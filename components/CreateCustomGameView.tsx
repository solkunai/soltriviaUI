import React, { useState, useMemo, useEffect } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { SystemProgram, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { createCustomGame, recordCustomGameFunding, efPost } from '../src/utils/api';
import {
  buildFundCustomGameIx,
  buildFundCustomGameSplIx,
  buildCreateCustomGameNftIx,
  buildCreateCustomGameTmPnftIx,
  fetchGameConfig,
} from '../src/utils/soltriviaContract';
import { getJupiterToken, looksLikeMintCA, type JupiterToken } from '../src/utils/jupiterTokens';
import { useWalletSPL } from '../src/hooks/useWalletSPL';
import { isAdminWallet } from '../src/utils/admin';
import {
  listDrafts,
  saveDraft as saveDraftToStorage,
  deleteDraft as deleteDraftFromStorage,
  clearDrafts as clearAllDrafts,
  newDraftId,
  type CustomGameDraft,
} from '../src/utils/customGameDrafts';
import CustomGameDraftsModal from './CustomGameDraftsModal';
import NFTSelector from './NFTSelector';
import type { WalletNFT } from '../src/hooks/useWalletNFTs';
import { supabase } from '../src/utils/supabase';
import { getRecentBlockhashWithRetry } from '../src/utils/rpc';
import {
  REVENUE_WALLET,
  CUSTOM_GAME_CREATION_FEE_LAMPORTS,
  CUSTOM_GAME_PLATFORM_FEE_LAMPORTS,
  CUSTOM_GAME_QUESTION_COUNTS,
  CUSTOM_GAME_TIME_LIMITS,
  CUSTOM_GAME_NAME_MAX,
  CUSTOM_GAME_QUESTION_TEXT_MAX,
  CUSTOM_GAME_OPTION_TEXT_MAX,
  CUSTOM_GAME_SLUG_MIN,
  CUSTOM_GAME_SLUG_MAX,
  VALID_ROUND_COUNTS,
  CUSTOM_GAME_ENTRY_FEE_PRESETS,
  CUSTOM_GAME_ENTRY_FEE_LABELS,
  CUSTOM_GAME_MIN_ENTRY_FEE,
  CUSTOM_GAME_MAX_ENTRY_FEE,
  CUSTOM_GAME_MAX_PLAYER_PRESETS,
  CUSTOM_GAME_MIN_PLAYERS,
  CUSTOM_GAME_MAX_PLAYERS,
  CUSTOM_GAME_MIN_DURATION_MINUTES,
  CUSTOM_GAME_MAX_DURATION_MINUTES,
  CUSTOM_GAME_DURATION_PRESETS,
  CUSTOM_GAME_MAX_ENTRIES_PRESETS,
  CUSTOM_GAME_WINNER_SPLITS,
  CUSTOM_GAME_WINNER_SPLIT_LABELS,
  CUSTOM_GAME_PLATFORM_CUT_BPS,
  TXN_FEE_LAMPORTS,
  CREATOR_FUNDED_MIN_PRIZE_LAMPORTS,
  CREATOR_FUNDED_MAX_PRIZE_LAMPORTS,
  CREATOR_FUNDED_PRIZE_PRESETS,
  CREATOR_FUNDED_PRIZE_LABELS,
} from '../src/utils/constants';

interface CreateCustomGameViewProps {
  hasGamePass: boolean;
  onGameCreated: (slug: string) => void;
  onBack: () => void;
}

interface QuestionDraft {
  questionText: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
}

type Step = 'settings' | 'prize' | 'questions' | 'review';
const ALL_STEPS: Step[] = ['settings', 'prize', 'questions', 'review'];

const CreateCustomGameView: React.FC<CreateCustomGameViewProps> = ({ hasGamePass, onGameCreated, onBack }) => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  // Step
  const [step, setStep] = useState<Step>('settings');

  // Settings
  const [gameName, setGameName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState<5 | 10 | 15>(10);
  const [roundCount, setRoundCount] = useState<number>(1);
  const [timeLimit, setTimeLimit] = useState<number>(15);

  // Prize Pool
  // Top-level game type the user picks first. Both Players Fund and Creator
  // Funds fan out to a token sub-picker (SOL / USDC / SPL). Creator Funds
  // additionally supports NFT. The legacy `prizeModel` is derived so downstream
  // submission stays unchanged for SOL paths.
  const [gameType, setGameType] = useState<'free' | 'players_fund' | 'creator_funds'>('free');

  // Admin-only "Featured by Sol Trivia" toggle. Only visible + togglable when
  // the connected wallet is in the admin allowlist (src/utils/admin.ts).
  // Server-side double-checked in create-custom-game EF v41+.
  const isAdmin = isAdminWallet(publicKey?.toBase58());
  const [isFeatured, setIsFeatured] = useState(false);
  const [playerFundTokenType, setPlayerFundTokenType] = useState<'sol' | 'usdc' | 'spl'>('sol');
  const [creatorPrizeType, setCreatorPrizeType] = useState<'sol' | 'usdc' | 'nft' | 'spl'>('sol');
  // SPL token resolution via Jupiter: user pastes a mint address, we auto-fetch
  // symbol + decimals + logo from Jupiter. Manual fallback inputs only show if
  // Jupiter doesn't have the token (rare, freshly-launched memecoins).
  const [customSplMint, setCustomSplMint] = useState('');
  const [jupiterToken, setJupiterToken] = useState<JupiterToken | null>(null);
  const [jupiterLoading, setJupiterLoading] = useState(false);
  const [jupiterError, setJupiterError] = useState<string | null>(null);
  const [manualDecimals, setManualDecimals] = useState<number>(6);
  const [manualSymbol, setManualSymbol] = useState('');

  // Mainnet USDC. Decimals are fixed per token; locked here so we don't depend
  // on a network call. Devnet equivalent (for future testing): 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU.
  const USDC_MAINNET_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  // Cache the last-resolved Jupiter token info (Kyle 2026-06-26 deeper fix).
  // jupiterToken can transiently flip to null on re-renders (e.g., a sibling
  // state change causes the Jupiter fetch effect to re-run during a brief
  // window where setJupiterToken(null) executes before the refetch completes).
  // Without this cache, selectedToken collapses to null mid-session, which
  // displays "1.20 SOL" instead of "1200 SKR" and (pre-safety-guard) could
  // have let a creator accidentally commit real SOL instead of an SPL token.
  // Cache is reset when customSplMint changes (user picked a different token).
  const [resolvedJupiterToken, setResolvedJupiterToken] = useState<JupiterToken | null>(null);
  useEffect(() => {
    // Mint changed -> reset cache so a previously-resolved token from a
    // different mint doesn't bleed into the new selection.
    setResolvedJupiterToken(null);
  }, [customSplMint]);
  useEffect(() => {
    // Persist whatever the latest valid Jupiter resolution is. Only updates
    // when jupiterToken is non-null; null transients leave cache intact.
    if (jupiterToken) setResolvedJupiterToken(jupiterToken);
  }, [jupiterToken]);

  // Auto-fetch token metadata from Jupiter when the pasted mint is a valid
  // base58 address. Debounced cancellation via the cancelled flag so a fast
  // typer doesn't see stale results from earlier requests.
  useEffect(() => {
    if (!customSplMint || !looksLikeMintCA(customSplMint)) {
      setJupiterToken(null);
      setJupiterError(null);
      setJupiterLoading(false);
      return;
    }
    let cancelled = false;
    setJupiterLoading(true);
    setJupiterError(null);
    getJupiterToken(customSplMint.trim())
      .then((tok) => {
        if (cancelled) return;
        if (tok) {
          setJupiterToken(tok);
          setJupiterError(null);
        } else {
          setJupiterToken(null);
          setJupiterError('Token not found on Jupiter. Enter decimals + symbol manually below.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setJupiterToken(null);
        setJupiterError('Failed to fetch token info: ' + (err?.message || 'unknown error'));
      })
      .finally(() => {
        if (!cancelled) setJupiterLoading(false);
      });
    return () => { cancelled = true; };
  }, [customSplMint]);

  // Wallet SPL holdings (only fetched when an SPL sub-picker is active — saves
  // a Helius proxy call for SOL/Free/Creator-SOL paths). Passing null disables
  // the hook's network request.
  const isSplSubPickActive = (gameType === 'players_fund' && playerFundTokenType === 'spl')
    || (gameType === 'creator_funds' && creatorPrizeType === 'spl');
  const { assets: walletSplAssets, status: walletSplStatus } = useWalletSPL(
    isSplSubPickActive && publicKey ? publicKey.toBase58() : null,
  );

  // Resolve the picked token from the (gameType, sub-pick) pair. Returns null
  // for SOL games / free games / NFT games (NFT is handled via selectedNft).
  // When non-null, the EF dispatches the SPL ix path.
  type SelectedToken = { mint: string; decimals: number; symbol: string } | null;
  const selectedToken: SelectedToken = (() => {
    const pick = gameType === 'players_fund' ? playerFundTokenType
      : gameType === 'creator_funds' ? creatorPrizeType
      : 'sol';
    if (pick === 'usdc') return { mint: USDC_MAINNET_MINT, decimals: 6, symbol: 'USDC' };
    if (pick === 'spl') {
      if (!customSplMint) return null;
      // Jupiter-resolved token is the source of truth when available. Falls
      // back to the cached last-resolved token (resolvedJupiterToken) if
      // jupiterToken is transiently null on this render — see the cache
      // useEffects above for why this can happen.
      const tokenInfo = jupiterToken ?? resolvedJupiterToken;
      if (tokenInfo) return {
        mint: tokenInfo.address,
        decimals: tokenInfo.decimals,
        symbol: tokenInfo.symbol,
      };
      // Manual fallback (only when Jupiter doesn't know the token).
      if (manualSymbol) return {
        mint: customSplMint.trim(),
        decimals: manualDecimals,
        symbol: manualSymbol.trim(),
      };
      return null;
    }
    return null;
  })();

  const prizeModel: 'free' | 'player_funded' | 'creator_funded' | 'nft_prize' =
    gameType === 'free' ? 'free'
    : gameType === 'players_fund' ? 'player_funded'
    : creatorPrizeType === 'nft' ? 'nft_prize'
    : 'creator_funded';

  const [entryFeeLamports, setEntryFeeLamports] = useState<number>(CUSTOM_GAME_ENTRY_FEE_PRESETS[1]); // 0.1 SOL default
  const [customEntryFee, setCustomEntryFee] = useState('');
  // Kyle 2026-06-24: maxPlayers can now be null = "No Max" (∞). Join EF already treats null/0 as no cap.
  const [maxPlayers, setMaxPlayers] = useState<number | null>(5);
  const [customMaxPlayers, setCustomMaxPlayers] = useState<string>('');
  const [gameDurationMinutes, setGameDurationMinutes] = useState<number>(15); // 15 min default (streamer/friends use case)
  // Custom duration input: number + M/H/D unit picker.
  const [customDurationValue, setCustomDurationValue] = useState<string>('');
  const [customDurationUnit, setCustomDurationUnit] = useState<'M' | 'H' | 'D'>('M');
  const [maxWinners, setMaxWinners] = useState<number>(3);
  // v44 re-entry settings. null max = unlimited (preserved default). When
  // allowReEntries=false, EF effectively caps at 1. Player-funded games:
  // each re-entry pays full entry fee and grows the pot.
  const [allowReEntries, setAllowReEntries] = useState<boolean>(true);
  const [maxEntriesPerPlayer, setMaxEntriesPerPlayer] = useState<number | null>(null);
  const [creatorDepositLamports, setCreatorDepositLamports] = useState<number>(CREATOR_FUNDED_PRIZE_PRESETS[2]); // 0.5 SOL default
  const [customCreatorDeposit, setCustomCreatorDeposit] = useState('');
  // NFT prize: the wallet asset that becomes the single-winner prize. Core or pNFT.
  const [selectedNft, setSelectedNft] = useState<WalletNFT | null>(null);

  // Questions
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);

  // State
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Drafts (localStorage per-wallet). currentDraftId tracks the slot the
  // wizard is editing so subsequent "Save Draft" presses overwrite in-place
  // instead of creating new entries.
  const [drafts, setDrafts] = useState<CustomGameDraft[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [draftsModalOpen, setDraftsModalOpen] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  // Load drafts whenever the connected wallet changes.
  useEffect(() => {
    if (!publicKey) {
      setDrafts([]);
      setCurrentDraftId(null);
      return;
    }
    setDrafts(listDrafts(publicKey.toBase58()));
  }, [publicKey]);

  // Clear ALL drafts for this wallet on successful game creation. createdSlug
  // becoming truthy is the canonical signal — covers both SOL and NFT paths.
  useEffect(() => {
    if (createdSlug && publicKey) {
      clearAllDrafts(publicKey.toBase58());
      setDrafts([]);
      setCurrentDraftId(null);
    }
  }, [createdSlug, publicKey]);

  // Valid round counts for selected question count
  const validRounds = useMemo(() => VALID_ROUND_COUNTS[questionCount] || [1], [questionCount]);

  // Prize calculations. For SPL games, all amounts are in the selected token's
  // base units (10^decimals). For SOL games, base units == lamports (10^9).
  const isPaid = prizeModel === 'player_funded' || prizeModel === 'creator_funded';
  const isCreatorFunded = prizeModel === 'creator_funded';
  const isNftPrize = prizeModel === 'nft_prize';
  const isSplGame = isPaid && !!selectedToken;
  const activeDecimals = selectedToken?.decimals ?? 9;
  const activeSymbol = selectedToken?.symbol ?? 'SOL';
  const baseUnitMultiplier = Math.pow(10, activeDecimals);
  const activeEntryFee = customEntryFee
    ? Math.round(parseFloat(customEntryFee) * baseUnitMultiplier)
    : (isSplGame ? 0 : entryFeeLamports);
  const activeCreatorDeposit = customCreatorDeposit
    ? Math.round(parseFloat(customCreatorDeposit) * baseUnitMultiplier)
    : (isSplGame ? 0 : creatorDepositLamports);
  // For paid games with "No Max" (maxPlayers === null), the pot grows with
  // entries — we show 0 as the placeholder estimate (UI hint: "grows w/ players").
  const estimatedPot = isCreatorFunded ? activeCreatorDeposit : (isPaid ? activeEntryFee * (maxPlayers ?? 0) : 0);
  // Contract takes 0% from creator-funded games — winners receive the full deposit.
  const platformCut = isCreatorFunded ? 0 : Math.floor(estimatedPot * CUSTOM_GAME_PLATFORM_CUT_BPS / 10000);
  const prizePot = estimatedPot - platformCut;
  const winnerSplitBps = CUSTOM_GAME_WINNER_SPLITS[maxWinners];
  const winnerAmounts = winnerSplitBps.filter((b: number) => b > 0).map((b: number) => Math.floor(prizePot * b / 10000));
  // Format a base-units amount back to a human-readable string in the selected token.
  const formatAmount = (baseUnits: number): string => (baseUnits / baseUnitMultiplier).toFixed(Math.min(activeDecimals, 4));

  // Live USD value for SPL games (Jupiter returns usdPrice on the resolved
  // token). Returns null for SOL games / free games / when Jupiter doesn't
  // know the token's price. Display is approximate (price moves at view time).
  const tokenUsdPrice = jupiterToken?.usdPrice ?? null;
  const formatUsd = (baseUnits: number): string | null => {
    if (!isSplGame || !tokenUsdPrice || baseUnits <= 0) return null;
    const tokenAmount = baseUnits / baseUnitMultiplier;
    const usd = tokenAmount * tokenUsdPrice;
    if (usd > 0 && usd < 0.01) return '< $0.01';
    if (usd < 1000) return `≈ $${usd.toFixed(2)}`;
    if (usd < 1_000_000) return `≈ $${(usd / 1000).toFixed(2)}k`;
    return `≈ $${(usd / 1_000_000).toFixed(2)}M`;
  };

  // Reset round count if invalid for new question count
  const handleQuestionCountChange = (count: 5 | 10 | 15) => {
    setQuestionCount(count);
    const valid = VALID_ROUND_COUNTS[count] || [1];
    if (!valid.includes(roundCount)) {
      setRoundCount(valid[0]);
    }
  };

  // ── Drafts ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  // Snapshot the current wizard state into a draft. Same `currentDraftId`
  // overwrites the slot in-place; null creates a new slot (FIFO drop oldest).
  // Banner file + selected NFT are intentionally omitted (see customGameDrafts.ts).
  const handleSaveDraft = () => {
    if (!publicKey) {
      setError('Connect your wallet to save drafts.');
      return;
    }
    const id = currentDraftId ?? newDraftId();
    const now = Date.now();
    const snapshot: CustomGameDraft = {
      id,
      walletAddress: publicKey.toBase58(),
      savedAt: now,
      step,
      gameName,
      customSlug,
      questionCount,
      roundCount,
      timeLimit,
      gameType,
      playerFundTokenType,
      creatorPrizeType,
      customSplMint,
      manualSymbol,
      manualDecimals,
      entryFeeLamports,
      customEntryFee,
      maxPlayers,
      gameDurationMinutes,
      maxWinners,
      allowReEntries,
      maxEntriesPerPlayer,
      creatorDepositLamports,
      customCreatorDeposit,
      questions,
    };
    saveDraftToStorage(snapshot);
    setCurrentDraftId(id);
    setDraftSavedAt(now);
    setDrafts(listDrafts(publicKey.toBase58()));
  };

  const handleRestoreDraft = (d: CustomGameDraft) => {
    setStep(d.step);
    setGameName(d.gameName);
    setCustomSlug(d.customSlug);
    setQuestionCount(d.questionCount);
    setRoundCount(d.roundCount);
    setTimeLimit(d.timeLimit);
    setGameType(d.gameType);
    setPlayerFundTokenType(d.playerFundTokenType);
    setCreatorPrizeType(d.creatorPrizeType);
    setCustomSplMint(d.customSplMint);
    setManualSymbol(d.manualSymbol);
    setManualDecimals(d.manualDecimals);
    setEntryFeeLamports(d.entryFeeLamports);
    setCustomEntryFee(d.customEntryFee);
    setMaxPlayers(d.maxPlayers);
    setGameDurationMinutes(d.gameDurationMinutes);
    setMaxWinners(d.maxWinners);
    setAllowReEntries(d.allowReEntries ?? true);
    setMaxEntriesPerPlayer(d.maxEntriesPerPlayer ?? null);
    setCreatorDepositLamports(d.creatorDepositLamports);
    setCustomCreatorDeposit(d.customCreatorDeposit);
    setQuestions(d.questions);
    setCurrentDraftId(d.id);
    setDraftsModalOpen(false);
    setError(null);
    setDraftSavedAt(d.savedAt);
  };

  const handleDeleteDraft = (draftId: string) => {
    if (!publicKey) return;
    const remaining = deleteDraftFromStorage(publicKey.toBase58(), draftId);
    setDrafts(remaining);
    if (currentDraftId === draftId) setCurrentDraftId(null);
  };

  // Fee (creation fee for the game itself — separate from entry fee)
  const creationFeeLamports = hasGamePass
    ? CUSTOM_GAME_PLATFORM_FEE_LAMPORTS
    : CUSTOM_GAME_CREATION_FEE_LAMPORTS + CUSTOM_GAME_PLATFORM_FEE_LAMPORTS;
  const creationFeeSol = creationFeeLamports / 1_000_000_000;

  // Custom entry fee validation
  const handleCustomFeeChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    setCustomEntryFee(cleaned);
  };
  // SOL min/max only applies to SOL games. SPL games just require positive amount
  // (USD-pegged limits would need a price oracle, deferred).
  const isCustomFeeValid = !customEntryFee || (
    isSplGame
      ? parseFloat(customEntryFee) > 0
      : (parseFloat(customEntryFee) >= CUSTOM_GAME_MIN_ENTRY_FEE / 1_000_000_000 &&
         parseFloat(customEntryFee) <= CUSTOM_GAME_MAX_ENTRY_FEE / 1_000_000_000)
  );

  // Creator deposit validation
  const handleCustomDepositChange = (val: string) => {
    const cleaned = val.replace(/[^0-9.]/g, '');
    setCustomCreatorDeposit(cleaned);
  };
  const isCustomDepositValid = !customCreatorDeposit || (
    isSplGame
      ? parseFloat(customCreatorDeposit) > 0
      : (parseFloat(customCreatorDeposit) >= CREATOR_FUNDED_MIN_PRIZE_LAMPORTS / 1_000_000_000 &&
         parseFloat(customCreatorDeposit) <= CREATOR_FUNDED_MAX_PRIZE_LAMPORTS / 1_000_000_000)
  );

  // Navigate: settings → prize
  const goToPrize = () => {
    if (!gameName.trim()) { setError('Game name is required'); return; }
    if (gameName.trim().length > CUSTOM_GAME_NAME_MAX) { setError(`Game name max ${CUSTOM_GAME_NAME_MAX} chars`); return; }
    if (customSlug && (customSlug.length < CUSTOM_GAME_SLUG_MIN || customSlug.length > CUSTOM_GAME_SLUG_MAX)) {
      setError(`Slug must be ${CUSTOM_GAME_SLUG_MIN}-${CUSTOM_GAME_SLUG_MAX} characters`); return;
    }
    if (customSlug && !/^[a-z0-9-]+$/.test(customSlug)) {
      setError('Slug can only contain lowercase letters, numbers, and hyphens'); return;
    }
    setError(null);
    setStep('prize');
  };

  // Navigate: prize → questions
  const goToQuestions = () => {
    if (isPaid) {
      // SPL games: validate the SPL token info before checking amounts.
      if (isSplGame) {
        if (!selectedToken?.mint || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(selectedToken.mint)) {
          setError('Paste a valid SPL token mint address');
          return;
        }
        if (activeDecimals < 0 || activeDecimals > 9) {
          setError('Token decimals must be between 0 and 9');
          return;
        }
      }
      if (isCreatorFunded) {
        if (!isCustomDepositValid) {
          setError(isSplGame
            ? `Prize deposit must be > 0 ${activeSymbol}`
            : 'Prize deposit must be between 0.05 and 100 SOL');
          return;
        }
        if (!isSplGame && activeCreatorDeposit < CREATOR_FUNDED_MIN_PRIZE_LAMPORTS) {
          setError('Minimum prize deposit is 0.05 SOL');
          return;
        }
        if (isSplGame && activeCreatorDeposit <= 0) {
          setError(`Enter a creator deposit amount in ${activeSymbol}`);
          return;
        }
      } else {
        if (!isCustomFeeValid) {
          setError(isSplGame
            ? `Entry fee must be > 0 ${activeSymbol}`
            : 'Entry fee must be between 0.01 and 10 SOL');
          return;
        }
        if (!isSplGame && activeEntryFee < CUSTOM_GAME_MIN_ENTRY_FEE) {
          setError('Minimum entry fee is 0.01 SOL');
          return;
        }
        if (isSplGame && activeEntryFee <= 0) {
          setError(`Enter an entry fee amount in ${activeSymbol}`);
          return;
        }
      }
      // maxPlayers === null = "No Max" (∞), skip min check. Otherwise enforce min.
      if (maxPlayers !== null && maxPlayers < CUSTOM_GAME_MIN_PLAYERS) { setError(`Minimum ${CUSTOM_GAME_MIN_PLAYERS} players`); return; }
    }
    // Duration validation applies to ALL game types (free + paid).
    if (gameDurationMinutes < CUSTOM_GAME_MIN_DURATION_MINUTES) {
      setError(`Minimum game duration is ${CUSTOM_GAME_MIN_DURATION_MINUTES} minutes`); return;
    }
    if (gameDurationMinutes > CUSTOM_GAME_MAX_DURATION_MINUTES) {
      setError(`Maximum game duration is 30 days`); return;
    }
    if (isNftPrize) {
      if (!selectedNft) { setError('Pick an NFT prize from your wallet first'); return; }
      if (selectedNft.standard !== 'core' && selectedNft.standard !== 'pnft') {
        setError('Only Core and pNFT standards are supported as prizes. The legacy NFT format isn\'t escrow-compatible.'); return;
      }
    }
    setError(null);

    // Initialize empty questions if needed
    if (questions.length !== questionCount) {
      const newQuestions: QuestionDraft[] = Array.from({ length: questionCount }, (_, i) =>
        questions[i] || { questionText: '', options: ['', '', '', ''], correctIndex: 0 as const }
      );
      setQuestions(newQuestions);
      setCurrentQIdx(0);
    }
    setStep('questions');
  };

  // Update current question
  const updateQuestion = (field: string, value: any) => {
    const updated = [...questions];
    if (field === 'questionText') {
      updated[currentQIdx] = { ...updated[currentQIdx], questionText: value };
    } else if (field === 'correctIndex') {
      updated[currentQIdx] = { ...updated[currentQIdx], correctIndex: value };
    } else if (field.startsWith('option')) {
      const optIdx = parseInt(field.replace('option', ''));
      const opts = [...updated[currentQIdx].options] as [string, string, string, string];
      opts[optIdx] = value;
      updated[currentQIdx] = { ...updated[currentQIdx], options: opts };
    }
    setQuestions(updated);
  };

  // Validate single question
  const isQuestionValid = (q: QuestionDraft): boolean => {
    return q.questionText.trim().length > 0 &&
      q.options.every(o => o.trim().length > 0) &&
      q.correctIndex >= 0 && q.correctIndex <= 3;
  };

  // All questions valid
  const allQuestionsValid = questions.length === questionCount && questions.every(isQuestionValid);

  const goToReview = () => {
    if (!allQuestionsValid) {
      setError('All questions must be filled out with all 4 options and a correct answer marked');
      return;
    }
    setError(null);
    setStep('review');
  };

  // Create game (payment + API)
  const handleCreate = async () => {
    if (!publicKey || creating) return;
    setCreating(true);
    setError(null);

    // ── NFT prize branch: bypass EF, submit the on-chain create_custom_game_nft
    // (or TmPnft) ix directly. Creator wallet signs to escrow the NFT into the
    // program-owned escrow PDA. The Supabase metadata insertion for NFT games
    // is a backend-agent task (extend createCustomGame EF to accept nft fields).
    if (isNftPrize) {
      try {
        if (!selectedNft) throw new Error('No NFT selected');
        if (selectedNft.standard !== 'core' && selectedNft.standard !== 'pnft') {
          throw new Error('Only Core and pNFT standards are supported as prizes.');
        }

        // 1. Read on-chain config to know what game_id will be assigned.
        const cfg = await fetchGameConfig(connection);
        if (!cfg) throw new Error('GameConfig not initialized on-chain.');
        const nextGameId = cfg.nextCustomGameId;

        // 2. Build the NFT-create ix matching the selected standard.
        const nowSec = Math.floor(Date.now() / 1000);
        const expiresAtUnix = nowSec + Math.max(60, gameDurationMinutes * 60);
        const nftMintPk = new PublicKey(selectedNft.mint);

        // Creator-funded NFT prize: entries are ALWAYS free for players.
        // Creator already locks the prize (the NFT); charging extra entry fees
        // on top would double-bill players, which doesn't match the design.
        const nftCreateIx = selectedNft.standard === 'core'
          ? buildCreateCustomGameNftIx({
              creator: publicKey,
              nextGameId,
              coreNftAsset: nftMintPk,
              entryFeeLamports: 0,
              expiresAtUnix,
              platformCutBps: CUSTOM_GAME_PLATFORM_CUT_BPS,
            })
          : buildCreateCustomGameTmPnftIx({
              creator: publicKey,
              nextGameId,
              nftMint: nftMintPk,
              // Token records / auth rules are only required for pNFTs with
              // auth-rules sets. Most pNFTs (Mad Lads, DeGods) DO use them;
              // for an MVP we let the user retry if the tx fails (the error
              // surfaces the missing accounts). Future polish: derive automatically.
              entryFeeLamports: 0,
              expiresAtUnix,
              platformCutBps: CUSTOM_GAME_PLATFORM_CUT_BPS,
            });

        // 3. Also charge the SOL creation fee (separate tx — same as the
        // non-NFT flow expects). For NFT games we bundle creation fee + NFT
        // escrow into one tx to avoid 2 wallet popups.
        const creationFeeIx = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(REVENUE_WALLET),
          lamports: creationFeeLamports,
        });

        const { blockhash } = await getRecentBlockhashWithRetry(connection);
        const message = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: [creationFeeIx, nftCreateIx],
        }).compileToV0Message();
        const tx = new VersionedTransaction(message);
        const sig = await sendTransaction(tx, connection);
        await Promise.race([
          connection.confirmTransaction(sig, 'confirmed'),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Confirmation timeout')), 30000)),
        ]);

        // Insert the Supabase metadata row via create-custom-game EF (v37+).
        // The EF re-reads the on-chain custom_game_nft PDA on the right cluster
        // and verifies it matches (creator + nftMint + standard) before insert.
        // If verification fails or the row doesn't insert, the on-chain game
        // remains safely escrowed and reclaimable by the creator after expiry.
        const cluster = (import.meta.env.VITE_SOLANA_NETWORK as string | undefined) === 'devnet'
          ? 'devnet'
          : 'mainnet-beta';
        const efPayload = {
          cluster,
          walletAddress: publicKey.toBase58(),
          name: gameName.trim(),
          slug: customSlug.trim() || undefined,
          questionCount,
          roundCount,
          timeLimitSeconds: timeLimit,
          questions: questions.map((q) => ({
            questionText: q.questionText,
            options: q.options,
            correctIndex: q.correctIndex,
          })),
          contentDisclaimerAccepted: true,
          txSignature: sig,
          prizeModel: 'nft' as const,
          nftMint: selectedNft.mint,
          nftStandard: selectedNft.standard,
          onChainGameId: Number(nextGameId),
          nftEntryFeeLamports: 0,
          nftExpiresAt: Number(expiresAtUnix),
        };

        // Use efPost (shared helper). It throws on non-2xx with the EF's
        // actual error string surfaced as err.message — no FunctionsHttpError
        // opaque wrapping to unpack.
        try {
          const efData = await efPost<{ success: boolean; slug?: string; game_id?: string }>(
            'create-custom-game',
            efPayload,
          );
          setCreatedSlug(efData.slug || `nft-game-${nextGameId}`);
          return;
        } catch (efErr: any) {
          const errMsg = efErr?.message || 'unknown error';
          console.error('NFT EF call failed:', errMsg, efErr);
          setError(
            `Game created on-chain (id ${nextGameId}) and your NFT is escrowed safely, ` +
            `but the lobby row failed to insert: ${errMsg}. ` +
            `Your NFT can be reclaimed after expiry. Tx: ${sig.slice(0, 8)}…`,
          );
          setCreatedSlug(`nft-game-${nextGameId}`);
          return;
        }
      } catch (err: any) {
        console.error('NFT custom game create failed:', err);
        const msg = err?.message?.includes('User rejected') || err?.message?.includes('user reject')
          ? 'Transaction cancelled.'
          : err?.message || 'Failed to create NFT custom game.';
        setError(msg);
        return;
      } finally {
        setCreating(false);
      }
    }

    try {
      // Build payment tx
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const instructions = [
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(REVENUE_WALLET),
          lamports: creationFeeLamports,
        }),
      ];

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      await Promise.race([
        connection.confirmTransaction(signature, 'confirmed'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)),
      ]);

      // Call Edge Function
      const params: any = {
        walletAddress: publicKey.toBase58(),
        txSignature: signature,
        name: gameName.trim(),
        slug: customSlug.trim() || undefined,
        questionCount: questionCount as 5 | 10 | 15,
        roundCount,
        timeLimitSeconds: timeLimit,
        questions: questions.map(q => ({
          questionText: q.questionText.trim(),
          options: q.options.map(o => o.trim()) as [string, string, string, string],
          correctIndex: q.correctIndex,
        })),
        contentDisclaimerAccepted: true,
      };

      // Admin-only "Featured by Sol Trivia" flag. EF v41+ rejects this from
      // non-admin wallets; the toggle is hidden on the client too.
      if (isAdmin && isFeatured) {
        params.isFeatured = true;
      }

      // v44: re-entry cap settings (applies to all game types, not just paid)
      params.allowReEntries = allowReEntries;
      params.maxEntriesPerPlayer = maxEntriesPerPlayer;

      // Add prize pool fields for paid games
      if (isPaid) {
        params.prizeModel = isCreatorFunded ? 'creator_funded' : 'player_funded';
        params.maxPlayers = maxPlayers;
        params.gameDurationMinutes = gameDurationMinutes;
        params.maxWinners = maxWinners;
        if (isCreatorFunded) {
          params.creatorDepositLamports = activeCreatorDeposit;
        } else {
          params.entryFeeLamports = activeEntryFee;
        }
        // SPL multi-token: when a non-SOL token is selected, the EF dispatches
        // create_custom_game_spl instead of create_custom_game. The *_lamports
        // fields above now hold base units of the selected token.
        if (isSplGame && selectedToken) {
          params.tokenMint = selectedToken.mint;
          params.tokenDecimals = selectedToken.decimals;
          params.tokenSymbol = selectedToken.symbol;
          // tokenProgram defaults to classic SPL Token server-side; pass the
          // Token-2022 program ID explicitly for 2022 mints (none of USDC/BONK
          // need this today). Future: auto-detect via mint.owner.
        }
      }

      // Upload banner if provided
      if (bannerFile) {
        try {
          const ext = bannerFile.name.split('.').pop() || 'png';
          const path = `${publicKey.toBase58()}/${Date.now()}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from('game-banners').upload(path, bannerFile, { contentType: bannerFile.type, upsert: false });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('game-banners').getPublicUrl(path);
            if (urlData?.publicUrl) params.bannerUrl = urlData.publicUrl;
          }
        } catch (_) { /* banner upload failed silently — game still creates fine */ }
      }

      const result = await createCustomGame(params);

      // For creator-funded games, immediately chain the prize-pool deposit so the
      // game is fully funded as part of creation. Wallet pops up a second time.
      // SOL path: buildFundCustomGameIx. SPL path: buildFundCustomGameSplIx.
      if (isCreatorFunded && result.on_chain_game_id != null && activeCreatorDeposit > 0) {
        try {
          const { blockhash: fundBlockhash } = await getRecentBlockhashWithRetry(connection);
          const fundIx = isSplGame && selectedToken
            ? buildFundCustomGameSplIx({
                creator: publicKey,
                gameId: result.on_chain_game_id,
                mint: new PublicKey(selectedToken.mint),
                amount: activeCreatorDeposit,
              })
            : buildFundCustomGameIx(publicKey, result.on_chain_game_id, activeCreatorDeposit);
          const fundMessage = new TransactionMessage({
            payerKey: publicKey,
            recentBlockhash: fundBlockhash,
            instructions: [fundIx],
          }).compileToV0Message();
          const fundTx = new VersionedTransaction(fundMessage);
          const fundSig = await sendTransaction(fundTx, connection);

          await Promise.race([
            connection.confirmTransaction(fundSig, 'confirmed'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Fund transaction confirmation timeout')), 30000)),
          ]);

          await recordCustomGameFunding(
            result.game_id,
            publicKey.toBase58(),
            fundSig,
            activeCreatorDeposit,
          );
        } catch (fundErr: any) {
          console.error('Prize pool funding failed after create:', fundErr);
          // Game exists in DB and on-chain but is unfunded. Lobby has a recovery
          // path: creator can re-attempt funding via the Fund Prize Pool button.
          const userRejected = fundErr.message?.includes('User rejected') || fundErr.message?.includes('user reject');
          setError(
            userRejected
              ? 'Game created, but prize pool funding was cancelled. Open the game lobby to fund it.'
              : 'Game created, but prize pool funding failed. Open the game lobby to retry funding. Details: ' + (fundErr.message || 'Unknown error'),
          );
          // Still surface the success screen so the creator can navigate to the lobby.
          setCreatedSlug(result.slug);
          return;
        }
      }

      setCreatedSlug(result.slug);
    } catch (err: any) {
      console.error('Failed to create custom game:', err);
      setError(err.message || 'Failed to create game');
    } finally {
      setCreating(false);
    }
  };

  // Success screen
  if (createdSlug) {
    const shareUrl = `${window.location.origin}/game/${createdSlug}`;
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center max-w-md w-full">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#38BDF8]/10 border border-[#38BDF8]/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-[#38BDF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-3xl font-[1000] italic text-white uppercase mb-2">Game Created!</h2>
          <p className="text-zinc-400 text-sm mb-6">Share the link with your friends</p>

          <div className="bg-[#0A0A0A] border border-white/10 rounded-xl p-4 mb-6">
            <p className="text-[#38BDF8] text-sm font-mono break-all">{shareUrl}</p>
          </div>

          <div className="flex gap-3 mb-4">
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
              }}
              className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-xs tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={() => {
                const text = isCreatorFunded
                  ? `just dropped ${(activeCreatorDeposit / 1_000_000_000).toFixed(2)} SOL on a trivia game on @soltrivia_app\n\n"${gameName}" | FREE entry, real prizes\n\nthink you're smart enough to win?\n\n${shareUrl}`
                  : isPaid
                  ? `just dropped a prize pool trivia game on @soltrivia_app\n\n"${gameName}" | entry: ${(activeEntryFee / 1_000_000_000).toFixed(2)} SOL\n\nthink you're smart enough to win? ape in\n\n${shareUrl}`
                  : `just created "${gameName}" on @soltrivia_app\n\nfree trivia game, harder than it looks\n\nprove you're not ngmi\n\n${shareUrl}`;
                window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
              }}
              className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-xs tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Share on X
            </button>
          </div>

          <button
            onClick={() => onGameCreated(createdSlug)}
            className="w-full min-h-[48px] px-6 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
          >
            Go to Game
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative">
      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => {
            const idx = ALL_STEPS.indexOf(step);
            if (idx <= 0) onBack();
            else setStep(ALL_STEPS[idx - 1]);
          }} className="text-zinc-500 hover:text-zinc-300 font-black uppercase text-[10px] tracking-wider transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="flex items-center gap-2">
            {ALL_STEPS.map((s, i) => {
              const currentIdx = ALL_STEPS.indexOf(step);
              const isDone = i < currentIdx;
              const isActive = step === s;
              return (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center rounded-md transition-all"
                    style={{
                      width: 36,
                      height: 22,
                      background: isDone ? 'rgba(56,189,248,0.55)' : isActive ? '#38BDF8' : 'rgba(255,255,255,0.06)',
                      border: `1px solid ${isDone ? 'rgba(56,189,248,0.7)' : isActive ? '#38BDF8' : 'rgba(255,255,255,0.10)'}`,
                    }}
                  >
                    {isDone ? (
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <path d="M3 7L6 10L11 4" stroke="#0a0a0a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <span
                        className="font-black italic tabular-nums"
                        style={{
                          fontSize: 11,
                          color: isActive ? '#0a0a0a' : '#71717a',
                          fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
                          fontWeight: 900,
                        }}
                      >
                        {i + 1}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <p className="text-[#38BDF8] text-[9px] font-black uppercase tracking-[0.4em]">
            STEP {ALL_STEPS.indexOf(step) + 1} OF {ALL_STEPS.length} · Create Custom Game
          </p>
          <div className="flex items-center gap-1.5">
            {drafts.length > 0 && (
              <button
                onClick={() => setDraftsModalOpen(true)}
                className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 font-black uppercase text-[9px] tracking-wider transition-colors"
              >
                Drafts ({drafts.length})
              </button>
            )}
            {step !== 'review' && publicKey && (
              <button
                onClick={handleSaveDraft}
                className="px-2.5 py-1 rounded-md bg-[#38BDF8]/10 border border-[#38BDF8]/25 text-[#38BDF8] hover:bg-[#38BDF8]/15 font-black uppercase text-[9px] tracking-wider transition-colors flex items-center gap-1.5"
                title="Save current progress as a draft to resume later"
              >
                {draftSavedAt && Date.now() - draftSavedAt < 4000 ? (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    Saved
                  </>
                ) : (
                  'Save Draft'
                )}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-xs font-black">{error}</p>
          </div>
        )}

        {/* STEP 1: Settings */}
        {step === 'settings' && (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-4xl font-[1000] italic text-white uppercase tracking-tighter">Game Settings</h2>

            {/* Admin-only: FEATURED BY SOL TRIVIA toggle. Shown only when the
                connected wallet is in the allowlist. Server-side double-checked
                in create-custom-game EF v41+. */}
            {isAdmin && (
              <div
                className="rounded-2xl p-4 flex items-center gap-4"
                style={{
                  background: isFeatured
                    ? 'linear-gradient(135deg,#FFD700 0%,#FFC107 100%)'
                    : 'linear-gradient(135deg,rgba(255,215,0,0.18) 0%,rgba(255,193,7,0.12) 100%)',
                  border: `2px solid ${isFeatured ? '#FFD700' : 'rgba(255,215,0,0.55)'}`,
                  boxShadow: isFeatured
                    ? '0 18px 40px -18px rgba(255,215,0,0.85)'
                    : '0 14px 30px -18px rgba(255,215,0,0.45)',
                  transition: 'background 120ms ease, border 120ms ease',
                }}
              >
                <div
                  className="flex items-center justify-center shrink-0"
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: isFeatured ? '#000' : 'rgba(0,0,0,0.45)',
                    color: '#FFD700',
                    fontSize: 22,
                    fontWeight: 900,
                  }}
                >
                  ★
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="font-black italic uppercase"
                    style={{ color: isFeatured ? '#000' : '#FFD700', fontSize: 15, letterSpacing: '0.06em', lineHeight: 1.05 }}
                  >
                    Featured by Sol Trivia
                  </div>
                  <p
                    className="mt-1"
                    style={{ color: isFeatured ? 'rgba(0,0,0,0.7)' : 'rgba(255,215,0,0.78)', fontSize: 11, fontWeight: 700, lineHeight: 1.35 }}
                  >
                    Render this game in the swipeable Featured strip on the Custom Games hub. Admin-only.
                  </p>
                </div>
                <button
                  onClick={() => setIsFeatured(v => !v)}
                  aria-pressed={isFeatured}
                  className="shrink-0"
                  style={{
                    width: 56,
                    height: 32,
                    borderRadius: 999,
                    background: isFeatured ? '#000' : 'rgba(0,0,0,0.25)',
                    border: `2px solid ${isFeatured ? '#000' : 'rgba(0,0,0,0.45)'}`,
                    padding: 2,
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'background 120ms ease, border 120ms ease',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: isFeatured ? '#FFD700' : '#FFFFFF',
                      transform: `translateX(${isFeatured ? 24 : 0}px)`,
                      transition: 'transform 140ms ease, background 120ms ease',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                    }}
                  />
                </button>
              </div>
            )}

            {/* Game Name */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Game Name *</label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value.slice(0, CUSTOM_GAME_NAME_MAX))}
                placeholder="My Trivia Night"
                className="w-full min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
              />
              <p className="text-zinc-700 text-[10px] mt-1">{gameName.length}/{CUSTOM_GAME_NAME_MAX}</p>
            </div>

            {/* Custom Slug */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Custom Link (optional)</label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-600 text-xs font-mono shrink-0">soltrivia.app/game/</span>
                <input
                  type="text"
                  value={customSlug}
                  onChange={(e) => setCustomSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, CUSTOM_GAME_SLUG_MAX))}
                  placeholder="auto-generated"
                  className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
                />
              </div>
            </div>

            {/* Banner Image */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Banner Image (optional)</label>
              {bannerPreview ? (
                <div className="relative mb-2">
                  <img src={bannerPreview} alt="Banner preview" className="w-full h-32 md:h-40 object-cover rounded-xl border border-white/10" />
                  <button
                    onClick={() => { setBannerFile(null); setBannerPreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-28 bg-white/5 border border-dashed border-white/10 rounded-xl cursor-pointer hover:bg-white/[0.07] transition-colors">
                  <svg className="w-8 h-8 text-zinc-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="text-zinc-600 text-[10px] font-bold uppercase">Upload banner</span>
                  <span className="text-zinc-700 text-[9px] mt-0.5">PNG, JPG up to 2MB</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) { setError('Banner must be under 2MB'); return; }
                      setBannerFile(file);
                      setBannerPreview(URL.createObjectURL(file));
                    }}
                  />
                </label>
              )}
              <p className="text-zinc-700 text-[10px] mt-1">Shows on your game lobby and share links</p>
            </div>

            {/* Content Disclaimer — bold so it actually gets read. */}
            <div
              className="rounded-2xl p-4 flex items-start gap-3"
              style={{
                background: 'linear-gradient(135deg,rgba(245,158,11,0.14) 0%,rgba(255,107,53,0.10) 100%)',
                border: '1.5px solid rgba(245,158,11,0.55)',
                boxShadow: '0 14px 30px -18px rgba(245,158,11,0.45)',
              }}
            >
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#F59E0B',
                  color: '#000',
                  fontSize: 18,
                  fontWeight: 900,
                }}
              >
                !
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-black italic uppercase"
                  style={{ color: '#F59E0B', fontSize: 12, letterSpacing: '0.14em', lineHeight: 1 }}
                >
                  Content Agreement
                </div>
                <p
                  className="mt-1.5"
                  style={{ color: 'rgba(255,233,170,0.92)', fontSize: 11, fontWeight: 600, lineHeight: 1.45 }}
                >
                  By creating a game, you agree that inappropriate, offensive, or disrespectful content violates our <span style={{ color: '#FBBF24', textDecoration: 'underline' }}>Terms of Service</span>. Sol Trivia reserves the right to ban games and creators without notice. Funds tied to banned games may not be recoverable.
                </p>
              </div>
            </div>

            {/* Question Count */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Questions</label>
              <div className="flex gap-2">
                {CUSTOM_GAME_QUESTION_COUNTS.map((count) => (
                  <button
                    key={count}
                    onClick={() => handleQuestionCountChange(count)}
                    className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-lg transition-all active:scale-[0.98] ${questionCount === count ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>

            {/* Round Count */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Rounds</label>
              <div className="flex gap-2 flex-wrap">
                {validRounds.map((count) => (
                  <button
                    key={count}
                    onClick={() => setRoundCount(count)}
                    className={`min-w-[44px] min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-lg transition-all active:scale-[0.98] ${roundCount === count ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <p className="text-zinc-700 text-[10px] mt-1">{questionCount / roundCount} questions per round</p>
            </div>

            {/* Time Limit */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Time per Question</label>
              <div className="flex gap-2">
                {CUSTOM_GAME_TIME_LIMITS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTimeLimit(t)}
                    className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-lg transition-all active:scale-[0.98] ${timeLimit === t ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {t}s
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={goToPrize}
              className="w-full min-h-[48px] px-6 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
            >
              Next: Prize Pool
            </button>
          </div>
        )}

        {/* STEP 2: Prize Pool */}
        {step === 'prize' && (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-4xl font-[1000] italic text-white uppercase tracking-tighter">Prize Pool</h2>

            {/* Game Type Toggle */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Game Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setGameType('free')}
                  className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${gameType === 'free' ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                >
                  Free
                </button>
                <button
                  onClick={() => setGameType('players_fund')}
                  className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${gameType === 'players_fund' ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                >
                  Players Fund
                </button>
                <button
                  onClick={() => setGameType('creator_funds')}
                  className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${gameType === 'creator_funds' ? 'bg-amber-500 text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                >
                  Creator Funds
                </button>
              </div>

              {/* Players-Fund sub-picker: SOL / USDC / SPL (no NFT — players can't escrow NFTs) */}
              {gameType === 'players_fund' && (
                <div className="mt-3">
                  <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Entry Token</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => setPlayerFundTokenType('sol')}
                      className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${playerFundTokenType === 'sol' ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      SOL
                    </button>
                    <button
                      onClick={() => setPlayerFundTokenType('usdc')}
                      className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${playerFundTokenType === 'usdc' ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      USDC
                    </button>
                    <button
                      onClick={() => setPlayerFundTokenType('spl')}
                      className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${playerFundTokenType === 'spl' ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      SPL
                    </button>
                  </div>
                </div>
              )}

              {/* Creator-Funds sub-picker: SOL / USDC / NFT / SPL */}
              {gameType === 'creator_funds' && (
                <div className="mt-3">
                  <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Prize Type</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      onClick={() => setCreatorPrizeType('sol')}
                      className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${creatorPrizeType === 'sol' ? 'bg-amber-500 text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      SOL
                    </button>
                    <button
                      onClick={() => setCreatorPrizeType('usdc')}
                      className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${creatorPrizeType === 'usdc' ? 'bg-amber-500 text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      USDC
                    </button>
                    <button
                      onClick={() => setCreatorPrizeType('nft')}
                      className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${creatorPrizeType === 'nft' ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      NFT
                    </button>
                    <button
                      onClick={() => setCreatorPrizeType('spl')}
                      className={`min-h-[44px] px-3 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${creatorPrizeType === 'spl' ? 'bg-amber-500 text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      SPL
                    </button>
                  </div>
                </div>
              )}

              {/* Custom SPL mint input + Jupiter auto-resolve (visible when EITHER
                  sub-picker is set to 'spl'). Wallet holdings list above the
                  paste input so the user can one-tap fill from their own bag.
                  Manual fallback for unverified tokens only renders if Jupiter
                  doesn't know the mint. */}
              {isSplSubPickActive && (
                <div className="mt-3 rounded-xl bg-white/[0.03] border border-white/5 p-3 space-y-3">
                  {/* WALLET HOLDINGS LIST , click to auto-fill */}
                  <div>
                    <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Tokens in Your Wallet</label>
                    {!publicKey ? (
                      <p className="text-zinc-600 text-[10px] italic">Connect your wallet to see your SPL tokens.</p>
                    ) : walletSplStatus === 'loading' ? (
                      <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold">
                        <div className="w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                        Loading your tokens...
                      </div>
                    ) : walletSplStatus === 'error' ? (
                      <p className="text-amber-400 text-[10px]">Couldn't load wallet tokens. Paste a mint below instead.</p>
                    ) : walletSplAssets.length === 0 ? (
                      <p className="text-zinc-600 text-[10px] italic">No SPL tokens in wallet , paste a mint below.</p>
                    ) : (
                      <div className="max-h-48 overflow-y-auto -mx-1 pr-1 space-y-1">
                        {walletSplAssets.map((a) => {
                          const isSelected = customSplMint === a.mint;
                          return (
                            <button
                              key={a.mint}
                              onClick={() => setCustomSplMint(a.mint)}
                              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all text-left ${
                                isSelected
                                  ? 'bg-[#38BDF8]/15 border border-[#38BDF8]/40'
                                  : 'bg-white/[0.03] border border-white/5 hover:bg-white/[0.07] hover:border-white/10'
                              }`}
                            >
                              {a.logo ? (
                                <img src={a.logo} alt="" className="w-7 h-7 rounded-full bg-white/5 shrink-0" />
                              ) : (
                                <div
                                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center font-[1000] italic text-[10px] text-white shrink-0"
                                  style={a.tint ? { background: a.tint } : undefined}
                                >
                                  {a.symbol.slice(0, 2)}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-white font-[1000] italic text-xs">{a.symbol}</span>
                                  <span className="text-zinc-600 text-[9px] truncate">{a.name}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-white text-[10px] font-bold tabular-nums">{a.balance}</div>
                                {a.usd && <div className="text-zinc-600 text-[8px] tabular-nums">{a.usd}</div>}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-3">
                    <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Or Enter Contract Address</label>
                    <input
                      type="text"
                      value={customSplMint}
                      onChange={(e) => setCustomSplMint(e.target.value.trim())}
                      placeholder="Paste mint address (e.g. DezX...BONK)"
                      className="w-full min-h-[44px] px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
                    />
                  </div>

                  {jupiterLoading && (
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-bold">
                      <div className="w-3 h-3 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                      Looking up token on Jupiter...
                    </div>
                  )}

                  {jupiterToken && !jupiterLoading && (
                    <div className="rounded-lg bg-[#38BDF8]/8 border border-[#38BDF8]/25 p-2 flex items-center gap-3">
                      {jupiterToken.logoURI && (
                        <img src={jupiterToken.logoURI} alt="" className="w-8 h-8 rounded-full bg-white/5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-white font-[1000] italic text-sm">{jupiterToken.symbol}</span>
                          <span className="text-zinc-500 text-[10px] truncate">{jupiterToken.name}</span>
                          {jupiterToken.isVerified && (
                            <img
                              src="/jup_vrfd_nobg.png"
                              alt="Jupiter Verified"
                              title="Jupiter Verified"
                              style={{ height: 14, width: 'auto', display: 'inline-block', verticalAlign: 'middle' }}
                            />
                          )}
                        </div>
                        <div className="text-zinc-600 text-[9px] mt-0.5">{jupiterToken.decimals} decimals</div>
                      </div>
                    </div>
                  )}

                  {jupiterError && !jupiterLoading && (
                    <>
                      <p className="text-amber-400 text-[10px]">{jupiterError}</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualSymbol}
                          onChange={(e) => setManualSymbol(e.target.value.slice(0, 16).toUpperCase())}
                          placeholder="Symbol (e.g. BONK)"
                          className="flex-1 min-h-[40px] px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-bold text-xs placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
                        />
                        <input
                          type="number"
                          min={0}
                          max={9}
                          value={manualDecimals}
                          onChange={(e) => setManualDecimals(Math.max(0, Math.min(9, Number(e.target.value) || 0)))}
                          placeholder="Decimals"
                          className="w-24 min-h-[40px] px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-bold text-xs placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <p className="text-zinc-600 text-[10px] mt-2">
                {gameType === 'free' ? 'No entry fee. Players compete for XP and bragging rights.'
                  : gameType === 'players_fund' ? `Players pay an entry fee${selectedToken ? ` in ${selectedToken.symbol}` : ' in SOL'}. Winners split the prize pool.`
                  : creatorPrizeType === 'nft' ? 'You escrow one of your NFTs as the prize. Single winner takes it. Free for players to enter.'
                  : `You deposit the prize pool${selectedToken ? ` in ${selectedToken.symbol}` : ' in SOL'}. Players join for 0.0025 SOL platform fee. Winners claim from your deposit.`}
              </p>
            </div>

            {/* NFT prize selection — visible when prizeModel === 'nft_prize' */}
            {isNftPrize && (
              <div>
                <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Pick the NFT prize</label>
                <NFTSelector
                  walletAddress={publicKey?.toBase58() ?? null}
                  selectedMint={selectedNft?.mint ?? null}
                  onSelect={(nft) => setSelectedNft(nft)}
                />
                {selectedNft && (
                  <div className="mt-3 rounded-xl bg-purple-500/10 border border-purple-500/30 px-4 py-3 flex items-center gap-3">
                    {selectedNft.thumbnail && (
                      <img src={selectedNft.thumbnail} alt="" className="w-10 h-10 rounded-md object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-[1000] truncate">{selectedNft.name}</div>
                      <div className="text-zinc-400 text-[10px] truncate">{selectedNft.collectionName} · {selectedNft.standard.toUpperCase()}</div>
                    </div>
                    <button onClick={() => setSelectedNft(null)} className="text-zinc-400 hover:text-white text-sm px-2">Clear</button>
                  </div>
                )}
                <p className="text-zinc-600 text-[10px] mt-2">
                  Single winner gets your NFT. Free for players to enter. If too few play, you can reclaim the NFT after expiry.
                </p>
              </div>
            )}

            {isPaid && (
              <>
                {/* Entry Fee (player-funded only). Presets shown ONLY for SOL games —
                    SPL/USDC games use a free-form input since the same dollar value
                    differs wildly across token decimals (0.1 SOL vs 0.1 BONK etc). */}
                {!isCreatorFunded && (
                  <div>
                    <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Entry Fee ({activeSymbol})</label>
                    {!isSplGame && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {CUSTOM_GAME_ENTRY_FEE_PRESETS.map((fee, i) => (
                          <button
                            key={fee}
                            onClick={() => { setEntryFeeLamports(fee); setCustomEntryFee(''); }}
                            className={`min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${!customEntryFee && entryFeeLamports === fee ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                          >
                            {CUSTOM_GAME_ENTRY_FEE_LABELS[i]}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customEntryFee}
                      onChange={(e) => handleCustomFeeChange(e.target.value)}
                      placeholder={isSplGame ? `Amount in ${activeSymbol}` : 'Custom (0.01 - 10 SOL)'}
                      className={`w-full min-h-[44px] px-4 py-3 bg-white/5 border rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none transition-colors ${!isCustomFeeValid ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-[#38BDF8]/40'}`}
                    />
                    {!isCustomFeeValid && (
                      <p className="text-red-400 text-[10px] mt-1">
                        {isSplGame ? `Entry fee must be greater than 0 ${activeSymbol}` : 'Entry fee must be between 0.01 and 10 SOL'}
                      </p>
                    )}
                  </div>
                )}

                {/* Prize Deposit (creator-funded only). Presets SOL-only, same reasoning. */}
                {isCreatorFunded && (
                  <div>
                    <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Prize Pool Deposit ({activeSymbol})</label>
                    {!isSplGame && (
                      <div className="flex gap-2 flex-wrap mb-2">
                        {CREATOR_FUNDED_PRIZE_PRESETS.map((amt, i) => (
                          <button
                            key={amt}
                            onClick={() => { setCreatorDepositLamports(amt); setCustomCreatorDeposit(''); }}
                            className={`min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${!customCreatorDeposit && creatorDepositLamports === amt ? 'bg-amber-500 text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                          >
                            {CREATOR_FUNDED_PRIZE_LABELS[i]}
                          </button>
                        ))}
                      </div>
                    )}
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customCreatorDeposit}
                      onChange={(e) => handleCustomDepositChange(e.target.value)}
                      placeholder={isSplGame ? `Amount in ${activeSymbol}` : 'Custom (0.05 - 100 SOL)'}
                      className={`w-full min-h-[44px] px-4 py-3 bg-white/5 border rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none transition-colors ${!isCustomDepositValid ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-amber-500/40'}`}
                    />
                    {!isCustomDepositValid && (
                      <p className="text-red-400 text-[10px] mt-1">
                        {isSplGame ? `Prize deposit must be greater than 0 ${activeSymbol}` : 'Prize deposit must be between 0.05 and 100 SOL'}
                      </p>
                    )}
                    <p className="text-zinc-600 text-[10px] mt-1">You deposit this {activeSymbol} when you start the game (after players join). Players join for {TXN_FEE_LAMPORTS / 1_000_000_000} SOL platform fee only.</p>
                  </div>
                )}

                {/* Max Players, Duration, Winners moved OUT of {isPaid} block in
                    the parent — they apply to all game types including free.
                    See block immediately following the {isPaid && (...)} close. */}

                {/* Prize Calculator. All amounts shown in the selected token's
                    natural units. For SPL games with a Jupiter-resolved price,
                    a tiny "≈ $USD" hint appears alongside each amount.
                    Platform fee on entry is always SOL regardless. */}
                <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 space-y-2">
                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wider mb-3">Estimated Prize Breakdown</p>
                  {isCreatorFunded ? (
                    <div className="flex justify-between text-zinc-500 text-xs">
                      <span>Your deposit</span>
                      <span className="text-right">
                        <span>{formatAmount(activeCreatorDeposit)} {activeSymbol}</span>
                        {formatUsd(activeCreatorDeposit) && (
                          <span className="block text-zinc-600 text-[9px] tabular-nums">{formatUsd(activeCreatorDeposit)}</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between text-zinc-500 text-xs">
                      <span>Entry fee</span>
                      <span className="text-right">
                        <span>{formatAmount(activeEntryFee)} {activeSymbol} x {maxPlayers ?? '∞'} players</span>
                        {formatUsd(activeEntryFee) && (
                          <span className="block text-zinc-600 text-[9px] tabular-nums">{formatUsd(activeEntryFee)} per player</span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-400 text-xs font-bold">
                    <span>Total pot</span>
                    <span className="text-right">
                      <span>{formatAmount(estimatedPot)} {activeSymbol}</span>
                      {formatUsd(estimatedPot) && (
                        <span className="block text-zinc-600 text-[9px] font-normal tabular-nums">{formatUsd(estimatedPot)}</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600 text-[10px]">
                    <span>Platform cut ({isCreatorFunded ? 0 : 10}%)</span>
                    <span>-{formatAmount(platformCut)} {activeSymbol}</span>
                  </div>
                  <div className="border-t border-white/5 pt-2 mt-2">
                    <div className="flex justify-between text-[#38BDF8] text-sm font-[1000] italic">
                      <span>Prize pool</span>
                      <span className="text-right">
                        <span>{formatAmount(prizePot)} {activeSymbol}</span>
                        {formatUsd(prizePot) && (
                          <span className="block text-[#38BDF8]/70 text-[9px] tabular-nums font-normal not-italic">{formatUsd(prizePot)}</span>
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2">
                    {winnerAmounts.map((amt, i) => (
                      <div key={i} className="flex justify-between text-zinc-400 text-[11px]">
                        <span>{i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'} place ({CUSTOM_GAME_WINNER_SPLIT_LABELS[maxWinners][i]})</span>
                        <span className="text-right">
                          <span className="text-white font-bold">{formatAmount(amt)} {activeSymbol}</span>
                          {formatUsd(amt) && (
                            <span className="block text-zinc-600 text-[9px] tabular-nums">{formatUsd(amt)}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                  {isCreatorFunded ? (
                    <p className="text-zinc-700 text-[9px] mt-2">Players join for {TXN_FEE_LAMPORTS / 1_000_000_000} SOL platform fee only. You deposit {formatAmount(activeCreatorDeposit)} {activeSymbol} when you start the game.</p>
                  ) : (
                    <p className="text-zinc-700 text-[9px] mt-2">+ {TXN_FEE_LAMPORTS / 1_000_000_000} SOL platform fee per entry</p>
                  )}
                </div>
              </>
            )}

            {/* Max Players + Game Duration + Winner Count apply to ALL game
                types (free + paid). Moved out of {isPaid} gate 2026-06-24. */}

            {/* Max Players */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Max Players</label>
              <div className="flex gap-2 flex-wrap">
                {CUSTOM_GAME_MAX_PLAYER_PRESETS.map((count) => (
                  <button
                    key={count}
                    onClick={() => { setMaxPlayers(count); setCustomMaxPlayers(''); }}
                    className={`min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${maxPlayers === count && !customMaxPlayers ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {count.toLocaleString()}
                  </button>
                ))}
                <button
                  onClick={() => { setMaxPlayers(null); setCustomMaxPlayers(''); }}
                  className={`min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${maxPlayers === null ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                >
                  ∞ No Max
                </button>
              </div>
              <input
                type="number"
                inputMode="numeric"
                min={CUSTOM_GAME_MIN_PLAYERS}
                max={CUSTOM_GAME_MAX_PLAYERS}
                value={customMaxPlayers}
                onChange={(e) => {
                  const raw = e.target.value;
                  setCustomMaxPlayers(raw);
                  const v = parseInt(raw, 10);
                  if (!isNaN(v)) setMaxPlayers(Math.max(CUSTOM_GAME_MIN_PLAYERS, Math.min(CUSTOM_GAME_MAX_PLAYERS, v)));
                }}
                placeholder={`Custom (${CUSTOM_GAME_MIN_PLAYERS} - ${CUSTOM_GAME_MAX_PLAYERS.toLocaleString()})`}
                className="w-full mt-2 min-h-[40px] px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40"
              />
            </div>

            {/* Game Duration */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Game Duration</label>
              <div className="flex gap-2 flex-wrap">
                {CUSTOM_GAME_DURATION_PRESETS.map((d) => (
                  <button
                    key={d.minutes}
                    onClick={() => { setGameDurationMinutes(d.minutes); setCustomDurationValue(''); }}
                    className={`min-h-[40px] px-3 py-2 rounded-xl font-black text-[11px] uppercase transition-all active:scale-[0.98] ${gameDurationMinutes === d.minutes && !customDurationValue ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              {/* Custom duration: number + M/H/D picker */}
              <div className="flex gap-2 mt-2 items-stretch">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={customDurationValue}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setCustomDurationValue(raw);
                    const v = parseInt(raw, 10);
                    if (!isNaN(v)) {
                      const mins = customDurationUnit === 'M' ? v : customDurationUnit === 'H' ? v * 60 : v * 1440;
                      setGameDurationMinutes(Math.max(CUSTOM_GAME_MIN_DURATION_MINUTES, Math.min(CUSTOM_GAME_MAX_DURATION_MINUTES, mins)));
                    }
                  }}
                  placeholder="Custom"
                  className="flex-1 min-h-[40px] px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40"
                />
                <div className="flex gap-1">
                  {(['M', 'H', 'D'] as const).map((u) => (
                    <button
                      key={u}
                      onClick={() => {
                        setCustomDurationUnit(u);
                        const v = parseInt(customDurationValue, 10);
                        if (!isNaN(v)) {
                          const mins = u === 'M' ? v : u === 'H' ? v * 60 : v * 1440;
                          setGameDurationMinutes(Math.max(CUSTOM_GAME_MIN_DURATION_MINUTES, Math.min(CUSTOM_GAME_MAX_DURATION_MINUTES, mins)));
                        }
                      }}
                      className={`min-w-[44px] px-3 rounded-xl font-black text-xs transition-all ${customDurationUnit === u ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-zinc-600 text-[10px] mt-1">Min 15 min, max 30 days. Players can join and play during this window.</p>
            </div>

            {/* Winners */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Winner Count</label>
              <div className="flex gap-2">
                {([1, 3, 5] as const).map((w) => (
                  <button
                    key={w}
                    onClick={() => setMaxWinners(w)}
                    className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl transition-all active:scale-[0.98] ${maxWinners === w ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                  >
                    <span className="font-[1000] italic text-lg block">{w}</span>
                    <span className="text-[8px] font-black uppercase tracking-wider opacity-70">
                      {w === 1 ? 'Winner' : 'Winners'}
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 flex gap-2 flex-wrap">
                {CUSTOM_GAME_WINNER_SPLIT_LABELS[maxWinners].map((label, i) => (
                  <span key={i} className="px-2 py-1 bg-[#38BDF8]/10 border border-[#38BDF8]/20 rounded text-[#38BDF8] text-[10px] font-black">
                    {i + 1}{i === 0 ? 'st' : i === 1 ? 'nd' : i === 2 ? 'rd' : 'th'}: {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Re-Entry Cap (v44) */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Re-Entries</label>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => { setAllowReEntries(true); setMaxEntriesPerPlayer(null); }}
                  className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${allowReEntries ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                >
                  Allow Re-Entries
                </button>
                <button
                  onClick={() => { setAllowReEntries(false); setMaxEntriesPerPlayer(1); }}
                  className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic text-sm transition-all active:scale-[0.98] ${!allowReEntries ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                >
                  Single Attempt
                </button>
              </div>
              {allowReEntries && (
                <div>
                  <div className="text-zinc-500 text-[10px] font-black uppercase tracking-wider mb-2">Max Entries Per Wallet</div>
                  <div className="flex gap-2 flex-wrap">
                    {CUSTOM_GAME_MAX_ENTRIES_PRESETS.map((n) => (
                      <button
                        key={n}
                        onClick={() => setMaxEntriesPerPlayer(n)}
                        className={`min-h-[40px] px-3 py-2 rounded-xl font-black text-[11px] uppercase transition-all active:scale-[0.98] ${maxEntriesPerPlayer === n ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                      >
                        {n}
                      </button>
                    ))}
                    <button
                      onClick={() => setMaxEntriesPerPlayer(null)}
                      className={`min-h-[40px] px-3 py-2 rounded-xl font-black text-[11px] uppercase transition-all active:scale-[0.98] ${maxEntriesPerPlayer === null ? 'bg-[#38BDF8] text-black' : 'bg-white/5 border border-white/10 text-zinc-400 hover:bg-white/10'}`}
                    >
                      ∞ Unlimited
                    </button>
                  </div>
                </div>
              )}
              <p className="text-zinc-600 text-[10px] mt-2">
                {prizeModel === 'player_funded'
                  ? 'Each re-entry pays the full entry fee. Pot grows with re-entries.'
                  : 'Each re-entry = another attempt at the prize. Best score wins.'}
              </p>
            </div>

            {/* Sticky Next button: hovers at the bottom of the viewport so
                users with long forms (NFT picker, many fields) don't have to
                scroll all the way down to advance. */}
            <div className="sticky bottom-4 -mx-4 px-4 pt-3 pb-1 z-20">
              <div className="rounded-xl bg-black/90 backdrop-blur-sm border border-white/10 shadow-[0_-8px_24px_rgba(0,0,0,0.6)] p-2">
                <button
                  onClick={goToQuestions}
                  className="w-full min-h-[48px] px-6 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-lg hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
                >
                  Next: Write Questions
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Question Builder */}
        {step === 'questions' && questions.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-[1000] italic text-white uppercase tracking-tighter">Question {currentQIdx + 1}</h2>
              <span className="text-[#38BDF8] text-sm font-[1000] italic">{currentQIdx + 1} / {questionCount}</span>
            </div>

            {/* Progress dots */}
            <div className="flex gap-1.5 flex-wrap">
              {questions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentQIdx(i)}
                  className={`w-6 h-6 rounded-full text-[9px] font-black transition-all ${
                    i === currentQIdx
                      ? 'bg-[#38BDF8] text-black'
                      : isQuestionValid(q)
                        ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
                        : 'bg-white/5 text-zinc-600 border border-white/10'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Question Text */}
            <div>
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block mb-2">Question *</label>
              <textarea
                value={questions[currentQIdx].questionText}
                onChange={(e) => updateQuestion('questionText', e.target.value.slice(0, CUSTOM_GAME_QUESTION_TEXT_MAX))}
                placeholder="What is the capital of France?"
                rows={3}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors resize-none"
              />
              <p className="text-zinc-700 text-[10px] mt-1">{questions[currentQIdx].questionText.length}/{CUSTOM_GAME_QUESTION_TEXT_MAX}</p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block">Answers * (tap to mark correct)</label>
              {['A', 'B', 'C', 'D'].map((label, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <button
                    onClick={() => updateQuestion('correctIndex', idx as 0 | 1 | 2 | 3)}
                    className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center font-[1000] italic text-sm transition-all active:scale-[0.95] ${
                      questions[currentQIdx].correctIndex === idx
                        ? 'bg-[#38BDF8] text-black'
                        : 'bg-white/5 border border-white/10 text-zinc-500 hover:border-[#38BDF8]/30'
                    }`}
                  >
                    {label}
                  </button>
                  <input
                    type="text"
                    value={questions[currentQIdx].options[idx]}
                    onChange={(e) => updateQuestion(`option${idx}`, e.target.value.slice(0, CUSTOM_GAME_OPTION_TEXT_MAX))}
                    placeholder={`Option ${label}`}
                    className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white font-bold text-sm placeholder-zinc-600 focus:outline-none focus:border-[#38BDF8]/40 transition-colors"
                  />
                </div>
              ))}
              <p className="text-zinc-600 text-[10px]">Tap the letter to mark the correct answer. Currently: <span className="text-[#38BDF8] font-black">{['A', 'B', 'C', 'D'][questions[currentQIdx].correctIndex]}</span></p>
            </div>

            {/* Nav */}
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentQIdx(Math.max(0, currentQIdx - 1))}
                disabled={currentQIdx === 0}
                className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-xs tracking-wider hover:bg-white/10 disabled:opacity-30 transition-all active:scale-[0.98]"
              >
                Prev
              </button>
              {currentQIdx < questionCount - 1 ? (
                <button
                  onClick={() => setCurrentQIdx(currentQIdx + 1)}
                  className="flex-1 min-h-[44px] px-4 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-sm tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
                >
                  Next
                </button>
              ) : (
                <button
                  onClick={goToReview}
                  disabled={!allQuestionsValid}
                  className={`flex-1 min-h-[44px] px-4 py-3 rounded-xl font-[1000] italic uppercase text-sm tracking-tighter transition-all active:scale-[0.98] ${
                    allQuestionsValid ? 'bg-[#38BDF8] text-black hover:bg-[#7DD3FC]' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  Review Game
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: Review & Pay */}
        {step === 'review' && (
          <div className="space-y-6">
            <h2 className="text-2xl md:text-4xl font-[1000] italic text-white uppercase tracking-tighter">Review & Create</h2>

            {/* Summary */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6">
              <h3 className="text-white font-[1000] italic text-xl uppercase mb-4">{gameName}</h3>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Questions</span>
                  <span className="text-white font-[1000] italic">{questionCount}</span>
                </div>
                <div className="text-center">
                  <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Rounds</span>
                  <span className="text-white font-[1000] italic">{roundCount}</span>
                </div>
                <div className="text-center">
                  <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Time/Q</span>
                  <span className="text-white font-[1000] italic">{timeLimit}s</span>
                </div>
              </div>
              {customSlug && (
                <p className="text-zinc-500 text-xs font-mono">soltrivia.app/game/{customSlug}</p>
              )}
            </div>

            {/* Prize Pool Summary (paid games) */}
            {isPaid && (
              <div className="bg-[#38BDF8]/5 border border-[#38BDF8]/20 rounded-2xl p-6">
                <p className="text-[#38BDF8] text-[9px] font-black uppercase tracking-[0.3em] mb-3">Prize Pool Game</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-zinc-600 text-[8px] font-black uppercase block">Entry Fee</span>
                    <span className="text-white font-[1000] italic">{(activeEntryFee / 1_000_000_000).toFixed(2)} SOL</span>
                  </div>
                  <div>
                    <span className="text-zinc-600 text-[8px] font-black uppercase block">Max Players</span>
                    <span className="text-white font-[1000] italic">{maxPlayers === null ? '∞' : maxPlayers.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600 text-[8px] font-black uppercase block">Duration</span>
                    <span className="text-white font-[1000] italic">{CUSTOM_GAME_DURATION_PRESETS.find(d => d.minutes === gameDurationMinutes)?.label || `${gameDurationMinutes}m`}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600 text-[8px] font-black uppercase block">Winners</span>
                    <span className="text-white font-[1000] italic">{maxWinners} ({CUSTOM_GAME_WINNER_SPLIT_LABELS[maxWinners].join('/')})</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[#38BDF8]/10">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-400">Est. Prize Pool</span>
                    <span className="text-[#38BDF8] font-[1000] italic">{(prizePot / 1_000_000_000).toFixed(2)} SOL</span>
                  </div>
                </div>
              </div>
            )}

            {/* Prize Summary (NFT-funded games) */}
            {isNftPrize && selectedNft && (
              <div className="bg-[#38BDF8]/5 border border-[#38BDF8]/20 rounded-2xl p-6">
                <p className="text-[#38BDF8] text-[9px] font-black uppercase tracking-[0.3em] mb-4">NFT Prize Game</p>

                {/* Hero: NFT art + name. The asset IS the prize, so give it the headline treatment. */}
                <div className="flex items-center gap-4 mb-5">
                  {selectedNft.thumbnail ? (
                    <img
                      src={selectedNft.thumbnail}
                      alt=""
                      className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-cover shrink-0 border border-[#38BDF8]/30 shadow-[0_8px_24px_-8px_rgba(56,189,248,0.45)]"
                    />
                  ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-[#38BDF8]/10 border border-[#38BDF8]/30 flex items-center justify-center shrink-0">
                      <span className="text-[#38BDF8] text-[10px] font-black uppercase tracking-widest">{selectedNft.standard.toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter leading-none truncate">
                      {selectedNft.name}
                    </div>
                    <div className="mt-1 text-zinc-400 text-xs font-bold italic uppercase tracking-wider truncate">
                      {selectedNft.collectionName}
                    </div>
                    <div className="mt-2 inline-block text-[#38BDF8] text-[9px] font-black italic uppercase tracking-widest px-2 py-1 rounded-md bg-[#38BDF8]/10 border border-[#38BDF8]/30">
                      {selectedNft.standard.toUpperCase()} NFT
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1">Entry</span>
                    <span className="text-white text-base md:text-lg font-[1000] italic uppercase tracking-tighter">Free</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1">Max Players</span>
                    <span className="text-white text-base md:text-lg font-[1000] italic uppercase tracking-tighter">{maxPlayers === null ? '∞' : maxPlayers.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1">Duration</span>
                    <span className="text-white text-base md:text-lg font-[1000] italic uppercase tracking-tighter">{CUSTOM_GAME_DURATION_PRESETS.find(d => d.minutes === gameDurationMinutes)?.label || `${gameDurationMinutes}m`}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest block mb-1">Winner</span>
                    <span className="text-white text-base md:text-lg font-[1000] italic uppercase tracking-tighter">Take All</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#38BDF8]/15">
                  <p className="text-[#38BDF8] text-[11px] font-black italic">
                    Top scorer takes the NFT. If too few play, you reclaim after expiry.
                  </p>
                </div>
              </div>
            )}

            {/* Questions Preview */}
            <div className="space-y-2">
              <label className="text-[#38BDF8] text-[10px] font-black uppercase tracking-wider block">Questions Preview</label>
              {questions.map((q, i) => (
                <details key={i} className="bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                  <summary className="px-4 py-3 cursor-pointer flex items-center gap-3 hover:bg-white/[0.03] transition-colors">
                    <span className={`w-6 h-6 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 ${isQuestionValid(q) ? 'bg-[#38BDF8]/20 text-[#38BDF8]' : 'bg-red-500/20 text-red-400'}`}>{i + 1}</span>
                    <span className="text-white text-sm font-bold truncate flex-1">{q.questionText || '(empty)'}</span>
                  </summary>
                  <div className="px-4 pb-3 space-y-1">
                    {q.options.map((opt, j) => (
                      <div key={j} className={`text-xs px-3 py-1.5 rounded ${j === q.correctIndex ? 'text-[#38BDF8] bg-[#38BDF8]/10' : 'text-zinc-500'}`}>
                        {['A', 'B', 'C', 'D'][j]}. {opt || '(empty)'}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>

            {/* Fee */}
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-xs font-black uppercase">Total Fee</span>
                <span className="text-[#38BDF8] text-lg font-[1000] italic">{creationFeeSol} SOL</span>
              </div>
              <div className="mt-2 space-y-1">
                {!hasGamePass && (
                  <div className="flex justify-between text-zinc-600 text-[10px]">
                    <span>Creation fee</span>
                    <span>{CUSTOM_GAME_CREATION_FEE_LAMPORTS / 1_000_000_000} SOL</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-600 text-[10px]">
                  <span>Platform fee</span>
                  <span>{CUSTOM_GAME_PLATFORM_FEE_LAMPORTS / 1_000_000_000} SOL</span>
                </div>
                {hasGamePass && (
                  <p className="text-[#38BDF8] text-[10px] font-black mt-1">Game Pass: creation fee waived!</p>
                )}
              </div>
            </div>

            {/* Safety guard (Kyle 2026-06-26): when game is SPL but selectedToken
                hasn't resolved (e.g., Jupiter fetch in-flight or failed and no
                manual override), block creation. Without this guard, EF would
                receive no tokenMint → dispatched as SOL game → user accidentally
                commits real SOL instead of intended SPL. Manual override path
                (user-typed decimals + symbol) makes selectedToken truthy and
                button enables. */}
            <button
              onClick={handleCreate}
              disabled={creating || (isSplGame && !selectedToken)}
              className={`w-full min-h-[52px] px-6 py-4 rounded-xl font-[1000] italic uppercase text-xl tracking-tighter transition-all active:scale-[0.98] ${
                creating || (isSplGame && !selectedToken)
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-[#38BDF8] text-black hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)]'
              }`}
            >
              {creating
                ? 'Creating...'
                : (isSplGame && !selectedToken)
                  ? 'Waiting for token info — re-select token'
                  : `Create Game (${creationFeeSol} SOL)`}
            </button>
          </div>
        )}
      </div>

      {/* Drafts modal — opens via the header pill. Restore writes wizard
          state in-place; delete removes the slot from localStorage. */}
      {draftsModalOpen && (
        <CustomGameDraftsModal
          drafts={drafts}
          onRestore={handleRestoreDraft}
          onDelete={handleDeleteDraft}
          onClose={() => setDraftsModalOpen(false)}
        />
      )}
    </div>
  );
};

export default CreateCustomGameView;

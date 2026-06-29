import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { View } from './types';

const PATH_TO_VIEW: Record<string, View> = {
  '/': View.HOME,
  '/play': View.PLAY,
  '/quests': View.QUESTS,
  '/leaderboard': View.LEADERBOARD,
  '/profile': View.PROFILE,
  '/quiz': View.QUIZ,
  '/results': View.RESULTS,
  '/practice': View.PRACTICE,
  '/practice-results': View.PRACTICE_RESULTS,
  ...(import.meta.env.VITE_ENABLE_CONTRACT_TEST === 'true' ? { '/contract-test': View.CONTRACT_TEST } : {}),
  '/terms': View.TERMS,
  '/privacy': View.PRIVACY,
  '/admin': View.ADMIN,
  '/adminlogin': View.ADMIN,
  '/custom-games': View.CUSTOM_GAMES_HUB,
  '/create-game': View.CUSTOM_GAME_CREATE,
  '/duels': View.DUEL_LOBBY,
  '/compete': View.COMPETE_LOBBY,
  '/referrals': View.REFERRALS,
  '/game-pass': View.GAME_PASS,
  '/lives': View.LIVES,
  '/mint': View.MINT,
  '/swap': View.SWAP,
};
function viewFromPath(): View {
  if (typeof window === 'undefined') return View.HOME;
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  // Dynamic route: /game/:slug → custom game lobby
  if (path.startsWith('/game/') && path.length > 6) return View.CUSTOM_GAME_LOBBY;
  // Dynamic route: /duel/:shareCode → duel waiting/join flow
  if (path.startsWith('/duel/') && path.length > 6) return View.DUEL_WAITING;
  return PATH_TO_VIEW[path] ?? View.HOME;
}
function pathForView(view: View, customSlug?: string | null, duelShareCode?: string | null): string {
  if (view === View.HOME) return '/';
  if (view === View.ADMIN) return '/admin';
  if (view === View.CONTRACT_TEST) return import.meta.env.VITE_ENABLE_CONTRACT_TEST === 'true' ? '/contract-test' : '/';
  if (view === View.CUSTOM_GAMES_HUB) return '/custom-games';
  if (view === View.CUSTOM_GAME_CREATE) return '/create-game';
  if ([View.CUSTOM_GAME_LOBBY, View.CUSTOM_GAME_PLAY, View.CUSTOM_GAME_RESULTS].includes(view)) {
    if (customSlug) return `/game/${customSlug}`;
    const current = window.location.pathname;
    if (current.startsWith('/game/')) return current;
    return '/';
  }
  if (view === View.COMPETE_LOBBY) return '/compete';
  if (view === View.DUEL_LOBBY) return '/duels';
  if (view === View.REFERRALS) return '/referrals';
  if (view === View.GAME_PASS) return '/game-pass';
  if (view === View.LIVES) return '/lives';
  if (view === View.MINT) return '/mint';
  if (view === View.SWAP) return '/swap';
  if ([View.DUEL_WAITING, View.DUEL_PLAY, View.DUEL_RESULTS].includes(view)) {
    if (duelShareCode) return `/duel/${duelShareCode}`;
    const current = window.location.pathname;
    if (current.startsWith('/duel/')) return current;
    return '/duels';
  }
  return '/' + view.toLowerCase();
}
import { useWallet, useConnection } from './src/contexts/WalletContext';
import { SystemProgram, PublicKey, TransactionMessage, VersionedTransaction, TransactionInstruction } from '@solana/web3.js';
import Sidebar from './components/Sidebar';
import HomeView from './components/HomeView';
import HomeViewV2, { HomeRightRail } from './components/HomeViewV2';
import RoundsViewV2 from './components/RoundsViewV2';
import QuestsViewV2 from './components/QuestsViewV2';
import LeaderboardViewV2 from './components/LeaderboardViewV2';
import DuelsViewV2 from './components/DuelsViewV2';
import CustomGamesViewV2 from './components/CustomGamesViewV2';
import GamePassViewV2 from './components/GamePassViewV2';
import ReferralsViewV2 from './components/ReferralsViewV2';
import MintViewV2 from './components/MintViewV2';
import FreePlayViewV2 from './components/FreePlayViewV2';
import LivesViewV2 from './components/LivesViewV2';
import { WebShell } from './components/WebShell';
import LeaderboardView from './components/LeaderboardView';
import QuestsView from './components/QuestsView';
import ProfileViewV2 from './components/ProfileViewV2';
import PlayView from './components/PlayView';
import GuideModal from './components/GuideModal';
import BuyLivesModal from './components/BuyLivesModal';
import FirstTimeDepositModal from './components/FirstTimeDepositModal';
import { getBalanceSafely } from './src/utils/balance';
import { isMobileDevice, isStandalonePWA, isInTWA, a2hsDismissedRecently, isFreshWalletOnThisDevice } from './src/utils/pwa';
import SwapModal from './components/SwapModal';
import EditProfileModal from './components/EditProfileModal';
import QuizView from './components/QuizView';
import ResultsView from './components/ResultsView';
import PracticeResultsView from './components/PracticeResultsView';
import WalletRequiredModal from './components/WalletRequiredModal';
import LegalDisclaimerModal from './components/LegalDisclaimerModal';
import WalletConnectButton from './components/WalletConnectButton';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import NotificationBell from './components/NotificationBell';
import AdminRoute from './components/AdminRoute';
import TermsOfServiceView from './components/TermsOfServiceView';
import PrivacyPolicyView from './components/PrivacyPolicyView';
import LoadingScreen from './components/LoadingScreen';
import ContractTestView from './components/ContractTestView';
import CategorySelectorModal from './components/CategorySelectorModal';
import ContentDisclaimerModal, { hasAcceptedContentDisclaimer } from './components/ContentDisclaimerModal';
import CreateCustomGameView from './components/CreateCustomGameView';
import CustomGamesHubView from './components/CustomGamesHubView';
import CustomGameLobbyView from './components/CustomGameLobbyView';
import CustomGameQuizView from './components/CustomGameQuizView';
import CustomGameResultsView from './components/CustomGameResultsView';
import DuelWaitingView from './components/DuelWaitingView';
import DuelQuizView from './components/DuelQuizView';
import DuelResultsView from './components/DuelResultsView';
import CompeteLobbyView from './components/CompeteLobbyView';
import { getPlayerLives, getRoundEntriesUsed, startGame, completeSession, registerPlayerProfile, updateProfile, updateQuestProgress, getLeaderboard, ensureRoundOnChain, buildRoundEntryTx, initializeProgram, startPracticeGame, registerReferral, getSeekerProfile, checkGamePass, startCustomGame, joinCustomGame, startCustomGameTimer, recordCustomGameFunding, createDuel, joinDuel, getDuel, updateDuelStatus, getOnboardingStatus, type CustomGameData, type ClaimablePayout, type ClaimableCustomGameWin, type RefundableEntry, type RefundableCustomGame, type ActiveDuel } from './src/utils/api';
import OnboardingModal from './components/OnboardingModal';
import RoundRecoveryModal from './components/RoundRecoveryModal';
import {
  savePendingRoundEntry,
  clearPendingRoundEntry,
  listAllPendingRoundEntries,
  pruneStalePendingEntries,
  type PendingRoundEntry,
} from './src/utils/pendingRoundEntry';
import { fetchUnpaidRoundPayouts, fetchUnclaimedCustomWins, fetchClaimableRefundEntries, fetchClaimableRefundCustoms } from './src/utils/claims';
import { REVENUE_WALLET, DEFAULT_AVATAR, SOLANA_NETWORK, PAID_TRIVIA_ENABLED, CUSTOM_GAME_MAX_ATTEMPTS, getReEntryFeeLamports } from './src/utils/constants';
import {
  buildEnterRoundInstruction,
  buildEnterTierRoundIx,
  contractRoundIdFromDateAndNumber,
  buildCreateDuelIx,
  buildJoinDuelIx,
  buildCreateDuelSplIx,
  buildJoinDuelSplIx,
  SPL_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM,
  buildCancelDuelIx,
  buildExpireDuelIx,
  buildClaimDuelPrizeIx,
  buildClaimDuelPrizeSplIx,
  buildEnterCustomGameIx,
  buildEnterCustomGameSplIx,
  buildCreateAtaIdempotentIx,
  buildFundCustomGameIx,
  buildClaimCustomPrizeIx,
  buildClaimCustomPrizeSplIx,
  buildClaimTierPrizeIx,
  buildClaimTierRefundIx,
  buildClaimCustomRefundIx,
  // NFT custom-game ix builders (v2.1) — for claim + reclaim flows
  buildClaimCustomNftPrizeIx,
  buildClaimCustomTmPnftPrizeIx,
  buildReclaimCustomNftIx,
  buildReclaimCustomTmPnftIx,
  buildEnterCustomGameNftIx,
  // Referral on-chain claim (v2.1 upgrade) — credits accumulate in a PDA when
  // the referee buys Lives/Pass; the referrer claims via this ix.
  buildClaimReferralBalanceIx,
  fetchReferralBalance,
  fetchGameConfig,
  fetchTierRound,
  fetchCustomGame as fetchCustomGameOnChain,
} from './src/utils/soltriviaContract';

import { supabase } from './src/utils/supabase';
import { useKeepAlive } from './src/hooks/useKeepAlive';
import { getRecentBlockhashWithRetry } from './src/utils/rpc';

const App: React.FC = () => {
  // Keep Render free tier service alive (pings every 2 minutes)
  useKeepAlive(true);
  const { connected, publicKey, sendTransaction, isPrivyUser } = useWallet();
  const { connection } = useConnection();
  const [currentView, setCurrentView] = useState<View>(viewFromPath);
  // Round-entry in-flight guard: ref blocks instant double-taps (before re-render),
  // state drives the button spinner/disable. Prevents the "tap again → error" bug.
  const isEnteringRoundRef = useRef(false);
  const [isEnteringRound, setIsEnteringRound] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [nerdMintCopied, setNerdMintCopied] = useState(false);
  const [isBuyLivesOpen, setIsBuyLivesOpen] = useState(false);
  const [showFirstTimeDeposit, setShowFirstTimeDeposit] = useState(false);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [showWalletRequired, setShowWalletRequired] = useState(false);
  const [appLoading, setAppLoading] = useState(true);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(() => {
    try { return localStorage.getItem('soltrivia_terms_accepted') === 'true'; } catch { return false; }
  });
  
  const [lives, setLives] = useState<number | null>(null);
  const [livesDisplayReady, setLivesDisplayReady] = useState(false); // false = show "—" for first 5s after connect
  const [roundEntriesUsed, setRoundEntriesUsed] = useState(0);
  const [freeEntryNotification, setFreeEntryNotification] = useState<string | null>(null);
  // Per-round entry cap. First entry is free of life cost; entries 2-5 cost 1 life each.
  // Server-side double-check at App.tsx:813 enforces the same cap from the DB.
  const ROUND_ENTRIES_MAX = 5;
  
  // Seeker Genesis Token verification status (for discounted lives pricing)
  const [isSeekerVerified, setIsSeekerVerified] = useState(false);
  // Onboarding modal gate (v2.1, 2026-06-05). When a NEW wallet connects
  // (or any wallet whose profile lacks onboarded_at), we render
  // OnboardingModal on top of everything until they finish age + ToS + name.
  // Existing players were grandfathered via the migration so they skip this.
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [onboardingSeekerDomain, setOnboardingSeekerDomain] = useState<string | null>(null);
  const [onboardingPendingRef, setOnboardingPendingRef] = useState<string | null>(null);

  // Game Pass state (unlocks premium practice categories)
  const [hasGamePass, setHasGamePass] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);

  // Quiz results state
  const [lastGameResults, setLastGameResults] = useState<{ score: number, points: number, time: number, rank?: number; scoreSaveFailed?: boolean } | null>(null);
  
  // Current game session ID
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Practice mode state
  const [practiceQuestionIds, setPracticeQuestionIds] = useState<string[] | null>(null);
  const [practiceResults, setPracticeResults] = useState<{ score: number; points: number; time: number } | null>(null);

  // Custom Games state
  const [customGameSlug, setCustomGameSlug] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path.startsWith('/game/') && path.length > 6) return path.slice(6);
    return null;
  });
  const [customGameSessionId, setCustomGameSessionId] = useState<string | null>(null);
  const [customGameData, setCustomGameData] = useState<{ name: string; questionCount: number; roundCount: number; timeLimitSeconds: number; isPaidGame?: boolean; isCreatorFunded?: boolean; prizePotSol?: number; entryFeeLamports?: number; tokenSymbol?: string; tokenDecimals?: number; tokenMint?: string | null; gameStatus?: string; entriesRemaining?: number | null } | null>(null);
  const [customGameResults, setCustomGameResults] = useState<{
    score: number; correctCount: number; totalQuestions: number; totalPoints: number;
    timeTakenMs: number; rank: number | null; gameName: string; slug: string;
    isPaidGame?: boolean; isCreatorFunded?: boolean; prizePotSol?: number; entryFeeLamports?: number;
    tokenSymbol?: string; tokenDecimals?: number; tokenMint?: string | null;
    gameStatus?: string; entriesRemaining?: number | null;
  } | null>(null);
  const [customGameAttemptsUsed, setCustomGameAttemptsUsed] = useState(0);
  const [showContentDisclaimer, setShowContentDisclaimer] = useState(false);

  // Duel state
  const [duelId, setDuelId] = useState<number | null>(null);           // on-chain duel ID
  const [dbDuelId, setDbDuelId] = useState<string | null>(null);       // Supabase UUID
  const [duelShareCode, setDuelShareCode] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const path = window.location.pathname;
    if (path.startsWith('/duel/') && path.length > 6) return path.slice(6);
    return null;
  });
  const [duelEntryFee, setDuelEntryFee] = useState(0);
  /**
   * v2.1: SPL token info for the active duel. All three set together when the
   * duel is an SPL wager; left as null/undefined for SOL duels. The display
   * components (DuelWaitingView, DuelsViewV2 rows) branch on whether
   * duelTokenSymbol is present.
   */
  const [duelTokenSymbol, setDuelTokenSymbol] = useState<string | null>(null);
  const [duelTokenDecimals, setDuelTokenDecimals] = useState<number | null>(null);
  const [duelTokenMint, setDuelTokenMint] = useState<string | null>(null);
  /**
   * v2.1 hybrid: solo mode for DUEL_PLAY — creator pre-playing before any
   * opponent has joined. When true, DuelQuizView skips opponent subscription
   * and onFinish routes back to DUEL_WAITING instead of DUEL_RESULTS.
   */
  const [duelSoloMode, setDuelSoloMode] = useState<boolean>(false);
  /**
   * v2.1 hybrid: tracks whether the creator has banked their score for the
   * active duel. Sourced from the duel record (player1.finished). Passed to
   * DuelWaitingView so the screen renders the right pre/post-play state.
   */
  const [duelCreatorFinished, setDuelCreatorFinished] = useState<boolean>(false);
  const [duelIsPublic, setDuelIsPublic] = useState(true);
  const [duelExpiresAt, setDuelExpiresAt] = useState('');
  const [duelOpponent, setDuelOpponent] = useState<{ wallet: string; username: string | null; avatar: string | null } | null>(null);
  const [duelIsPlayer1, setDuelIsPlayer1] = useState(true);
  const [duelResults, setDuelResults] = useState<{
    myScore: number; myCorrect: number;
    opponentScore: number; opponentCorrect: number;
    winner: string | null; duelComplete: boolean;
    totalPot: number;
  } | null>(null);

  // Claims data for PlayView
  const [claimableRoundPayouts, setClaimableRoundPayouts] = useState<ClaimablePayout[]>([]);
  const [claimableCustomGames, setClaimableCustomGames] = useState<ClaimableCustomGameWin[]>([]);
  const [refundableEntries, setRefundableEntries] = useState<RefundableEntry[]>([]);
  const [refundableCustomGames, setRefundableCustomGames] = useState<RefundableCustomGame[]>([]);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Round-entry recovery (Kyle 2026-06-07). Mirror of native RoundRecoveryProvider.
  // When a pending entry sits in localStorage AND the corresponding round is still
  // active, offer the player a resume modal. No SOL is re-spent — start-game v73
  // verifies the saved tx and either resumes the existing session or creates one.
  const [pendingRecoveryEntry, setPendingRecoveryEntry] = useState<PendingRoundEntry | null>(null);
  const [pendingRecoveryEndsAt, setPendingRecoveryEndsAt] = useState<number | null>(null);
  const [pendingRecoveryBusy, setPendingRecoveryBusy] = useState(false);
  const recoveryDismissedRef = useRef<Set<string>>(new Set());
  const [showFundingDisclaimer, setShowFundingDisclaimer] = useState(false);
  const [fundingGameData, setFundingGameData] = useState<CustomGameData | null>(null);
  const [funding, setFunding] = useState(false);

  // Ref: current wallet so async fetch can avoid applying stale result for a different wallet (reload race)
  const currentWalletRef = useRef<string | null>(null);
  currentWalletRef.current = publicKey?.toBase58() ?? null;

  const livesIntervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const livesTimeoutRef = useRef<number | null>(null);
  const livesShowAfterRef = useRef<number | null>(null);

  // Only active-game views truly require wallet (quiz in progress, viewing results)
  const walletRequiredViews = [View.QUIZ, View.RESULTS, View.CUSTOM_GAME_CREATE, View.CUSTOM_GAME_PLAY, View.DUEL_PLAY, View.DUEL_RESULTS];

  // Lives: on load/reload do not show count for 5s; keep fetching then show (avoids wrong value from wallet race)
  useEffect(() => {
    if (!connected || !publicKey) {
      setLives(null);
      setLivesDisplayReady(false);
      return;
    }

    setLivesDisplayReady(false);
    const walletAddress = publicKey.toBase58();

    const fetchLivesOnly = async (forWallet: string) => {
      try {
        const res = await getPlayerLives(forWallet);
        const count = Math.max(0, Number(res.lives_count) || 0);
        if (currentWalletRef.current === forWallet) {
          setLives(count);
        }
      } catch (err) {
        if (currentWalletRef.current === forWallet) setLives(0);
      }
    };

    const fetchAll = async () => {
      await fetchLivesOnly(walletAddress);
      if (currentWalletRef.current === walletAddress) {
        registerPlayerProfile(walletAddress).catch(() => {});
        if (!currentSessionId) getRoundEntriesUsed(walletAddress).then(setRoundEntriesUsed).catch(() => {});
      }
    };

    livesTimeoutRef.current = window.setTimeout(() => {
      livesTimeoutRef.current = null;
      fetchAll();
      livesIntervalsRef.current = [
        setInterval(() => fetchLivesOnly(walletAddress), 2000),
        setInterval(fetchAll, 30000),
      ];
      // Show lives count only after 5s of fetching for this address
      livesShowAfterRef.current = window.setTimeout(() => {
        livesShowAfterRef.current = null;
        setLivesDisplayReady(true);
      }, 5000);
    }, 250);

    return () => {
      if (livesTimeoutRef.current) {
        clearTimeout(livesTimeoutRef.current);
        livesTimeoutRef.current = null;
      }
      if (livesShowAfterRef.current) {
        clearTimeout(livesShowAfterRef.current);
        livesShowAfterRef.current = null;
      }
      livesIntervalsRef.current.forEach(clearInterval);
      livesIntervalsRef.current = [];
    };
  }, [connected, publicKey, currentSessionId]);

  // Check wallet connection when navigating
  const handleViewChange = (view: View) => {
    // QUIZ and RESULTS require active wallet connection
    if (walletRequiredViews.includes(view) && !connected) {
      setShowWalletRequired(true);
      return;
    }

    setCurrentView(view);
  };

  // Sync path to URL when view changes (so reload keeps the same page)
  useEffect(() => {
    const want = pathForView(currentView, customGameSlug, duelShareCode);
    if (window.location.pathname.replace(/\/$/, '') !== want.replace(/\/$/, '')) {
      window.history.replaceState(null, '', want);
    }
  }, [currentView, customGameSlug, duelShareCode]);

  // Back/forward: update view from path (+ extract custom game slug / duel share code)
  useEffect(() => {
    const onPopState = () => {
      const view = viewFromPath();
      setCurrentView(view);
      const path = window.location.pathname;
      if (view === View.CUSTOM_GAME_LOBBY) {
        if (path.startsWith('/game/') && path.length > 6) setCustomGameSlug(path.slice(6));
      }
      if (view === View.DUEL_WAITING) {
        if (path.startsWith('/duel/') && path.length > 6) setDuelShareCode(path.slice(6));
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Restore quiz session from sessionStorage when we land on /quiz (e.g. after reload)
  useEffect(() => {
    if (currentView !== View.QUIZ || currentSessionId != null || !connected) return;
    try {
      const stored = sessionStorage.getItem('quiz_session_id');
      if (stored) setCurrentSessionId(stored);
    } catch (_) {}
  }, [currentView, connected, currentSessionId]);

  // Redirect to HOME only when user disconnects from views that need wallet data
  const disconnectRedirectViews = [View.QUIZ, View.RESULTS, View.PROFILE, View.CUSTOM_GAME_PLAY, View.CUSTOM_GAME_RESULTS, View.DUEL_PLAY, View.DUEL_RESULTS];
  const prevConnectedRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    const wasConnected = prevConnectedRef.current;
    prevConnectedRef.current = connected;
    if (wasConnected === true && !connected && disconnectRedirectViews.includes(currentView)) {
      setCurrentView(View.HOME);
    }
  }, [connected, currentView]);

  // Close wallet required modal when wallet connects
  useEffect(() => {
    if (connected && showWalletRequired) {
      setShowWalletRequired(false);
    }
  }, [connected, showWalletRequired]);

  // First-time deposit modal — fires once per wallet for embedded-wallet users (Privy or
  // Phantom Connect) whose balance is below the minimum to play.
  // Native wallet users (Phantom extension, Solflare, Backpack, MWA) already manage their
  // own SOL elsewhere, so we don't pester them.
  useEffect(() => {
    if (!connected || !publicKey) return;
    // Privy-only: embedded signup wallets start empty with no external funding
    // UI. Phantom-Connect + external/MWA wallets manage their own SOL, so we
    // never show them the fund-your-wallet modal.
    if (!isPrivyUser) return;

    const wallet = publicKey.toBase58();
    let dismissedKey: string;
    try {
      dismissedKey = `soltrivia_deposit_modal_dismissed_${wallet}`;
      if (localStorage.getItem(dismissedKey) === 'true') return;
    } catch {
      return; // localStorage unavailable, skip the modal
    }

    let cancelled = false;
    (async () => {
      try {
        const lamports = await getBalanceSafely(connection, publicKey);
        if (cancelled || lamports === null) return;
        const sol = lamports / 1e9;
        // Trigger if under 0.025 SOL — they can't enter a round at this balance
        if (sol < 0.025) {
          setShowFirstTimeDeposit(true);
        } else {
          // Funded — mark dismissed so we never bother them again
          try { localStorage.setItem(dismissedKey, 'true'); } catch { /* noop */ }
        }
      } catch {
        // Network failure — don't block the user
      }
    })();
    return () => { cancelled = true; };
  }, [connected, publicKey, isPrivyUser, connection]);

  // Add-to-Homescreen prompt: only at a fresh signup/login (first time this
  // wallet connects on this device), and only on real mobile web — never on
  // desktop, never when already installed, and never inside the Seeker TWA
  // (those users installed from the dApp store).
  useEffect(() => {
    if (!connected || !publicKey) return;
    if (!isMobileDevice() || isStandalonePWA() || isInTWA()) return;
    if (a2hsDismissedRecently()) return;
    if (!isFreshWalletOnThisDevice(publicKey.toBase58())) return;
    setShowInstallPrompt(true);
  }, [connected, publicKey]);

  // Auto-dismiss free-entry notification after 5 seconds
  useEffect(() => {
    if (!freeEntryNotification) return;
    const t = setTimeout(() => setFreeEntryNotification(null), 5000);
    return () => clearTimeout(t);
  }, [freeEntryNotification]);

  // Onboarding gate — fires once per wallet connect. If the profile lacks
  // `onboarded_at`, we surface the 3-step modal. Pre-fills referral input
  // with any code captured from `?ref=X` so the user sees who referred them.
  useEffect(() => {
    if (!connected || !publicKey) {
      setNeedsOnboarding(false);
      setOnboardingSeekerDomain(null);
      setOnboardingPendingRef(null);
      return;
    }
    const walletAddr = publicKey.toBase58();
    let cancelled = false;
    getOnboardingStatus(walletAddr)
      .then((status) => {
        if (cancelled || currentWalletRef.current !== walletAddr) return;
        setNeedsOnboarding(status.needsOnboarding);
        setOnboardingSeekerDomain(status.seekerDomain);
        try {
          const stored = localStorage.getItem('soltrivia_referral_code');
          setOnboardingPendingRef(stored?.trim() || null);
        } catch {
          setOnboardingPendingRef(null);
        }
      })
      .catch(() => {
        // Defensive: never block the app behind a transient failure here.
        if (!cancelled) setNeedsOnboarding(false);
      });
    return () => { cancelled = true; };
  }, [connected, publicKey]);

  // Fetch Seeker verification status + Game Pass when wallet connects
  useEffect(() => {
    if (!connected || !publicKey) {
      setIsSeekerVerified(false);
      setHasGamePass(false);
      return;
    }
    const walletAddr = publicKey.toBase58();
    getSeekerProfile(walletAddr)
      .then((profile) => {
        if (currentWalletRef.current === walletAddr) {
          setIsSeekerVerified(profile?.is_seeker_verified ?? false);
        }
      })
      .catch(() => {});
    checkGamePass(walletAddr)
      .then((status) => {
        if (currentWalletRef.current === walletAddr) {
          setHasGamePass(status.is_active);
        }
      })
      .catch(() => {});
    // Fetch claim/refund data via on-chain-truth wrappers (claims.ts).
    // Each wrapper combines the DB fetch with a per-player on-chain filter
    // so ghost / already-claimed rows are dropped before they reach state.
    fetchUnpaidRoundPayouts(connection, walletAddr).then((p) => {
      if (currentWalletRef.current === walletAddr) setClaimableRoundPayouts(p);
    }).catch(() => {});
    fetchUnclaimedCustomWins(connection, walletAddr).then((c) => {
      if (currentWalletRef.current === walletAddr) setClaimableCustomGames(c);
    }).catch(() => {});
    fetchClaimableRefundEntries(connection, walletAddr).then((e) => {
      if (currentWalletRef.current === walletAddr) setRefundableEntries(e);
    }).catch(() => {});
    fetchClaimableRefundCustoms(connection, walletAddr).then((c) => {
      if (currentWalletRef.current === walletAddr) setRefundableCustomGames(c);
    }).catch(() => {});
  }, [connected, publicKey]);

  // Round-entry recovery scan (Kyle 2026-06-07). Runs whenever the wallet
  // becomes available (initial connect, reconnect, page refresh) AND on
  // every page visibility change (so tab-switch back triggers a re-check).
  // Mirror of native RoundRecoveryProvider, scoped to soltrivia.app.
  useEffect(() => {
    if (!connected || !publicKey) return;
    let cancelled = false;

    const checkForPending = async () => {
      pruneStalePendingEntries();
      const all = listAllPendingRoundEntries();
      if (all.length === 0) return;
      for (const entry of all) {
        const key = `${entry.date}:${entry.roundNumber}`;
        if (recoveryDismissedRef.current.has(key)) continue;
        try {
          // Use supabase REST to check the round is still active. Skip
          // if not (refund cron will handle).
          const { data: round } = await import('./src/utils/supabase').then(m =>
            m.supabase
              .from('daily_rounds')
              .select('status')
              .eq('date', entry.date)
              .eq('round_number', entry.roundNumber)
              .maybeSingle()
          );
          if (!round || (round as any).status !== 'active') {
            clearPendingRoundEntry(entry.date, entry.roundNumber);
            continue;
          }
        } catch {
          continue; // DB unreachable — try next focus
        }
        if (cancelled) return;
        const [y, m, d] = entry.date.split('-').map(Number);
        const startUtc = Date.UTC(y, m - 1, d) + entry.roundNumber * 6 * 3600 * 1000;
        setPendingRecoveryEntry(entry);
        setPendingRecoveryEndsAt(startUtc + 6 * 3600 * 1000);
        return;
      }
    };

    checkForPending();
    const onVis = () => {
      if (document.visibilityState === 'visible') checkForPending();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [connected, publicKey]);

  const handlePendingRecoveryResume = async () => {
    if (!pendingRecoveryEntry || !publicKey) return;
    setPendingRecoveryBusy(true);
    try {
      const session = await startGame(
        publicKey.toBase58(),
        pendingRecoveryEntry.txSignature,
        pendingRecoveryEntry.tierIndex,
      );
      clearPendingRoundEntry(
        pendingRecoveryEntry.date,
        pendingRecoveryEntry.roundNumber,
      );
      setCurrentSessionId(session.sessionId);
      try {
        sessionStorage.setItem('quiz_session_id', session.sessionId);
      } catch (_) { /* non-fatal */ }
      setPendingRecoveryEntry(null);
      setCurrentView(View.QUIZ);
    } catch {
      // Leave the entry in localStorage — next visibility change will
      // re-offer. Most likely cause: round flipped to refund status in
      // the few seconds between the modal opening and Resume click.
    } finally {
      setPendingRecoveryBusy(false);
    }
  };

  const handlePendingRecoveryDismiss = () => {
    if (!pendingRecoveryEntry) return;
    recoveryDismissedRef.current.add(
      `${pendingRecoveryEntry.date}:${pendingRecoveryEntry.roundNumber}`,
    );
    setPendingRecoveryEntry(null);
  };

  // Referral: capture ?ref=CODE from URL on mount → store in localStorage → clean URL
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refCode = params.get('ref');
      if (refCode && refCode.trim()) {
        localStorage.setItem('soltrivia_referral_code', refCode.trim());
        // Remove ?ref= from URL without page reload
        params.delete('ref');
        const cleanUrl = params.toString()
          ? `${window.location.pathname}?${params.toString()}`
          : window.location.pathname;
        window.history.replaceState(null, '', cleanUrl);
      }
    } catch (_) {}
  }, []);

  // Referral: register referral when wallet connects (if stored code exists)
  const referralRegisteredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!connected || !publicKey) return;
    const walletAddr = publicKey.toBase58();
    // Only attempt once per wallet per session
    if (referralRegisteredRef.current === walletAddr) return;
    try {
      const storedCode = localStorage.getItem('soltrivia_referral_code');
      if (!storedCode) return;
      referralRegisteredRef.current = walletAddr;
      registerReferral(walletAddr, storedCode)
        .then(() => {
          // Successfully registered — clear stored code
          localStorage.removeItem('soltrivia_referral_code');
        })
        .catch((err) => {
          // Non-fatal: self-referral, already referred, invalid code, etc.
          // Clear code on known non-retryable errors
          if (err.message?.includes('self-referral') || err.message?.includes('already been referred')) {
            localStorage.removeItem('soltrivia_referral_code');
          }
        });
    } catch (_) {}
  }, [connected, publicKey]);

  // Admin access: Check URL on mount for /adminlogin
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/adminlogin' || path === '/admin') {
      setCurrentView(View.ADMIN);
      // Update URL without page reload
      window.history.replaceState({}, '', '/adminlogin');
    }
  }, []);

  // Admin access: Ctrl+Shift+A keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setCurrentView(View.ADMIN);
        window.history.replaceState({}, '', '/adminlogin');
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Update URL when navigating away from admin
  useEffect(() => {
    if (currentView !== View.ADMIN && window.location.pathname === '/adminlogin') {
      window.history.replaceState({}, '', '/');
    }
  }, [currentView]);

  // Profile state (DEFAULT_AVATAR = inline SVG, no network, fast load)
  const [profile, setProfile] = useState({
    username: 'Solana_Sage',
    avatar: DEFAULT_AVATAR,
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileCacheBuster, setProfileCacheBuster] = useState(0);

  const refetchProfile = React.useCallback(async () => {
    if (!publicKey) return;
    const walletAddress = publicKey.toBase58();
    try {
      const { data, error } = await supabase
        .from('player_profiles')
        .select('username, avatar_url')
        .eq('wallet_address', walletAddress)
        .maybeSingle();
      if (data && !error) {
        setProfile({
          username: data.username || 'Solana_Sage',
          avatar: data.avatar_url || DEFAULT_AVATAR,
        });
      }
    } catch (_) {}
  }, [publicKey]);

  // Fetch profile when wallet connects (single fast Supabase query)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!connected || !publicKey) {
        setProfile({ username: 'Solana_Sage', avatar: DEFAULT_AVATAR });
        return;
      }

      setProfileLoading(true);
      const walletAddress = publicKey.toBase58();

      try {
        const { data: profileData, error } = await supabase
          .from('player_profiles')
          .select('username, avatar_url')
          .eq('wallet_address', walletAddress)
          .single();

        if (profileData && !error) {
          setProfile({
            username: profileData.username || 'Solana_Sage',
            avatar: profileData.avatar_url || DEFAULT_AVATAR,
          });
          // Mark identity_sync quest complete if profile is set up (username or avatar)
          const hasProfile = (profileData.username && String(profileData.username).trim() !== '') || (profileData.avatar_url && String(profileData.avatar_url).trim() !== '');
          if (hasProfile) {
            try {
              await updateQuestProgress(walletAddress, 'identity_sync', 1);
            } catch (_) {
              // ignore
            }
          }
        } else if (error && error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error);
        }
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setProfileLoading(false);
      }
    };

    fetchProfile();
  }, [connected, publicKey]);

  // Refetch profile when user opens Profile tab so we always show latest from DB (fixes refresh showing stale/default)
  useEffect(() => {
    if (currentView !== View.PROFILE || !connected || !publicKey) return;
    refetchProfile();
  }, [currentView, connected, publicKey, refetchProfile]);

  // Refetch round entries when user navigates to Play so 2/2 → 1/2 → 0/2 is correct from DB
  useEffect(() => {
    if (currentView !== View.PLAY || !connected || !publicKey || currentSessionId) return;
    getRoundEntriesUsed(publicKey.toBase58()).then(setRoundEntriesUsed).catch(() => {});
  }, [currentView, connected, publicKey, currentSessionId]);

  const handleUpdateProfile = async (username: string, avatar: string) => {
    if (!publicKey) return;

    // Optimistically update UI
    setProfile({ username, avatar });

    const walletAddress = publicKey.toBase58();

    try {
      const result = await updateProfile(walletAddress, {
        username,
        avatarUrl: avatar,
      });

      if (result.success) {
        setProfile({
          username: result.username || username,
          avatar: result.avatar_url || avatar,
        });
        setProfileCacheBuster(Date.now());
      }

      try {
        await updateQuestProgress(walletAddress, 'identity_sync', 1);
      } catch {
        // ignore quest update failure
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      alert('Profile save failed. Please try again.');
    }
  };

  const PRACTICE_DAILY_LIMIT = 5;

  const getPracticeUsageToday = (): number => {
    try {
      const stored = localStorage.getItem('practice_usage');
      if (!stored) return 0;
      const { date, count } = JSON.parse(stored);
      const today = new Date().toISOString().split('T')[0];
      return date === today ? count : 0;
    } catch { return 0; }
  };

  const incrementPracticeUsage = () => {
    const today = new Date().toISOString().split('T')[0];
    const current = getPracticeUsageToday();
    localStorage.setItem('practice_usage', JSON.stringify({ date: today, count: current + 1 }));
  };

  const practiceRunsLeft = PRACTICE_DAILY_LIMIT - getPracticeUsageToday();

  const handleStartPractice = () => {
    // Game pass holders get unlimited practice runs
    if (!hasGamePass && practiceRunsLeft <= 0) {
      alert('You\'ve used all 5 practice runs for today. Come back tomorrow, get a Game Pass for unlimited plays, or play for real SOL!');
      return;
    }
    setShowCategorySelector(true);
  };

  const handleCategorySelected = async (category: string) => {
    setShowCategorySelector(false);
    try {
      console.log('🎮 Starting practice mode...', { category });
      const walletAddr = publicKey?.toBase58() ?? undefined;
      const response = await startPracticeGame({
        category: category === 'all' ? undefined : category,
        wallet_address: walletAddr,
      });
      console.log('✅ Practice session created:', response.practice_session_id);
      if (!hasGamePass) incrementPracticeUsage();
      setPracticeQuestionIds(response.question_ids);
      setPracticeResults(null);
      setCurrentView(View.PRACTICE);
    } catch (err: any) {
      console.error('❌ Failed to start practice game:', err);
      // v2.1: practice-game EF v29 returns 429 with code='PRACTICE_CAP_REACHED'
      // when the wallet has hit the 5/24h rolling cap. Server-side enforcement;
      // can't be bypassed by clearing localStorage. Game Pass holders bypass.
      if (err.code === 'PRACTICE_CAP_REACHED' || err.status === 429) {
        alert(
          err.message ||
          `Daily practice cap reached (${err.cap ?? 5}/24h). Come back in 24h or get a Game Pass for unlimited plays.`
        );
      } else if (err.requires_pass) {
        alert('Game Pass required for this category. Get a Game Pass to unlock all categories!');
        setShowCategorySelector(true);
      } else {
        alert(err.message || 'Failed to start practice mode. Please try again.');
      }
    }
  };

  const handlePracticeFinish = (correctCount: number, points: number, totalTimeSeconds: number) => {
    console.log('🎮 Practice finished:', { correctCount, points, totalTimeSeconds });
    setPracticeResults({ score: correctCount, points, time: totalTimeSeconds });
    setPracticeQuestionIds(null);
    setCurrentView(View.PRACTICE_RESULTS);
  };

  const handleQuizFinish = async (correctCount: number, points: number, totalTimeSeconds: number) => {
    const sessionIdToComplete = currentSessionId;
    // Keep currentSessionId set until we switch view so QuizView doesn't see null and log an error

    let rank: number | undefined = undefined;

    // Store final score in Supabase via complete-session (so profile + leaderboard show it), with retry
    let scoreSaveFailed = false;
    if (sessionIdToComplete) {
      const payload = {
        session_id: sessionIdToComplete,
        total_score: points,
        correct_count: correctCount,
        time_taken_ms: Math.round(totalTimeSeconds * 1000),
      };
      const maxAttempts = 3;
      const delayMs = 500;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const completeRes = await completeSession(payload);
          rank = completeRes.rank ?? undefined;
          console.log('✅ Session completed, rank:', rank);
          break;
        } catch (err) {
          console.error(`Complete session attempt ${attempt}/${maxAttempts} failed:`, err);
          if (attempt < maxAttempts) {
            await new Promise((r) => setTimeout(r, delayMs));
          } else {
            scoreSaveFailed = true;
          }
        }
      }
    }

    // If rank not from complete-session, fetch from leaderboard
    if (rank === undefined && publicKey) {
      try {
        const response = await getLeaderboard();
        const leaderboard = Array.isArray(response) ? response : (response.leaderboard || []);
        const userAddress = publicKey.toBase58();
        const userEntry = leaderboard.find((entry: any) => entry.wallet_address === userAddress);
        rank = userEntry?.rank;
        console.log('🏆 User rank from leaderboard:', rank);
      } catch (err) {
        console.error('Failed to fetch rank:', err);
      }
    }

    if (publicKey) {
      await new Promise((r) => setTimeout(r, 500));
      try {
        const walletAddr = publicKey.toBase58();
        const [livesData, entriesUsed] = await Promise.all([
          getPlayerLives(walletAddr),
          getRoundEntriesUsed(walletAddr),
        ]);
        setLives(Math.max(0, Number(livesData.lives_count) || 0));
        setRoundEntriesUsed(entriesUsed);
      } catch (_) {}
    }

    setLastGameResults({ score: correctCount, points, time: totalTimeSeconds, rank, scoreSaveFailed });
    setCurrentView(View.RESULTS);
    setCurrentSessionId(null);
    try {
      sessionStorage.removeItem('quiz_session_id');
    } catch (_) {}
  };

  const handleStartQuiz = async (tierIndex: number = 0) => {
    if (!PAID_TRIVIA_ENABLED) return;
    if (!connected || !publicKey) {
      setShowWalletRequired(true);
      return;
    }
    // Block re-entry while a round entry is already in flight (covers every call site:
    // RoundsView CTA, results "play again", free-play "play for real"). Synchronous ref
    // so a fast double-tap is rejected before React re-renders the disabled button.
    if (isEnteringRoundRef.current) return;

    // Check if player can play (has round entries OR purchased lives)
    const roundEntriesLeft = ROUND_ENTRIES_MAX - roundEntriesUsed;
    if (roundEntriesLeft <= 0 && (lives ?? 0) <= 0) {
      setIsBuyLivesOpen(true);
      return;
    }

    try {
      // Lock the entry button for the whole flow (pre-checks → build → sign → confirm).
      isEnteringRoundRef.current = true;
      setIsEnteringRound(true);

      // --- Pre-flight entry cap check (BEFORE taking payment) ---
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const roundNumber = Math.floor(now.getUTCHours() / 6);
      const walletAddr = publicKey.toBase58();

      const { data: currentRound } = await supabase
        .from('daily_rounds')
        .select('id')
        .eq('date', today)
        .eq('round_number', roundNumber)
        .maybeSingle();

      if (currentRound) {
        const { data: roundSessions } = await supabase
          .from('game_sessions')
          .select('id, finished_at')
          .eq('round_id', currentRound.id)
          .eq('wallet_address', walletAddr);

        const finishedInRound = roundSessions?.filter(s => s.finished_at).length || 0;
        if (finishedInRound >= 5) {
          alert('You\'ve reached the maximum 5 entries for this round. Try again next round!');
          return;
        }
      }

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: dailySessions } = await supabase
        .from('game_sessions')
        .select('id')
        .eq('wallet_address', walletAddr)
        .gte('started_at', twentyFourHoursAgo)
        .not('finished_at', 'is', null)
        .limit(25);
      const dailyCount = dailySessions?.length ?? 0;

      if (dailyCount >= 20) {
        alert('You\'ve reached the maximum 20 entries for today. Please try again tomorrow!');
        return;
      }

      // Pre-check (lives model 2026-04-26): first entry per round is free of life cost.
      // Only block if the player is RE-entering this round AND has no lives.
      try {
        const { data: currentRound } = await supabase
          .from('daily_rounds')
          .select('id')
          .eq('date', today)
          .eq('round_number', roundNumber)
          .maybeSingle();

        let entriesThisRound = 0;
        if (currentRound?.id) {
          const { count } = await supabase
            .from('game_sessions')
            .select('id', { count: 'exact', head: true })
            .eq('wallet_address', walletAddr)
            .eq('round_id', currentRound.id);
          entriesThisRound = count ?? 0;
        }

        if (entriesThisRound > 0) {
          const livesData = await getPlayerLives(walletAddr);
          if ((livesData.lives_count ?? 0) <= 0) {
            setIsBuyLivesOpen(true);
            return;
          }
        }
      } catch (livesCheckErr) {
        console.warn('Lives pre-check failed, proceeding anyway:', livesCheckErr);
      }

      // The V2 program has been initialized since Feb 2026. The initialize-program call
      // is a paranoid no-op — wrap it so a transient failure (CORS cache, RPC blip)
      // never blocks a real player from entering a round.
      try {
        await initializeProgram({
          revenueWallet: REVENUE_WALLET,
          useDevnet: SOLANA_NETWORK === 'devnet',
        });
      } catch (initErr) {
        console.warn('initializeProgram failed (non-fatal, program is already initialized):', initErr);
      }
      // Atomic round entry: EF returns a tx with enter_tier_round (+ create_tier_round
      // partial-signed by operator if PDA doesn't exist). Operator only pays PDA rent if
      // the user actually signs and the tx confirms — fixes the "round created, nobody joins" leak.
      const entryTxResp = await buildRoundEntryTx(publicKey.toBase58(), {
        date: today,
        round_number: roundNumber,
        tier_index: tierIndex,
        ...(SOLANA_NETWORK === 'devnet' ? { useDevnet: true } : {}),
      });
      const txBytes = Uint8Array.from(atob(entryTxResp.tx_base64), c => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(txBytes);

      // Debug: simulate transaction to get detailed error before wallet sends
      try {
        const simResult = await connection.simulateTransaction(transaction, { sigVerify: false });
        if (simResult.value.err) {
          console.error('🔴 TX simulation failed:', JSON.stringify(simResult.value.err));
          console.error('🔴 Logs:', simResult.value.logs);
        } else {
          console.log('✅ TX simulation OK. Logs:', simResult.value.logs);
        }
      } catch (simErr) {
        console.error('🔴 Simulation call error:', simErr);
      }

      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      const confirmationPromise = connection.confirmTransaction(signature, 'confirmed');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)
      );
      
      await Promise.race([confirmationPromise, timeoutPromise]);

      // RECOVERY: persist the paid-but-unstarted entry to localStorage so the
      // RoundRecoveryModal can offer resume if the next step (start-game)
      // dies for any reason (network blip, tab close, JS crash). Saved
      // BEFORE the EF call — we'd rather have a stale entry than miss a
      // real recovery (clearPendingRoundEntry below is idempotent).
      // Kyle 2026-06-07.
      savePendingRoundEntry({
        txSignature: signature,
        date: today,
        roundNumber,
        tierIndex,
        paidAt: Date.now(),
      });

      // Call backend to start game session
      const gameResult = await startGame(publicKey.toBase58(), signature, tierIndex);

      // Session created → drop the pending entry.
      clearPendingRoundEntry(today, roundNumber);

      console.log('🎮 startGame result:', JSON.stringify(gameResult));

      // Store session ID for quiz (and persist so reload on /quiz keeps the game)
      setCurrentSessionId(gameResult.sessionId);
      try {
        sessionStorage.setItem('quiz_session_id', gameResult.sessionId);
      } catch (_) {}

      // Optimistically update UI based on whether it was a free or paid entry
      if (gameResult.freeEntry) {
        setRoundEntriesUsed(prev => prev + 1);
        setFreeEntryNotification('Free entry — your first play this round.');
      } else if (!gameResult.resumed) {
        setLives(prev => Math.max(0, (prev ?? 0) - 1));
        setRoundEntriesUsed(prev => prev + 1);
      }
      setCurrentView(View.QUIZ);
    } catch (err: any) {
      console.error('Failed to start quiz:', err);

      // Show error to user
      if (err.message?.includes('User rejected')) {
        // User cancelled, don't show error
        return;
      }

      // Handle entry cap errors
      if (err.code === 'ROUND_CAP_REACHED') {
        alert('You\'ve reached the maximum 5 entries for this round. Try again next round!');
        return;
      }
      if (err.code === 'DAILY_CAP_REACHED') {
        alert('You\'ve reached the maximum 20 entries for today. Please try again tomorrow!');
        return;
      }

      // If no lives and free entries used, open buy lives modal
      if (err.code === 'NO_LIVES' || err.code === 'ALREADY_PLAYED' || err.message?.includes('Free entries used') || err.message?.includes('Insufficient lives')) {
        setIsBuyLivesOpen(true);
        return;
      }

      // For other errors, show the message
      alert(err.message || 'Failed to start quiz. Please try again.');
    } finally {
      // Always unlock the entry button, whether we entered, errored, hit a cap, or the
      // user cancelled the wallet prompt. (return inside try/catch still runs finally.)
      isEnteringRoundRef.current = false;
      setIsEnteringRound(false);
    }
  };

  // ─── Custom Games Handlers ─────────────────────────────────────────────────
  const handleNavigateToCustomGames = () => {
    setCurrentView(View.CUSTOM_GAMES_HUB);
  };

  const handleNavigateToCreateGame = () => {
    if (!connected) {
      setShowWalletRequired(true);
      return;
    }
    if (!hasAcceptedContentDisclaimer()) {
      setShowContentDisclaimer(true);
      return;
    }
    setCurrentView(View.CUSTOM_GAME_CREATE);
  };

  const handleViewCustomGame = (slug: string) => {
    setCustomGameSlug(slug);
    setCustomGameSessionId(null);
    setCustomGameData(null);
    setCustomGameResults(null);
    setCustomGameAttemptsUsed(0);
    window.history.pushState({}, '', `/game/${slug}`);
    setCurrentView(View.CUSTOM_GAME_LOBBY);
  };

  const handleCustomGameCreated = (slug: string) => {
    setCustomGameSlug(slug);
    setCustomGameSessionId(null);
    setCustomGameData(null);
    setCustomGameResults(null);
    setCustomGameAttemptsUsed(0);
    setCurrentView(View.CUSTOM_GAME_LOBBY);
  };

  const handleStartCustomGame = async (gameData: CustomGameData) => {
    if (!connected || !publicKey) {
      setShowWalletRequired(true);
      return;
    }
    try {
      const walletAddr = publicKey.toBase58();
      const isPaidGame = gameData.prize_model === 'player_funded' || gameData.prize_model === 'creator_funded';
      const isReEntry = isPaidGame && gameData.player_attempts > 0 && !gameData.player_has_in_progress;

      let txSignature: string | undefined;
      if (isReEntry) {
        // Build system transfer for re-entry fee → revenue wallet
        const reEntryFee = getReEntryFeeLamports(gameData.entry_fee_lamports);
        const { blockhash } = await getRecentBlockhashWithRetry(connection);
        const ix = SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(REVENUE_WALLET),
          lamports: reEntryFee,
        });
        const messageV0 = new TransactionMessage({
          payerKey: publicKey,
          recentBlockhash: blockhash,
          instructions: [ix],
        }).compileToV0Message();
        const tx = new VersionedTransaction(messageV0);
        txSignature = await sendTransaction(tx, connection);
        await connection.confirmTransaction(txSignature, 'confirmed');
      }

      const res = await startCustomGame(gameData.game_id, walletAddr, txSignature);
      setCustomGameSessionId(res.session_id);
      const tokenDecimals = gameData.token_decimals ?? 9;
      const tokenDivisor = Math.pow(10, tokenDecimals);
      setCustomGameData({
        name: gameData.name,
        questionCount: gameData.question_count,
        roundCount: gameData.round_count,
        timeLimitSeconds: gameData.time_limit_seconds,
        isPaidGame,
        isCreatorFunded: gameData.prize_model === 'creator_funded',
        prizePotSol: gameData.prize_pot_lamports / tokenDivisor,
        entryFeeLamports: gameData.entry_fee_lamports,
        tokenSymbol: gameData.token_symbol ?? 'SOL',
        tokenDecimals,
        tokenMint: gameData.token_mint ?? null,
        gameStatus: gameData.status,
        entriesRemaining: gameData.player_entries_remaining ?? null,
      });
      setCustomGameAttemptsUsed(gameData.player_attempts + (res.resumed ? 0 : 1));
      setCurrentView(View.CUSTOM_GAME_PLAY);
    } catch (err: any) {
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to start custom game');
      }
    }
  };

  const handleCustomGameFinish = (results: {
    score: number; correctCount: number; totalPoints: number; timeTakenMs: number; rank: number | null;
  }) => {
    setCustomGameResults({
      ...results,
      totalQuestions: customGameData?.questionCount ?? 0,
      gameName: customGameData?.name ?? '',
      slug: customGameSlug ?? '',
      isPaidGame: customGameData?.isPaidGame,
      isCreatorFunded: customGameData?.isCreatorFunded,
      prizePotSol: customGameData?.prizePotSol,
      entryFeeLamports: customGameData?.entryFeeLamports,
      tokenSymbol: customGameData?.tokenSymbol,
      tokenDecimals: customGameData?.tokenDecimals,
      tokenMint: customGameData?.tokenMint,
      gameStatus: customGameData?.gameStatus,
      entriesRemaining: customGameData?.entriesRemaining,
    });
    setCustomGameSessionId(null);
    setCustomGameData(null);
    setCurrentView(View.CUSTOM_GAME_RESULTS);
  };

  const handleCustomGamePlayAgain = async () => {
    if (!customGameSlug || !connected || !publicKey) return;
    try {
      const walletAddr = publicKey.toBase58();
      const gameData = await import('./src/utils/api').then(m => m.getCustomGame(customGameSlug, walletAddr));
      await handleStartCustomGame(gameData);
    } catch (err: any) {
      alert(err.message || 'Failed to start custom game');
    }
  };

  // ─── Custom Games: Paid Game Handlers ──────────────────────────────────────
  const handleJoinCustomGame = async (gameData: CustomGameData) => {
    if (!connected || !publicKey) {
      setShowWalletRequired(true);
      return;
    }
    if (gameData.on_chain_game_id == null) {
      alert('Game is not set up on-chain yet. Please try again later.');
      return;
    }
    const { blockhash } = await getRecentBlockhashWithRetry(connection);
    const isSplGame = !!gameData.token_mint;
    const instructions: TransactionInstruction[] = [];
    if (isSplGame) {
      instructions.push(buildCreateAtaIdempotentIx({
        payer: publicKey,
        owner: publicKey,
        mint: new PublicKey(gameData.token_mint!),
      }));
    }
    instructions.push(
      gameData.prize_model === 'nft'
        ? buildEnterCustomGameNftIx({
            player: publicKey,
            gameId: gameData.on_chain_game_id,
            revenueWallet: new PublicKey(REVENUE_WALLET),
          })
        : isSplGame
          ? buildEnterCustomGameSplIx({
              player: publicKey,
              gameId: gameData.on_chain_game_id,
              mint: new PublicKey(gameData.token_mint!),
              revenueWallet: new PublicKey(REVENUE_WALLET),
            })
          : buildEnterCustomGameIx(
              publicKey,
              gameData.on_chain_game_id,
              new PublicKey(REVENUE_WALLET),
            ),
    );
    const messageV0 = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, 'confirmed');

    // Register entry in Supabase — if this fails, player paid on-chain but isn't registered
    try {
      await joinCustomGame(gameData.game_id, publicKey.toBase58(), signature);
    } catch (regErr: any) {
      console.error('Failed to register custom game entry in DB:', regErr);
      alert('Your payment was confirmed on-chain but registration failed. Please try refreshing the page. If the issue persists, contact support with tx: ' + signature);
      throw regErr;
    }
  };

  const handleStartCustomGameTimer = async (gameData: CustomGameData) => {
    if (!connected || !publicKey) {
      setShowWalletRequired(true);
      return;
    }
    await startCustomGameTimer(gameData.game_id, publicKey.toBase58());
  };

  // Show disclaimer modal before funding a creator-funded game
  const handleFundAndStartRequest = (gameData: CustomGameData) => {
    setFundingGameData(gameData);
    setShowFundingDisclaimer(true);
  };

  // Actually fund the game after disclaimer is accepted
  const handleFundAndStartCreatorGame = async () => {
    if (!connected || !publicKey || !fundingGameData) {
      setShowWalletRequired(true);
      return;
    }
    const gameData = fundingGameData;
    if (!gameData.on_chain_game_id && gameData.on_chain_game_id !== 0) {
      alert('Game has no on-chain ID');
      return;
    }
    const depositLamports = gameData.creator_deposit_lamports || 0;
    if (depositLamports <= 0) {
      alert('Invalid deposit amount');
      return;
    }
    setFunding(true);
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildFundCustomGameIx(publicKey, gameData.on_chain_game_id, depositLamports);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Register funding in Supabase
      await recordCustomGameFunding(
        gameData.game_id,
        publicKey.toBase58(),
        signature,
        depositLamports,
      );

      setShowFundingDisclaimer(false);
      setFundingGameData(null);
    } catch (err: any) {
      console.error('Failed to fund creator game:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to fund game. Please try again.');
      }
    } finally {
      setFunding(false);
    }
  };

  const handleEndCustomGame = async (gameData: any) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    try {
      const { finalizeCustomGame } = await import('./src/utils/api');
      await finalizeCustomGame(gameData.id, publicKey.toBase58());
      alert('Game ended! Winners can now claim their prizes.');
    } catch (err: any) {
      console.error('End game error:', err);
      alert(err.message || 'Failed to end game');
    }
  };

  const handleClaimCustomPrize = async (onChainGameId: number) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    setClaimingId(`custom-${onChainGameId}`);
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildClaimCustomPrizeIx(publicKey, onChainGameId);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      setClaimableCustomGames(prev => prev.filter(cg => cg.on_chain_game_id !== onChainGameId));
    } catch (err: any) {
      console.error('Failed to claim custom game prize:', err);
      if (err.message?.includes('already been claimed') || err.message?.includes('AlreadyClaimed')) {
        setClaimableCustomGames(prev => prev.filter(cg => cg.on_chain_game_id !== onChainGameId));
      } else if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to claim prize. Please try again.');
      }
    } finally {
      setClaimingId(null);
    }
  };

  /** SPL variant of custom-game prize claim. Used when the win row has a
   *  non-null token_mint (USDC / NERD / any SPL). Mirrors the SOL handler
   *  signature so ProfileViewV2 can route conditionally. */
  const handleClaimCustomSplPrize = async (onChainGameId: number, tokenMint: string) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    setClaimingId(`custom-spl-${onChainGameId}`);
    try {
      const mintPk = new PublicKey(tokenMint);
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildClaimCustomPrizeSplIx({
        winner: publicKey,
        gameId: onChainGameId,
        mint: mintPk,
      });
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      setClaimableCustomGames(prev => prev.filter(cg => cg.on_chain_game_id !== onChainGameId));
    } catch (err: any) {
      console.error('Failed to claim custom-game SPL prize:', err);
      if (err.message?.includes('already been claimed') || err.message?.includes('AlreadyClaimed')) {
        setClaimableCustomGames(prev => prev.filter(cg => cg.on_chain_game_id !== onChainGameId));
      } else if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to claim SPL prize. Please try again.');
      }
    } finally {
      setClaimingId(null);
    }
  };

  // ─── NFT custom game handlers (v2.1) ──────────────────────────────────────
  // For NFT prize games, the player signs the on-chain ix directly. EF isn't
  // needed for claim/reclaim — only for tracking metadata after the fact.

  /** Winner claims the escrowed NFT prize. Branches by nft_standard. */
  const handleClaimNftCustomPrize = async (args: {
    onChainGameId: number;
    nftMint: string;
    nftStandard: 'core' | 'pnft';
  }) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    setClaimingId(`custom-nft-${args.onChainGameId}`);
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const mintPk = new PublicKey(args.nftMint);
      const ix = args.nftStandard === 'core'
        ? buildClaimCustomNftPrizeIx({
            winner: publicKey,
            gameId: args.onChainGameId,
            coreNftAsset: mintPk,
          })
        : buildClaimCustomTmPnftPrizeIx({
            winner: publicKey,
            gameId: args.onChainGameId,
            nftMint: mintPk,
          });
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`NFT prize claimed for game ${args.onChainGameId}. Tx: ${signature}`);
    } catch (err: any) {
      console.error('Failed to claim NFT prize:', err);
      if (err.message?.includes('AlreadyClaimed')) {
        // Treat as success — NFT is in winner's wallet
      } else if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to claim NFT prize. Please try again.');
      }
    } finally {
      setClaimingId(null);
    }
  };

  /** Creator reclaims their NFT if the game expired without finalize. Branches by nft_standard. */
  const handleReclaimNftCustomPrize = async (args: {
    onChainGameId: number;
    creatorWallet: string;
    nftMint: string;
    nftStandard: 'core' | 'pnft';
  }) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    setClaimingId(`custom-nft-reclaim-${args.onChainGameId}`);
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const mintPk = new PublicKey(args.nftMint);
      const creatorPk = new PublicKey(args.creatorWallet);
      const ix = args.nftStandard === 'core'
        ? buildReclaimCustomNftIx({
            cranker: publicKey,
            gameId: args.onChainGameId,
            creator: creatorPk,
            coreNftAsset: mintPk,
          })
        : buildReclaimCustomTmPnftIx({
            cranker: publicKey,
            gameId: args.onChainGameId,
            creator: creatorPk,
            nftMint: mintPk,
          });
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`NFT reclaimed for game ${args.onChainGameId}. Tx: ${signature}`);
    } catch (err: any) {
      console.error('Failed to reclaim NFT:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to reclaim NFT. Please try again.');
      }
    } finally {
      setClaimingId(null);
    }
  };

  /** Build + sign enter_custom_game_nft tx for joining an NFT game. Returns tx signature. */
  const buildAndSendEnterNftGameTx = async (args: {
    onChainGameId: number;
  }): Promise<string> => {
    if (!connected || !publicKey) throw new Error('Wallet not connected');
    const cfg = await fetchGameConfig(connection);
    if (!cfg) throw new Error('GameConfig not found');
    const revenueWallet = new PublicKey(cfg.revenueWallet);
    const { blockhash } = await getRecentBlockhashWithRetry(connection);
    const ix = buildEnterCustomGameNftIx({
      player: publicKey,
      gameId: args.onChainGameId,
      revenueWallet,
    });
    const messageV0 = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, 'confirmed');
    return signature;
  };

  const handleClaimRoundPrizeFromPlay = async (payout: ClaimablePayout) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    const id = `round-${payout.round_id}-${payout.rank}`;
    setClaimingId(id);
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildClaimTierPrizeIx(publicKey, payout.contract_round_id, payout.tier_index ?? 0);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      setClaimableRoundPayouts(prev => prev.filter(p => !(p.round_id === payout.round_id && p.rank === payout.rank)));
    } catch (err: any) {
      console.error('Failed to claim round prize:', err);
      if (err.message?.includes('already been claimed') || err.message?.includes('AlreadyClaimed')) {
        setClaimableRoundPayouts(prev => prev.filter(p => !(p.round_id === payout.round_id && p.rank === payout.rank)));
      } else if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to claim prize. Please try again.');
      }
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimRefund = async (entry: RefundableEntry) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    const id = `refund-${entry.round_id}-${entry.tier_index}`;
    setClaimingId(id);
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildClaimTierRefundIx(publicKey, entry.contract_round_id, entry.tier_index);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      setRefundableEntries(prev => prev.filter(re => !(re.round_id === entry.round_id && re.tier_index === entry.tier_index)));
    } catch (err: any) {
      console.error('Failed to claim refund:', err);
      if (err.message?.includes('already been claimed') || err.message?.includes('AlreadyClaimed')) {
        setRefundableEntries(prev => prev.filter(re => !(re.round_id === entry.round_id && re.tier_index === entry.tier_index)));
      } else if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to claim refund. Please try again.');
      }
    } finally {
      setClaimingId(null);
    }
  };

  const handleClaimCGRefund = async (cg: RefundableCustomGame) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    const id = `cgref-${cg.on_chain_game_id}`;
    setClaimingId(id);
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildClaimCustomRefundIx(publicKey, cg.on_chain_game_id);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      setRefundableCustomGames(prev => prev.filter(g => g.on_chain_game_id !== cg.on_chain_game_id));
    } catch (err: any) {
      console.error('Failed to claim custom game refund:', err);
      if (err.message?.includes('already been claimed') || err.message?.includes('AlreadyClaimed')) {
        setRefundableCustomGames(prev => prev.filter(g => g.on_chain_game_id !== cg.on_chain_game_id));
      } else if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to claim custom game refund. Please try again.');
      }
    } finally {
      setClaimingId(null);
    }
  };

  // Wrapper for lobby view: claims custom game refund by on-chain ID only
  const handleClaimCGRefundById = async (onChainGameId: number) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    setClaimingId(`cgref-${onChainGameId}`);
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildClaimCustomRefundIx(publicKey, onChainGameId);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      setRefundableCustomGames(prev => prev.filter(g => g.on_chain_game_id !== onChainGameId));
    } catch (err: any) {
      console.error('Failed to claim custom game refund:', err);
      if (err.message?.includes('already been claimed') || err.message?.includes('AlreadyClaimed')) {
        setRefundableCustomGames(prev => prev.filter(g => g.on_chain_game_id !== onChainGameId));
      } else if (!err.message?.includes('User rejected')) {
        throw err;
      }
    } finally {
      setClaimingId(null);
    }
  };

  // ─── Duels Handlers ──────────────────────────────────────────────────────────
  const handleCreateDuel = async (entryFee: number, isPublic: boolean) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    try {
      // Fetch nextDuelId from on-chain config
      const config = await fetchGameConfig(connection);
      if (!config) throw new Error('Failed to read on-chain config');
      const nextDuelId = config.nextDuelId;

      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildCreateDuelIx(
        publicKey,
        entryFee,
        isPublic,
        nextDuelId,
        // CRITICAL: use the on-chain config's revenue wallet, NOT the hardcoded
        // mainnet REVENUE_WALLET constant. Anchor's `address = config.revenue_wallet`
        // constraint fails simulation otherwise (error 6041 InvalidRevenueWallet)
        // when the on-chain config has a different wallet (e.g. devnet uses GRjf5...).
        new PublicKey(config.revenueWallet),
      );
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Call create-duel EF. SOLANA_NETWORK feeds the cluster scope so
      // mainnet duel_id=N and devnet duel_id=N don't collide.
      const result = await createDuel({
        wallet_address: publicKey.toBase58(),
        tx_signature: signature,
        duel_id: nextDuelId,
        entry_fee_lamports: entryFee,
        is_public: isPublic,
        cluster: SOLANA_NETWORK,
      });

      setDuelId(nextDuelId);
      setDbDuelId(result.db_duel_id);
      setDuelShareCode(result.share_code);
      setDuelEntryFee(entryFee);
      // SOL duel: clear any leftover SPL token state from a prior SPL session.
      setDuelTokenSymbol(null);
      setDuelTokenDecimals(null);
      setDuelTokenMint(null);
      setDuelIsPublic(isPublic);
      setDuelExpiresAt(result.expires_at);
      setDuelOpponent(null);
      setDuelResults(null);
      setDuelIsPlayer1(true);
      // v2.1 hybrid: brand-new duel starts clean. Creator hasn't pre-played
      // yet; soloMode is reserved for when they tap PLAY NOW on waiting view.
      setDuelCreatorFinished(false);
      setDuelSoloMode(false);
      window.history.pushState({}, '', `/duel/${result.share_code}`);
      setCurrentView(View.DUEL_WAITING);
    } catch (err: any) {
      console.error('Failed to create duel:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to create duel. Please try again.');
      }
    }
  };

  /**
   * SPL-token duel creator. Mirrors handleCreateDuel but routes through
   * buildCreateDuelSplIx + the SPL EF branch. The contract collects the
   * 0.0025 SOL platform fee inside the ix (revenue_wallet account is
   * writable), so no separate SystemProgram.transfer is needed.
   *
   * @param wagerDisplay  Decimal token units (e.g. 100 NERD, 25 USDC)
   * @param token         Chosen token: mint, symbol, decimals, tokenProgram
   * @param isPublic      Whether the duel is open to any joiner
   */
  const handleCreateDuelSpl = async (
    wagerDisplay: number,
    token: { mint: string; symbol: string; decimals: number; tokenProgram?: 'spl' | 'token2022' },
    isPublic: boolean,
  ) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    try {
      const mintPk = new PublicKey(token.mint);

      // Token-2022 vs classic SPL Token detection: read the mint account
      // and check the owner program. The contract supports both via
      // token_interface but we have to pass the correct program ID for
      // the ATA derivation and ix CPI to line up.
      const mintInfo = await connection.getAccountInfo(mintPk);
      if (!mintInfo) throw new Error(`Mint not found: ${token.mint}`);
      const tokenProgram = mintInfo.owner.equals(TOKEN_2022_PROGRAM)
        ? TOKEN_2022_PROGRAM
        : SPL_TOKEN_PROGRAM_ID;

      // Convert display units to raw u64 using token's decimals.
      // Floor to avoid sending a non-integer through u64 encoding.
      const entryFeeAmount = BigInt(
        Math.floor(wagerDisplay * Math.pow(10, token.decimals)),
      );
      if (entryFeeAmount <= 0n) throw new Error('Wager must be positive');

      const config = await fetchGameConfig(connection);
      if (!config) throw new Error('Failed to read on-chain config');
      const nextDuelId = config.nextDuelId;

      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildCreateDuelSplIx({
        player1: publicKey,
        nextDuelId,
        mint: mintPk,
        entryFeeAmount,
        isPublic,
        // On-chain config's revenue_wallet (see InvalidRevenueWallet note in handleCreateDuel).
        revenueWallet: new PublicKey(config.revenueWallet),
        tokenProgram,
      });
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Call create-duel EF with SPL fields. Field names match the EF's
      // canonical SPL branch (token_mint / entry_token_amount). token_program
      // is intentionally NOT sent — the EF doesn't store it; the on-chain
      // ix already runs with the right program (detected from mint owner
      // above), and handleJoinDuelSpl re-detects it at join time.
      const result = await createDuel({
        wallet_address: publicKey.toBase58(),
        tx_signature: signature,
        duel_id: nextDuelId,
        entry_fee_lamports: 0,                    // SOL wager unused for SPL
        is_public: isPublic,
        cluster: SOLANA_NETWORK,
        token_mint: token.mint,
        entry_token_amount: entryFeeAmount.toString(),
        token_symbol: token.symbol,
        token_decimals: token.decimals,
      });

      setDuelId(nextDuelId);
      setDbDuelId(result.db_duel_id);
      setDuelShareCode(result.share_code);
      // For SPL duels, store the token amount in raw units in duelEntryFee.
      // DuelWaitingView reads this together with duelTokenSymbol/Decimals so
      // it can format "100 NERD" instead of "0.02 SOL".
      setDuelEntryFee(Number(entryFeeAmount));
      setDuelTokenSymbol(token.symbol);
      setDuelTokenDecimals(token.decimals);
      setDuelTokenMint(token.mint);
      setDuelIsPublic(isPublic);
      setDuelExpiresAt(result.expires_at);
      setDuelOpponent(null);
      setDuelResults(null);
      setDuelIsPlayer1(true);
      // v2.1 hybrid: brand-new duel starts clean.
      setDuelCreatorFinished(false);
      setDuelSoloMode(false);
      window.history.pushState({}, '', `/duel/${result.share_code}`);
      setCurrentView(View.DUEL_WAITING);
    } catch (err: any) {
      console.error('Failed to create SPL duel:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to create duel. Please try again.');
      }
    }
  };

  /**
   * SPL-token duel joiner. Mirrors handleJoinDuel but routes through
   * buildJoinDuelSplIx. Token program is always re-detected from on-chain
   * mint owner (single source of truth, cheap RPC call).
   */
  const handleJoinDuelSpl = async (
    onChainDuelId: number,
    mint: string,
  ) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    try {
      const mintPk = new PublicKey(mint);
      const mintInfo = await connection.getAccountInfo(mintPk);
      if (!mintInfo) throw new Error(`Mint not found: ${mint}`);
      const tokenProgram = mintInfo.owner.equals(TOKEN_2022_PROGRAM)
        ? TOKEN_2022_PROGRAM
        : SPL_TOKEN_PROGRAM_ID;

      // Fetch on-chain config for the correct revenue_wallet (see
      // InvalidRevenueWallet note in handleCreateDuel).
      const config = await fetchGameConfig(connection);
      if (!config) throw new Error('Failed to read on-chain config');

      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildJoinDuelSplIx({
        player2: publicKey,
        duelId: onChainDuelId,
        mint: mintPk,
        revenueWallet: new PublicKey(config.revenueWallet),
        tokenProgram,
      });
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      const result = await joinDuel({
        wallet_address: publicKey.toBase58(),
        tx_signature: signature,
        duel_id: onChainDuelId,
        cluster: SOLANA_NETWORK,
      });

      setDuelId(onChainDuelId);
      setDbDuelId(result.db_duel_id);
      // entry_fee_token_amount comes back on the duel record, surfaced below.
      setDuelIsPlayer1(false);
      setDuelResults(null);

      const duelInfo = await getDuel({ duel_id: onChainDuelId, wallet_address: publicKey.toBase58(), cluster: SOLANA_NETWORK });
      setDuelOpponent({
        wallet: duelInfo.player1.wallet,
        username: duelInfo.player1.username ?? null,
        avatar: duelInfo.player1.avatar ?? null,
      });
      if (duelInfo.share_code) setDuelShareCode(duelInfo.share_code);
      // Raw token amount + token info for display in waiting / play / results.
      // Canonical field names: token_mint / entry_token_amount.
      if (duelInfo.entry_token_amount) {
        setDuelEntryFee(Number(duelInfo.entry_token_amount));
      }
      if (duelInfo.token_symbol) setDuelTokenSymbol(duelInfo.token_symbol);
      if (typeof duelInfo.token_decimals === 'number') setDuelTokenDecimals(duelInfo.token_decimals);
      if (duelInfo.token_mint) setDuelTokenMint(duelInfo.token_mint);

      setCurrentView(View.DUEL_PLAY);
    } catch (err: any) {
      console.error('Failed to join SPL duel:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to join duel. Please try again.');
      }
    }
  };

  const handleJoinDuel = async (onChainDuelId: number, entryFee: number) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }

    // Detect SPL vs SOL by pre-fetching the duel record. The duel row
    // populates `token_mint` when create-duel was called with SPL fields.
    // For SOL duels it stays undefined/null.
    try {
      const pre = await getDuel({ duel_id: onChainDuelId, wallet_address: publicKey.toBase58(), cluster: SOLANA_NETWORK });
      if (pre?.token_mint) {
        return handleJoinDuelSpl(onChainDuelId, pre.token_mint);
      }
    } catch {
      // getDuel may fail if the duel doesn't exist yet on the EF side; fall
      // through to the SOL path which the EF will reject with a clearer error.
    }

    try {
      // Fetch on-chain config for the correct revenue_wallet (see
      // InvalidRevenueWallet note in handleCreateDuel).
      const config = await fetchGameConfig(connection);
      if (!config) throw new Error('Failed to read on-chain config');

      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildJoinDuelIx(
        publicKey,
        onChainDuelId,
        new PublicKey(config.revenueWallet),
      );
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      // Call join-duel EF
      const result = await joinDuel({
        wallet_address: publicKey.toBase58(),
        tx_signature: signature,
        duel_id: onChainDuelId,
        cluster: SOLANA_NETWORK,
      });

      setDuelId(onChainDuelId);
      setDbDuelId(result.db_duel_id);
      setDuelEntryFee(entryFee);
      // SOL duel: clear any leftover SPL token state.
      setDuelTokenSymbol(null);
      setDuelTokenDecimals(null);
      setDuelTokenMint(null);
      setDuelIsPlayer1(false);
      setDuelResults(null);

      // Fetch duel details for opponent info
      const duelInfo = await getDuel({ duel_id: onChainDuelId, wallet_address: publicKey.toBase58(), cluster: SOLANA_NETWORK });
      setDuelOpponent({
        wallet: duelInfo.player1.wallet,
        username: duelInfo.player1.username ?? null,
        avatar: duelInfo.player1.avatar ?? null,
      });
      if (duelInfo.share_code) setDuelShareCode(duelInfo.share_code);

      setCurrentView(View.DUEL_PLAY);
    } catch (err: any) {
      console.error('Failed to join duel:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to join duel. Please try again.');
      }
    }
  };

  const handleJoinByShareCode = async (shareCode: string) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    try {
      const duelInfo = await getDuel({ share_code: shareCode, wallet_address: publicKey.toBase58(), cluster: SOLANA_NETWORK });
      if (duelInfo.status !== 'waiting') {
        alert('This duel is no longer available.');
        return;
      }
      await handleJoinDuel(duelInfo.duel_id, duelInfo.entry_fee_lamports);
    } catch (err: any) {
      console.error('Failed to join by share code:', err);
      alert(err.message || 'Invalid share code or duel not found.');
    }
  };

  const handleDuelJoined = async (opponentWallet: string, joinedDbDuelId: string) => {
    // Called when opponent joins our waiting duel (Realtime or poll)
    try {
      const duelInfo = await getDuel({ duel_id: duelId!, wallet_address: publicKey!.toBase58(), cluster: SOLANA_NETWORK });
      setDuelOpponent({
        wallet: opponentWallet,
        username: duelInfo.player2?.username ?? null,
        avatar: duelInfo.player2?.avatar ?? null,
      });
      setDbDuelId(joinedDbDuelId);
      setCurrentView(View.DUEL_PLAY);
    } catch {
      setDuelOpponent({ wallet: opponentWallet, username: null, avatar: null });
      setDbDuelId(joinedDbDuelId);
      setCurrentView(View.DUEL_PLAY);
    }
  };

  const handleResumeDuel = async (duel: ActiveDuel) => {
    setDuelId(duel.duel_id);
    setDbDuelId(duel.id);
    setDuelShareCode(duel.share_code);
    setDuelEntryFee(duel.entry_fee_lamports);
    setDuelIsPublic(duel.is_public);
    setDuelExpiresAt(duel.expires_at);
    setDuelResults(null);
    setDuelIsPlayer1(true);
    window.history.pushState({}, '', `/duel/${duel.share_code}`);

    // If duel has an opponent (status='playing'), go straight to quiz
    if (duel.status === 'playing') {
      try {
        const walletAddr = publicKey?.toBase58();
        const duelInfo = await getDuel({ duel_id: duel.duel_id, wallet_address: walletAddr, cluster: SOLANA_NETWORK });
        if (duelInfo.status === 'playing' && duelInfo.player2) {
          setDuelOpponent({
            wallet: duelInfo.player2.wallet,
            username: duelInfo.player2.username ?? null,
            avatar: duelInfo.player2.avatar ?? null,
          });
          setCurrentView(View.DUEL_PLAY);
          return;
        }
        // Duel was auto-resolved/expired by backend — go to lobby
        if (duelInfo.status !== 'waiting') {
          setCurrentView(View.DUEL_LOBBY);
          return;
        }
      } catch { /* fall through to waiting view */ }
    }

    setDuelOpponent(null);
    setCurrentView(View.DUEL_WAITING);
  };

  /**
   * View own duel from the lobby: fetches the duel info and routes the user
   * back into the appropriate screen (waiting room while still 'waiting',
   * quiz if opponent already joined). Lets creators grab their share link,
   * see the countdown, etc. without having to remember the URL.
   */
  const handleViewOwnDuel = async (onChainDuelId: number) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    try {
      const duelInfo = await getDuel({
        duel_id: onChainDuelId,
        wallet_address: publicKey.toBase58(),
        cluster: SOLANA_NETWORK,
      });
      setDuelId(onChainDuelId);
      setDbDuelId(duelInfo.db_duel_id);
      setDuelShareCode(duelInfo.share_code);
      setDuelIsPublic(duelInfo.is_public);
      setDuelExpiresAt(duelInfo.expires_at);
      setDuelResults(null);
      setDuelIsPlayer1(true);
      // v2.1 hybrid: capture whether the creator already banked their score.
      // DuelWaitingView reads this to render the right pre/post-play state.
      setDuelCreatorFinished(!!duelInfo.player1?.finished);
      setDuelSoloMode(false);
      // Token info (SPL duel vs SOL duel).
      if (duelInfo.token_mint && typeof duelInfo.token_decimals === 'number') {
        setDuelTokenMint(duelInfo.token_mint);
        setDuelTokenSymbol(duelInfo.token_symbol ?? null);
        setDuelTokenDecimals(duelInfo.token_decimals);
        setDuelEntryFee(Number(duelInfo.entry_token_amount ?? 0));
      } else {
        setDuelTokenMint(null);
        setDuelTokenSymbol(null);
        setDuelTokenDecimals(null);
        setDuelEntryFee(duelInfo.entry_fee_lamports);
      }
      if (duelInfo.share_code) {
        window.history.pushState({}, '', `/duel/${duelInfo.share_code}`);
      }
      if (duelInfo.status === 'playing' && duelInfo.player2) {
        setDuelOpponent({
          wallet: duelInfo.player2.wallet,
          username: duelInfo.player2.username ?? null,
          avatar: duelInfo.player2.avatar ?? null,
        });
        setCurrentView(View.DUEL_PLAY);
      } else if (duelInfo.status === 'waiting') {
        setDuelOpponent(null);
        setCurrentView(View.DUEL_WAITING);
      } else {
        alert(`This duel is already ${duelInfo.status}.`);
      }
    } catch (err: any) {
      console.error('Failed to view own duel:', err);
      alert(err.message || 'Failed to load duel.');
    }
  };

  const handleCancelDuel = async () => {
    if (!connected || !publicKey || duelId == null) return;
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildCancelDuelIx(publicKey, duelId);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      // Update DB status
      await updateDuelStatus(duelId, 'cancelled').catch(() => {});
      setDuelId(null);
      setDbDuelId(null);
      setDuelShareCode(null);
      setCurrentView(View.DUEL_LOBBY);
    } catch (err: any) {
      console.error('Failed to cancel duel:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to cancel duel.');
      }
    }
  };

  const handleClaimDuelRefund = async (refundDuelId: number, player1Wallet: string) => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildExpireDuelIx(publicKey, refundDuelId, new PublicKey(player1Wallet));
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      // Update DB status
      await updateDuelStatus(refundDuelId, 'expired').catch(() => {});
    } catch (err: any) {
      console.error('Failed to claim duel refund:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to claim refund. Please try again.');
      }
      throw err; // Re-throw so caller can handle
    }
  };

  const handleDuelFinish = (results: {
    myScore: number; myCorrect: number;
    opponentScore: number; opponentCorrect: number;
    winner: string | null; duelComplete: boolean;
  }) => {
    // v2.1 hybrid: in soloMode (creator pre-playing), the duel isn't done —
    // opponent hasn't joined yet. Route back to DUEL_WAITING with the
    // creatorFinished flag set so the screen renders the "score banked"
    // state. The actual result (winner determined) lands later when the
    // opponent joins + finishes + completion poll fires onResultsReady.
    if (duelSoloMode) {
      setDuelCreatorFinished(true);
      setDuelSoloMode(false);
      setCurrentView(View.DUEL_WAITING);
      return;
    }
    setDuelResults({
      ...results,
      totalPot: duelEntryFee * 2,
    });
    setCurrentView(View.DUEL_RESULTS);
  };

  /**
   * v2.1 hybrid: creator pre-plays their 5 questions before any opponent
   * has joined. Sets soloMode + routes to DUEL_PLAY. submit-duel-answer
   * v25 accepts answers while status='waiting' as long as the wallet is
   * the creator. create-duel v29 inserted the creator's session row at
   * create time, so the quiz can start answering immediately.
   */
  const handleCreatorPrePlay = () => {
    if (!connected || !publicKey || duelId == null || !dbDuelId) {
      setShowWalletRequired(true);
      return;
    }
    setDuelSoloMode(true);
    // Clear opponent state so DuelQuizView doesn't try to render an opponent
    // overlay before the soloMode prop takes effect on first render.
    setDuelOpponent({ wallet: '', username: null, avatar: null });
    setCurrentView(View.DUEL_PLAY);
  };

  /**
   * v2.1 hybrid: called from DuelWaitingView when the poll/realtime sub
   * detects the duel transitioned to completed/resolved (opponent joined +
   * finished after creator pre-played). Routes to the result screen.
   */
  const handleDuelResultsReady = async () => {
    if (!connected || !publicKey || duelId == null) return;
    try {
      const duelInfo = await getDuel({
        duel_id: duelId,
        wallet_address: publicKey.toBase58(),
        cluster: SOLANA_NETWORK,
      });
      if (duelInfo.player2) {
        setDuelOpponent({
          wallet: duelInfo.player2.wallet,
          username: duelInfo.player2.username ?? null,
          avatar: duelInfo.player2.avatar ?? null,
        });
      }
      const myIsP1 = publicKey.toBase58() === duelInfo.player1.wallet;
      const myScore = myIsP1 ? duelInfo.player1.score : (duelInfo.player2?.score ?? 0);
      const myCorrect = myIsP1 ? duelInfo.player1.correct : (duelInfo.player2?.correct ?? 0);
      const opponentScore = myIsP1 ? (duelInfo.player2?.score ?? 0) : duelInfo.player1.score;
      const opponentCorrect = myIsP1 ? (duelInfo.player2?.correct ?? 0) : duelInfo.player1.correct;
      setDuelResults({
        myScore,
        myCorrect,
        opponentScore,
        opponentCorrect,
        winner: duelInfo.winner_wallet,
        duelComplete: ['completed', 'resolved'].includes(duelInfo.status),
        totalPot: duelEntryFee * 2,
      });
      setCurrentView(View.DUEL_RESULTS);
    } catch (err) {
      console.error('Failed to fetch duel results:', err);
    }
  };

  const handleClaimDuelPrize = async (claimDuelId?: number) => {
    const targetDuelId = claimDuelId ?? duelId;
    if (!connected || !publicKey || targetDuelId == null) return;
    try {
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildClaimDuelPrizeIx(publicKey, targetDuelId);
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      alert('Prize claimed successfully!');
    } catch (err: any) {
      console.error('Failed to claim duel prize:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to claim prize. Please try again.');
      }
    }
  };

  /** SPL variant of duel prize claim. Used when the duel was a token wager
   *  (USDC / NERD / any SPL). Branches via `tokenMint` arg. Mirrors the SOL
   *  handler signature so DuelResultsView + ProfileViewV2 route conditionally. */
  const handleClaimDuelSplPrize = async (claimDuelId: number, tokenMint: string) => {
    if (!connected || !publicKey || claimDuelId == null) return;
    try {
      const mintPk = new PublicKey(tokenMint);
      const { blockhash } = await getRecentBlockhashWithRetry(connection);
      const ix = buildClaimDuelPrizeSplIx({
        winner: publicKey,
        duelId: claimDuelId,
        mint: mintPk,
      });
      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      alert('SPL prize claimed successfully!');
    } catch (err: any) {
      console.error('Failed to claim duel SPL prize:', err);
      if (!err.message?.includes('User rejected')) {
        alert(err.message || 'Failed to claim SPL prize. Please try again.');
      }
    }
  };

  // Referral on-chain claim: drains the referrer's accumulated PDA to wallet.
  // The ProfileViewV2 card calls this and refetches its balance on success.
  // Throws on user-cancel (caller surfaces); throws other errors with the
  // ix-level message ("NothingToSweep" if the PDA is empty, etc).
  const handleClaimReferralBalance = async () => {
    if (!connected || !publicKey) { setShowWalletRequired(true); return; }
    const ix = buildClaimReferralBalanceIx({ referrer: publicKey });
    const { blockhash } = await getRecentBlockhashWithRetry(connection);
    const messageV0 = new TransactionMessage({
      payerKey: publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(messageV0);
    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, 'confirmed');
  };

  // Handle direct duel link: /duel/:shareCode on page load
  useEffect(() => {
    if (currentView !== View.DUEL_WAITING || !duelShareCode || dbDuelId) return;
    // Fetch duel info by share code to populate state
    (async () => {
      try {
        const walletAddr = publicKey?.toBase58();
        const duelInfo = await getDuel({ share_code: duelShareCode, wallet_address: walletAddr, cluster: SOLANA_NETWORK });
        setDuelId(duelInfo.duel_id);
        setDbDuelId(duelInfo.db_duel_id);
        setDuelEntryFee(duelInfo.entry_fee_lamports);
        setDuelIsPublic(duelInfo.is_public);
        setDuelExpiresAt(duelInfo.expires_at);
        setDuelIsPlayer1(duelInfo.player1.wallet === walletAddr);

        if (duelInfo.status === 'waiting') {
          // If current user is player1, show waiting view
          if (duelInfo.player1.wallet === walletAddr) {
            // Already on waiting view, state is populated
          } else {
            // Visitor: auto-join when they click join (show lobby-like join UI)
            // For now, redirect to lobby with the code pre-filled
            setCurrentView(View.DUEL_LOBBY);
          }
        } else if (duelInfo.status === 'playing') {
          // Duel in progress — if creator hasn't finished, route to quiz
          if (duelInfo.player1.wallet === walletAddr && duelInfo.player2) {
            setDuelOpponent({
              wallet: duelInfo.player2.wallet,
              username: duelInfo.player2.username ?? null,
              avatar: duelInfo.player2.avatar ?? null,
            });
            setCurrentView(View.DUEL_PLAY);
          } else if (duelInfo.player2?.wallet === walletAddr && duelInfo.player1) {
            setDuelOpponent({
              wallet: duelInfo.player1.wallet,
              username: duelInfo.player1.username ?? null,
              avatar: duelInfo.player1.avatar ?? null,
            });
            setCurrentView(View.DUEL_PLAY);
          } else {
            setCurrentView(View.DUEL_LOBBY);
          }
        } else if (duelInfo.status === 'completed' || duelInfo.status === 'resolved') {
          // Duel finished
          setCurrentView(View.DUEL_LOBBY);
        }
      } catch {
        // Invalid share code, go to lobby
        setCurrentView(View.DUEL_LOBBY);
      }
    })();
  }, [currentView, duelShareCode, dbDuelId, publicKey]);

  const handleBuyLivesSuccess = (newLivesCount?: number) => {
    if (typeof newLivesCount === 'number') {
      setLives(Math.max(0, newLivesCount));
    } else {
      setLives(prev => Math.max(0, (prev ?? 0) + 3));
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case View.HOME:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) {
                setShowWalletRequired(true);
              } else {
                setIsBuyLivesOpen(true);
              }
            }}
            onConnect={() => setShowWalletRequired(true)}
            onOpenGuide={() => setIsGuideOpen(true)}
            rightRail={
              <HomeRightRail
                lives={livesDisplayReady ? lives : null}
                onOpenSwap={() => setCurrentView(View.SWAP)}
                onBuyLives={() => {
                  if (!connected) {
                    setShowWalletRequired(true);
                  } else {
                    setIsBuyLivesOpen(true);
                  }
                }}
              />
            }
          >
            <HomeViewV2
              lives={livesDisplayReady ? lives : null}
              onEnterTrivia={() => {
                if (!connected) {
                  setShowWalletRequired(true);
                } else {
                  setCurrentView(View.COMPETE_LOBBY);
                }
              }}
              onOpenGuide={() => setIsGuideOpen(true)}
              onOpenBuyLives={() => {
                if (!connected) {
                  setShowWalletRequired(true);
                } else {
                  setIsBuyLivesOpen(true);
                }
              }}
              onStartPractice={handleStartPractice}
              onOpenFreePlay={() => setCurrentView(View.PLAY)}
              practiceRunsLeft={practiceRunsLeft}
              hasGamePass={hasGamePass}
              isSeekerVerified={isSeekerVerified}
              onBuyGamePass={() => setCurrentView(View.GAME_PASS)}
              onCreateCustomGame={handleNavigateToCustomGames}
              onViewCustomGame={handleViewCustomGame}
              onEnterDuels={() => setCurrentView(View.DUEL_LOBBY)}
              onMint={() => setCurrentView(View.MINT)}
            />
          </WebShell>
        );
      case View.LEADERBOARD:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <LeaderboardViewV2 />
          </WebShell>
        );
      case View.COMPETE_LOBBY:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
            rightRail={
              <HomeRightRail
                lives={livesDisplayReady ? lives : null}
                onOpenSwap={() => setCurrentView(View.SWAP)}
                onBuyLives={() => {
                  if (!connected) setShowWalletRequired(true);
                  else setIsBuyLivesOpen(true);
                }}
              />
            }
          >
            <RoundsViewV2
              lives={livesDisplayReady ? lives : null}
              walletConnected={connected}
              entering={isEnteringRound}
              roundEntriesUsed={roundEntriesUsed}
              roundEntriesMax={ROUND_ENTRIES_MAX}
              onStartQuiz={handleStartQuiz}
              onConnectWallet={() => setShowWalletRequired(true)}
              onOpenBuyLives={() => {
                if (!connected) setShowWalletRequired(true);
                else setIsBuyLivesOpen(true);
              }}
            />
          </WebShell>
        );
      case View.PLAY:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <FreePlayViewV2
              hasGamePass={hasGamePass}
              practiceRunsLeft={practiceRunsLeft}
              onStartCategory={handleCategorySelected}
              onBuyGamePass={() => setCurrentView(View.GAME_PASS)}
            />
          </WebShell>
        );
      case View.QUESTS:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <QuestsViewV2 />
          </WebShell>
        );
      case View.PROFILE:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            {!connected ? (
              <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <div
                  className="text-center"
                  style={{
                    background: '#0a0a0a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: '40px 32px',
                    maxWidth: 440,
                  }}
                >
                  <div
                    className="mx-auto mb-5 flex items-center justify-center rounded-full"
                    style={{
                      width: 64,
                      height: 64,
                      background:
                        'linear-gradient(135deg, rgba(153,69,255,0.2), rgba(20,241,149,0.2))',
                      border: '1px solid rgba(153,69,255,0.3)',
                    }}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#14F195" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <h3
                    className="font-black italic uppercase mb-2 text-white"
                    style={{ fontSize: 22, letterSpacing: '-0.02em' }}
                  >
                    Connect Your Wallet
                  </h3>
                  <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 20 }}>
                    Connect your Solana wallet to view your profile, stats, and game history.
                  </p>
                  <button
                    onClick={() => setShowWalletRequired(true)}
                    className="font-black italic uppercase rounded-full active:opacity-90"
                    style={{
                      background: '#14F195',
                      color: '#000',
                      padding: '12px 28px',
                      fontSize: 12,
                      letterSpacing: '0.14em',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    CONNECT WALLET →
                  </button>
                </div>
              </div>
            ) : (
              <ProfileViewV2
                username={profile.username}
                avatar={profile.avatar}
                lives={livesDisplayReady ? lives : null}
                hasGamePass={hasGamePass}
                onEdit={() => setIsEditProfileOpen(true)}
                onBuyLives={() => setIsBuyLivesOpen(true)}
                onOpenGamePass={() => setCurrentView(View.GAME_PASS)}
                onOpenSwap={() => setCurrentView(View.SWAP)}
                onOpenReferrals={() => setCurrentView(View.REFERRALS)}
                onClaimRoundPrize={handleClaimRoundPrizeFromPlay}
                onClaimDuelPrize={handleClaimDuelPrize}
                onClaimDuelSplPrize={handleClaimDuelSplPrize}
                onClaimCustomPrize={handleClaimCustomPrize}
                onClaimCustomSplPrize={handleClaimCustomSplPrize}
                onClaimRoundRefund={handleClaimRefund}
                onClaimCustomRefund={handleClaimCGRefundById}
                onClaimDuelRefund={handleClaimDuelRefund}
                onClaimReferralBalance={handleClaimReferralBalance}
                onAvatarUpdated={(url: string) => {
                  setProfile((prev) => ({ ...prev, avatar: url }));
                  setProfileCacheBuster(Date.now());
                  refetchProfile();
                }}
                onSeekerVerified={(verified: boolean) => setIsSeekerVerified(verified)}
              />
            )}
          </WebShell>
        );
      case View.LIVES:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <LivesViewV2
              livesCount={livesDisplayReady ? lives : null}
              walletConnected={connected}
              isSeekerVerified={isSeekerVerified}
              onConnect={() => setShowWalletRequired(true)}
              onBuyTier={() => {
                if (!connected) setShowWalletRequired(true);
                else setIsBuyLivesOpen(true);
              }}
            />
          </WebShell>
        );
      case View.SWAP:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
            rightRail={
              <HomeRightRail
                lives={livesDisplayReady ? lives : null}
                onOpenSwap={() => setCurrentView(View.SWAP)}
                onBuyLives={() => {
                  if (!connected) setShowWalletRequired(true);
                  else setIsBuyLivesOpen(true);
                }}
              />
            }
          >
            <SwapModal onClose={() => setCurrentView(View.HOME)} />
          </WebShell>
        );
      case View.QUIZ:
        return connected ? (
          <div className="flex flex-col flex-1">
            {freeEntryNotification && (
              <div
                className="mx-4 mt-2 mb-0 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-sm text-center"
                role="alert"
              >
                {freeEntryNotification}
              </div>
            )}
            <QuizView
              sessionId={currentSessionId}
              onFinish={handleQuizFinish}
              onQuit={() => {
                try {
                  sessionStorage.removeItem('quiz_session_id');
                } catch (_) {}
                setCurrentSessionId(null);
                setFreeEntryNotification(null);
                setCurrentView(View.PLAY);
              }}
            />
          </div>
        ) : null;
      case View.RESULTS:
        return connected && lastGameResults ? (
          <WebShell
            activeView={View.COMPETE_LOBBY}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <ResultsView
              results={lastGameResults}
              lives={livesDisplayReady ? lives : null}
              roundEntriesLeft={Math.max(0, ROUND_ENTRIES_MAX - roundEntriesUsed)}
              roundEntriesMax={ROUND_ENTRIES_MAX}
              onRestart={() => handleStartQuiz()}
              onGoHome={() => setCurrentView(View.HOME)}
              onBuyLives={() => setIsBuyLivesOpen(true)}
            />
          </WebShell>
        ) : null;
      case View.PRACTICE:
        return practiceQuestionIds ? (
          <QuizView
            sessionId={null}
            mode="practice"
            practiceQuestionIds={practiceQuestionIds}
            onFinish={handlePracticeFinish}
            onQuit={() => {
              setPracticeQuestionIds(null);
              setCurrentView(View.PLAY);
            }}
          />
        ) : null;
      case View.PRACTICE_RESULTS:
        return practiceResults ? (
          <WebShell
            activeView={View.PLAY}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <PracticeResultsView
              score={practiceResults.score}
              totalQuestions={10}
              points={practiceResults.points}
              totalTime={practiceResults.time}
              onPlayForReal={() => {
                setPracticeResults(null);
                setCurrentView(View.PLAY);
                if (connected) {
                  handleStartQuiz();
                } else {
                  setShowWalletRequired(true);
                }
              }}
              onTryAgain={() => {
                setPracticeResults(null);
                handleStartPractice();
              }}
              onBackToHome={() => {
                setPracticeResults(null);
                setCurrentView(View.HOME);
              }}
            />
          </WebShell>
        ) : null;
      case View.TERMS:
        return <TermsOfServiceView onBack={() => setCurrentView(View.HOME)} />;
      case View.PRIVACY:
        return <PrivacyPolicyView onBack={() => setCurrentView(View.HOME)} />;
      case View.ADMIN:
        return <AdminRoute />;
      case View.CONTRACT_TEST:
        return <ContractTestView />;
      case View.CUSTOM_GAMES_HUB:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
            topbarMode="search"
          >
            <CustomGamesViewV2
              onCreate={handleNavigateToCreateGame}
              onView={handleViewCustomGame}
              onJoinByCode={(code) => handleViewCustomGame(code.trim().toLowerCase())}
            />
          </WebShell>
        );
      case View.CUSTOM_GAME_CREATE:
        return (
          <WebShell
            activeView={View.CUSTOM_GAMES_HUB}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            {connected ? (
              <CreateCustomGameView
                hasGamePass={hasGamePass}
                onGameCreated={handleCustomGameCreated}
                onBack={() => setCurrentView(View.PLAY)}
              />
            ) : (
              <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
                <div
                  className="text-center"
                  style={{
                    background: '#0a0a0a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 16,
                    padding: '32px',
                    maxWidth: 440,
                  }}
                >
                  <h3
                    className="font-black italic uppercase mb-2 text-white"
                    style={{ fontSize: 22, letterSpacing: '-0.02em' }}
                  >
                    Connect to Host
                  </h3>
                  <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 20 }}>
                    Connect your Solana wallet to create a custom game room.
                  </p>
                  <button
                    onClick={() => setShowWalletRequired(true)}
                    className="font-black italic uppercase rounded-full active:opacity-90"
                    style={{
                      background: '#38BDF8',
                      color: '#000',
                      padding: '12px 28px',
                      fontSize: 12,
                      letterSpacing: '0.14em',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    CONNECT WALLET →
                  </button>
                </div>
              </div>
            )}
          </WebShell>
        );
      case View.CUSTOM_GAME_LOBBY:
        return customGameSlug ? (
          <WebShell
            activeView={View.CUSTOM_GAMES_HUB}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <CustomGameLobbyView
              slug={customGameSlug}
              walletAddress={publicKey?.toBase58() ?? null}
              onStartGame={handleStartCustomGame}
              onJoinGame={handleJoinCustomGame}
              onStartTimer={handleStartCustomGameTimer}
              onFundAndStart={handleFundAndStartRequest}
              onEndGame={handleEndCustomGame}
              onClaimPrize={handleClaimCustomPrize}
              onClaimSplPrize={handleClaimCustomSplPrize}
              onClaimRefund={handleClaimCGRefundById}
              onClaimNftPrize={handleClaimNftCustomPrize}
              onReclaimNftPrize={handleReclaimNftCustomPrize}
              onEnterNftGame={buildAndSendEnterNftGameTx}
              onBack={() => setCurrentView(View.HOME)}
              onConnectWallet={() => setShowWalletRequired(true)}
            />
          </WebShell>
        ) : null;
      case View.CUSTOM_GAME_PLAY:
        return connected && customGameSessionId && customGameData ? (
          <CustomGameQuizView
            sessionId={customGameSessionId}
            gameData={customGameData}
            onFinish={handleCustomGameFinish}
            onQuit={() => {
              setCustomGameSessionId(null);
              setCustomGameData(null);
              if (customGameSlug) {
                setCurrentView(View.CUSTOM_GAME_LOBBY);
              } else {
                setCurrentView(View.HOME);
              }
            }}
          />
        ) : null;
      case View.CUSTOM_GAME_RESULTS:
        return customGameResults ? (
          <WebShell
            activeView={View.CUSTOM_GAMES_HUB}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <CustomGameResultsView
              results={customGameResults}
              attemptsUsed={customGameAttemptsUsed}
              maxAttempts={CUSTOM_GAME_MAX_ATTEMPTS}
              isPaidGame={customGameResults.isPaidGame}
              isCreatorFunded={customGameResults.isCreatorFunded}
              prizePotSol={customGameResults.prizePotSol}
              entryFeeLamports={customGameResults.entryFeeLamports}
              gameStatus={customGameResults.gameStatus}
              entriesRemaining={customGameResults.entriesRemaining}
              onPlayAgain={handleCustomGamePlayAgain}
              onViewLeaderboard={() => {
                if (customGameSlug) setCurrentView(View.CUSTOM_GAME_LOBBY);
              }}
              onBackToHome={() => {
                setCustomGameResults(null);
                setCurrentView(View.HOME);
              }}
            />
          </WebShell>
        ) : null;
      case View.DUEL_LOBBY:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
            topbarMode="search"
          >
            <DuelsViewV2
              walletConnected={connected}
              onCreateDuel={(wager, token) => {
                if (!token) {
                  // SOL path (unchanged).
                  handleCreateDuel(wager * 1_000_000_000, true);
                } else {
                  // SPL path (USDC + memecoins).
                  handleCreateDuelSpl(wager, token, true);
                }
              }}
              onViewOwnDuel={handleViewOwnDuel}
              // onJoinDuel: fetch the duel to learn the entry_fee_lamports, then
              // route through handleJoinDuel which auto-detects SOL vs SPL.
              // Was missing pre-2026-06-10 — clicking JOIN looked dead. Kyle.
              onJoinDuel={async (onChainDuelId) => {
                if (!connected || !publicKey) { setShowWalletRequired(true); return; }
                try {
                  const duelInfo = await getDuel({
                    duel_id: onChainDuelId,
                    wallet_address: publicKey.toBase58(),
                    cluster: SOLANA_NETWORK,
                  });
                  if (duelInfo.status !== 'waiting') {
                    alert('This duel is no longer available.');
                    return;
                  }
                  await handleJoinDuel(duelInfo.duel_id, duelInfo.entry_fee_lamports);
                } catch (err: any) {
                  console.error('Failed to join duel from lobby:', err);
                  alert(err?.message || 'Could not join. Try again.');
                }
              }}
            />
          </WebShell>
        );
      case View.DUEL_WAITING:
        return duelId != null && dbDuelId && duelShareCode ? (
          <WebShell
            activeView={View.DUEL_LOBBY}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <DuelWaitingView
              duelId={duelId}
              dbDuelId={dbDuelId}
              shareCode={duelShareCode}
              entryFee={duelEntryFee}
              isPublic={duelIsPublic}
              expiresAt={duelExpiresAt}
              walletAddress={publicKey!.toBase58()}
              onDuelJoined={handleDuelJoined}
              onCancel={handleCancelDuel}
              onClaimRefund={handleClaimDuelRefund}
              onBack={() => setCurrentView(View.DUEL_LOBBY)}
              tokenSymbol={duelTokenSymbol}
              tokenDecimals={duelTokenDecimals}
              tokenMint={duelTokenMint}
              creatorFinished={duelCreatorFinished}
              onPlayNow={handleCreatorPrePlay}
              onResultsReady={handleDuelResultsReady}
            />
          </WebShell>
        ) : null;
      case View.DUEL_PLAY:
        // v2.1 hybrid: soloMode allows DUEL_PLAY to render without an
        // opponent present (creator pre-playing). For real-time race
        // (classic), opponent is required as before.
        return connected && dbDuelId && duelId != null && (duelSoloMode || duelOpponent) ? (
          <DuelQuizView
            dbDuelId={dbDuelId}
            duelId={duelId}
            walletAddress={publicKey!.toBase58()}
            opponentWallet={duelOpponent?.wallet ?? ''}
            opponentUsername={duelOpponent?.username ?? null}
            opponentAvatar={duelOpponent?.avatar ?? null}
            isPlayer1={duelIsPlayer1}
            soloMode={duelSoloMode}
            onFinish={handleDuelFinish}
            onQuit={() => setCurrentView(View.DUEL_LOBBY)}
          />
        ) : null;
      case View.DUEL_RESULTS:
        return connected && duelResults && duelId != null ? (
          <WebShell
            activeView={View.DUEL_LOBBY}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <DuelResultsView
              duelId={duelId}
              dbDuelId={dbDuelId!}
              myWallet={publicKey!.toBase58()}
              tokenSymbol={duelTokenSymbol}
              tokenDecimals={duelTokenDecimals}
              tokenMint={duelTokenMint}
              myScore={duelResults.myScore}
              myCorrect={duelResults.myCorrect}
              opponentWallet={duelOpponent?.wallet ?? ''}
              opponentUsername={duelOpponent?.username ?? null}
              opponentAvatar={duelOpponent?.avatar ?? null}
              opponentScore={duelResults.opponentScore}
              opponentCorrect={duelResults.opponentCorrect}
              winnerWallet={duelResults.winner}
              entryFee={duelEntryFee}
              totalPot={duelResults.totalPot}
              duelComplete={duelResults.duelComplete}
              isPlayer1={duelIsPlayer1}
              onClaimPrize={async () => {
                // SPL duels (token_mint set) route to the SPL claim handler;
                // SOL duels stay on the classic handler. Same UI button.
                if (duelTokenMint && duelId != null) {
                  await handleClaimDuelSplPrize(duelId, duelTokenMint);
                } else {
                  await handleClaimDuelPrize();
                }
              }}
              onPlayAgain={() => setCurrentView(View.DUEL_LOBBY)}
              onBackToLobby={() => setCurrentView(View.DUEL_LOBBY)}
            />
          </WebShell>
        ) : null;
      case View.REFERRALS:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <ReferralsViewV2 />
          </WebShell>
        );
      case View.GAME_PASS:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <GamePassViewV2
              hasGamePass={hasGamePass}
              isSeekerVerified={isSeekerVerified}
              onPurchased={() => setHasGamePass(true)}
            />
          </WebShell>
        );
      case View.MINT:
        return (
          <WebShell
            activeView={currentView}
            onNav={(v) => setCurrentView(v)}
            lives={livesDisplayReady ? lives : null}
            walletAddress={publicKey?.toBase58() ?? null}
            onBuyLives={() => {
              if (!connected) setShowWalletRequired(true);
              else setIsBuyLivesOpen(true);
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onConnect={() => setShowWalletRequired(true)}
          >
            <MintViewV2
              walletAddress={publicKey?.toBase58() ?? null}
              hasGamePass={hasGamePass}
              isSeekerVerified={isSeekerVerified}
              onPlay={() => setCurrentView(View.COMPETE_LOBBY)}
            />
          </WebShell>
        );
      default:
        return (
          <HomeView
            lives={livesDisplayReady ? lives : null}
            onEnterTrivia={() => {
              if (!connected) {
                setShowWalletRequired(true);
              } else {
                setCurrentView(View.COMPETE_LOBBY);
              }
            }}
            onOpenGuide={() => setIsGuideOpen(true)}
            onOpenBuyLives={() => {
              if (!connected) {
                setShowWalletRequired(true);
              } else {
                setIsBuyLivesOpen(true);
              }
            }}
            onStartPractice={handleStartPractice}
            practiceRunsLeft={practiceRunsLeft}
            hasGamePass={hasGamePass}
            isSeekerVerified={isSeekerVerified}
            onBuyGamePass={() => setCurrentView(View.GAME_PASS)}
            onCreateCustomGame={handleNavigateToCreateGame}
            onEnterDuels={() => setCurrentView(View.DUEL_LOBBY)}
          />
        );
    }
  };

  // V2 shell-enabled views: render WebShell + V2 page body. Old chrome
  // (Sidebar + NERD banner + mobile help button) hides for these so the new
  // shell isn't doubled up. Add a view here when its V2 port lands.
  const v2ShellViews: View[] = [View.HOME, View.COMPETE_LOBBY, View.QUESTS, View.LEADERBOARD, View.DUEL_LOBBY, View.CUSTOM_GAMES_HUB, View.REFERRALS, View.GAME_PASS, View.MINT, View.PLAY, View.PROFILE, View.LIVES, View.CUSTOM_GAME_CREATE, View.CUSTOM_GAME_LOBBY, View.DUEL_WAITING, View.RESULTS, View.PRACTICE_RESULTS, View.CUSTOM_GAME_RESULTS, View.DUEL_RESULTS];
  const isV2Shell = v2ShellViews.includes(currentView);

  // Hide sidebar during active quiz, legal full-page views, OR any V2-shell view.
  const hideSidebar = isV2Shell || currentView === View.QUIZ || currentView === View.TERMS || currentView === View.PRIVACY || currentView === View.CUSTOM_GAME_PLAY || currentView === View.DUEL_PLAY;

  // Footer removed – Terms & Privacy links are in the How to Play modal

  // Optimized help button logic to avoid duplication on views with built-in headers
  const viewsWithBuiltInHeader = [View.LEADERBOARD, View.PROFILE, View.QUESTS];
  const showMobileHelpButton = currentView !== View.HOME && !hideSidebar && !viewsWithBuiltInHeader.includes(currentView);

  if (appLoading) {
    return <LoadingScreen onComplete={() => setAppLoading(false)} />;
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#050505] overflow-hidden text-white selection:bg-[#00FFA3] selection:text-black">
      {/* Round-entry recovery modal (Kyle 2026-06-07). Detects paid-but-
          unstarted entries in localStorage + offers resume. start-game v73
          re-uses the existing on-chain tx — no SOL re-spent. */}
      <RoundRecoveryModal
        visible={pendingRecoveryEntry !== null}
        entry={pendingRecoveryEntry}
        roundEndsAtMs={pendingRecoveryEndsAt}
        busy={pendingRecoveryBusy}
        onResume={handlePendingRecoveryResume}
        onDismiss={handlePendingRecoveryDismiss}
      />
      {/* First-connect onboarding modal — gates new wallets until age + ToS
          + username are confirmed. Pre-fills the referral input from any
          ?ref=X code we caught. Renders above EVERYTHING (z-index 400). */}
      {needsOnboarding && connected && publicKey && (
        <OnboardingModal
          walletAddress={publicKey.toBase58()}
          seekerDomain={onboardingSeekerDomain}
          initialReferralCode={onboardingPendingRef}
          onComplete={({ username, referralRegistered }) => {
            setNeedsOnboarding(false);
            // Reflect the new username in the profile state so the topbar +
            // profile page update immediately without a hard refresh.
            setProfile((prev) => ({ ...prev, username }));
            // Clear the captured ref code regardless of whether the modal
            // registered it (the existing App.tsx referral effect may have
            // beaten the modal to it; either way the code is now consumed).
            if (referralRegistered) {
              try { localStorage.removeItem('soltrivia_referral_code'); } catch {}
            }
          }}
        />
      )}
      {!hideSidebar && <Sidebar currentView={currentView} setView={handleViewChange} />}

      <main className="flex-1 overflow-y-auto relative h-full scroll-smooth flex flex-col pb-[100px] md:pb-0 safe-bottom">
        {/* $NERD Promo Banner — sticky inside scroll container */}
        {!hideSidebar && (
          <div className="sticky top-0 z-10 shrink-0 flex items-center justify-center gap-2 w-full bg-amber-500/[0.06] border-b border-amber-500/15 px-4 py-1.5 text-center">
            <button
              onClick={() => setCurrentView(View.SWAP)}
              className="flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
            >
              <img src="/token-nerd.png" alt="$NERD" className="w-4 h-4 rounded-full object-cover" />
              <span className="text-amber-400 text-[10px] font-black uppercase tracking-wider italic">
                Buy $NERD &middot; Save 10% on lives & game pass
              </span>
              <span className="text-amber-300/80 text-[10px] font-black uppercase tracking-wider">
                &rarr;
              </span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText('DEc6Gf57RfFJbjqGrzo4zeRBr5iQS8vTV8r11ZuyBAGS');
                setNerdMintCopied(true);
                setTimeout(() => setNerdMintCopied(false), 1500);
              }}
              className="ml-1 p-1 rounded hover:bg-amber-500/20 transition-colors"
              title="Copy $NERD mint address"
            >
              {nerdMintCopied ? (
                <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
            <div className="ml-1 hidden md:block">
              <NotificationBell walletAddress={publicKey?.toBase58() ?? null} />
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0">{renderContent()}</div>
      </main>

      {/* Global Mobile Help Button for views without headers */}
      {showMobileHelpButton && (
        <div className="md:hidden fixed z-[150] top-[-4px] left-0 right-0 h-[64px] px-6 flex justify-end items-center pointer-events-none transition-all duration-300 safe-top">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="pointer-events-auto w-10 h-10 flex items-center justify-center transition-all active:scale-95"
          >
            <div className="w-8 h-8 rounded-full bg-[#14F195] flex items-center justify-center shadow-lg shadow-black/50">
              <span className="text-black font-black text-sm italic">?</span>
            </div>
          </button>
        </div>
      )}

      <GuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        onOpenTerms={() => setCurrentView(View.TERMS)}
        onOpenPrivacy={() => setCurrentView(View.PRIVACY)}
      />
      <CategorySelectorModal
        isOpen={showCategorySelector}
        onClose={() => setShowCategorySelector(false)}
        onSelectCategory={handleCategorySelected}
        hasGamePass={hasGamePass}
        isSeekerVerified={isSeekerVerified}
        onGamePassPurchased={() => setHasGamePass(true)}
      />
      <BuyLivesModal isOpen={isBuyLivesOpen} onClose={() => setIsBuyLivesOpen(false)} onBuySuccess={handleBuyLivesSuccess} isSeekerVerified={isSeekerVerified} />
      {showFirstTimeDeposit && publicKey && isPrivyUser && (
        <FirstTimeDepositModal
          walletAddress={publicKey.toBase58()}
          connection={connection}
          provider="privy"
          onClose={() => {
            setShowFirstTimeDeposit(false);
            try {
              localStorage.setItem(`soltrivia_deposit_modal_dismissed_${publicKey.toBase58()}`, 'true');
            } catch { /* noop */ }
          }}
          onGoToProfile={() => setCurrentView(View.PROFILE)}
        />
      )}
      <EditProfileModal
        isOpen={isEditProfileOpen} 
        onClose={() => setIsEditProfileOpen(false)} 
        currentUsername={profile.username}
        currentAvatar={profile.avatar}
        onSave={handleUpdateProfile}
      />
      <WalletRequiredModal
        isOpen={showWalletRequired}
        onClose={() => setShowWalletRequired(false)}
        onOpenTerms={() => setCurrentView(View.TERMS)}
        onOpenPrivacy={() => setCurrentView(View.PRIVACY)}
      />
      <ContentDisclaimerModal
        isOpen={showContentDisclaimer}
        onAccept={() => {
          setShowContentDisclaimer(false);
          setCurrentView(View.CUSTOM_GAME_CREATE);
        }}
        onClose={() => setShowContentDisclaimer(false)}
      />

      {/* Funding Disclaimer Modal for Creator-Funded Games */}
      {showFundingDisclaimer && fundingGameData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-xl font-[1000] italic text-white uppercase tracking-tighter">Fund Your Game</h3>
            <div className="space-y-3 text-zinc-400 text-sm">
              <p>You are about to deposit <span className="text-white font-bold">{(fundingGameData.creator_deposit_lamports / 1e9).toFixed(2)} SOL</span> into the prize vault.</p>
              <div className="bg-white/[0.03] border border-white/5 rounded-xl p-3 space-y-2 text-xs">
                <p>Your deposit goes into a smart contract vault on Solana</p>
                <p>10% platform fee is deducted from the prize pool at finalization</p>
                <p>Winners claim their prizes directly from the vault</p>
                <p>Once the game plays out, your deposit cannot be withdrawn</p>
                <p>If no one finishes the quiz, the vault can be swept back by admin</p>
              </div>
              <p className="text-zinc-500 text-xs">The game timer will start immediately after funding.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowFundingDisclaimer(false); setFundingGameData(null); }}
                className="flex-1 min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-xs tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleFundAndStartCreatorGame}
                disabled={funding}
                className="flex-1 min-h-[44px] px-4 py-3 bg-amber-500 text-black font-[1000] italic uppercase text-sm rounded-xl hover:bg-amber-400 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {funding ? 'Funding...' : `Fund ${(fundingGameData.creator_deposit_lamports / 1e9).toFixed(2)} SOL`}
              </button>
            </div>
          </div>
        </div>
      )}

      <PwaInstallPrompt open={showInstallPrompt} onClose={() => setShowInstallPrompt(false)} />
      {!hasAcceptedTerms && currentView !== View.TERMS && currentView !== View.PRIVACY && (
        <LegalDisclaimerModal
          onAccept={() => {
            try { localStorage.setItem('soltrivia_terms_accepted', 'true'); } catch {}
            setHasAcceptedTerms(true);
          }}
          onOpenTerms={() => setCurrentView(View.TERMS)}
          onOpenPrivacy={() => setCurrentView(View.PRIVACY)}
        />
      )}
    </div>
  );
};

export default App;

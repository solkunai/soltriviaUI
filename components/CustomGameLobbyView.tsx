import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCustomGame, type CustomGameData } from '../src/utils/api';
import { getJupiterToken } from '../src/utils/jupiterTokens';
import { JupiterVerifiedBadge } from './JupiterVerifiedBadge';
import {
  CUSTOM_GAME_MAX_ATTEMPTS,
  DEFAULT_AVATAR,
  getReEntryFeeLamports,
} from '../src/utils/constants';
import NftPrizeCard from './NftPrizeCard';

// ── Gate 4 cross-platform locked decisions (per Sol Trivia design 2026-06-04) ──
//  D: diagonal 150° gold-tinted prize hero (lobby + setup wizard + results)
//  B: top-3 medal colors , 1st gold, 2nd silver, 3rd bronze, 4+ zinc
//  C: JOINED FOOTER pill below leaderboard with 3-variant copy
const MEDAL_GOLD = '#FFD700';
const MEDAL_SILVER = '#cfcfd6';
const MEDAL_BRONZE = '#E8A36B';
const ZINC_DIM = '#a1a1aa';

/** Handles the teens-trap (11/12/13 → TH, not ST/ND/RD). */
function ordinalSuffix(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return 'TH';
  const mod10 = n % 10;
  if (mod10 === 1) return 'ST';
  if (mod10 === 2) return 'ND';
  if (mod10 === 3) return 'RD';
  return 'TH';
}

function medalColorForRank(rank: number): string {
  if (rank === 1) return MEDAL_GOLD;
  if (rank === 2) return MEDAL_SILVER;
  if (rank === 3) return MEDAL_BRONZE;
  return ZINC_DIM;
}

/**
 * Bold gold-tinted diagonal 150° prize hero. Same component shape used by
 * setup wizard (step 2/4) and results screen per decision D. Adapts copy
 * for paid / creator-funded / free. Countdown ticker on the right when
 * lobby is still active.
 */
function PrizeHeroV2(props: {
  prizeSol: number;
  entryFeeSol: number;
  playerCount: number;
  maxPlayers: number | null;
  maxWinners: number;
  prizeSplitBps: number[];
  isCreatorFunded: boolean;
  isFree: boolean;
  countdown: string | null;
  countdownLabel: string;
  /** Token symbol for display. Defaults to SOL for back-compat with pre-v2.1 callers. */
  tokenSymbol?: string;
  /** Optional Jupiter-resolved USD price per unit (for SPL token games). Renders a tiny "≈ $X" hint under the hero amount when present. */
  tokenUsdPrice?: number | null;
}) {
  const { prizeSol, entryFeeSol, playerCount, maxPlayers, maxWinners, prizeSplitBps, isCreatorFunded, isFree, countdown, countdownLabel } = props;
  const sym = props.tokenSymbol ?? 'SOL';
  const formatHeroUsd = (humanAmount: number): string | null => {
    if (!props.tokenUsdPrice || humanAmount <= 0) return null;
    const usd = humanAmount * props.tokenUsdPrice;
    if (usd > 0 && usd < 0.01) return '< $0.01';
    if (usd < 1000) return `≈ $${usd.toFixed(2)}`;
    if (usd < 1_000_000) return `≈ $${(usd / 1000).toFixed(2)}k`;
    return `≈ $${(usd / 1_000_000).toFixed(2)}M`;
  };
  const heroUsd = formatHeroUsd(prizeSol);
  const subtitle = isFree
    ? 'FREE ENTRY · GLORY ONLY'
    : isCreatorFunded
    ? 'CREATOR FUNDED · WINNER TAKES ALL'
    : `${entryFeeSol.toFixed(3)} ${sym} ENTRY · ${playerCount}${maxPlayers ? ` OF ${maxPlayers} MAX` : ''}`;
  const winnersChips: Array<{ rank: number; sol: number }> = [];
  for (let i = 0; i < maxWinners; i++) {
    const bps = prizeSplitBps[i] || 0;
    if (bps > 0) winnersChips.push({ rank: i + 1, sol: (prizeSol * bps) / 10000 });
  }
  const heroLabel = isFree ? 'GLORY · NO PRIZE' : isCreatorFunded ? 'PRIZE · CREATOR FUNDED' : 'PRIZE POOL · GROWS PER PLAYER';
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 mb-6 relative overflow-hidden"
      style={{
        background:
          'linear-gradient(150deg, rgba(255,215,0,0.18) 0%, rgba(255,215,0,0.05) 60%, transparent 100%)',
        border: '1px solid rgba(255,215,0,0.35)',
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div
            className="font-black italic uppercase tracking-[0.2em] text-[10px] sm:text-[11px]"
            style={{ color: MEDAL_GOLD, fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
          >
            {heroLabel}
          </div>
          <div
            className="font-black italic mt-2 tabular-nums"
            style={{
              color: MEDAL_GOLD,
              fontSize: 'clamp(38px, 8vw, 52px)',
              letterSpacing: '-0.02em',
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              fontWeight: 900,
              lineHeight: 1,
            }}
          >
            {isFree ? `— ${sym}` : `${prizeSol.toFixed(prizeSol >= 1 ? 2 : 3)} ${sym}`}
          </div>
          {heroUsd && (
            <div
              className="font-bold tabular-nums mt-1"
              style={{ color: 'rgba(255,215,0,0.55)', fontSize: 12 }}
            >
              {heroUsd}
            </div>
          )}
          <div
            className="font-black italic uppercase tracking-[0.16em] text-[10px] sm:text-[11px] text-zinc-400 mt-3"
            style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
          >
            {subtitle}
          </div>
        </div>
        {countdown && (
          <div
            className="rounded-lg px-3 py-2 text-right"
            style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="text-zinc-500 font-black italic uppercase tracking-[0.18em] text-[9px]"
              style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
            >
              {countdownLabel}
            </div>
            <div
              className="text-white font-black italic tabular-nums text-base sm:text-lg"
              style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif', fontWeight: 900, letterSpacing: '-0.02em' }}
            >
              {countdown}
            </div>
          </div>
        )}
      </div>
      {winnersChips.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {winnersChips.map((c) => {
            const color = medalColorForRank(c.rank);
            const isFirst = c.rank === 1;
            return (
              <div
                key={c.rank}
                className="rounded-md px-2.5 py-1.5 flex items-baseline gap-1.5"
                style={{
                  background: isFirst ? 'rgba(255,215,0,0.18)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isFirst ? 'rgba(255,215,0,0.45)' : 'rgba(255,255,255,0.10)'}`,
                }}
              >
                <span
                  className="font-black italic uppercase tracking-[0.14em] text-[9px]"
                  style={{ color, fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
                >
                  {c.rank}{ordinalSuffix(c.rank)}
                </span>
                <span
                  className="font-black italic tabular-nums text-[11px]"
                  style={{ color: isFirst ? MEDAL_GOLD : '#fff', fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
                >
                  {c.sol.toFixed(3)} {sym}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CustomGameLobbyViewProps {
  slug: string;
  walletAddress: string | null;
  onStartGame: (gameData: CustomGameData) => void;
  onJoinGame: (gameData: CustomGameData) => Promise<void>;
  onStartTimer: (gameData: CustomGameData) => Promise<void>;
  onClaimPrize: (onChainGameId: number) => Promise<void>;
  /** SPL variant — called when the game used a token_mint (USDC, NERD, etc.). */
  onClaimSplPrize?: (onChainGameId: number, tokenMint: string) => Promise<void>;
  onClaimRefund?: (onChainGameId: number) => Promise<void>;
  onFundAndStart?: (gameData: CustomGameData) => void;
  onEndGame?: (gameData: CustomGameData) => Promise<void>;
  /** Winner claims the escrowed NFT prize (v2.1). Branches by nft_standard. */
  onClaimNftPrize?: (args: {
    onChainGameId: number;
    nftMint: string;
    nftStandard: 'core' | 'pnft';
  }) => Promise<void>;
  /** Creator reclaims their NFT if the game expired without finalize. */
  onReclaimNftPrize?: (args: {
    onChainGameId: number;
    creatorWallet: string;
    nftMint: string;
    nftStandard: 'core' | 'pnft';
  }) => Promise<void>;
  /** Build + sign the enter_custom_game_nft tx for an NFT game. Returns tx sig. */
  onEnterNftGame?: (args: { onChainGameId: number }) => Promise<string>;
  onBack: () => void;
  onConnectWallet: () => void;
}

const CustomGameLobbyView: React.FC<CustomGameLobbyViewProps> = ({
  slug,
  walletAddress,
  onStartGame,
  onJoinGame,
  onClaimPrize,
  onClaimSplPrize,
  onClaimRefund,
  onFundAndStart,
  onEndGame,
  onClaimNftPrize,
  onReclaimNftPrize,
  onBack,
  onConnectWallet,
}) => {
  const [gameData, setGameData] = useState<CustomGameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [joining, setJoining] = useState(false);

  const [claiming, setClaiming] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [countdown, setCountdown] = useState('');
  const [showReEntryConfirm, setShowReEntryConfirm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shareUrl = `${window.location.origin}/game/${slug}`;

  const fetchGame = useCallback(async () => {
    try {
      const data = await getCustomGame(slug, walletAddress || undefined);
      setGameData(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load game');
    }
  }, [slug, walletAddress]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    fetchGame().finally(() => setLoading(false));
  }, [fetchGame]);

  // Polling for paid games in active/started/completed states
  useEffect(() => {
    if (!gameData || gameData.prize_model === 'free') return;
    if (['finalized', 'expired', 'banned'].includes(gameData.status)) return;

    const interval = gameData.status === 'completed' ? 5000 : 10000;
    pollRef.current = setInterval(fetchGame, interval);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [gameData?.status, gameData?.prize_model, fetchGame]);

  // Countdown timer for started games
  useEffect(() => {
    if (!gameData?.ends_at || gameData.status !== 'started') {
      setCountdown('');
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, new Date(gameData.ends_at!).getTime() - Date.now());
      if (diff <= 0) {
        setCountdown('Ended');
        fetchGame();
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`);
    };
    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [gameData?.ends_at, gameData?.status]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // Token-aware display helpers. NULL gameData.token_mint = SOL game; all
  // *_lamports columns hold base units of whatever token the game uses.
  const tokenDecimals = gameData?.token_decimals ?? 9;
  const tokenSymbol = gameData?.token_symbol ?? 'SOL';
  const baseDivisor = Math.pow(10, tokenDecimals);
  const formatToken = (baseUnits: number) => (baseUnits / baseDivisor).toFixed(Math.min(tokenDecimals, 4));

  // Live Jupiter USD price + logo for the game's token. Only fetched for SPL
  // games (NULL token_mint = SOL, which has its own price feed elsewhere).
  // Kyle 2026-06-27: also captures logoURI so we can display the token icon
  // alongside the symbol in the prize/entry rows.
  const [tokenUsdPrice, setTokenUsdPrice] = useState<number | null>(null);
  const [tokenLogo, setTokenLogo] = useState<string | null>(null);
  useEffect(() => {
    const mint = gameData?.token_mint;
    if (!mint) {
      setTokenUsdPrice(null);
      setTokenLogo(null);
      return;
    }
    let cancelled = false;
    getJupiterToken(mint)
      .then((tok) => {
        if (cancelled) return;
        setTokenUsdPrice(tok?.usdPrice ?? null);
        setTokenLogo(tok?.logoURI ?? null);
      })
      .catch(() => {
        if (!cancelled) { setTokenUsdPrice(null); setTokenLogo(null); }
      });
    return () => { cancelled = true; };
  }, [gameData?.token_mint]);

  // Format a token amount (already divided to human units) as a "≈ $USD" hint.
  // Returns null when no price available or amount is zero. Approximate.
  const formatTokenUsd = (humanAmount: number): string | null => {
    if (!tokenUsdPrice || !gameData?.token_mint || humanAmount <= 0) return null;
    const usd = humanAmount * tokenUsdPrice;
    if (usd > 0 && usd < 0.01) return '< $0.01';
    if (usd < 1000) return `≈ $${usd.toFixed(2)}`;
    if (usd < 1_000_000) return `≈ $${(usd / 1000).toFixed(2)}k`;
    return `≈ $${(usd / 1_000_000).toFixed(2)}M`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleShareX = () => {
    if (!gameData) return;
    const isPlayerFunded = gameData.prize_model === 'player_funded';
    const isCreatorFundedShare = gameData.prize_model === 'creator_funded';
    const fee = formatToken(gameData.entry_fee_lamports);
    const creatorPrize = formatToken(gameData.creator_deposit_lamports || 0);
    const text = isCreatorFundedShare
      ? `i'm putting ${creatorPrize} ${tokenSymbol} on the line for a trivia game\n\n"${gameData.name}" on @soltrivia_app | FREE to enter, real prizes\n\nthink you're smart enough to win?\n\n${shareUrl}`
      : isPlayerFunded
      ? `i just built a trivia game with real ${tokenSymbol} on the line\n\n"${gameData.name}" on @soltrivia_app | entry: ${fee} ${tokenSymbol}\n\nput your wallet where your brain is, anon\n\n${shareUrl}`
      : `"${gameData.name}" on @soltrivia_app , free to play, harder than you think\n\nbet you can't beat my score. prove me wrong\n\n${shareUrl}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleJoin = async () => {
    if (!gameData) return;
    setJoining(true);
    try {
      await onJoinGame(gameData);
      await fetchGame();
    } catch (err: any) {
      if (!err.message?.includes('User rejected')) alert(err.message || 'Failed to join game');
    } finally {
      setJoining(false);
    }
  };


  const handleClaim = async () => {
    if (gameData?.on_chain_game_id == null) return;
    setClaiming(true);
    try {
      // Route to SPL handler when this game used a token_mint (USDC, NERD, any SPL).
      const splMint = (gameData as any).token_mint as string | null | undefined;
      if (splMint && onClaimSplPrize) {
        await onClaimSplPrize(gameData.on_chain_game_id, splMint);
      } else {
        await onClaimPrize(gameData.on_chain_game_id);
      }
      await fetchGame();
    } catch (err: any) {
      if (!err.message?.includes('User rejected')) alert(err.message || 'Failed to claim prize');
    } finally {
      setClaiming(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505]">
        <div className="text-center">
          <p className="text-white text-xl font-black uppercase mb-4">Loading Game...</p>
          <div className="w-16 h-16 border-4 border-[#38BDF8] border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !gameData) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-[1000] italic text-white uppercase mb-2">Game Not Found</h2>
          <p className="text-zinc-400 text-sm mb-6">{error || 'This game does not exist or has been removed.'}</p>
          <button onClick={onBack} className="min-h-[44px] px-8 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Expired ──
  // Finalized games (status='finalized') fall through to the main lobby even if their
  // expires_at has passed — the main lobby renders the winner card + leaderboard so anyone
  // can come back to see who won and claim prizes.
  if ((gameData.is_expired || gameData.status === 'expired') && gameData.status !== 'finalized') {
    const isPaidExpired = gameData.prize_model === 'player_funded' && gameData.entry_fee_lamports > 0;
    const canClaimRefund = isPaidExpired && gameData.player_has_entered && gameData.on_chain_game_id != null && onClaimRefund;
    const entryRefundDisplay = formatToken(gameData.entry_fee_lamports);

    // v2.1: NFT prize game expired without finalize. Creator (or anyone, but
    // the contract sends the NFT to the creator) can crank reclaim_custom_nft
    // (or _tm_pnft) to return the escrowed NFT.
    const isNftExpired = gameData.prize_model === 'nft';
    const isCreatorOfExpired = !!(walletAddress && gameData.creator_wallet === walletAddress);
    const canReclaimNft = isNftExpired
      && isCreatorOfExpired
      && !!gameData.nft_mint
      && !!gameData.nft_standard
      && gameData.on_chain_game_id != null
      && !!onReclaimNftPrize;

    const handleRefund = async () => {
      if (gameData.on_chain_game_id == null || !onClaimRefund) return;
      setRefunding(true);
      try {
        await onClaimRefund(gameData.on_chain_game_id);
      } catch (err: any) {
        if (!err.message?.includes('User rejected')) alert(err.message || 'Failed to claim refund');
      } finally {
        setRefunding(false);
      }
    };

    const handleNftReclaim = async () => {
      if (!canReclaimNft) return;
      setRefunding(true);
      try {
        await onReclaimNftPrize!({
          onChainGameId: gameData.on_chain_game_id!,
          creatorWallet: gameData.creator_wallet,
          nftMint: gameData.nft_mint!,
          nftStandard: gameData.nft_standard!,
        });
        await fetchGame();
      } catch (err: any) {
        if (!err.message?.includes('User rejected')) alert(err.message || 'Failed to reclaim NFT');
      } finally {
        setRefunding(false);
      }
    };

    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
            <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-[1000] italic text-white uppercase mb-2">Game Expired</h2>
          <p className="text-zinc-400 text-sm mb-2">"{gameData.name}" has expired.</p>
          {canReclaimNft ? (
            <>
              <p className="text-zinc-400 text-xs mb-6">
                Your NFT prize is still in escrow. Reclaim it to your wallet below.
              </p>
              {gameData.nft_mint && (
                <div className="mb-5">
                  <NftPrizeCard
                    mint={gameData.nft_mint}
                    hintStandard={gameData.nft_standard ?? undefined}
                    variant="full"
                  />
                </div>
              )}
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleNftReclaim}
                  disabled={refunding}
                  className="min-h-[48px] px-8 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98] disabled:opacity-50 shadow-[0_10px_40px_-10px_rgba(56,189,248,0.4)]"
                >
                  {refunding ? 'Reclaiming NFT...' : 'Reclaim My NFT'}
                </button>
                <button onClick={onBack} className="min-h-[44px] px-8 py-3 text-zinc-500 font-black uppercase text-[10px] tracking-wider hover:text-zinc-300 transition-all">
                  Back to Home
                </button>
              </div>
            </>
          ) : canClaimRefund ? (
            <>
              <p className="text-zinc-400 text-xs mb-6">You paid {entryRefundDisplay} {tokenSymbol} entry. Claim your refund below.</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRefund}
                  disabled={refunding}
                  className="min-h-[48px] px-8 py-3 bg-amber-500 text-black font-[1000] italic uppercase rounded-xl hover:bg-amber-400 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {refunding ? 'Claiming Refund...' : `Claim Refund (${entryRefundDisplay} ${tokenSymbol})`}
                </button>
                <button onClick={onBack} className="min-h-[44px] px-8 py-3 text-zinc-500 font-black uppercase text-[10px] tracking-wider hover:text-zinc-300 transition-all">
                  Back to Home
                </button>
              </div>
            </>
          ) : isNftExpired ? (
            <>
              <p className="text-zinc-600 text-xs mb-6">
                This NFT prize game expired without a winner. The creator can reclaim the escrowed NFT.
              </p>
              <button onClick={onBack} className="min-h-[44px] px-8 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]">
                Back to Home
              </button>
            </>
          ) : (
            <>
              <p className="text-zinc-600 text-xs mb-6">Custom games are available for 7 days after creation.</p>
              <button onClick={onBack} className="min-h-[44px] px-8 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]">
                Back to Home
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Banned ──
  if (gameData.status === 'banned') {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-[1000] italic text-red-400 uppercase mb-2">Game Removed</h2>
          <p className="text-zinc-400 text-sm mb-6">This game has been removed for violating content guidelines.</p>
          <button onClick={onBack} className="min-h-[44px] px-8 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]">
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // ── Main Lobby ──
  const isPaid = gameData.prize_model === 'player_funded' || gameData.prize_model === 'creator_funded';
  const isCreatorFunded = gameData.prize_model === 'creator_funded';
  const isNftPrize = gameData.prize_model === 'nft';
  const nftMint = gameData.nft_mint;
  const nftStandard = gameData.nft_standard;
  const isCreator = !!(walletAddress && gameData.creator_wallet === walletAddress);
  const hasEntered = gameData.player_has_entered;
  const attemptsUsed = gameData.player_attempts ?? 0;
  const hasInProgress = gameData.player_has_in_progress;
  const canPlay = attemptsUsed < CUSTOM_GAME_MAX_ATTEMPTS || hasInProgress;
  const isReEntry = isPaid && hasEntered && attemptsUsed > 0 && !hasInProgress;
  // Token-aware display amounts. Variable names kept *SOL for back-compat with
  // call sites; each holds the human-readable amount in whatever token the
  // game uses (formatToken() divides by 10^decimals).
  const reEntryFeeSOL = isReEntry ? Number(formatToken(getReEntryFeeLamports(gameData.entry_fee_lamports))) : 0;
  const entryFeeSOL = Number(formatToken(gameData.entry_fee_lamports));
  const creatorDepositSOL = Number(formatToken(gameData.creator_deposit_lamports || 0));
  const prizePotSOL = isCreatorFunded
    ? (gameData.fund_tx_signature ? Number(formatToken(gameData.prize_pot_lamports)) : (creatorDepositSOL * 0.9))
    : Number(formatToken(gameData.prize_pot_lamports));
  const isFunded = isCreatorFunded && !!gameData.fund_tx_signature;

  // Check if current wallet is a winner (includes NFT games — they also use winner_wallets)
  const winnerIndex = ((isPaid || isNftPrize) && gameData.winner_wallets)
    ? gameData.winner_wallets.indexOf(walletAddress ?? '')
    : -1;
  const isWinner = winnerIndex >= 0;
  const winnerAmountSOL = isWinner && isPaid ? Number(formatToken(gameData.winner_amounts?.[winnerIndex] ?? 0)) : 0;

  // NFT-specific handler closures.
  const handleClaimNft = async () => {
    if (!gameData || gameData.on_chain_game_id == null || !nftMint || !nftStandard || !onClaimNftPrize) return;
    setClaiming(true);
    try {
      await onClaimNftPrize({
        onChainGameId: gameData.on_chain_game_id,
        nftMint,
        nftStandard,
      });
      await fetchGame();
    } catch (err: any) {
      if (!err.message?.includes('User rejected')) alert(err.message || 'Failed to claim NFT prize');
    } finally {
      setClaiming(false);
    }
  };

  const handleReclaimNft = async () => {
    if (!gameData || gameData.on_chain_game_id == null || !nftMint || !nftStandard || !onReclaimNftPrize) return;
    setRefunding(true);
    try {
      await onReclaimNftPrize({
        onChainGameId: gameData.on_chain_game_id,
        creatorWallet: gameData.creator_wallet,
        nftMint,
        nftStandard,
      });
      await fetchGame();
    } catch (err: any) {
      if (!err.message?.includes('User rejected')) alert(err.message || 'Failed to reclaim NFT');
    } finally {
      setRefunding(false);
    }
  };

  // Prize breakdown
  const prizeBreakdown: { rank: number; pct: string; sol: number }[] = [];
  if (isPaid && gameData.prize_split_bps?.length) {
    for (let i = 0; i < gameData.max_winners; i++) {
      const bps = gameData.prize_split_bps[i] || 0;
      if (bps > 0) {
        prizeBreakdown.push({
          rank: i + 1,
          pct: `${bps / 100}%`,
          sol: (prizePotSOL * bps) / 10000,
        });
      }
    }
  }

  // Expiry display
  const expiresAt = new Date(gameData.expires_at);
  const now = new Date();
  const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
  const daysLeft = Math.floor(hoursLeft / 24);
  const expiryLabel = daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h left` : `${hoursLeft}h left`;
  const creatorShort = gameData.creator_username || `${gameData.creator_wallet.slice(0, 4)}...${gameData.creator_wallet.slice(-4)}`;

  // Status display
  const statusColors: Record<string, string> = {
    active: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20',
    started: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    completed: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
    finalized: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    expired: 'text-zinc-400 bg-zinc-700/30 border-zinc-600/30',
  };
  const statusLabels: Record<string, string> = {
    active: 'Lobby Open',
    started: 'In Progress',
    completed: 'Completed',
    finalized: 'Prizes Available',
    expired: 'Expired',
  };

  // CTA logic
  const canCreatorFund = isCreatorFunded && isCreator && gameData.status === 'active' && !isFunded;
  // Block join on creator-funded games until the creator has funded the prize pool —
  // protects players from wasting the 0.0025 SOL platform fee on an empty pot.
  const awaitingCreatorFunding = isCreatorFunded && !isFunded;
  // Kyle 2026-06-27: contract allows joins anytime until expires_at — there's no
  // "lobby-only" phase. Previously this required status === 'active', which broke
  // creator-funded SPL games (those auto-fund + flip to 'started' on creation,
  // collapsing the join window to milliseconds). Now allows joins for either
  // 'active' OR 'started'. expired/completed/finalized/banned states already
  // short-circuit higher up in the component so they can't reach here.
  const showJoinButton = isPaid && !hasEntered && !isCreator &&
    (gameData.status === 'active' || gameData.status === 'started') &&
    !awaitingCreatorFunding;

  // Duration label
  const durationLabel = gameData.game_duration_minutes
    ? (gameData.game_duration_minutes >= 60 ? `${gameData.game_duration_minutes / 60}h` : `${gameData.game_duration_minutes}m`)
    : null;

  return (
    <div className="flex flex-col relative overflow-x-hidden">
      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Back */}
        <button onClick={onBack} className="mb-6 text-zinc-500 hover:text-zinc-300 font-black uppercase text-[10px] tracking-wider transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>

        {/* Banner Image */}
        {gameData.banner_url && (
          <div className="mb-4 -mx-2 md:mx-0">
            {/* Kyle 2026-06-27: aspect-[4/1] keeps the banner's full 4:1 aspect ratio
                visible on every screen size (was h-36 md:h-48 which gave ~2.5:1 on
                mobile widths, cropping the sides of 4:1 source banners and cutting
                off content like the Sol Trivia logo on the left edge). */}
            <img src={gameData.banner_url} alt={gameData.name} className="w-full aspect-[4/1] object-cover rounded-2xl border border-white/5" />
          </div>
        )}

        {/* \u2500\u2500 Editorial header (Gate 4 lobby polish per design 2026-06-04) \u2500\u2500 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <p className={`text-[9px] font-black uppercase tracking-[0.4em] ${isCreatorFunded ? 'text-amber-400' : isPaid ? 'text-[#38BDF8]' : 'text-zinc-400'}`}>
              {isCreatorFunded ? 'Creator-Funded Game' : isPaid ? 'Prize Game' : 'Custom Game'}
            </p>
            {isPaid && (
              <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border ${statusColors[gameData.status] || 'text-zinc-400 bg-white/5 border-white/10'}`}>
                {statusLabels[gameData.status] || gameData.status}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl font-[1000] italic text-white uppercase tracking-tighter mb-3 leading-tight">
            {gameData.name}
          </h1>

          <p className="text-zinc-500 text-[10px] sm:text-xs font-black italic uppercase tracking-[0.2em] mb-3">
            HOSTED BY <span className="text-zinc-300">{creatorShort}</span>
            <span className="text-zinc-700 mx-2">{'\u00b7'}</span>
            <span className="text-zinc-300 tabular-nums">{gameData.player_count}</span> IN
          </p>

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-zinc-400 text-[10px] font-black uppercase tracking-wider">
              {gameData.question_count} Q's
            </span>
            <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-zinc-400 text-[10px] font-black uppercase tracking-wider">
              {gameData.round_count} {gameData.round_count === 1 ? 'Round' : 'Rounds'}
            </span>
            <span className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-zinc-400 text-[10px] font-black uppercase tracking-wider">
              {gameData.time_limit_seconds}s per Q
            </span>
            {isPaid && (
              <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${isCreatorFunded ? 'bg-amber-400/10 border border-amber-400/20 text-amber-400' : 'bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8]'}`}>
                {isCreatorFunded ? 'Free Entry' : `${entryFeeSOL} ${tokenSymbol} Entry`}
                {!isCreatorFunded && <JupiterVerifiedBadge mint={gameData.token_mint ?? null} size={11} />}
              </span>
            )}
          </div>
        </div>

        {/* \u2500\u2500 PRIZE HERO V2 (gold-tinted diagonal 150\u00b0 per decision D) \u2500\u2500 */}
        {(isPaid || isCreatorFunded) && (
          <PrizeHeroV2
            prizeSol={prizePotSOL}
            entryFeeSol={entryFeeSOL ? Number(entryFeeSOL) : 0}
            playerCount={gameData.player_count}
            maxPlayers={gameData.max_players ?? null}
            maxWinners={gameData.max_winners}
            prizeSplitBps={gameData.prize_split_bps ?? []}
            isCreatorFunded={isCreatorFunded}
            isFree={!isPaid}
            countdown={gameData.status === 'started' && countdown ? countdown : (gameData.status === 'active' ? expiryLabel : null)}
            countdownLabel={gameData.status === 'started' ? 'TIME LEFT' : 'CLOSES IN'}
            tokenSymbol={tokenSymbol}
            tokenUsdPrice={tokenUsdPrice}
          />
        )}

        {isCreatorFunded && !isFunded && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-400/10 border border-amber-400/20 text-amber-400">
            <span>Awaiting Creator Funding</span>
          </div>
        )}

        {/* \u2500\u2500 YOU HAVEN'T PLAYED callout (cyan dashed, per 3:10am screenshot) \u2500\u2500
            Kyle 2026-06-27: also show during 'started' \u2014 creator-funded SPL games
            skip the 'active' phase entirely (auto-fund on creation), so this
            invitation-to-play wouldn't otherwise appear for them. */}
        {(gameData.status === 'active' || gameData.status === 'started') && !hasEntered && !isCreator && (
          <div
            className="rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-3"
            style={{
              background: 'rgba(56,189,248,0.06)',
              border: '1.5px dashed rgba(56,189,248,0.45)',
            }}
          >
            <div className="min-w-0">
              <p className="text-[#38BDF8] font-black italic uppercase tracking-[0.18em] text-[10px] sm:text-[11px]" style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}>
                You haven't played
              </p>
              <p className="text-zinc-400 text-[11px] sm:text-xs font-bold italic mt-0.5">
                {gameData.question_count} Q's {'\u00b7'} {gameData.time_limit_seconds}s each
              </p>
            </div>
          </div>
        )}

        {/* \u2500\u2500 3-COL COMPACT STATS V3 (PLAYED / ENTRIES / ENTRY FEE per
            decision aligned with native commit 1B 2026-06-05) \u2500\u2500 */}
        {(isPaid || isCreatorFunded) && (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 mb-6 grid grid-cols-3 gap-3">
            <div className="text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Played</span>
              <span className="text-white text-base sm:text-lg font-[1000] italic tabular-nums">{gameData.player_count}</span>
            </div>
            <div className="text-center border-x border-white/5">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Entries</span>
              <span className="text-white text-base sm:text-lg font-[1000] italic">
                1<span className="text-xs">{'\u00d7'}</span>
              </span>
              <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mt-0.5">per player</span>
            </div>
            <div className="text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Entry Fee</span>
              <span className={`text-base sm:text-lg font-[1000] italic ${isCreatorFunded || !isPaid ? 'text-[#14F195]' : 'text-[#FFD700]'}`}>
                {isCreatorFunded || !isPaid ? 'FREE' : `${entryFeeSOL} ${tokenSymbol}`}
              </span>
            </div>
          </div>
        )}

        {/* Winner Hero Card — shown for finalized paid games with at least one winner */}
        {isPaid && gameData.status === 'finalized' && gameData.winner_wallets && gameData.winner_wallets.length > 0 && (
          <div className="bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-transparent border border-yellow-500/30 rounded-2xl p-6 md:p-8 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-yellow-400 text-2xl">🏆</span>
              <span className="text-yellow-400 text-[10px] font-black uppercase tracking-[0.4em] italic">
                {gameData.winner_wallets.length === 1 ? 'Winner' : 'Winners'}
              </span>
            </div>
            <div className="space-y-2">
              {gameData.winner_wallets.map((winnerWallet, idx) => {
                const amount = Number(formatToken(gameData.winner_amounts?.[idx] ?? 0));
                const winnerEntry = gameData.leaderboard.find((e) => e.wallet_address === winnerWallet);
                const winnerName = winnerEntry?.username || `${winnerWallet.slice(0, 6)}...${winnerWallet.slice(-4)}`;
                const isYou = !!walletAddress && winnerWallet === walletAddress;
                return (
                  <div
                    key={winnerWallet}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl ${idx === 0 ? 'bg-yellow-500/15 border border-yellow-400/40' : 'bg-white/[0.03] border border-white/5'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-lg font-[1000] italic ${idx === 0 ? 'text-yellow-400' : 'text-zinc-400'}`}>
                        #{idx + 1}
                      </span>
                      {winnerEntry?.avatar_url && (
                        <img
                          src={winnerEntry.avatar_url || DEFAULT_AVATAR}
                          alt=""
                          className="w-9 h-9 rounded-full object-cover border border-white/10"
                          onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`font-[1000] italic text-base md:text-lg truncate ${idx === 0 ? 'text-white' : 'text-zinc-300'}`}>
                            {winnerName}
                          </span>
                          {isYou && (
                            <span className="px-2 py-0.5 bg-[#14F195]/15 border border-[#14F195]/30 rounded text-[#14F195] text-[9px] font-black uppercase tracking-wider whitespace-nowrap">You won!</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`font-[1000] italic text-base md:text-lg ${idx === 0 ? 'text-yellow-400' : 'text-zinc-300'}`}>
                        {amount.toFixed(3)}
                      </span>
                      <span className="text-zinc-600 text-[9px] font-black uppercase inline-flex items-center gap-1">
                        {/* Kyle 2026-06-27: token logo (SKR/USDC/any SPL) shown next to symbol */}
                        {tokenLogo && <img src={tokenLogo} alt="" className="w-3 h-3 rounded-full" />}
                        {tokenSymbol}
                        <JupiterVerifiedBadge mint={gameData.token_mint ?? null} size={10} style={{ marginLeft: 2 }} />
                      </span>
                      {formatTokenUsd(amount) && (
                        <span className="text-zinc-700 text-[9px] tabular-nums block">{formatTokenUsd(amount)}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CTA — immediately visible */}
        <div className="mb-4">
          {!walletAddress ? (
            <button
              onClick={onConnectWallet}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#38BDF8] text-white font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:shadow-[0_10px_40px_-10px_rgba(56,189,248,0.4)] transition-all active:scale-[0.98]"
            >
              Connect Wallet {isPaid ? (isCreatorFunded ? 'to Join (Free)' : 'to Join') : 'to Play'}
            </button>
          ) : (isPaid && gameData.status === 'finalized' && !isNftPrize) ? (
            /* ── Paid SOL/SPL FINALIZED — claim or view results ──
                Kyle 2026-06-27: scope of this branch shrunk from "all paid games"
                to "paid SOL/SPL games that are FINALIZED only". The bigger
                "non-finalized paid game" CTAs (Started, Active+Join button,
                Play Now, etc.) ALWAYS lived in the next (isNftPrize) branch
                and were therefore unreachable for SOL/SPL paid games — exactly
                the World Cup bug (creator-funded SPL game starts at 'started'
                status, falls into this branch, only finalized CTAs were checked,
                nothing rendered → no Join button). Edit 2 widens the next
                branch's selector to (isPaid || isNftPrize) so paid games can
                also reach the full set of state-aware CTAs below. */}
            <>
              {/* v44: if winner_is_refund=true, the on-chain "winner" is the
                  refund recipient. UI labels it as REFUND, not PRIZE. */}
              {gameData.status === 'finalized' && (
                isWinner ? (
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)] transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {claiming
                      ? (gameData.winner_is_refund ? 'Claiming Refund...' : 'Claiming...')
                      : (gameData.winner_is_refund
                        ? `Claim Refund (${winnerAmountSOL.toFixed(3)} ${tokenSymbol})`
                        : `Claim Prize (${winnerAmountSOL.toFixed(3)} ${tokenSymbol})`)}
                  </button>
                ) : (
                  <div className="w-full min-h-[56px] px-6 py-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl text-center">
                    <span className="text-zinc-400 font-[1000] italic uppercase text-lg">Game Finalized</span>
                    <p className="text-zinc-500 text-xs font-black mt-1">View the leaderboard below to see winners.</p>
                  </div>
                )
              )}
            </>
          ) : (isPaid || isNftPrize) ? (
            /* ── Paid (SOL/SPL/NFT) Game CTAs — all non-finalized paid states ──
                Kyle 2026-06-27: selector widened from `isNftPrize` to
                `(isPaid || isNftPrize)` so paid SOL/SPL games reach the full
                set of state-aware CTAs below (Started, Active+Join button,
                Play Now, awaiting funding, etc.). The earlier branch above
                catches the FINALIZED case for paid SOL/SPL (claim button).
                NFT-specific blocks below remain guarded with isNftPrize so
                they only render for NFT games (the NftPrizeCard hero +
                NFT-specific finalized message + NFT Prize Game wrapper). */
            <>
              {/* Artwork hero — shown for every NFT game state so all players
                  see what the prize actually IS. Fetches metadata from Helius
                  DAS (cached 5min). Cyan accents per the brand rule. */}
              {nftMint && (
                <div className="mb-4">
                  <NftPrizeCard
                    mint={nftMint}
                    hintStandard={nftStandard ?? undefined}
                    variant="full"
                  />
                </div>
              )}

              {/* Finalized NFT game: winner claims, others see message */}
              {gameData.status === 'finalized' && (
                isWinner && nftMint && nftStandard && onClaimNftPrize ? (
                  <button
                    onClick={handleClaimNft}
                    disabled={claiming}
                    className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.4)] transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {claiming ? 'Claiming NFT...' : 'Claim NFT Prize'}
                  </button>
                ) : (
                  <div className="w-full min-h-[56px] px-6 py-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl text-center">
                    <span className="text-zinc-400 font-[1000] italic uppercase text-lg">NFT Game Finalized</span>
                    <p className="text-zinc-500 text-xs font-black mt-1">
                      {gameData.winner_wallets?.[0]
                        ? `Winner: ${gameData.winner_wallets[0].slice(0, 6)}…${gameData.winner_wallets[0].slice(-4)}`
                        : 'Check leaderboard for the winner.'}
                    </p>
                  </div>
                )
              )}

              {/* Expired NFT games early-return at the top of this component
                  (line ~209) and render the dedicated reclaim screen there.
                  So status === 'expired' is unreachable here. */}

              {/* Completed: awaiting finalization */}
              {gameData.status === 'completed' && (
                <div className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded-xl text-center">
                  <span className="text-[#38BDF8] font-[1000] italic uppercase text-lg">Finalizing NFT Winner...</span>
                  <p className="text-zinc-500 text-xs font-black mt-1">The single winner will receive the escrowed NFT.</p>
                </div>
              )}

              {/* Active/started NFT game: NFT-specific hero card with join button.
                  Kyle 2026-06-27: added isNftPrize guard. Was unguarded inside the
                  isNftPrize branch (so naturally only rendered for NFT games). Now
                  this branch ALSO serves paid SOL/SPL games (post Edit 2 widening),
                  so an explicit guard is needed to prevent SPL games from rendering
                  the NFT-styled card. SOL/SPL games render the generic Started /
                  Active OR started blocks farther down instead. */}
              {isNftPrize && (gameData.status === 'active' || gameData.status === 'started') && (
                <div className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8]/10 border border-[#38BDF8]/30 rounded-xl text-center">
                  <span className="text-[#7DD3FC] font-[1000] italic uppercase text-lg">NFT Prize Game</span>
                  <p className="text-zinc-400 text-xs font-black mt-1">
                    Single winner gets the escrowed NFT
                    {entryFeeSOL > 0 && ` · Entry: ${entryFeeSOL} ${tokenSymbol}`}
                  </p>
                  {!isCreator && !hasEntered && (
                    <button
                      onClick={handleJoin}
                      disabled={joining}
                      className="w-full min-h-[44px] px-4 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-sm tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98] mt-3 disabled:opacity-50"
                    >
                      {joining ? 'Joining...' : entryFeeSOL > 0 ? `Join NFT Game (${entryFeeSOL} ${tokenSymbol})` : 'Join NFT Game'}
                    </button>
                  )}
                  {hasEntered && !isCreator && canPlay && (
                    <button
                      onClick={() => onStartGame(gameData)}
                      className="w-full min-h-[44px] px-4 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-sm tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98] mt-3"
                    >
                      Play Now
                    </button>
                  )}
                </div>
              )}

              {/* Completed: awaiting finalization */}
              {gameData.status === 'completed' && (
                <div className="w-full min-h-[56px] px-6 py-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center">
                  <span className="text-blue-400 font-[1000] italic uppercase text-lg">Finalizing Results...</span>
                  <p className="text-zinc-500 text-xs font-black mt-1">Winners will be announced shortly.</p>
                </div>
              )}

              {/* Started: play or status */}
              {gameData.status === 'started' && (
                isCreator ? (
                  <div className="w-full min-h-[56px] px-6 py-4 bg-yellow-400/10 border border-yellow-400/20 rounded-xl text-center">
                    <span className="text-yellow-400 font-[1000] italic uppercase text-lg">Game In Progress</span>
                    <p className="text-zinc-500 text-xs font-black mt-1">{countdown ? `${countdown} remaining` : 'Players are competing'}</p>
                    {onEndGame && (
                      <button
                        onClick={() => onEndGame(gameData)}
                        className="w-full min-h-12 px-6 py-3 bg-red-600 text-white font-[1000] italic uppercase text-sm tracking-tighter rounded-xl hover:bg-red-500 transition-all active:scale-[0.98] mt-3"
                      >
                        End Game & Pay Winners
                      </button>
                    )}
                  </div>
                ) : hasEntered && canPlay && isReEntry && !showReEntryConfirm ? (
                  <button
                    onClick={() => setShowReEntryConfirm(true)}
                    className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)] transition-all active:scale-[0.98]"
                  >
                    Play Again ({reEntryFeeSOL} {tokenSymbol})
                  </button>
                ) : hasEntered && canPlay && isReEntry && showReEntryConfirm ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-amber-400 font-black text-sm uppercase text-center mb-1">Hold up, nerd.</p>
                    <p className="text-zinc-400 text-xs text-center mb-3">
                      Re-entry costs <span className="text-white font-black">{reEntryFeeSOL} {tokenSymbol}</span>. Only your highest score counts. Re-entry fees are non-refundable. Proceed wisely.
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowReEntryConfirm(false)} className="flex-1 min-h-[40px] px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 font-black uppercase text-xs rounded-lg hover:bg-white/10 transition-all">
                        Nah
                      </button>
                      <button onClick={() => { setShowReEntryConfirm(false); onStartGame(gameData); }} className="flex-1 min-h-[40px] px-4 py-2 bg-amber-500 text-black font-[1000] italic uppercase text-xs rounded-lg hover:bg-amber-400 transition-all">
                        Let's Go
                      </button>
                    </div>
                  </div>
                ) : hasEntered && canPlay ? (
                  <button
                    onClick={() => onStartGame(gameData)}
                    className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)] transition-all active:scale-[0.98]"
                  >
                    Play Now
                  </button>
                ) : hasEntered && !canPlay ? (
                  <div className="w-full min-h-[56px] px-6 py-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl text-center">
                    <span className="text-zinc-400 font-[1000] italic uppercase text-lg">Max Attempts Reached</span>
                    {gameData.player_best_score != null && (
                      <p className="text-zinc-500 text-xs font-black mt-1">Your best: {gameData.player_best_score} XP</p>
                    )}
                  </div>
                ) : null
                /* Kyle 2026-06-27: !hasEntered case intentionally falls through to
                   the "Active OR started" wrapper below, which renders the Join
                   button. Previously this branch showed a dead-end "Entry Required"
                   message that blocked the Join button from rendering for
                   creator-funded SPL games (which skip 'active' and start in
                   'started' status). Contract permits joins anytime until expires_at. */
              )}

              {/* Active OR started: join / start timer / waiting.
                  Kyle 2026-06-27: was only 'active', which blocked creator-funded
                  SPL games (they auto-fund + flip to 'started' on creation).
                  Contract permits joins anytime until expires_at. */}
              {(gameData.status === 'active' || gameData.status === 'started') && (
                <>
                  {showJoinButton && (
                    <>
                      <button
                        onClick={handleJoin}
                        disabled={joining}
                        className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)] transition-all active:scale-[0.98] disabled:opacity-50"
                      >
                        {joining ? 'Joining...' : isCreatorFunded ? 'Join Game (0.0025 SOL)' : `Join Game (${entryFeeSOL} ${tokenSymbol})`}
                      </button>
                      {isCreatorFunded && (
                        <p className="text-zinc-500 text-[10px] font-black italic uppercase tracking-wider text-center mt-2">
                          Free entry — 0.0025 SOL platform fee only
                        </p>
                      )}
                    </>
                  )}

                  {awaitingCreatorFunding && !isCreator && !hasEntered && (
                    <div className="w-full min-h-[56px] px-6 py-4 bg-amber-400/10 border border-amber-400/20 rounded-xl text-center">
                      <span className="text-amber-400 font-[1000] italic uppercase text-base">Awaiting Creator Funding</span>
                      <p className="text-zinc-400 text-xs font-black mt-1">Once the creator funds the prize pool, players can enter.</p>
                    </div>
                  )}

                  {hasEntered && !isCreator && canPlay && isReEntry && !showReEntryConfirm && (
                    <button
                      onClick={() => setShowReEntryConfirm(true)}
                      className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)] transition-all active:scale-[0.98]"
                    >
                      Play Again ({reEntryFeeSOL} {tokenSymbol})
                    </button>
                  )}

                  {hasEntered && !isCreator && canPlay && isReEntry && showReEntryConfirm && (
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                      <p className="text-amber-400 font-black text-sm uppercase text-center mb-1">Hold up, nerd.</p>
                      <p className="text-zinc-400 text-xs text-center mb-3">
                        Re-entry costs <span className="text-white font-black">{reEntryFeeSOL} {tokenSymbol}</span>. Only your highest score counts. Re-entry fees are non-refundable. Proceed wisely.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => setShowReEntryConfirm(false)} className="flex-1 min-h-[40px] px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 font-black uppercase text-xs rounded-lg hover:bg-white/10 transition-all">
                          Nah
                        </button>
                        <button onClick={() => { setShowReEntryConfirm(false); onStartGame(gameData); }} className="flex-1 min-h-[40px] px-4 py-2 bg-amber-500 text-black font-[1000] italic uppercase text-xs rounded-lg hover:bg-amber-400 transition-all">
                          Let's Go
                        </button>
                      </div>
                    </div>
                  )}

                  {hasEntered && !isCreator && canPlay && !isReEntry && (
                    <button
                      onClick={() => onStartGame(gameData)}
                      className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)] transition-all active:scale-[0.98]"
                    >
                      Play Now
                    </button>
                  )}

                  {hasEntered && !isCreator && !canPlay && (
                    <div className="w-full min-h-[56px] px-6 py-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl text-center">
                      <span className="text-zinc-400 font-[1000] italic uppercase text-lg">Max Attempts Reached</span>
                      {gameData.player_best_score != null && (
                        <p className="text-zinc-500 text-xs font-black mt-1">Your best: {gameData.player_best_score} XP</p>
                      )}
                    </div>
                  )}

                  {isCreator && (
                    <div className="flex flex-col gap-3">
                      {canCreatorFund ? (
                        <button
                          onClick={() => onFundAndStart?.(gameData)}
                          className="w-full min-h-[56px] px-6 py-4 bg-amber-500 text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-amber-400 shadow-[0_10px_40px_-10px_rgba(245,158,11,0.3)] transition-all active:scale-[0.98]"
                        >
                          Fund Prize Pool ({creatorDepositSOL} {tokenSymbol})
                        </button>
                      ) : (
                        <div className="w-full min-h-[56px] px-6 py-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl text-center">
                          <span className="text-zinc-400 font-[1000] italic uppercase text-sm">
                            {gameData.player_count > 0
                              ? `${gameData.player_count} player${gameData.player_count !== 1 ? 's' : ''} joined`
                              : 'Waiting for players to join'}
                          </span>
                          <p className="text-zinc-500 text-xs font-black mt-1">
                            Share the link to get players in!
                          </p>
                        </div>
                      )}
                      <p className="text-zinc-600 text-[10px] font-black uppercase tracking-wider text-center">
                        You are the creator — you cannot play your own {isCreatorFunded ? 'funded' : ''} game.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Attempt counter for entered players */}
              {hasEntered && !isCreator && canPlay && ['active', 'started'].includes(gameData.status) && (
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-wider text-center mt-2">
                  Attempts: {attemptsUsed} / {CUSTOM_GAME_MAX_ATTEMPTS}
                </p>
              )}
            </>
          ) : (
            /* ── Free Game CTAs ── */
            <>
              {canPlay ? (
                <button
                  onClick={() => onStartGame(gameData)}
                  className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)] transition-all active:scale-[0.98]"
                >
                  Play Now
                </button>
              ) : (
                <div className="w-full min-h-[56px] px-6 py-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl text-center">
                  <span className="text-zinc-400 font-[1000] italic uppercase text-lg">Max Attempts Reached</span>
                  {gameData.player_best_score != null && (
                    <p className="text-zinc-500 text-xs font-black mt-1">Your best: {gameData.player_best_score} XP</p>
                  )}
                </div>
              )}
              {canPlay && (
                <p className="text-zinc-600 text-[10px] font-black uppercase tracking-wider text-center mt-2">
                  Attempts: {attemptsUsed} / {CUSTOM_GAME_MAX_ATTEMPTS}
                </p>
              )}
            </>
          )}
        </div>

        {/* Game Details (below CTA) , standalone Prize Split card DROPPED
            per Gate 4 decision , the winners-split chips inside PrizeHeroV2
            own that data now. */}

        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 md:p-6 mb-4">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Created by</span>
              <span className="text-white text-xs font-black italic">{creatorShort}</span>
            </div>
            <div className="text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Total Plays</span>
              <span className="text-white text-xs font-black italic">{gameData.total_plays}</span>
            </div>
            <div className="text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Lobby Closes</span>
              <span className="text-yellow-400 text-xs font-black italic">{expiryLabel}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 min-h-[44px] px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-[10px] tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={handleShareX}
              className="flex-1 min-h-[44px] px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-zinc-400 font-black uppercase text-[10px] tracking-wider hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Share on X
            </button>
          </div>
        </div>

        {/* ── LIVE LEADERBOARD (Gate 4 polish: gold/silver/bronze medals +
            tinted top-N rows + +PAYOUT chip per row + OUT past cutoff) ── */}
        {gameData.leaderboard.length > 0 && (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 md:p-8">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-lg font-[1000] italic text-white uppercase tracking-tighter">
                Live Leaderboard
              </h3>
              <span className="text-zinc-500 font-black italic uppercase tracking-[0.18em] text-[10px] tabular-nums">
                {gameData.leaderboard.length} {gameData.leaderboard.length === 1 ? 'ENTRY' : 'ENTRIES'}
              </span>
            </div>
            <div className="space-y-2">
              {gameData.leaderboard.map((entry, i) => {
                const isYou = walletAddress && entry.wallet_address === walletAddress;
                const entryWinnerIdx = (isPaid && gameData.winner_wallets)
                  ? gameData.winner_wallets.indexOf(entry.wallet_address)
                  : -1;
                const finalizedPrizeSol = entryWinnerIdx >= 0 ? Number(formatToken(gameData.winner_amounts?.[entryWinnerIdx] ?? 0)) : 0;

                // Live projection: while game is active/started/completed-not-yet-
                // finalized, show "if-now" payout using the same prize_split_bps.
                const isInWinningZone = isPaid && entry.rank <= gameData.max_winners;
                const splitBps = (gameData.prize_split_bps?.[entry.rank - 1] ?? 0);
                const livePrizeSol = isInWinningZone && gameData.status !== 'finalized'
                  ? (prizePotSOL * splitBps) / 10000
                  : 0;
                const showLivePrize = isPaid && livePrizeSol > 0 && gameData.status !== 'finalized';
                const showFinalPrize = isPaid && finalizedPrizeSol > 0 && gameData.status === 'finalized';
                const isOut = isPaid && !isInWinningZone && gameData.max_winners > 0;

                const medalColor = medalColorForRank(entry.rank);
                const topNTint = isInWinningZone && entry.rank <= 3 && !isYou;

                return (
                  <div
                    key={entry.wallet_address}
                    className="flex items-center gap-3 p-3 rounded-xl transition-all"
                    style={{
                      background: isYou
                        ? 'rgba(56,189,248,0.10)'
                        : topNTint
                        ? 'rgba(255,215,0,0.06)'
                        : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${isYou ? 'rgba(56,189,248,0.30)' : topNTint ? 'rgba(255,215,0,0.20)' : 'rgba(255,255,255,0.05)'}`,
                    }}
                  >
                    <span
                      className="w-8 text-center font-[1000] italic text-base tabular-nums"
                      style={{ color: medalColor }}
                    >
                      #{entry.rank}
                    </span>
                    <img
                      src={entry.avatar_url || DEFAULT_AVATAR}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-white/10"
                      onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`font-black italic text-sm truncate block ${isYou ? 'text-[#38BDF8]' : 'text-white'}`}>
                        {entry.username}
                        {isYou && <span className="text-[#38BDF8] text-[9px] ml-1 uppercase">(You)</span>}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#38BDF8] font-[1000] italic text-sm tabular-nums">{entry.score.toLocaleString()}</span>
                      <span className="text-zinc-600 text-[8px] font-black uppercase block">XP</span>
                    </div>
                    {showFinalPrize && (
                      <div className="text-right ml-1 sm:ml-2">
                        <span className="font-[1000] italic text-xs tabular-nums" style={{ color: MEDAL_GOLD }}>
                          +{finalizedPrizeSol.toFixed(3)}
                        </span>
                        <span className="text-zinc-600 text-[8px] font-black uppercase block">{tokenSymbol}</span>
                        {formatTokenUsd(finalizedPrizeSol) && (
                          <span className="text-zinc-700 text-[8px] tabular-nums block">{formatTokenUsd(finalizedPrizeSol)}</span>
                        )}
                      </div>
                    )}
                    {showLivePrize && (
                      <div className="text-right ml-1 sm:ml-2">
                        <span className="font-[1000] italic text-xs tabular-nums" style={{ color: MEDAL_GOLD }}>
                          +{livePrizeSol.toFixed(3)}
                        </span>
                        <span className="text-zinc-600 text-[7px] sm:text-[8px] font-black uppercase block">{tokenSymbol} · IF NOW</span>
                        {formatTokenUsd(livePrizeSol) && (
                          <span className="text-zinc-700 text-[8px] tabular-nums block">{formatTokenUsd(livePrizeSol)}</span>
                        )}
                      </div>
                    )}
                    {isOut && !showLivePrize && !showFinalPrize && (
                      <div className="text-right ml-1 sm:ml-2">
                        <span className="text-zinc-500 font-[1000] italic text-[10px] uppercase tracking-wider">Out</span>
                      </div>
                    )}
                    {entry.is_seeker_verified && (
                      <span className="text-[8px] font-black text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded uppercase">SGT</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* JOINED FOOTER pill , 3-variant copy per decision C */}
            {hasEntered && (gameData.status === 'active' || gameData.status === 'started') && (() => {
              const myEntry = gameData.leaderboard.find((e) => e.wallet_address === walletAddress);
              const myRank = myEntry?.rank;
              const inWinZone = isPaid && myRank != null && myRank <= gameData.max_winners;
              const notYetRanked = myRank == null;
              let line2: string;
              if (notYetRanked) {
                line2 = "Play your attempts before the timer ends.";
              } else if (inWinZone) {
                line2 = "You're in the winning zone. Hold your spot until the timer ends.";
              } else {
                line2 = `Climb into the top ${gameData.max_winners} before the timer ends to win.`;
              }
              return (
                <div
                  className="rounded-xl px-4 py-3 mt-4 flex items-center justify-between gap-3"
                  style={{
                    background: 'rgba(56,189,248,0.06)',
                    border: '1px solid rgba(56,189,248,0.30)',
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-[#38BDF8] font-black italic uppercase tracking-[0.18em] text-[10px] sm:text-[11px]"
                      style={{ fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif' }}
                    >
                      {notYetRanked ? "You're in" : `You're in · Rank ${myRank} of ${gameData.leaderboard.length}`}
                    </p>
                    <p className="text-zinc-400 text-[11px] sm:text-xs font-bold italic mt-1 leading-snug">
                      {line2}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomGameLobbyView;

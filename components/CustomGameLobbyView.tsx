import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCustomGame, type CustomGameData } from '../src/utils/api';
import {
  CUSTOM_GAME_MAX_ATTEMPTS,
  CUSTOM_GAME_MIN_PLAYERS,
  DEFAULT_AVATAR,
} from '../src/utils/constants';

interface CustomGameLobbyViewProps {
  slug: string;
  walletAddress: string | null;
  onStartGame: (gameData: CustomGameData) => void;
  onJoinGame: (gameData: CustomGameData) => Promise<void>;
  onStartTimer: (gameData: CustomGameData) => Promise<void>;
  onClaimPrize: (onChainGameId: number) => Promise<void>;
  onClaimRefund?: (onChainGameId: number) => Promise<void>;
  onFundAndStart?: (gameData: CustomGameData) => void;
  onBack: () => void;
  onConnectWallet: () => void;
}

const CustomGameLobbyView: React.FC<CustomGameLobbyViewProps> = ({
  slug,
  walletAddress,
  onStartGame,
  onJoinGame,
  onClaimPrize,
  onClaimRefund,
  onFundAndStart,
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
    const fee = gameData.entry_fee_lamports / 1e9;
    const creatorPrize = (gameData.creator_deposit_lamports || 0) / 1e9;
    const text = isCreatorFundedShare
      ? `i'm putting ${creatorPrize} SOL on the line for a trivia game\n\n"${gameData.name}" on @soltrivia_app | FREE to enter, real prizes\n\nthink you're smart enough to win?\n\n${shareUrl}`
      : isPlayerFunded
      ? `i just built a trivia game with real SOL on the line\n\n"${gameData.name}" on @soltrivia_app | entry: ${fee} SOL\n\nput your wallet where your brain is, anon\n\n${shareUrl}`
      : `"${gameData.name}" on @soltrivia_app — free to play, harder than you think\n\nbet you can't beat my score. prove me wrong\n\n${shareUrl}`;
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
      await onClaimPrize(gameData.on_chain_game_id);
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
  if (gameData.is_expired || gameData.status === 'expired') {
    const isPaidExpired = gameData.prize_model === 'player_funded' && gameData.entry_fee_lamports > 0;
    const canClaimRefund = isPaidExpired && gameData.player_has_entered && gameData.on_chain_game_id != null && onClaimRefund;
    const entryRefundSOL = gameData.entry_fee_lamports / 1e9;

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
          {canClaimRefund ? (
            <>
              <p className="text-zinc-400 text-xs mb-6">You paid {entryRefundSOL} SOL entry. Claim your refund below.</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleRefund}
                  disabled={refunding}
                  className="min-h-[48px] px-8 py-3 bg-amber-500 text-black font-[1000] italic uppercase rounded-xl hover:bg-amber-400 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {refunding ? 'Claiming Refund...' : `Claim Refund (${entryRefundSOL} SOL)`}
                </button>
                <button onClick={onBack} className="min-h-[44px] px-8 py-3 text-zinc-500 font-black uppercase text-[10px] tracking-wider hover:text-zinc-300 transition-all">
                  Back to Home
                </button>
              </div>
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
  const isCreator = !!(walletAddress && gameData.creator_wallet === walletAddress);
  const hasEntered = gameData.player_has_entered;
  const attemptsUsed = gameData.player_attempts ?? 0;
  const canPlay = attemptsUsed < CUSTOM_GAME_MAX_ATTEMPTS;
  const entryFeeSOL = gameData.entry_fee_lamports / 1e9;
  const creatorDepositSOL = (gameData.creator_deposit_lamports || 0) / 1e9;
  const prizePotSOL = isCreatorFunded
    ? (gameData.fund_tx_signature ? (gameData.prize_pot_lamports / 1e9) : (creatorDepositSOL * 0.9))
    : gameData.prize_pot_lamports / 1e9;
  const isFunded = isCreatorFunded && !!gameData.fund_tx_signature;

  // Check if current wallet is a winner
  const winnerIndex = (isPaid && gameData.winner_wallets)
    ? gameData.winner_wallets.indexOf(walletAddress ?? '')
    : -1;
  const isWinner = winnerIndex >= 0;
  const winnerAmountSOL = isWinner ? (gameData.winner_amounts?.[winnerIndex] ?? 0) / 1e9 : 0;

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
    finalized: 'text-[#38BDF8] bg-[#38BDF8]/10 border-[#38BDF8]/20',
  };
  const statusLabels: Record<string, string> = {
    active: 'Lobby Open',
    started: 'In Progress',
    completed: 'Completed',
    finalized: 'Prizes Available',
  };

  // CTA logic
  const canCreatorFund = isCreatorFunded && isCreator && gameData.status === 'active' && gameData.player_count >= CUSTOM_GAME_MIN_PLAYERS && !isFunded;
  const showJoinButton = isPaid && !hasEntered && !isCreator && gameData.status === 'active';

  // Duration label
  const durationLabel = gameData.game_duration_minutes
    ? (gameData.game_duration_minutes >= 60 ? `${gameData.game_duration_minutes / 60}h` : `${gameData.game_duration_minutes}m`)
    : null;

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto overflow-x-hidden relative p-4 sm:p-6 md:p-12">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="scan-line opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#38BDF8]/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl mx-auto">
        {/* Back */}
        <button onClick={onBack} className="mb-6 text-zinc-500 hover:text-zinc-300 font-black uppercase text-[10px] tracking-wider transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Back
        </button>

        {/* Game Info Card */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className={`text-[9px] font-black uppercase tracking-[0.4em] ${isCreatorFunded ? 'text-amber-400' : 'text-[#38BDF8]'}`}>
              {isCreatorFunded ? 'Creator-Funded Game' : isPaid ? 'Prize Game' : 'Custom Game'}
            </p>
            {isPaid && (
              <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border ${statusColors[gameData.status] || 'text-zinc-400 bg-white/5 border-white/10'}`}>
                {statusLabels[gameData.status] || gameData.status}
              </span>
            )}
          </div>

          <h1 className="text-3xl md:text-5xl font-[1000] italic text-white uppercase tracking-tighter mb-4 leading-tight">
            {gameData.name}
          </h1>

          <div className="flex flex-wrap gap-2 mb-4">
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
              <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${isCreatorFunded ? 'bg-amber-400/10 border border-amber-400/20 text-amber-400' : 'bg-[#38BDF8]/10 border border-[#38BDF8]/20 text-[#38BDF8]'}`}>
                {isCreatorFunded ? 'Free Entry' : `${entryFeeSOL} SOL Entry`}
              </span>
            )}
          </div>

          {/* Compact stats row for paid games */}
          {isPaid && (
            <div className="flex items-center gap-4 mb-4 text-center">
              <div className="flex-1">
                <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block">
                  {isCreatorFunded ? 'Prize' : 'Pool'}
                </span>
                <span className="text-[#38BDF8] text-base font-[1000] italic">{prizePotSOL.toFixed(2)} SOL</span>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="flex-1">
                <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block">Players</span>
                <span className="text-white text-base font-[1000] italic">{gameData.player_count}{gameData.max_players ? `/${gameData.max_players}` : ''}</span>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="flex-1">
                <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block">
                  {gameData.status === 'started' ? 'Left' : 'Duration'}
                </span>
                {gameData.status === 'started' && countdown ? (
                  <span className="text-yellow-400 text-base font-[1000] italic">{countdown}</span>
                ) : (
                  <span className="text-white text-base font-[1000] italic">{durationLabel || '\u2014'}</span>
                )}
              </div>
            </div>
          )}

          {isCreatorFunded && (
            <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider ${isFunded ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-amber-400/10 border border-amber-400/20 text-amber-400'}`}>
              <span>{isFunded ? 'Prize Pool Funded' : 'Awaiting Creator Funding'}</span>
            </div>
          )}
        </div>

        {/* CTA — immediately visible */}
        <div className="mb-4">
          {!walletAddress ? (
            <button
              onClick={onConnectWallet}
              className="w-full min-h-[56px] px-6 py-4 bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#38BDF8] text-white font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:shadow-[0_10px_40px_-10px_rgba(56,189,248,0.4)] transition-all active:scale-[0.98]"
            >
              Connect Wallet {isPaid ? (isCreatorFunded ? 'to Join (Free)' : 'to Join') : 'to Play'}
            </button>
          ) : isPaid ? (
            /* ── Paid Game CTAs ── */
            <>
              {/* Finalized: claim or view results */}
              {gameData.status === 'finalized' && (
                isWinner ? (
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)] transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {claiming ? 'Claiming...' : `Claim Prize (${winnerAmountSOL.toFixed(3)} SOL)`}
                  </button>
                ) : (
                  <div className="w-full min-h-[56px] px-6 py-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl text-center">
                    <span className="text-zinc-400 font-[1000] italic uppercase text-lg">Game Finalized</span>
                    <p className="text-zinc-500 text-xs font-black mt-1">View the leaderboard below to see winners.</p>
                  </div>
                )
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
                ) : (
                  <div className="w-full min-h-[56px] px-6 py-4 bg-zinc-800/50 border border-zinc-700/30 rounded-xl text-center">
                    <span className="text-zinc-400 font-[1000] italic uppercase text-lg">Entry Required</span>
                    <p className="text-zinc-500 text-xs font-black mt-1">Game is in progress but you haven't joined.</p>
                  </div>
                )
              )}

              {/* Active: join / start timer / waiting */}
              {gameData.status === 'active' && (
                <>
                  {showJoinButton && (
                    <button
                      onClick={handleJoin}
                      disabled={joining}
                      className="w-full min-h-[56px] px-6 py-4 bg-[#38BDF8] text-black font-[1000] italic uppercase text-xl tracking-tighter rounded-xl hover:bg-[#7DD3FC] shadow-[0_10px_40px_-10px_rgba(56,189,248,0.3)] transition-all active:scale-[0.98] disabled:opacity-50"
                    >
                      {joining ? 'Joining...' : isCreatorFunded ? 'Join Game (0.0025 SOL)' : `Join Game (${entryFeeSOL} SOL)`}
                    </button>
                  )}

                  {hasEntered && !isCreator && canPlay && (
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
                          Fund & Start Game ({creatorDepositSOL} SOL)
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

        {/* Game Details (below CTA) */}
        {isPaid && prizeBreakdown.length > 0 && (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-4 md:p-6 mb-4">
            <p className="text-zinc-600 text-[8px] font-black uppercase tracking-widest mb-2">Prize Split (Top {gameData.max_winners})</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {prizeBreakdown.map((p) => (
                <div key={p.rank} className="bg-white/[0.03] border border-white/5 rounded-lg p-2 text-center">
                  <span className={`text-[10px] font-black block ${p.rank === 1 ? 'text-[#38BDF8]' : 'text-zinc-400'}`}>
                    #{p.rank} ({p.pct})
                  </span>
                  <span className="text-white text-xs font-[1000] italic">{p.sol.toFixed(3)}</span>
                  <span className="text-zinc-600 text-[8px] block">SOL</span>
                </div>
              ))}
            </div>
          </div>
        )}

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
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Expires</span>
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

        {/* Leaderboard */}
        {gameData.leaderboard.length > 0 && (
          <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 md:p-8">
            <h3 className="text-lg font-[1000] italic text-white uppercase tracking-tighter mb-4">Leaderboard</h3>
            <div className="space-y-2">
              {gameData.leaderboard.map((entry, i) => {
                const isYou = walletAddress && entry.wallet_address === walletAddress;
                const entryWinnerIdx = (isPaid && gameData.winner_wallets)
                  ? gameData.winner_wallets.indexOf(entry.wallet_address)
                  : -1;
                const prizeAmount = entryWinnerIdx >= 0 ? (gameData.winner_amounts?.[entryWinnerIdx] ?? 0) / 1e9 : 0;

                return (
                  <div
                    key={entry.wallet_address}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isYou ? 'bg-[#38BDF8]/10 border border-[#38BDF8]/20' : 'bg-white/[0.02] border border-white/5'}`}
                  >
                    <span className={`w-8 text-center font-[1000] italic text-sm ${i < 3 ? 'text-[#38BDF8]' : 'text-zinc-500'}`}>
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
                      <span className="text-[#38BDF8] font-[1000] italic text-sm">{entry.score.toLocaleString()}</span>
                      <span className="text-zinc-600 text-[8px] font-black uppercase block">XP</span>
                    </div>
                    {isPaid && prizeAmount > 0 && gameData.status === 'finalized' && (
                      <div className="text-right ml-2">
                        <span className="text-yellow-400 font-[1000] italic text-xs">{prizeAmount.toFixed(3)}</span>
                        <span className="text-zinc-600 text-[8px] font-black uppercase block">SOL</span>
                      </div>
                    )}
                    {entry.is_seeker_verified && (
                      <span className="text-[8px] font-black text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded uppercase">SGT</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomGameLobbyView;

import React, { useState, useEffect, useRef } from 'react';
import { subscribeDuelUpdates, getDuel } from '../src/utils/api';
import { JupiterVerifiedBadge } from './JupiterVerifiedBadge';

interface DuelWaitingViewProps {
  duelId: number;
  dbDuelId: string;
  shareCode: string;
  entryFee: number;
  isPublic: boolean;
  expiresAt: string;
  walletAddress: string;
  onDuelJoined: (opponentWallet: string, dbDuelId: string) => void;
  onCancel: () => Promise<void>;
  onClaimRefund: (duelId: number, player1Wallet: string) => Promise<void>;
  onBack: () => void;
  /**
   * v2.1 SPL: token info for SPL duels. When tokenSymbol is set, entryFee
   * is interpreted as raw units of that token and tokenDecimals is used
   * to convert to display units. All three undefined = legacy SOL duel.
   */
  tokenSymbol?: string | null;
  tokenDecimals?: number | null;
  /** Mint for SPL duels — drives the Jupiter Verified badge in the wager pill. */
  tokenMint?: string | null;
  /**
   * v2.1 hybrid: pre-play state. Initial value indicates whether the
   * creator already banked their score before this mount (e.g. they came
   * back to a duel they pre-played earlier). The component itself polls
   * to keep this in sync. When true + opponent joins, opponent plays
   * solo and the creator stays on this screen until the result.
   */
  creatorFinished?: boolean;
  /** v2.1 hybrid: opens DUEL_PLAY in soloMode for the creator to pre-play. */
  onPlayNow?: () => void;
  /** v2.1 hybrid: results are ready (both players finished). */
  onResultsReady?: () => void;
}

/** Format the wager for display. Branches on tokenSymbol presence. */
function formatWager(entryFee: number, tokenSymbol?: string | null, tokenDecimals?: number | null): string {
  if (tokenSymbol && typeof tokenDecimals === 'number') {
    const display = entryFee / Math.pow(10, tokenDecimals);
    // For SPL: 2 decimal places for sub-1 amounts, no trailing zeros for whole
    // numbers, 2 for the rest. Avoids weird strings like "100.00000000 NERD".
    const formatted = display < 1
      ? display.toLocaleString(undefined, { maximumFractionDigits: 6 })
      : display.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${formatted} ${tokenSymbol}`;
  }
  // SOL legacy formatting.
  return `${(entryFee / 1_000_000_000).toFixed(2)} SOL`;
}

const DuelWaitingView: React.FC<DuelWaitingViewProps> = ({ duelId, dbDuelId, shareCode, entryFee, isPublic, expiresAt, walletAddress, onDuelJoined, onCancel, onClaimRefund, onBack, tokenSymbol, tokenDecimals, tokenMint, creatorFinished: creatorFinishedInitial = false, onPlayNow, onResultsReady }) => {
  const wagerLabel = formatWager(entryFee, tokenSymbol, tokenDecimals);
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  // v2.1 hybrid: creator's pre-play state. Updated by poll + initial prop.
  const [creatorFinished, setCreatorFinished] = useState<boolean>(creatorFinishedInitial);
  // v2.1 hybrid: per the poll, "opponent has joined and is now playing solo".
  // Used to show the "opponent is playing" state when creator already finished.
  const [opponentPlaying, setOpponentPlaying] = useState<boolean>(false);
  const pollRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);
  const onDuelJoinedRef = useRef(onDuelJoined);
  const creatorFinishedRef = useRef(creatorFinished);
  useEffect(() => { onDuelJoinedRef.current = onDuelJoined; });
  useEffect(() => { creatorFinishedRef.current = creatorFinished; }, [creatorFinished]);

  const shareUrl = `https://soltrivia.app/duel/${shareCode}`;

  // Countdown timer
  useEffect(() => {
    const updateTimer = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setExpired(true);
        setTimeLeft('0:00');
        if (timerRef.current) clearInterval(timerRef.current);
        return;
      }
      const totalMins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      if (totalMins >= 60) {
        const hrs = Math.floor(totalMins / 60);
        const mins = totalMins % 60;
        setTimeLeft(`${hrs}h ${mins.toString().padStart(2, '0')}m`);
      } else {
        setTimeLeft(`${totalMins}:${secs.toString().padStart(2, '0')}`);
      }
    };
    updateTimer();
    timerRef.current = window.setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [expiresAt]);

  // Realtime subscription for opponent joining. v2.1 hybrid: only auto-route
  // to DUEL_PLAY if creator has NOT pre-played. If they pre-played, stay on
  // waiting view + flip opponentPlaying so the UI shows "opponent is playing".
  useEffect(() => {
    subRef.current = subscribeDuelUpdates(dbDuelId, (duel) => {
      if (duel.status === 'playing' && duel.player2_wallet) {
        if (creatorFinishedRef.current) {
          setOpponentPlaying(true);
        } else {
          onDuelJoined(duel.player2_wallet as string, dbDuelId);
        }
      }
      if (duel.status === 'completed' || duel.status === 'resolved') {
        onResultsReady?.();
      }
    });
    return () => { subRef.current?.unsubscribe(); };
  }, [dbDuelId, onDuelJoined, onResultsReady]);

  // Poll for state changes. Detects opponent joining, creator finished,
  // and duel completed. Same hybrid branching as the realtime sub above.
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const duel = await getDuel({ duel_id: duelId });
        if (!active) return;
        // v2.1 hybrid: keep creatorFinished synced from the duel record.
        // player1.finished comes from player1_finished_at via get-duel v22+.
        if (duel.player1?.finished && !creatorFinishedRef.current) {
          setCreatorFinished(true);
        }
        if (duel.status === 'completed' || duel.status === 'resolved') {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          onResultsReady?.();
          return;
        }
        if (duel.status === 'playing' && duel.player2) {
          if (creatorFinishedRef.current) {
            // Hybrid: opponent joined while creator was already done — stay on
            // waiting view, show "opponent is playing" + poll for completion.
            setOpponentPlaying(true);
          } else {
            // Classic: opponent joined and we haven't pre-played — auto-route
            // to the real-time race quiz.
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            onDuelJoinedRef.current(duel.player2.wallet, duel.db_duel_id);
          }
        }
      } catch {}
    };
    poll(); // Immediate first check
    pollRef.current = window.setInterval(poll, 3000);
    return () => { active = false; if (pollRef.current) clearInterval(pollRef.current); };
  }, [duelId, onResultsReady]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShareX = () => {
    const text = `1v1 me on @soltrivia_app for ${wagerLabel}. trivia. on-chain. winner takes all.\n\nyou're ngmi if you dodge this\n\n${shareUrl}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      if (expired) {
        await onClaimRefund(duelId, walletAddress);
      } else {
        await onCancel();
      }
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
      <div className="max-w-md w-full text-center">
        {/* Pulsing VS icon */}
        <div className="w-24 h-24 mx-auto mb-8 relative">
          <div className="absolute inset-0 bg-[#FF3131]/10 rounded-full opacity-50"></div>
          <div className="relative w-24 h-24 bg-[#FF3131]/30 rounded-full flex items-center justify-center border-2 border-[#FF3131]/40">
            <span className="text-[#FF3131] text-3xl font-[1000] italic">VS</span>
          </div>
        </div>

        <p className="text-[#FF3131] text-[10px] font-black uppercase tracking-[0.4em] mb-2">
          {opponentPlaying
            ? 'Opponent is Playing'
            : creatorFinished
              ? 'Score Banked · Waiting for Opponent'
              : 'Waiting for Opponent'}
        </p>
        <h2 className="text-3xl font-[1000] italic text-white uppercase tracking-tighter mb-2 inline-flex items-center justify-center gap-2 w-full">
          <span>{wagerLabel}</span>
          <JupiterVerifiedBadge mint={tokenMint ?? null} size={18} />
          <span>Duel</span>
        </h2>
        <p className="text-zinc-500 text-xs font-bold uppercase mb-1">
          {isPublic ? 'Public — visible in lobby' : 'Private — share link only'}
        </p>
        <p className={`text-sm font-[1000] italic tabular-nums mb-4 ${expired ? 'text-[#FF3131]' : 'text-zinc-400'}`}>
          {expired ? 'Expired' : `Expires in ${timeLeft}`}
        </p>

        {/* v2.1 hybrid: PLAY NOW CTA (pre-play). Lets the creator bank their
            score immediately, then walk away — opponent plays solo on join,
            results pushed when opponent finishes. Hidden once creator has
            already finished, and hidden when no onPlayNow handler is wired
            (graceful for legacy callers). */}
        {!creatorFinished && !expired && onPlayNow && (
          <div className="mb-6">
            <button
              onClick={onPlayNow}
              className="w-full px-6 py-4 bg-gradient-to-r from-[#FFD700] to-[#FFB700] text-black font-[1000] italic uppercase text-base tracking-tight rounded-xl active:opacity-90 transition-all shadow-[0_8px_24px_-8px_rgba(255,215,0,0.5)]"
            >
              Play Now · Bank Your Score
            </button>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-2">
              Answer your 5 questions, then walk away. Opponent plays solo when they join.
            </p>
          </div>
        )}

        {/* v2.1 hybrid: post-play status banner. */}
        {creatorFinished && !opponentPlaying && (
          <div className="mb-6 p-3 bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-xl">
            <p className="text-[#FFD700] text-[9px] font-black uppercase tracking-[0.3em] mb-1">
              ✓ Score Locked In
            </p>
            <p className="text-zinc-300 text-xs">
              You'll get a notification when someone joins and the result is ready.
            </p>
          </div>
        )}
        {opponentPlaying && (
          <div className="mb-6 p-3 bg-[#FF3131]/10 border border-[#FF3131]/30 rounded-xl">
            <p className="text-[#FF3131] text-[9px] font-black uppercase tracking-[0.3em] mb-1">
              ⚔ Opponent is Playing
            </p>
            <p className="text-zinc-300 text-xs">
              Sit tight — results land as soon as they finish.
            </p>
          </div>
        )}

        {/* Share Link */}
        <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-zinc-500 text-[10px] font-bold uppercase mb-2">Share Link</p>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 bg-black border border-white/20 rounded text-white text-xs font-mono"
            />
            <button
              onClick={handleCopy}
              className="px-3 py-2 bg-[#14F195] text-black font-black uppercase text-[10px] rounded"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCopy} className="flex-1 px-3 py-2 bg-white/5 border border-white/10 text-zinc-400 font-bold uppercase text-[10px] rounded hover:text-white">
              Copy Code: {shareCode}
            </button>
            <button onClick={handleShareX} className="flex-1 px-3 py-2 bg-white/5 border border-white/10 text-zinc-400 font-bold uppercase text-[10px] rounded hover:text-white">
              Share on X
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className={`flex-1 px-4 py-3 font-black uppercase text-xs rounded-lg disabled:opacity-50 transition-all ${
              expired
                ? 'bg-[#14F195]/10 border border-[#14F195]/30 text-[#14F195] hover:bg-[#14F195]/20'
                : 'bg-white/5 border border-white/10 text-zinc-400 hover:text-white'
            }`}
          >
            {cancelling ? (expired ? 'Claiming Refund...' : 'Cancelling...') : expired ? 'Claim Refund' : 'Cancel Duel'}
          </button>
          <button
            onClick={onBack}
            className="px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-black uppercase text-xs rounded-lg transition-all"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default DuelWaitingView;

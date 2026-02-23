import React, { useState, useEffect, useRef } from 'react';
import { subscribeDuelUpdates, getDuel } from '../src/utils/api';

interface DuelWaitingViewProps {
  duelId: number;
  dbDuelId: string;
  shareCode: string;
  entryFee: number;
  isPublic: boolean;
  expiresAt: string;
  onDuelJoined: (opponentWallet: string, dbDuelId: string) => void;
  onCancel: () => void;
  onBack: () => void;
}

const DuelWaitingView: React.FC<DuelWaitingViewProps> = ({ duelId, dbDuelId, shareCode, entryFee, isPublic, expiresAt, onDuelJoined, onCancel, onBack }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [expired, setExpired] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const pollRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);

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
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
    };
    updateTimer();
    timerRef.current = window.setInterval(updateTimer, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [expiresAt]);

  // Realtime subscription for opponent joining
  useEffect(() => {
    subRef.current = subscribeDuelUpdates(dbDuelId, (duel) => {
      if (duel.status === 'playing' && duel.player2_wallet) {
        onDuelJoined(duel.player2_wallet as string, dbDuelId);
      }
    });
    return () => { subRef.current?.unsubscribe(); };
  }, [dbDuelId, onDuelJoined]);

  // Polling fallback
  useEffect(() => {
    const poll = async () => {
      try {
        const duel = await getDuel({ duel_id: duelId });
        if (duel.status === 'playing' && duel.player2) {
          onDuelJoined(duel.player2.wallet, duel.db_duel_id);
        }
      } catch {}
    };
    pollRef.current = window.setInterval(poll, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [duelId, onDuelJoined]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleShareX = () => {
    const text = `1v1 me on @soltrivia_app for ${(entryFee / 1_000_000_000).toFixed(2)} SOL. trivia. on-chain. winner takes all.\n\nyou're ngmi if you dodge this\n\n${shareUrl}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleCancel = () => {
    setCancelling(true);
    onCancel();
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

        <p className="text-[#FF3131] text-[10px] font-black uppercase tracking-[0.4em] mb-2">Waiting for Opponent</p>
        <h2 className="text-3xl font-[1000] italic text-white uppercase tracking-tighter mb-2">
          {(entryFee / 1_000_000_000).toFixed(2)} SOL Duel
        </h2>
        <p className="text-zinc-500 text-xs font-bold uppercase mb-1">
          {isPublic ? 'Public — visible in lobby' : 'Private — share link only'}
        </p>
        <p className={`text-sm font-[1000] italic tabular-nums mb-8 ${expired ? 'text-[#FF3131]' : 'text-zinc-400'}`}>
          {expired ? 'Expired' : `Expires in ${timeLeft}`}
        </p>

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
            disabled={cancelling || expired}
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-black uppercase text-xs rounded-lg disabled:opacity-50 transition-all"
          >
            {cancelling ? 'Cancelling...' : 'Cancel Duel'}
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

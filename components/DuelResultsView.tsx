import React, { useState, useEffect, useRef } from 'react';
import { getDuel, subscribeDuelUpdates, type DuelInfo } from '../src/utils/api';

interface DuelResultsViewProps {
  duelId: number;
  dbDuelId: string;
  myWallet: string;
  myScore: number;
  myCorrect: number;
  opponentWallet: string;
  opponentUsername: string | null;
  opponentAvatar: string | null;
  opponentScore: number;
  opponentCorrect: number;
  winnerWallet: string | null;
  entryFee: number;
  totalPot: number;
  duelComplete: boolean;
  isPlayer1: boolean;
  onClaimPrize: () => Promise<void>;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

const DuelResultsView: React.FC<DuelResultsViewProps> = ({
  duelId, dbDuelId, myWallet, myScore, myCorrect,
  opponentWallet, opponentUsername, opponentAvatar,
  opponentScore, opponentCorrect, winnerWallet: initialWinner,
  entryFee, totalPot: initialPot, duelComplete: initialComplete,
  isPlayer1, onClaimPrize, onPlayAgain, onBackToLobby,
}) => {
  const [winner, setWinner] = useState<string | null>(initialWinner);
  const [resolved, setResolved] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [oppScore, setOppScore] = useState(opponentScore);
  const [oppCorrect, setOppCorrect] = useState(opponentCorrect);
  const [waitingForOpponent, setWaitingForOpponent] = useState(!initialComplete);
  const subRef = useRef<{ unsubscribe: () => void } | null>(null);
  const pollRef = useRef<number | null>(null);

  const isWinner = winner === myWallet;
  const isDraw = winner === null && !waitingForOpponent;
  const totalPot = initialPot || entryFee * 2;
  const houseCut = Math.floor(totalPot * 0.1);
  const winnerPrize = totalPot - houseCut;
  const oppDisplayName = opponentUsername || `${opponentWallet.slice(0, 4)}...${opponentWallet.slice(-4)}`;

  // Subscribe to duel updates for resolution
  useEffect(() => {
    subRef.current = subscribeDuelUpdates(dbDuelId, (duel) => {
      if (duel.status === 'resolved') setResolved(true);
      if (duel.status === 'completed' || duel.status === 'resolved') {
        setWaitingForOpponent(false);
        if (duel.winner_wallet) setWinner(duel.winner_wallet as string);
        // Read the OTHER player's data as opponent
        const oppScoreKey = isPlayer1 ? 'player2_score' : 'player1_score';
        const oppCorrectKey = isPlayer1 ? 'player2_correct' : 'player1_correct';
        if (duel[oppScoreKey] != null) setOppScore(duel[oppScoreKey] as number);
        if (duel[oppCorrectKey] != null) setOppCorrect(duel[oppCorrectKey] as number);
      }
    });
    return () => { subRef.current?.unsubscribe(); };
  }, [dbDuelId, isPlayer1]);

  // Poll for resolution status
  useEffect(() => {
    if (resolved) return;
    const poll = async () => {
      try {
        const duel = await getDuel({ duel_id: duelId, wallet_address: myWallet });
        if (duel.status === 'resolved') { setResolved(true); if (pollRef.current) clearInterval(pollRef.current); }
        if (duel.status === 'completed' || duel.status === 'resolved') {
          setWaitingForOpponent(false);
          if (duel.winner_wallet) setWinner(duel.winner_wallet);
          // Read the OTHER player's data as opponent
          const opp = isPlayer1 ? duel.player2 : duel.player1;
          if (opp) {
            setOppScore(opp.score);
            setOppCorrect(opp.correct);
          }
        }
      } catch {}
    };
    pollRef.current = window.setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [duelId, myWallet, resolved, isPlayer1]);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      await onClaimPrize();
    } catch (err: any) {
      console.error('Claim failed:', err);
      setClaiming(false);
    }
  };

  const handleShareX = () => {
    const text = isWinner
      ? `just mogged someone in a 1v1 on @soltrivia_app and collected ${(winnerPrize / 1_000_000_000).toFixed(4)} SOL\n\ntrivia degen szn. who wants smoke next?\n\nsoltrivia.app`
      : `got rekt in a @soltrivia_app duel. not gonna lie that stings.\n\nneed a rematch immediately. who's in?\n\nsoltrivia.app`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Waiting for opponent to finish
  if (waitingForOpponent) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 border-4 border-[#FF3131] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
          <h2 className="text-2xl font-[1000] italic text-white uppercase tracking-tighter mb-2">Waiting for Opponent</h2>
          <p className="text-zinc-500 text-sm">Your score: <span className="text-[#14F195] font-bold">{myScore} XP</span> ({myCorrect}/5 correct)</p>
          <p className="text-zinc-600 text-xs mt-2">Opponent is still playing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-[#050505] p-6">
      <div className="max-w-lg w-full">
        {/* Winner Announcement */}
        <div className="text-center mb-8">
          <p className="text-[#FF3131] text-[10px] font-black uppercase tracking-[0.4em] mb-3">Duel Complete</p>
          {isWinner ? (
            <>
              <h1 className="text-5xl md:text-7xl font-[1000] italic text-[#14F195] uppercase tracking-tighter mb-2">Victory!</h1>
              <p className="text-zinc-400 text-sm">You won the duel!</p>
            </>
          ) : isDraw ? (
            <>
              <h1 className="text-5xl md:text-7xl font-[1000] italic text-yellow-400 uppercase tracking-tighter mb-2">Draw!</h1>
              <p className="text-zinc-400 text-sm">It&apos;s a tie — tiebreaker by speed</p>
            </>
          ) : (
            <>
              <h1 className="text-5xl md:text-7xl font-[1000] italic text-[#FF3131] uppercase tracking-tighter mb-2">Defeat</h1>
              <p className="text-zinc-400 text-sm">Better luck next time!</p>
            </>
          )}
        </div>

        {/* Score Comparison */}
        <div className="grid grid-cols-3 gap-4 mb-8 p-6 bg-white/[0.02] border border-white/5 rounded-xl">
          {/* You */}
          <div className="text-center">
            <p className="text-zinc-500 text-[9px] font-black uppercase mb-2">You</p>
            <p className={`text-3xl font-[1000] italic tabular-nums ${isWinner ? 'text-[#14F195]' : 'text-white'}`}>{myScore}</p>
            <p className="text-zinc-500 text-xs mt-1">{myCorrect}/5</p>
          </div>

          {/* VS */}
          <div className="flex items-center justify-center">
            <div className="w-12 h-12 bg-[#FF3131]/20 rounded-full flex items-center justify-center">
              <span className="text-[#FF3131] text-sm font-[1000] italic">VS</span>
            </div>
          </div>

          {/* Opponent */}
          <div className="text-center">
            <p className="text-zinc-500 text-[9px] font-black uppercase mb-2 truncate">{oppDisplayName}</p>
            <p className={`text-3xl font-[1000] italic tabular-nums ${!isWinner && winner ? 'text-[#14F195]' : 'text-white'}`}>{oppScore}</p>
            <p className="text-zinc-500 text-xs mt-1">{oppCorrect}/5</p>
          </div>
        </div>

        {/* Prize Info */}
        <div className="mb-8 p-4 bg-white/5 border border-white/10 rounded-xl">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-zinc-600 text-[9px] font-black uppercase">Total Pot</p>
              <p className="text-white font-bold text-sm">{(totalPot / 1_000_000_000).toFixed(4)} SOL</p>
            </div>
            <div>
              <p className="text-zinc-600 text-[9px] font-black uppercase">House Cut (10%)</p>
              <p className="text-zinc-400 font-bold text-sm">{(houseCut / 1_000_000_000).toFixed(4)} SOL</p>
            </div>
            <div>
              <p className="text-zinc-600 text-[9px] font-black uppercase">Winner Prize</p>
              <p className="text-[#14F195] font-bold text-sm">{(winnerPrize / 1_000_000_000).toFixed(4)} SOL</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          {isWinner && (
            <button
              onClick={handleClaim}
              disabled={claiming || !resolved}
              className="w-full px-6 py-4 bg-[#14F195] text-black font-[1000] italic uppercase text-lg tracking-tight rounded-xl hover:bg-[#00FFA3] disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {claiming ? 'Claiming...' : !resolved ? 'Resolving on-chain...' : 'Claim Prize'}
            </button>
          )}

          <div className="flex gap-3">
            <button onClick={onPlayAgain} className="flex-1 px-4 py-3 bg-[#FF3131] text-white font-black uppercase text-xs rounded-lg hover:bg-[#FF3131]/80 transition-all active:scale-[0.98]">
              Play Again
            </button>
            <button onClick={handleShareX} className="flex-1 px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-black uppercase text-xs rounded-lg transition-all">
              Share on X
            </button>
            <button onClick={onBackToLobby} className="px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 hover:text-white font-black uppercase text-xs rounded-lg transition-all">
              Lobby
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuelResultsView;

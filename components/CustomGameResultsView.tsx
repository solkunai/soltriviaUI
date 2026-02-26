import React, { useState } from 'react';
import { getReEntryFeeLamports } from '../src/utils/constants';

interface CustomGameResultsViewProps {
  results: {
    score: number;
    correctCount: number;
    totalQuestions: number;
    totalPoints: number;
    timeTakenMs: number;
    rank: number | null;
    gameName: string;
    slug: string;
  };
  attemptsUsed: number;
  maxAttempts: number;
  isPaidGame?: boolean;
  isCreatorFunded?: boolean;
  prizePotSol?: number;
  entryFeeLamports?: number;
  onPlayAgain: () => void;
  onViewLeaderboard: () => void;
  onBackToHome: () => void;
}

const CustomGameResultsView: React.FC<CustomGameResultsViewProps> = ({
  results,
  attemptsUsed,
  maxAttempts,
  isPaidGame,
  isCreatorFunded,
  prizePotSol,
  entryFeeLamports,
  onPlayAgain,
  onViewLeaderboard,
  onBackToHome,
}) => {
  const [copied, setCopied] = useState(false);
  const [showReEntryConfirm, setShowReEntryConfirm] = useState(false);
  const shareUrl = `${window.location.origin}/game/${results.slug}`;
  const canPlayAgain = attemptsUsed < maxAttempts;
  const isReEntry = isPaidGame && attemptsUsed > 0;
  const reEntryFeeSOL = isReEntry && entryFeeLamports != null ? getReEntryFeeLamports(entryFeeLamports) / 1e9 : 0;
  const accuracy = results.totalQuestions > 0 ? Math.round((results.correctCount / results.totalQuestions) * 100) : 0;
  const timeSec = Math.round(results.timeTakenMs / 1000);
  const minutes = Math.floor(timeSec / 60);
  const seconds = timeSec % 60;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const handleShareX = () => {
    const text = isCreatorFunded
      ? `${results.correctCount}/${results.totalQuestions} on "${results.gameName}" | ${results.totalPoints} XP | @soltrivia_app\n\nfree entry, ${prizePotSol?.toFixed(2) ?? '?'} SOL prize pool. creator-funded trivia.\n\nthink you can beat me?\n\n${shareUrl}`
      : isPaidGame
      ? `${results.correctCount}/${results.totalQuestions} on "${results.gameName}" | ${results.totalPoints} XP | @soltrivia_app\n\nprize pool: ${prizePotSol?.toFixed(2) ?? '?'} SOL. real money. real trivia. real degens.\n\nthink you're built different? ape in\n\n${shareUrl}`
      : `${results.correctCount}/${results.totalQuestions} on "${results.gameName}" | ${results.totalPoints} XP | @soltrivia_app\n\nthis game is lowkey harder than the trenches\n\n${shareUrl}`;
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="scan-line opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#38BDF8]/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Game Name */}
        <p className={`text-[10px] font-black uppercase tracking-[0.4em] text-center mb-2 ${isCreatorFunded ? 'text-amber-400' : 'text-[#38BDF8]'}`}>
          {isCreatorFunded ? 'Creator-Funded Game' : isPaidGame ? 'Prize Game' : 'Custom Game'}
        </p>
        <h2 className="text-2xl md:text-4xl font-[1000] italic text-white text-center uppercase tracking-tighter mb-4">
          {results.gameName}
        </h2>

        {/* Prize Pool Banner (paid games) */}
        {isPaidGame && prizePotSol != null && (
          <div className="bg-[#38BDF8]/10 border border-[#38BDF8]/20 rounded-xl p-4 mb-6 text-center">
            <span className="text-zinc-400 text-[9px] font-black uppercase tracking-widest block mb-1">Prize Pool</span>
            <span className="text-[#38BDF8] text-2xl font-[1000] italic">{prizePotSol.toFixed(2)} SOL</span>
            <p className="text-zinc-400 text-[10px] font-black mt-2">
              Visit the leaderboard after the game ends to claim your prize!
            </p>
          </div>
        )}

        {/* Score Card */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 md:p-8 mb-6">
          {/* Rank */}
          {results.rank != null && (
            <div className="text-center mb-6">
              <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-1">Your Rank</span>
              <span className="text-[#38BDF8] text-5xl font-[1000] italic">#{results.rank}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Score</span>
              <span className="text-white text-2xl font-[1000] italic">{results.correctCount}/{results.totalQuestions}</span>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Accuracy</span>
              <span className="text-white text-2xl font-[1000] italic">{accuracy}%</span>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">XP Earned</span>
              <span className="text-[#38BDF8] text-2xl font-[1000] italic">{results.totalPoints.toLocaleString()}</span>
            </div>
            <div className="bg-white/[0.03] border border-white/5 rounded-xl p-4 text-center">
              <span className="text-zinc-600 text-[8px] font-black uppercase tracking-widest block mb-1">Time</span>
              <span className="text-white text-2xl font-[1000] italic">{minutes}:{seconds.toString().padStart(2, '0')}</span>
            </div>
          </div>

          <p className="text-zinc-600 text-[10px] font-black uppercase tracking-wider text-center">
            Attempts: {attemptsUsed} / {maxAttempts}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          {canPlayAgain && (
            isReEntry && !showReEntryConfirm ? (
              <button
                onClick={() => setShowReEntryConfirm(true)}
                className="w-full min-h-[48px] px-6 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
              >
                Play Again ({reEntryFeeSOL} SOL)
              </button>
            ) : isReEntry && showReEntryConfirm ? (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                <p className="text-amber-400 font-black text-sm uppercase text-center mb-1">Hold up, nerd.</p>
                <p className="text-zinc-400 text-xs text-center mb-3">
                  Re-entry costs <span className="text-white font-black">{reEntryFeeSOL} SOL</span>. Only your highest score counts. Re-entry fees are non-refundable. Proceed wisely.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReEntryConfirm(false)}
                    className="flex-1 min-h-[40px] px-4 py-2 bg-white/5 border border-white/10 text-zinc-400 font-black uppercase text-xs rounded-lg hover:bg-white/10 transition-all"
                  >
                    Nah
                  </button>
                  <button
                    onClick={() => { setShowReEntryConfirm(false); onPlayAgain(); }}
                    className="flex-1 min-h-[40px] px-4 py-2 bg-amber-500 text-black font-[1000] italic uppercase text-xs rounded-lg hover:bg-amber-400 transition-all"
                  >
                    Let's Go
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={onPlayAgain}
                className="w-full min-h-[48px] px-6 py-3 bg-[#38BDF8] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#7DD3FC] transition-all active:scale-[0.98]"
              >
                Play Again
              </button>
            )
          )}

          <button
            onClick={onViewLeaderboard}
            className="w-full min-h-[48px] px-6 py-3 bg-white/5 border border-white/10 text-white font-black uppercase text-xs tracking-wider rounded-xl hover:bg-white/10 transition-all active:scale-[0.98]"
          >
            {isPaidGame ? 'View Leaderboard & Prizes' : 'View Leaderboard'}
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleCopyLink}
              className="min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 font-black uppercase text-[10px] tracking-wider rounded-xl hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={handleShareX}
              className="min-h-[44px] px-4 py-3 bg-white/5 border border-white/10 text-zinc-400 font-black uppercase text-[10px] tracking-wider rounded-xl hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              Share on X
            </button>
          </div>

          <button
            onClick={onBackToHome}
            className="w-full min-h-[44px] px-6 py-3 text-zinc-500 font-black uppercase text-[10px] tracking-wider hover:text-zinc-300 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomGameResultsView;

import React, { useState } from 'react';

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
  onPlayAgain: () => void;
  onViewLeaderboard: () => void;
  onBackToHome: () => void;
}

const CustomGameResultsView: React.FC<CustomGameResultsViewProps> = ({
  results,
  attemptsUsed,
  maxAttempts,
  onPlayAgain,
  onViewLeaderboard,
  onBackToHome,
}) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/game/${results.slug}`;
  const canPlayAgain = attemptsUsed < maxAttempts;
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
    const text = `I scored ${results.correctCount}/${results.totalQuestions} (${results.totalPoints} XP) on "${results.gameName}" on @SolTrivia!\n\nThink you can beat me? Try it:`;
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="scan-line opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#14F195]/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Game Name */}
        <p className="text-[#14F195] text-[10px] font-black uppercase tracking-[0.4em] text-center mb-2">Custom Game</p>
        <h2 className="text-2xl md:text-4xl font-[1000] italic text-white text-center uppercase tracking-tighter mb-8">
          {results.gameName}
        </h2>

        {/* Score Card */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 md:p-8 mb-6">
          {/* Rank */}
          {results.rank != null && (
            <div className="text-center mb-6">
              <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-1">Your Rank</span>
              <span className="text-[#14F195] text-5xl font-[1000] italic">#{results.rank}</span>
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
              <span className="text-[#14F195] text-2xl font-[1000] italic">{results.totalPoints.toLocaleString()}</span>
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
            <button
              onClick={onPlayAgain}
              className="w-full min-h-[48px] px-6 py-3 bg-[#14F195] text-black font-[1000] italic uppercase text-lg tracking-tighter rounded-xl hover:bg-[#00FFA3] transition-all active:scale-[0.98]"
            >
              Play Again
            </button>
          )}

          <button
            onClick={onViewLeaderboard}
            className="w-full min-h-[48px] px-6 py-3 bg-white/5 border border-white/10 text-white font-black uppercase text-xs tracking-wider rounded-xl hover:bg-white/10 transition-all active:scale-[0.98]"
          >
            View Leaderboard
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

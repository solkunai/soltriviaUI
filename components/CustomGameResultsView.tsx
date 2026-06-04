import React, { useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { getReEntryFeeLamports } from '../src/utils/constants';
import CustomGameShareCard, { getCustomGameTier } from './CustomGameShareCard';
import { pickTweet, xIntentUrl } from '../src/utils/tweetVariants';

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
  const [sharing, setSharing] = useState(false);
  const shareUrl = `${window.location.origin}/game/${results.slug}`;
  const canPlayAgain = attemptsUsed < maxAttempts;
  const isReEntry = isPaidGame && attemptsUsed > 0;
  const reEntryFeeSOL = isReEntry && entryFeeLamports != null ? getReEntryFeeLamports(entryFeeLamports) / 1e9 : 0;
  const accuracy = results.totalQuestions > 0 ? Math.round((results.correctCount / results.totalQuestions) * 100) : 0;
  const timeSec = Math.round(results.timeTakenMs / 1000);
  const minutes = Math.floor(timeSec / 60);
  const seconds = timeSec % 60;

  // Off-screen CustomGameShareCard , render target for html-to-image capture.
  const shareCardRef = useRef<HTMLDivElement>(null);
  const { tier, moment } = getCustomGameTier(
    results.correctCount,
    results.totalQuestions,
    results.rank,
  );
  const cardMode: 'paid' | 'creator-funded' | 'free' = isCreatorFunded
    ? 'creator-funded'
    : isPaidGame
    ? 'paid'
    : 'free';
  const prizeLabel = prizePotSol != null ? `${prizePotSol.toFixed(2)} SOL` : null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const captureCard = async (): Promise<Blob | null> => {
    if (!shareCardRef.current) return null;
    try {
      const dataUrl = await toPng(shareCardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#08080a',
      });
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (err) {
      console.error('Custom game share card capture failed:', err);
      return null;
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleShareX = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const tweet = pickTweet(moment, {
        topic: results.gameName,
        score: results.totalPoints,
        correct: `${results.correctCount}/${results.totalQuestions}`,
        url: shareUrl,
      });
      const blob = await captureCard();
      const filename = `sol-trivia-custom-${results.slug}.png`;
      if (blob && typeof navigator.share === 'function') {
        const file = new File([blob], filename, { type: 'image/png' });
        const navAny = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
        if (!navAny.canShare || navAny.canShare({ files: [file] })) {
          try {
            await navigator.share({ text: tweet, files: [file] });
            return;
          } catch {
            // user dismissed sheet, fall through to download + intent fallback
          }
        }
      }
      if (blob) downloadBlob(blob, filename);
      window.open(xIntentUrl(tweet), '_blank');
    } finally {
      setSharing(false);
    }
  };

  const handleSaveImage = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const blob = await captureCard();
      if (blob) downloadBlob(blob, `sol-trivia-custom-${results.slug}.png`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-10 relative overflow-hidden">
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

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleCopyLink}
              className="min-h-[44px] px-2 py-3 bg-white/5 border border-white/10 text-zinc-400 font-black uppercase text-[10px] tracking-wider rounded-xl hover:bg-white/10 transition-all active:scale-[0.98]"
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
            <button
              onClick={handleShareX}
              disabled={sharing}
              className="min-h-[44px] px-2 py-3 bg-white/5 border border-white/10 text-zinc-400 font-black uppercase text-[10px] tracking-wider rounded-xl hover:bg-white/10 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sharing ? 'Capturing…' : 'Share on X'}
            </button>
            <button
              onClick={handleSaveImage}
              disabled={sharing}
              className="min-h-[44px] px-2 py-3 bg-white/5 border border-white/10 text-zinc-400 font-black uppercase text-[10px] tracking-wider rounded-xl hover:bg-white/10 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              title="Save stats card as PNG"
            >
              Save Image
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

      {/*
        Off-screen CustomGameShareCard , render target for html-to-image.
        Always mounted regardless of mode so the ref is populated when the
        user hits Share or Save Image.
      */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: -10000,
          top: 0,
          width: 480,
          height: 600,
          pointerEvents: 'none',
          opacity: 0,
        }}
      >
        <CustomGameShareCard
          ref={shareCardRef}
          tier={tier}
          gameName={results.gameName}
          correctCount={results.correctCount}
          totalQuestions={results.totalQuestions}
          points={results.totalPoints}
          timeSec={timeSec}
          rank={results.rank}
          prizeLabel={prizeLabel}
          mode={cardMode}
        />
      </div>
    </div>
  );
};

export default CustomGameResultsView;

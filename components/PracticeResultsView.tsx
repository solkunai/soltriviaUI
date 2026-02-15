import React, { useEffect, useState } from 'react';

interface PracticeResultsViewProps {
  score: number;
  totalQuestions: number;
  points: number;
  totalTime: number;
  onPlayForReal: () => void;
  onTryAgain: () => void;
  onBackToHome: () => void;
}

const PracticeResultsView: React.FC<PracticeResultsViewProps> = ({
  score,
  totalQuestions,
  points,
  totalTime,
  onPlayForReal,
  onTryAgain,
  onBackToHome,
}) => {
  const [showContent, setShowContent] = useState(false);
  const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const minutes = Math.floor(totalTime / 60);
  const seconds = totalTime % 60;

  // Determine performance level
  let performanceLevel = 'NGMI';
  let performanceColor = '#FF3131';
  let performanceMessage = 'Better luck next time, ser.';

  if (accuracy >= 90) {
    performanceLevel = 'CHAD ENERGY';
    performanceColor = '#14F195';
    performanceMessage = 'Absolute degen legend. Ready for the real arena?';
  } else if (accuracy >= 70) {
    performanceLevel = 'WAGMI';
    performanceColor = '#00FFA3';
    performanceMessage = 'Solid ape. Time to prove it for real SOL?';
  } else if (accuracy >= 50) {
    performanceLevel = 'NGMI → WAGMI';
    performanceColor = '#818cf8';
    performanceMessage = 'On the path, anon. Practice makes perfect.';
  }

  // Calculate what they COULD have won (hypothetical)
  const hypotheticalPrize = accuracy >= 90 ? 0.5 : accuracy >= 70 ? 0.25 : accuracy >= 50 ? 0.1 : 0;

  useEffect(() => {
    setTimeout(() => setShowContent(true), 300);
  }, []);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden bg-[#050505]">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="scan-line opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[150px]" style={{ backgroundColor: `${performanceColor}15` }}></div>
      </div>

      <div className={`relative z-10 w-full max-w-3xl transition-all duration-700 ${showContent ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-[#00FFA3] text-[10px] font-black tracking-[0.4em] uppercase italic">Practice Mode</span>
            <div className="w-1.5 h-1.5 rounded-full bg-[#00FFA3]"></div>
          </div>
          <h1 className="text-4xl md:text-7xl font-[1000] italic uppercase tracking-tighter leading-none mb-3">
            SIMULATION<br/>
            <span style={{ color: performanceColor }}>COMPLETE</span>
          </h1>
          <p className="text-zinc-500 text-xs font-black uppercase tracking-widest italic">
            No real SOL at stake... yet.
          </p>
        </div>

        {/* Performance Badge */}
        <div className="bg-[#0A0A0A] border-2 rounded-xl p-8 mb-6 text-center relative overflow-hidden" style={{ borderColor: `${performanceColor}40` }}>
          <div className="absolute inset-0 opacity-5" style={{ background: `radial-gradient(circle at center, ${performanceColor}, transparent)` }}></div>
          <div className="relative z-10">
            <div className="inline-block px-6 py-2 rounded-full mb-4" style={{ backgroundColor: `${performanceColor}20`, border: `2px solid ${performanceColor}60` }}>
              <span className="font-[1000] italic text-2xl md:text-3xl uppercase tracking-tighter" style={{ color: performanceColor }}>
                {performanceLevel}
              </span>
            </div>
            <p className="text-zinc-400 font-black italic text-sm md:text-base uppercase tracking-wide">
              {performanceMessage}
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 md:gap-4 mb-6">
          <div className="bg-[#0A0A0A] border border-white/10 p-5 md:p-6 rounded-lg text-center">
            <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-2 italic">Accuracy</span>
            <span className="text-white text-3xl md:text-4xl font-[1000] italic leading-none" style={{ color: performanceColor }}>
              {accuracy}%
            </span>
          </div>
          <div className="bg-[#0A0A0A] border border-white/10 p-5 md:p-6 rounded-lg text-center">
            <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-2 italic">Correct</span>
            <span className="text-white text-3xl md:text-4xl font-[1000] italic leading-none">
              {score}/{totalQuestions}
            </span>
          </div>
          <div className="bg-[#0A0A0A] border border-white/10 p-5 md:p-6 rounded-lg text-center">
            <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-2 italic">Time</span>
            <span className="text-white text-3xl md:text-4xl font-[1000] italic leading-none">
              {minutes}:{seconds.toString().padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* Hypothetical Prize Tease */}
        {hypotheticalPrize > 0 && (
          <div className="bg-gradient-to-r from-[#14F195]/10 via-[#00FFA3]/10 to-[#14F195]/10 border-2 border-[#14F195]/30 rounded-xl p-6 mb-6 relative overflow-hidden">
            <div className="absolute top-2 right-2">
              <span className="text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-[#14F195]/20 text-[#14F195] italic">
                What if?
              </span>
            </div>
            <div className="flex items-center gap-4">
              <svg className="w-12 h-12 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-zinc-400 text-xs font-black uppercase tracking-wide mb-1 italic">
                  With this score in a REAL game...
                </p>
                <p className="text-[#14F195] text-2xl md:text-3xl font-[1000] italic leading-none">
                  ≈ {hypotheticalPrize} SOL Prize
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col gap-4">
          <button
            onClick={onPlayForReal}
            className="w-full h-20 bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#14F195] rounded-full flex items-center justify-center px-10 active:scale-[0.98] transition-all group shadow-[0_15px_50px_-10px_rgba(20,241,149,0.5)] hover:shadow-[0_20px_70px_-10px_rgba(20,241,149,0.7)] border-t border-white/20 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
            <div className="flex items-center gap-3 relative z-10">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>
              </svg>
              <span className="text-white text-2xl md:text-3xl font-[1000] italic leading-none uppercase tracking-tighter">
                COMPETE FOR SOL
              </span>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onTryAgain}
              className="h-14 bg-[#0A0A0A] border-2 border-white/10 hover:border-[#00FFA3]/40 text-zinc-400 hover:text-white font-[1000] italic uppercase text-sm tracking-tighter rounded-full transition-all active:scale-[0.98]"
            >
              TRY AGAIN
            </button>
            <button
              onClick={onBackToHome}
              className="h-14 bg-[#0A0A0A] border-2 border-white/10 hover:border-white/20 text-zinc-400 hover:text-white font-[1000] italic uppercase text-sm tracking-tighter rounded-full transition-all active:scale-[0.98]"
            >
              MAIN MENU
            </button>
          </div>
        </div>

        {/* Footer Message */}
        <div className="mt-8 text-center">
          <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest italic leading-relaxed">
            Practice mode: Free & unlimited. No wallet needed.<br/>
            Real mode: 0.0225 SOL entry • Top 5 split 100% of prize pool
          </p>
        </div>
      </div>

      {/* Decorative Brainy */}
      <div className="absolute bottom-8 right-8 w-24 h-24 opacity-10 pointer-events-none rotate-12 hidden md:block">
        <img src="brainy-gaming.png" alt="" className="w-full h-full grayscale" onError={(e) => (e.currentTarget.style.display = 'none')} />
      </div>
    </div>
  );
};

export default PracticeResultsView;

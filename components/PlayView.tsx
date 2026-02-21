import React from 'react';
import { PAID_TRIVIA_ENABLED } from '../src/utils/constants';

interface PlayViewProps {
  lives: number | null;
  roundEntriesUsed: number;
  roundEntriesMax: number;
  onStartQuiz: () => void;
  onOpenBuyLives: () => void;
  onStartPractice: () => void;
  practiceRunsLeft: number;
  hasGamePass?: boolean;
  onCreateCustomGame?: () => void;
}

const PlayView: React.FC<PlayViewProps> = ({ lives, roundEntriesUsed, roundEntriesMax, onStartQuiz, onOpenBuyLives, onStartPractice, practiceRunsLeft, hasGamePass, onCreateCustomGame }) => {
  const roundEntriesLeft = Math.max(0, roundEntriesMax - roundEntriesUsed);
  const livesNum = lives ?? 0;
  const canPlay = roundEntriesLeft > 0 || livesNum > 0;
  return (
    <div className="h-full flex flex-col items-center justify-start md:justify-center p-4 pt-6 md:p-12 relative overflow-hidden bg-[#050505] overflow-y-auto">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="scan-line opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#14F195]/5 rounded-full blur-[150px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md md:max-w-lg flex flex-col items-center">
        {/* Mascot + Title */}
        <div className="flex flex-col items-center mb-6 md:mb-8">
          <div className="w-24 h-24 md:w-36 md:h-36 mb-3 md:mb-4 floating">
            <img
              src="brainy-gaming.png"
              alt="Brainy"
              className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(20,241,149,0.3)]"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
          <h2 className="text-3xl md:text-7xl font-[1000] italic uppercase tracking-tighter leading-none text-center mb-1.5 md:mb-3">
            ENTER THE<br/><span className="sol-gradient-text">ARENA</span>
          </h2>
          <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[9px] md:text-xs italic">
            Knowledge is the Ultimate Asset
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2.5 w-full mb-4 md:mb-5">
          <div className={`bg-[#0A0A0A] border rounded-xl p-3 md:p-4 text-center ${roundEntriesLeft > 0 ? 'border-[#14F195]/20' : 'border-white/5'}`}>
            <span className="text-zinc-500 text-[8px] font-black uppercase block mb-1 tracking-widest italic">Round Entries</span>
            <span className={`font-[1000] text-lg md:text-xl italic tabular-nums leading-none ${roundEntriesLeft > 0 ? 'text-[#14F195]' : 'text-zinc-600'}`}>
              {roundEntriesLeft}<span className="text-zinc-600 text-xs">/{roundEntriesMax}</span>
            </span>
          </div>
          <button
            onClick={onOpenBuyLives}
            className={`border rounded-xl p-3 md:p-4 text-center transition-colors ${livesNum > 0 ? 'bg-[#0A0A0A] border-white/10 hover:border-white/20' : 'bg-[#FF3131]/5 border-[#FF3131]/20 hover:bg-[#FF3131]/10'}`}
          >
            <span className={`text-[8px] font-black uppercase block mb-1 tracking-widest italic ${livesNum > 0 ? 'text-zinc-500' : 'text-[#FF3131]'}`}>Extra Lives</span>
            <span className={`font-[1000] text-lg md:text-xl italic tabular-nums leading-none ${livesNum > 0 ? 'text-white' : 'text-[#FF3131]'}`}>
              {livesNum > 0 ? livesNum : 'BUY'}
            </span>
          </button>
        </div>

        {/* Primary: Compete for SOL */}
        <button
          onClick={PAID_TRIVIA_ENABLED ? (canPlay ? onStartQuiz : onOpenBuyLives) : undefined}
          disabled={!PAID_TRIVIA_ENABLED}
          className={`w-full h-16 md:h-20 rounded-2xl flex items-center justify-between px-6 md:px-8 transition-all relative overflow-hidden mb-2.5 ${PAID_TRIVIA_ENABLED ? 'bg-gradient-to-r from-[#00FFA3] to-[#14F195] active:scale-[0.98] group shadow-[0_10px_30px_-8px_rgba(20,241,149,0.4)] hover:shadow-[0_15px_40px_-8px_rgba(20,241,149,0.6)] border border-white/20' : 'bg-zinc-800/60 border border-zinc-700/40 cursor-not-allowed'}`}
        >
          {PAID_TRIVIA_ENABLED && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>}
          <div className="flex flex-col items-start relative z-10">
            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] mb-0.5 ${PAID_TRIVIA_ENABLED ? 'text-black/50' : 'text-zinc-500'}`}>{PAID_TRIVIA_ENABLED ? 'WIN REAL SOL' : 'PAUSED — UPGRADING'}</span>
            <span className={`${PAID_TRIVIA_ENABLED ? 'text-black' : 'text-zinc-500'} text-xl md:text-3xl font-[1000] italic leading-none uppercase tracking-tighter`}>
              {canPlay ? 'COMPETE FOR SOL' : 'GET EXTRA LIVES'}
            </span>
          </div>
          <div className={`w-8 h-8 rounded-full ${PAID_TRIVIA_ENABLED ? 'bg-black/10' : 'bg-white/10'} flex items-center justify-center relative z-10`}>
            <svg className={`w-4 h-4 ${PAID_TRIVIA_ENABLED ? 'text-black' : 'text-zinc-500'}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </button>

        {/* Secondary: Practice / Free Play */}
        <button
          onClick={onStartPractice}
          disabled={!hasGamePass && practiceRunsLeft <= 0}
          className={`w-full h-14 md:h-16 bg-[#0A0A0A] border-2 rounded-2xl flex items-center justify-center px-6 active:scale-[0.98] transition-all group relative overflow-hidden mb-2.5 ${(hasGamePass || practiceRunsLeft > 0) ? 'border-[#14F195]/30 hover:border-[#14F195]/60' : 'border-zinc-700/30 opacity-50 cursor-not-allowed'}`}
        >
          <div className="flex items-center gap-2 relative z-10">
            <svg className="w-5 h-5 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[#14F195] text-base md:text-xl font-[1000] italic leading-none uppercase tracking-tighter">
              {hasGamePass ? 'FREE PLAY' : practiceRunsLeft > 0 ? 'TRY FREE PLAY' : 'NO RUNS LEFT'}
            </span>
          </div>
          {hasGamePass ? (
            <span className="absolute right-5 text-[#14F195]/60 text-[9px] font-black italic uppercase tracking-wider">Unlimited</span>
          ) : practiceRunsLeft > 0 ? (
            <span className="absolute right-5 text-zinc-600 text-xs font-black italic">{practiceRunsLeft}/5</span>
          ) : null}
        </button>

        {/* Tertiary: Create Custom Game */}
        {onCreateCustomGame && (
          <button
            onClick={onCreateCustomGame}
            className="w-full h-12 md:h-14 bg-[#0A0A0A] border-2 border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-between px-6 active:scale-[0.98] transition-all group relative overflow-hidden mb-4"
          >
            <div className="flex items-center gap-2 relative z-10">
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-zinc-300 text-sm md:text-base font-[1000] italic leading-none uppercase tracking-tighter">
                CREATE CUSTOM GAME
              </span>
            </div>
            <span className="text-zinc-600 text-[9px] font-black italic uppercase tracking-wider relative z-10">
              {hasGamePass ? '0.0025 SOL' : '0.0225 SOL'}
            </span>
          </button>
        )}

        {/* Info */}
        <p className="text-[8px] md:text-[9px] text-zinc-500 text-center font-black uppercase tracking-widest px-4 opacity-50 italic leading-relaxed">
          2 free entries every 6h • 0.0225 SOL per entry • Top 5 split prize pool
        </p>
      </div>
    </div>
  );
};

export default PlayView;

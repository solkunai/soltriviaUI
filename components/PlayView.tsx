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
    <div className="h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="scan-line opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#14F195]/5 rounded-full blur-[120px]"></div>
      </div>

      {/* Brainy Gaming Mascot */}
      <div className="relative z-10 w-full max-w-sm md:max-w-md lg:max-w-lg mb-8 floating">
        <img 
          src="brainy-gaming.png" 
          alt="Brainy Play" 
          className="w-full h-auto drop-shadow-[0_0_60px_rgba(20,241,149,0.4)]"
          onError={(e) => (e.currentTarget.style.display = 'none')} 
        />
      </div>

      {/* Arena Text */}
      <div className="text-center relative z-10 mb-12 flex flex-col items-center">
        <h2 className="text-5xl md:text-8xl font-[1000] italic uppercase tracking-tighter leading-none mb-4">
          ENTER THE<br/><span className="sol-gradient-text">ARENA</span>
        </h2>
        <div className="h-0.5 w-16 md:w-32 bg-[#00FFA3] opacity-30 mt-2 mb-6"></div>
        <p className="text-zinc-400 font-black uppercase tracking-[0.4em] text-xs md:text-sm italic">
          Knowledge is the Ultimate Asset
        </p>
      </div>

      {/* Big Play CTA */}
      <div className="flex flex-col gap-6 w-full max-md relative z-10 max-w-md">
        {!PAID_TRIVIA_ENABLED && (
          <div className="px-4 py-3 bg-yellow-500/10 border border-yellow-500/25 rounded-xl text-center">
            <span className="text-yellow-400 text-[10px] font-[1000] italic uppercase tracking-wide">Compete for SOL is temporarily paused while we upgrade the smart contract. Free play is still available!</span>
          </div>
        )}
        <button
          onClick={PAID_TRIVIA_ENABLED ? (canPlay ? onStartQuiz : onOpenBuyLives) : undefined}
          disabled={!PAID_TRIVIA_ENABLED}
          className={`w-full h-24 rounded-full flex items-center justify-center px-10 transition-all border-t relative overflow-hidden ${PAID_TRIVIA_ENABLED ? 'bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#14F195] active:scale-[0.98] group shadow-[0_15px_40px_-10px_rgba(153,69,255,0.4)] hover:shadow-[0_20px_60px_-10px_rgba(20,241,149,0.5)] border-white/20' : 'bg-zinc-800/50 border-zinc-700/30 cursor-not-allowed opacity-50'}`}
        >
          {PAID_TRIVIA_ENABLED && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>}

          <span className="text-white text-3xl md:text-4xl font-[1000] italic leading-none uppercase tracking-tighter relative z-10">
            {canPlay ? 'COMPETE FOR SOL' : 'GET EXTRA LIVES'}
          </span>
        </button>

        {/* Practice Mode Button */}
        <button
          onClick={onStartPractice}
          disabled={!hasGamePass && practiceRunsLeft <= 0}
          className={`w-full h-20 bg-[#0A0A0A] border-2 rounded-full flex items-center justify-center px-10 active:scale-[0.98] transition-all group relative overflow-hidden ${(hasGamePass || practiceRunsLeft > 0) ? 'border-[#14F195]/30 hover:border-[#14F195]/60 shadow-[0_8px_30px_-8px_rgba(20,241,149,0.2)] hover:shadow-[0_12px_40px_-8px_rgba(20,241,149,0.4)]' : 'border-zinc-700/30 opacity-50 cursor-not-allowed'}`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#14F195]/5 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>

          <div className="flex items-center gap-3 relative z-10">
            <svg className="w-6 h-6 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[#14F195] text-2xl md:text-3xl font-[1000] italic leading-none uppercase tracking-tighter">
              {hasGamePass ? 'PLAY NOW' : practiceRunsLeft > 0 ? 'TRY FREE PLAY' : 'NO RUNS LEFT TODAY'}
            </span>
          </div>
          {hasGamePass ? (
            <span className="absolute right-6 text-[#14F195] text-[9px] font-black italic uppercase tracking-wider">Unlimited</span>
          ) : practiceRunsLeft > 0 ? (
            <span className="absolute right-6 text-zinc-500 text-xs font-black italic">{practiceRunsLeft}/5</span>
          ) : null}
        </button>

        {/* Create Custom Game Button */}
        {onCreateCustomGame && (
          <button
            onClick={onCreateCustomGame}
            className="w-full h-16 bg-[#0A0A0A] border-2 border-[#9945FF]/30 hover:border-[#9945FF]/60 rounded-full flex items-center justify-between px-8 active:scale-[0.98] transition-all group relative overflow-hidden shadow-[0_8px_30px_-8px_rgba(153,69,255,0.15)] hover:shadow-[0_12px_40px_-8px_rgba(153,69,255,0.3)]"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#9945FF]/5 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
            <div className="flex items-center gap-3 relative z-10">
              <svg className="w-5 h-5 text-[#9945FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[#9945FF] text-lg md:text-xl font-[1000] italic leading-none uppercase tracking-tighter">
                CREATE CUSTOM GAME
              </span>
            </div>
            <span className="text-zinc-500 text-[9px] font-black italic uppercase tracking-wider relative z-10">
              {hasGamePass ? '0.0025 SOL' : '0.0225 SOL'}
            </span>
          </button>
        )}

        <div className="grid grid-cols-2 gap-4">
            <div className={`bg-[#0A0A0A] border p-4 rounded-full text-center backdrop-blur-md flex flex-col items-center justify-center ${roundEntriesLeft > 0 ? 'border-[#14F195]/20' : 'border-white/5'}`}>
                <span className="text-zinc-300 text-[8px] font-black uppercase block mb-1 tracking-widest italic leading-none">Round Entries</span>
                <span className={`font-black text-sm uppercase italic tabular-nums leading-none ${roundEntriesLeft > 0 ? 'text-[#14F195]' : 'text-zinc-500'}`}>
                  {roundEntriesLeft} / {roundEntriesMax}
                </span>
            </div>
            <button
              onClick={onOpenBuyLives}
              className={`border p-4 rounded-full text-center group transition-colors flex flex-col items-center justify-center ${livesNum > 0 ? 'bg-[#0A0A0A] border-white/10 hover:border-white/20' : 'bg-[#FF3131]/5 border-[#FF3131]/20 hover:bg-[#FF3131]/10'}`}
            >
                <span className={`text-[8px] font-black uppercase block mb-1 tracking-widest italic leading-none ${livesNum > 0 ? 'text-zinc-300' : 'text-[#FF3131]'}`}>Extra Lives</span>
                <span className={`font-black text-sm uppercase italic tabular-nums leading-none ${livesNum > 0 ? 'text-white' : 'text-[#FF3131]'}`}>
                  {livesNum > 0 ? livesNum : 'BUY'}
                </span>
            </button>
        </div>

        <p className="text-[9px] text-zinc-400 text-center font-black uppercase tracking-widest mt-2 px-6 opacity-60 italic leading-tight">
          * 2 round entries reset every 6h. Entry fee: 0.0225 SOL. <span className="text-[#14F195]">Extra lives</span> are for plays beyond your round entries. <span className="text-[#14F195]">Free play</span>: {hasGamePass ? 'unlimited with Game Pass.' : '5 free per day.'}
        </p>
      </div>
    </div>
  );
};

export default PlayView;

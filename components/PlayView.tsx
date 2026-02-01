import React from 'react';

interface PlayViewProps {
  lives: number;
  onStartQuiz: () => void;
  onOpenBuyLives: () => void;
}

const PlayView: React.FC<PlayViewProps> = ({ lives, onStartQuiz, onOpenBuyLives }) => {
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
        <button 
          onClick={onStartQuiz}
          className="w-full h-24 bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#14F195] rounded-full flex items-center justify-center px-10 active:scale-[0.98] transition-all group shadow-[0_15px_40px_-10px_rgba(153,69,255,0.4)] hover:shadow-[0_20px_60px_-10px_rgba(20,241,149,0.5)] border-t border-white/20 relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
          
          <span className="text-white text-3xl md:text-4xl font-[1000] italic leading-none uppercase tracking-tighter relative z-10">
            {lives > 0 ? 'START TRIVIA' : 'REFUEL LIVES'}
          </span>
        </button>
        
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-full text-center backdrop-blur-md flex flex-col items-center justify-center">
                <span className="text-zinc-300 text-[8px] font-black uppercase block mb-1 tracking-widest italic leading-none">Vitality</span>
                <span className={`font-black text-sm uppercase italic tabular-nums leading-none ${lives > 0 ? 'text-white' : 'text-[#FF3131]'}`}>
                  {lives} LIVES
                </span>
            </div>
            <button 
              onClick={onOpenBuyLives}
              className="bg-[#FF3131]/5 border border-[#FF3131]/20 p-4 rounded-full text-center group hover:bg-[#FF3131]/10 transition-colors flex flex-col items-center justify-center"
            >
                <span className="text-[#FF3131] text-[8px] font-black uppercase block mb-1 tracking-widest italic leading-none">Buy Entries</span>
                <span className="text-white font-black text-sm uppercase italic leading-none">0.03 SOL</span>
            </button>
        </div>
        
        <p className="text-[9px] text-zinc-400 text-center font-black uppercase tracking-widest mt-2 px-6 opacity-60 italic">
          * Standard entry is limited to 1 per session. <span className="text-[#FF3131]">Extra lives</span> allow multiple entries and roll over across rounds.
        </p>
      </div>
    </div>
  );
};

export default PlayView;

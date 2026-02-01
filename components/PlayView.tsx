
import React from 'react';

interface PlayViewProps {
  onOpenBuyLives: () => void;
}

const PlayView: React.FC<PlayViewProps> = ({ onOpenBuyLives }) => {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="scan-line opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#00FFA3]/5 rounded-full blur-[120px]"></div>
      </div>

      {/* Brainy Gaming Mascot */}
      <div className="relative z-10 w-full max-w-sm md:max-w-md lg:max-w-lg mb-8 floating">
        <img 
          src="brainy-gaming.png" 
          alt="Brainy Play" 
          className="w-full h-auto drop-shadow-[0_0_60px_rgba(0,255,163,0.4)]"
          onError={(e) => (e.currentTarget.style.display = 'none')} 
        />
      </div>

      {/* Arena Text */}
      <div className="text-center relative z-10 mb-12">
        <h2 className="text-5xl md:text-8xl font-[1000] italic uppercase tracking-tighter leading-none mb-4">
          ENTER THE<br/><span className="sol-gradient-text">ARENA</span>
        </h2>
        <p className="text-zinc-500 font-black uppercase tracking-[0.4em] text-xs md:text-sm">
          Knowledge is the Ultimate Asset
        </p>
      </div>

      {/* Big Play CTA */}
      <div className="flex flex-col gap-4 w-full max-w-md relative z-10">
        <button className="w-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#10b981] hover:brightness-110 active:scale-95 transition-all duration-300 py-6 md:py-8 px-10 italic font-[1000] text-2xl md:text-4xl text-white shadow-[0_0_40px_rgba(59,130,246,0.3)] group overflow-hidden relative border border-white/20">
          <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
          START TRIVIA
        </button>
        
        <div className="flex gap-4">
            <div className="flex-1 bg-[#0A0A0A] border border-white/5 p-4 rounded-sm text-center">
                <span className="text-zinc-600 text-[8px] font-black uppercase block mb-1">Entry Fee</span>
                <span className="text-white font-black text-sm uppercase italic">0.02 SOL</span>
            </div>
            <button 
              onClick={onOpenBuyLives}
              className="flex-1 bg-[#FF3131]/5 border border-[#FF3131]/20 p-4 rounded-sm text-center group hover:bg-[#FF3131]/10 transition-colors"
            >
                <span className="text-[#FF3131] text-[8px] font-black uppercase block mb-1 tracking-widest">Buy Entries</span>
                <span className="text-white font-black text-sm uppercase italic">3 LIVES / 0.03 SOL</span>
            </button>
        </div>
        
        <p className="text-[9px] text-zinc-600 text-center font-black uppercase tracking-widest mt-2 px-6">
          * Standard entry is limited to 1 per session. <span className="text-[#FF3131]">Extra lives</span> allow multiple entries and roll over across rounds.
        </p>
      </div>

      {/* Network Status Footer */}
      <div className="absolute bottom-32 md:bottom-12 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00FFA3] animate-pulse shadow-[0_0_8px_#00FFA3]"></div>
          <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Protocol Syncing with Brainy...</span>
      </div>
    </div>
  );
};

export default PlayView;

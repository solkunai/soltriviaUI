
import React from 'react';

interface HomeViewProps {
  onEnterTrivia: () => void;
  onOpenGuide: () => void;
  onOpenBuyLives: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onEnterTrivia, onOpenGuide, onOpenBuyLives }) => {
  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto custom-scrollbar px-6 pt-12 pb-36 relative">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none opacity-[0.02]">
        <div className="absolute top-[15%] left-1/2 -translate-x-1/2 text-[250px] font-black italic leading-none">88</div>
      </div>

      {/* Top Right "How to Play" Button */}
      <div className="absolute top-8 right-6 z-30">
        <button 
          onClick={onOpenGuide}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-full transition-all group"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white">GUIDE</span>
          <div className="w-4 h-4 rounded-full bg-[#00FFA3]/20 flex items-center justify-center text-[#00FFA3] font-black text-[9px] italic">?</div>
        </button>
      </div>

      {/* Main Branding Section */}
      <div className="mt-10 mb-8 z-10">
        <h1 className="text-[64px] sm:text-[72px] leading-[0.7] font-[1000] italic text-white uppercase tracking-tighter text-left ml-[-4px]">
          SOL
        </h1>
        <h1 className="text-[64px] sm:text-[72px] leading-[0.9] font-[1000] italic sol-gradient-text uppercase tracking-tighter text-left ml-[-4px]">
          TRIVIA
        </h1>
      </div>

      {/* Play Now Button */}
      <button 
        onClick={onEnterTrivia}
        className="w-full h-32 bg-[#00FFA3] rounded-sm mb-10 flex items-center justify-between px-8 active:scale-[0.98] transition-all group z-10 shadow-[0_10px_40px_rgba(0,255,163,0.15)]"
      >
        <div className="text-black text-[38px] font-[1000] italic leading-[0.85] text-left uppercase tracking-tighter">
          PLAY<br/>NOW
        </div>
        <div className="transition-transform group-hover:translate-x-2">
          <svg className="w-12 h-12 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </div>
      </button>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 z-10">
        <div className="bg-[#0A0A0A] border border-white/5 p-5 rounded-sm min-h-[130px] flex flex-col justify-between shadow-xl">
          <div className="w-9 h-9 bg-[#00FFA3]/5 border border-[#00FFA3]/20 rounded-sm flex items-center justify-center text-[#00FFA3]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div className="mt-4">
            <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-1">Balance</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[22px] font-[1000] italic text-white">12.42</span>
              <span className="text-[#00FFA3] text-[10px] font-[1000] italic uppercase">SOL</span>
            </div>
          </div>
        </div>

        {/* Lives Card with BUY trigger */}
        <button 
          onClick={onOpenBuyLives}
          className="bg-[#0A0A0A] border border-white/5 p-5 rounded-sm min-h-[130px] flex flex-col justify-between shadow-xl text-left hover:border-[#FF3131]/30 transition-colors group relative overflow-hidden"
        >
          <div className="absolute top-4 right-4 text-[8px] font-black text-[#FF3131] opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest">
            BUY +
          </div>
          <div className="w-9 h-9 bg-[#FF3131]/5 border border-[#FF3131]/20 rounded-sm flex items-center justify-center text-[#FF3131]">
             <svg className="w-5 h-5 fill-[#FF3131]" viewBox="0 0 24 24">
              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div className="mt-4">
            <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-1">Lives</span>
            <div className="text-[22px] font-[1000] italic text-[#FF3131]">03</div>
          </div>
        </button>
      </div>

      <div className="bg-[#0A0A0A] border border-white/5 p-5 rounded-sm z-10 min-h-[130px] flex flex-col justify-between shadow-xl">
        <div className="w-9 h-9 bg-[#00FFA3]/5 border border-[#00FFA3]/20 rounded-sm flex items-center justify-center text-[#00FFA3]">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
        </div>
        <div className="mt-4">
          <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest block mb-1">Global</span>
          <div className="text-[22px] font-[1000] italic text-white">#842</div>
        </div>
      </div>
    </div>
  );
};

export default HomeView;

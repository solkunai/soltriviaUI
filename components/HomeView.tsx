
import React from 'react';

interface HomeViewProps {
  onEnterTrivia: () => void;
  onOpenGuide: () => void;
  onOpenBuyLives: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onEnterTrivia, onOpenGuide, onOpenBuyLives }) => {
  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto custom-scrollbar relative px-6 md:px-12 lg:px-24">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none opacity-[0.02] z-0">
        <div className="absolute top-[10%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[300px] md:text-[500px] font-black italic leading-none">88</div>
      </div>

      {/* Top Header Row */}
      <div className="flex justify-end items-center pt-8 md:pt-12 z-20">
        <button 
          onClick={onOpenGuide}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full transition-all group backdrop-blur-md"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white">HOW TO PLAY</span>
          <div className="w-4 h-4 rounded-full bg-[#14F195]/20 flex items-center justify-center text-[#14F195] font-black text-[9px] italic">?</div>
        </button>
      </div>

      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col justify-center pb-32 md:pb-12 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
          
          {/* Left Side: Branding & CTA */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="mb-8 md:mb-10">
              <h1 className="text-[80px] sm:text-[100px] md:text-[130px] leading-[0.7] font-[1000] italic text-white uppercase tracking-tighter ml-[-4px]">
                SOL
              </h1>
              <h1 className="text-[80px] sm:text-[100px] md:text-[130px] leading-[0.9] font-[1000] italic sol-gradient-text uppercase tracking-tighter ml-[-4px]">
                TRIVIA
              </h1>
              <p className="text-zinc-500 font-black uppercase tracking-[0.4em] text-xs mt-6 max-w-sm">
                THE HIGH-STAKES INTELLIGENCE TRIVIA ON SOLANA
              </p>
            </div>

            {/* Play Now Button - High Fidelity Refinement */}
            <button 
              onClick={onEnterTrivia}
              className="w-full sm:max-w-md h-24 bg-gradient-to-r from-[#9945FF] via-[#3b82f6] to-[#14F195] rounded-xl flex items-center justify-between px-10 active:scale-[0.98] transition-all group shadow-[0_15px_40px_-10px_rgba(153,69,255,0.4)] hover:shadow-[0_20px_60px_-10px_rgba(20,241,149,0.5)] border-t border-white/20 relative overflow-hidden"
            >
              {/* Animated Sheen Overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
              
              <div className="flex flex-col items-start relative z-10">
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-1 group-hover:text-white/80 transition-colors">INITIALIZE ARENA</span>
                <div className="text-white text-3xl md:text-4xl font-[1000] italic leading-none uppercase tracking-tighter">
                  PLAY NOW
                </div>
              </div>
              
              <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center transition-all group-hover:bg-white/20 group-hover:scale-110 relative z-10">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </div>
            </button>
          </div>

          {/* Right Side: Stats Grid */}
          <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            
            {/* Balance Stat */}
            <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-xl min-h-[140px] flex flex-col justify-between shadow-xl backdrop-blur-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#14F195]/5 blur-3xl rounded-full translate-x-12 -translate-y-12"></div>
              <div className="w-10 h-10 bg-[#14F195]/5 border border-[#14F195]/20 rounded-lg flex items-center justify-center text-[#14F195]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="mt-6">
                <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest block mb-1">Balance</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-[28px] font-[1000] italic text-white">12.42</span>
                  <span className="text-[#14F195] text-xs font-[1000] italic uppercase">SOL</span>
                </div>
              </div>
            </div>

            {/* Lives Stat */}
            <button 
              onClick={onOpenBuyLives}
              className="bg-[#0A0A0A] border border-white/5 p-6 rounded-xl min-h-[140px] flex flex-col justify-between shadow-xl text-left hover:border-[#FF3131]/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-6 right-6 text-[9px] font-black text-[#FF3131] opacity-60 group-hover:opacity-100 transition-opacity uppercase tracking-widest flex items-center gap-1">
                REFILL <span className="text-lg leading-none">+</span>
              </div>
              <div className="w-10 h-10 bg-[#FF3131]/5 border border-[#FF3131]/20 rounded-lg flex items-center justify-center text-[#FF3131]">
                 <svg className="w-6 h-6 fill-[#FF3131]" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </div>
              <div className="mt-6">
                <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest block mb-1">Rolling Lives</span>
                <div className="text-[28px] font-[1000] italic text-[#FF3131]">03</div>
              </div>
            </button>

            {/* Global Ranking Stat */}
            <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-xl min-h-[140px] flex flex-col justify-between shadow-xl sm:col-span-2 lg:col-span-1">
              <div className="w-10 h-10 bg-[#14F195]/5 border border-[#14F195]/20 rounded-lg flex items-center justify-center text-[#14F195]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div className="mt-6">
                <span className="text-zinc-600 text-[10px] font-black uppercase tracking-widest block mb-1">Global Standing</span>
                <div className="flex items-center gap-4">
                  <span className="text-[28px] font-[1000] italic text-white">#842</span>
                  <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full w-[65%] bg-[#14F195] shadow-[0_0_10px_#14F195]"></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Floating Mascot Decor - Repositioned for web */}
      <div className="fixed right-4 bottom-24 w-[280px] lg:w-[450px] opacity-10 lg:opacity-30 pointer-events-none z-0 floating hidden md:block">
        <img src="brainy-gaming.png" alt="" className="w-full h-auto" onError={(e) => (e.currentTarget.style.display = 'none')} />
      </div>
    </div>
  );
};

export default HomeView;

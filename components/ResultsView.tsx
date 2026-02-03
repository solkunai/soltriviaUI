import React, { useState } from 'react';

interface ResultsViewProps {
  results: { score: number, points: number, time: number, rank?: number };
  lives: number;
  onRestart: () => void;
  onGoHome: () => void;
  onBuyLives: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ results, lives, onRestart, onGoHome, onBuyLives }) => {
  const [showShareCard, setShowShareCard] = useState(false);
  const isPerfect = results.score === 10;
  const hasLives = lives > 0;

  const handleShare = () => {
    const text = `I just scored ${results.points}XP on Solana Trivia Protocol! 🧠⚡\n\nAccuracy: ${results.score}/10\nTime: ${results.time}s\n\nThink you're smarter? Join the arena on Solana!\nhttps://soltriviaui.onrender.com`;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden bg-[#050505]">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
         <div className="scan-line"></div>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00FFA3]/5 rounded-full blur-[160px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden rounded-3xl animate-fade-in flex flex-col">
        {/* Accent Strip */}
        <div className="h-2 w-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#00FFA3]"></div>

        <div className="p-8 md:p-12 text-center">
          {/* Mascot Decoration */}
          <div className="flex justify-center mb-8">
              <div className="relative">
                  <div className="absolute inset-0 bg-[#00FFA3]/20 blur-3xl rounded-full"></div>
                  <img 
                    src={isPerfect ? "brainy-winning.png" : "brainy-idea.png"} 
                    alt="Brainy" 
                    className="w-24 md:w-32 h-auto relative z-10 floating" 
                    onError={(e) => (e.currentTarget.style.display = 'none')} 
                  />
              </div>
          </div>

          <div className="mb-10">
            <span className="text-[#00FFA3] text-[10px] md:text-sm font-black tracking-[0.5em] uppercase mb-2 block italic">TRIVIA FINALIZED</span>
            <h2 className="text-5xl md:text-8xl font-[1000] italic uppercase tracking-tighter text-white leading-[0.8] mb-4">
              {results.points.toLocaleString()} <span className="text-2xl md:text-4xl block md:inline text-[#00FFA3]">XP</span>
            </h2>
            <p className="text-zinc-400 font-black uppercase tracking-[0.3em] text-[10px] md:text-xs italic">
              {isPerfect ? "Peak Neural Optimization Achieved" : "Session Data Ingested Successfully"}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 mb-10">
            <div className="bg-black/40 border border-white/5 p-4 md:p-6 rounded-xl">
              <span className="text-zinc-300 text-[8px] md:text-[10px] font-black uppercase block mb-2 tracking-widest italic">Accuracy</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className={`text-2xl md:text-4xl font-[1000] italic leading-none ${isPerfect ? 'text-[#00FFA3]' : 'text-white'}`}>{results.score}</span>
                <span className="text-zinc-400 text-[10px] font-black italic">/10</span>
              </div>
            </div>
            <div className="bg-black/40 border border-white/5 p-4 md:p-6 rounded-xl">
              <span className="text-zinc-300 text-[8px] md:text-[10px] font-black uppercase block mb-2 tracking-widest italic">Elapsed</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-2xl md:text-4xl font-[1000] italic text-white leading-none tabular-nums">{results.time}</span>
                <span className="text-zinc-400 text-[10px] font-black italic">SEC</span>
              </div>
            </div>
            <div className="bg-black/40 border border-white/5 p-4 md:p-6 rounded-xl">
              <span className="text-zinc-300 text-[8px] md:text-[10px] font-black uppercase block mb-2 tracking-widest italic">Rank</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-2xl md:text-4xl font-[1000] italic text-[#FFD700] leading-none tabular-nums">
                  {results.rank ? `#${results.rank}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Social Share Trigger */}
          <button 
            onClick={() => setShowShareCard(true)}
            className="w-full mb-8 py-4 bg-white/5 border border-white/10 text-[#1DA1F2] hover:bg-[#1DA1F2]/10 font-[1000] text-sm md:text-lg italic uppercase tracking-tighter transition-all flex items-center justify-center gap-3 rounded-full group"
          >
            <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
            </svg>
            SHARE YOUR SCORE
          </button>

          {/* Conditional Run Again / Buy Lives Callout */}
          <div className="bg-black/60 border border-white/5 p-6 rounded-2xl mb-8 flex flex-col gap-4">
             {hasLives ? (
               <div className="flex flex-col items-center">
                  <span className="text-zinc-400 text-[9px] font-black uppercase tracking-[0.2em] mb-3 italic">VITALITY LIVES REMAINING: {lives}</span>
                  <button 
                    onClick={onRestart}
                    className="w-full py-5 bg-[#00FFA3] text-black font-[1000] text-xl italic uppercase tracking-tighter shadow-[0_10px_30px_rgba(0,255,163,0.2)] active:scale-95 transition-all rounded-full"
                  >
                    RUN AGAIN
                  </button>
               </div>
             ) : (
               <div className="flex flex-col items-center">
                  <div className="flex items-center gap-3 mb-4">
                     <div className="w-1.5 h-1.5 rounded-full bg-[#FF3131] animate-ping"></div>
                     <span className="text-[#FF3131] text-[10px] font-black uppercase tracking-[0.3em] italic">VITALITY DEPLETED</span>
                  </div>
                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-6 italic">Unlock multi-entry access to secure your rank.</p>
                  <button 
                    onClick={onBuyLives}
                    className="w-full py-5 bg-[#FF3131] text-white font-[1000] text-xl italic uppercase tracking-tighter shadow-[0_10px_30px_rgba(255,49,49,0.3)] active:scale-95 transition-all rounded-full"
                  >
                    GET MORE LIVES
                  </button>
               </div>
             )}
             
             <button 
              onClick={onGoHome}
              className="w-full py-4 bg-white/5 border border-white/10 text-zinc-400 font-black uppercase text-xs tracking-[0.3em] italic hover:bg-white/10 active:scale-95 transition-all rounded-full"
            >
              TERMINAL
            </button>
          </div>

          <p className="text-[8px] text-zinc-700 text-center font-black uppercase tracking-[0.4em] italic">
            Operation ID: {Math.random().toString(36).substring(7).toUpperCase()}
          </p>
        </div>
      </div>

      {/* Share Card Overlay */}
      {showShareCard && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-fade-in">
           <div className="relative w-full max-w-sm bg-[#050505] border border-white/20 p-8 rounded-2xl shadow-[0_0_80px_rgba(20,241,149,0.2)] flex flex-col overflow-hidden">
              {/* Card Watermark */}
              <div className="absolute top-[-10%] right-[-10%] text-[120px] font-black italic opacity-[0.03] select-none pointer-events-none">SOL</div>
              
              <div className="flex justify-between items-start mb-10">
                 <div>
                    <span className="text-[#00FFA3] text-[10px] font-black uppercase tracking-[0.4em] italic block mb-1">BRAINY_NODE</span>
                    <h3 className="text-2xl font-[1000] italic text-white uppercase tracking-tighter">SCORE_SYNC</h3>
                 </div>
                 <button onClick={() => setShowShareCard(false)} className="text-zinc-600 hover:text-white transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                 </button>
              </div>

              <div className="bg-gradient-to-br from-[#0A0A0A] to-black border border-white/10 p-8 rounded-xl text-center mb-8 relative">
                 <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-1/2 bg-[#00FFA3]"></div>
                 <span className="text-zinc-500 text-[9px] font-black uppercase tracking-[0.3em] mb-4 block italic">SYNAPTIC PERFORMANCE</span>
                 <div className="text-[100px] font-[1000] italic leading-none sol-gradient-text tracking-tighter mb-2">
                   {results.score}<span className="text-2xl text-white/40">/10</span>
                 </div>
                 <div className="text-white text-3xl font-[1000] italic uppercase tracking-tighter mb-4">
                   {results.points.toLocaleString()} XP
                 </div>
                 <div className="flex justify-center gap-6 pt-6 border-t border-white/5">
                    <div className="flex flex-col items-center">
                       <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest italic">TIME</span>
                       <span className="text-white font-black italic text-sm">{results.time}s</span>
                    </div>
                    <div className="flex flex-col items-center">
                       <span className="text-[8px] text-zinc-600 font-black uppercase tracking-widest italic">RANK</span>
                       <span className="text-[#FFD700] font-black italic text-sm">
                         {results.rank ? `#${results.rank}` : '—'}
                       </span>
                    </div>
                 </div>
              </div>

              <button 
                onClick={handleShare}
                className="w-full py-5 bg-[#1DA1F2] text-white font-[1000] text-xl italic uppercase tracking-tighter shadow-[0_15px_40_rgba(29,161,242,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3 rounded-full"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
                BROADCAST TO X
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default ResultsView;

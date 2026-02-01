
import React from 'react';

interface ResultsViewProps {
  results: { score: number, points: number, time: number };
  onRestart: () => void;
  onGoHome: () => void;
}

const ResultsView: React.FC<ResultsViewProps> = ({ results, onRestart, onGoHome }) => {
  const isPerfect = results.score === 10;
  const isGreat = results.score >= 8;
  
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 md:p-12 relative overflow-hidden bg-[#050505]">
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
         <div className="scan-line"></div>
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-[#00FFA3]/5 rounded-full blur-[160px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-2xl bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden rounded-3xl animate-fade-in">
        {/* Accent Strip */}
        <div className="h-2 w-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#00FFA3]"></div>

        <div className="p-8 md:p-16 text-center">
          {/* Mascot Decoration */}
          <div className="flex justify-center mb-10">
              <div className="relative">
                  <div className="absolute inset-0 bg-[#00FFA3]/20 blur-3xl rounded-full"></div>
                  <img 
                    src={isPerfect ? "brainy-winning.png" : "brainy-idea.png"} 
                    alt="Brainy" 
                    className="w-32 md:w-48 h-auto relative z-10 floating" 
                    onError={(e) => (e.currentTarget.style.display = 'none')} 
                  />
              </div>
          </div>

          <div className="mb-12">
            <span className="text-[#00FFA3] text-[10px] md:text-sm font-black tracking-[0.5em] uppercase mb-2 block">Sync Finalized</span>
            <h2 className="text-5xl md:text-8xl font-[1000] italic uppercase tracking-tighter text-white leading-[0.8] mb-4">
              {results.points.toLocaleString()} <span className="text-2xl md:text-4xl block md:inline text-[#00FFA3]">XP</span>
            </h2>
            <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[10px] md:text-xs">
              {isPerfect ? "Peak Neural Optimization Achieved" : "Session Data Ingested Successfully"}
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 md:gap-6 mb-12">
            <div className="bg-black/40 border border-white/5 p-4 md:p-6 rounded-xl">
              <span className="text-zinc-700 text-[8px] md:text-[10px] font-black uppercase block mb-2 tracking-widest">Accuracy</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className={`text-2xl md:text-4xl font-[1000] italic leading-none ${isPerfect ? 'text-[#00FFA3]' : 'text-white'}`}>{results.score}</span>
                <span className="text-zinc-600 text-[10px] font-black italic">/10</span>
              </div>
            </div>
            <div className="bg-black/40 border border-white/5 p-4 md:p-6 rounded-xl">
              <span className="text-zinc-700 text-[8px] md:text-[10px] font-black uppercase block mb-2 tracking-widest">Elapsed</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-2xl md:text-4xl font-[1000] italic text-white leading-none">{results.time}</span>
                <span className="text-zinc-600 text-[10px] font-black italic">SEC</span>
              </div>
            </div>
            <div className="bg-black/40 border border-white/5 p-4 md:p-6 rounded-xl">
              <span className="text-zinc-700 text-[8px] md:text-[10px] font-black uppercase block mb-2 tracking-widest">Global</span>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-2xl md:text-4xl font-[1000] italic text-[#FFD700] leading-none">#842</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={onRestart}
              className="flex-1 py-5 bg-[#00FFA3] text-black font-[1000] text-xl italic uppercase tracking-tighter shadow-[0_10px_30px_rgba(0,255,163,0.2)] active:scale-95 transition-all"
            >
              RUN AGAIN
            </button>
            <button 
              onClick={onGoHome}
              className="flex-1 py-5 bg-white/5 border border-white/10 text-white font-[1000] text-xl italic uppercase tracking-tighter hover:bg-white/10 active:scale-95 transition-all"
            >
              TERMINAL
            </button>
          </div>

          <p className="text-[8px] text-zinc-700 text-center font-black uppercase tracking-[0.4em] mt-8">
            Operation ID: {Math.random().toString(36).substring(7).toUpperCase()} // v2.5
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResultsView;

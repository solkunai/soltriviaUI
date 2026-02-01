
import React, { useState, useEffect } from 'react';

interface QuestsViewProps {
  onGoToProfile?: () => void;
}

const QuestsView: React.FC<QuestsViewProps> = ({ onGoToProfile }) => {
  // Simulated real-time progress for the global bar
  const [globalProgress, setGlobalProgress] = useState(64.2);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalProgress(prev => {
        if (prev >= 99) return 64.2; // Reset for demo loop
        return +(prev + 0.01).toFixed(2);
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const questCategories = [
    {
      title: 'Priority Missions',
      quests: [
        { title: 'GENESIS STREAK', desc: '7-day daily login chain', progress: 5, max: 7, reward: '1,500 QP', status: 'ACTIVE', type: 'ELITE' },
        { title: 'KNOWLEDGE BOWL', desc: 'Win 3 high-stakes games', progress: 1, max: 3, reward: '5,000 QP', status: 'CLAIM', type: 'ELITE' },
      ]
    },
    {
      title: 'Active Operations',
      quests: [
        { title: 'IDENTITY SYNC', desc: 'Set up your trivia profile', progress: 0, max: 1, reward: '1,000 QP', status: 'GO', type: 'STANDARD', action: onGoToProfile },
        { title: 'DAILY QUIZZER', desc: 'Play 3 games today', progress: 2, max: 3, reward: '250 QP', status: 'ACTIVE', type: 'STANDARD' },
        { title: 'SOCIAL SHARER', desc: 'Share on Solana Mobile', progress: 0, max: 1, reward: '500 QP', status: 'GO', type: 'STANDARD' },
        { title: 'TRIVIA TITAN', desc: '50 correct answers / 24h', progress: 42, max: 50, reward: '1,000 QP', status: 'ACTIVE', type: 'STANDARD' },
        { title: 'SOL SURFER', desc: 'Complete 10 transactions', progress: 8, max: 10, reward: '750 QP', status: 'ACTIVE', type: 'STANDARD' },
      ]
    }
  ];

  return (
    <div className="p-6 md:p-12 lg:p-20 max-w-[1400px] mx-auto pb-48 relative">
      {/* Brainy Mascot Decor */}
      <div className="absolute right-[5%] top-[10%] w-[150px] md:w-[350px] pointer-events-none z-0 opacity-10 floating hidden md:block">
        <img 
          src="brainy-idea.png" 
          alt="" 
          className="w-full h-auto"
          onError={(e) => (e.currentTarget.style.display = 'none')} 
        />
      </div>

      {/* Header Section - Fixed 'D' clipping */}
      <div className="relative z-10 mb-16">
        <div className="inline-block bg-[#00FFA3] text-black px-3 py-0.5 font-[1000] text-[11px] italic mb-4 tracking-[0.2em]">
          LOG: V2.5
        </div>
        <h1 className="text-6xl sm:text-7xl md:text-[110px] font-[1000] italic leading-[0.82] tracking-tight uppercase text-white mb-8 pr-12">
          MISSION<br />
          <span className="sol-gradient-text pr-6 inline-block">BOARD</span>
        </h1>
        
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#00FFA3] shadow-[0_0_10px_#00FFA3] animate-pulse"></div>
          <span className="text-white font-black uppercase text-[11px] tracking-[0.3em] italic">COMMUNITY MILESTONE</span>
        </div>
      </div>

      {/* Global Progress Bar Section */}
      <div className="mb-16 relative z-10 max-w-4xl">
        <div className="flex justify-between items-end mb-2">
            <span className="text-zinc-600 font-black uppercase text-[10px] tracking-widest italic">Server Progress</span>
            <span className="text-zinc-400 font-black text-xs italic tabular-nums">{globalProgress}%</span>
        </div>
        <div className="w-full h-3 bg-black rounded-full overflow-hidden border border-white/10 p-[2px] relative group">
            <div 
                className="h-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#00FFA3] transition-all duration-1000 ease-out relative"
                style={{ width: `${globalProgress}%` }}
            >
                <div className="absolute inset-0 bg-white/20 scan-line-horizontal"></div>
            </div>
            <div className="absolute top-0 left-[75%] w-[1px] h-full bg-white/20 z-20"></div>
        </div>
        <div className="flex justify-between mt-3">
           <span className="text-zinc-700 text-[9px] font-black uppercase tracking-widest">Shard: SOL-BRAIN-01</span>
           <span className="text-[#00FFA3] text-[9px] font-black uppercase tracking-widest animate-pulse">Next Yield Unlock at 75%</span>
        </div>
      </div>

      {/* Quests Container */}
      <div className="space-y-16 relative z-10">
        {questCategories.map((category, catIdx) => (
          <div key={catIdx}>
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.5em] whitespace-nowrap">{category.title}</h2>
              <div className="h-[1px] w-full bg-gradient-to-r from-white/10 to-transparent"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
              {category.quests.map((quest, qIdx) => (
                <QuestCard key={qIdx} quest={quest} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const QuestCard: React.FC<{ quest: any }> = ({ quest }) => {
  const isClaimable = quest.status === 'CLAIM';
  const isElite = quest.type === 'ELITE';
  const isActionable = quest.status === 'GO';
  
  return (
    <div className={`relative bg-[#0A0A0A] border transition-all duration-300 group overflow-hidden flex flex-col justify-between rounded-sm ${isClaimable ? 'border-[#00FFA3] ring-1 ring-[#00FFA3]/20' : 'border-white/5 hover:border-white/10'}`}>
      {isElite && (
        <div className="absolute top-0 right-0 px-3 py-1 bg-[#FFD700] text-black font-[1000] text-[8px] uppercase tracking-widest italic z-20">ELITE UNIT</div>
      )}
      
      <div className="p-6 md:p-10">
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1 min-w-0">
            <h3 className={`text-xl md:text-3xl font-[1000] italic uppercase tracking-tighter leading-none mb-2 truncate ${isClaimable ? 'text-[#00FFA3]' : 'text-white'}`}>
              {quest.title}
            </h3>
            <p className="text-zinc-500 text-[10px] md:text-xs font-black uppercase tracking-tight">
              {quest.desc}
            </p>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-end mb-2">
            <span className="text-zinc-700 text-[9px] font-black uppercase">Operation Progress</span>
            <span className="text-white text-[11px] font-black italic">{quest.progress}/{quest.max}</span>
          </div>
          <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
            <div 
                className={`h-full transition-all duration-700 ${isClaimable ? 'bg-[#00FFA3]' : 'bg-[#00FFA3]/30'}`} 
                style={{ width: `${(quest.progress/quest.max)*100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-6 md:px-10 md:pb-10">
        <div className="flex items-center justify-between gap-6">
           <div className="flex flex-col">
              <span className="text-zinc-700 text-[9px] font-black uppercase mb-1">Bounty</span>
              <span className="text-[#00FFA3] text-xl md:text-2xl font-[1000] italic leading-none">{quest.reward}</span>
           </div>
           
           <div className="flex-shrink-0 min-w-[120px]">
             {isClaimable ? (
                <button className="w-full py-3 bg-[#00FFA3] text-black font-black uppercase text-[10px] tracking-widest italic shadow-[0_0_20px_rgba(0,255,163,0.3)] hover:scale-[1.02] transition-transform">
                  CLAIM
                </button>
             ) : isActionable ? (
                <button 
                  onClick={() => quest.action && quest.action()}
                  className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-black uppercase text-[10px] tracking-widest italic text-center border border-white/10 transition-colors"
                >
                  GO
                </button>
             ) : (
               <div className="w-full py-3 bg-white/5 text-zinc-600 font-black uppercase text-[10px] tracking-widest italic text-center border border-white/5 opacity-50">
                 {quest.status}
               </div>
             )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default QuestsView;

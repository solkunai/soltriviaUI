
import React, { useState, useEffect } from 'react';

const QuestsView: React.FC = () => {
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
        { title: 'DAILY QUIZZER', desc: 'Play 3 games today', progress: 2, max: 3, reward: '250 QP', status: 'ACTIVE', type: 'STANDARD' },
        { title: 'SOCIAL SHARER', desc: 'Share on Solana Mobile', progress: 0, max: 1, reward: '500 QP', status: 'GO', type: 'STANDARD' },
        { title: 'TRIVIA TITAN', desc: '50 correct answers / 24h', progress: 42, max: 50, reward: '1,000 QP', status: 'ACTIVE', type: 'STANDARD' },
        { title: 'SOL SURFER', desc: 'Complete 10 transactions', progress: 8, max: 10, reward: '750 QP', status: 'ACTIVE', type: 'STANDARD' },
      ]
    }
  ];

  return (
    <div className="p-4 md:p-12 lg:p-20 max-w-[1400px] mx-auto pb-48 relative">
      {/* Brainy Mascot Decor */}
      <div className="absolute right-[-2%] top-[5%] w-[200px] md:w-[400px] pointer-events-none z-0 opacity-20 floating">
        <img 
          src="brainy-idea.png" 
          alt="" 
          className="w-full h-auto"
          onError={(e) => (e.currentTarget.style.display = 'none')} 
        />
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-6 relative z-10">
        <div className="relative">
          <span className="bg-[#00FFA3] text-black font-[1000] text-[8px] px-2 py-1 uppercase mb-3 inline-block italic z-10 relative tracking-widest">
            LOG: v2.5
          </span>
          <h1 className="text-4xl md:text-7xl font-[1000] italic leading-[0.8] tracking-tighter uppercase text-white z-10 relative">
            MISSION<br/><span className="sol-gradient-text">BOARD</span>
          </h1>
        </div>
        
        <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-sm text-left md:text-right min-w-[160px]">
            <span className="text-zinc-600 text-[8px] uppercase font-black block mb-1 tracking-widest">Global Rewards Pool</span>
            <span className="text-white text-xl md:text-3xl font-black italic tabular-nums">1.2M <span className="text-[#00FFA3] text-xs">QP</span></span>
        </div>
      </div>

      {/* Global Progress Bar Section */}
      <div className="mb-12 relative z-10">
        <div className="flex justify-between items-end mb-2">
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#00FFA3] rounded-full animate-pulse shadow-[0_0_8px_#00FFA3]"></div>
                <span className="text-white font-black uppercase text-[9px] tracking-[0.2em] italic">Community Milestone</span>
            </div>
            <span className="text-zinc-500 font-black text-[10px] italic">{globalProgress}%</span>
        </div>
        <div className="w-full h-2.5 bg-black rounded-full overflow-hidden border border-white/5 p-[1.5px] relative group">
            {/* The actual progress fill */}
            <div 
                className="h-full bg-gradient-to-r from-[#3b82f6] via-[#00FFA3] to-[#10b981] transition-all duration-1000 ease-out relative"
                style={{ width: `${globalProgress}%` }}
            >
                <div className="absolute inset-0 bg-white/20 scan-line-horizontal"></div>
            </div>
            {/* Marker for next unlock */}
            <div className="absolute top-0 left-[75%] w-[2px] h-full bg-white/30 z-20"></div>
        </div>
        <p className="text-zinc-600 text-[8px] font-black uppercase tracking-widest mt-2 flex justify-between">
            <span>Server: SOL-BRAIN-01</span>
            <span className="text-[#00FFA3]">Next Loot Drop at 75%</span>
        </p>
      </div>

      {/* Quests Container */}
      <div className="space-y-12 relative z-10">
        {questCategories.map((category, catIdx) => (
          <div key={catIdx}>
            <div className="flex items-center gap-4 mb-5">
              <h2 className="text-zinc-600 font-black uppercase text-[8px] tracking-[0.4em] whitespace-nowrap">{category.title}</h2>
              <div className="h-[1px] w-full bg-gradient-to-r from-white/10 to-transparent"></div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-6">
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
  
  return (
    <div className={`relative bg-[#0A0A0A] border transition-all duration-300 group overflow-hidden flex flex-col justify-between ${isClaimable ? 'border-[#00FFA3] ring-1 ring-[#00FFA3]/20' : 'border-white/5 hover:border-white/10'}`}>
      {isElite && (
        <div className="absolute top-0 right-0 px-2 py-0.5 bg-[#FFD700] text-black font-[1000] text-[6px] uppercase tracking-widest italic z-20">ELITE</div>
      )}
      
      <div className="p-3 md:p-8">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0">
            <h3 className={`text-xs md:text-2xl font-black italic uppercase tracking-tighter leading-tight mb-1 truncate ${isClaimable ? 'text-[#00FFA3]' : 'text-white'}`}>
              {quest.title}
            </h3>
            <p className="text-zinc-600 text-[7px] md:text-[9px] font-black uppercase tracking-tight line-clamp-2 md:line-clamp-none">
              {quest.desc}
            </p>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-end mb-1">
            <span className="text-zinc-700 text-[6px] md:text-[8px] font-black uppercase">Progress</span>
            <span className="text-white text-[7px] md:text-[10px] font-black italic">{quest.progress}/{quest.max}</span>
          </div>
          <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-white/5">
            <div 
                className={`h-full transition-all duration-700 ${isClaimable ? 'bg-[#00FFA3]' : 'bg-[#00FFA3]/30'}`} 
                style={{ width: `${(quest.progress/quest.max)*100}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="p-3 pt-0 md:p-8 md:pt-0">
        <div className="flex flex-col gap-2">
           <div className="flex justify-between items-baseline">
              <span className="text-zinc-700 text-[6px] md:text-[8px] font-black uppercase">Bounty</span>
              <span className="text-[#00FFA3] text-sm md:text-xl font-[1000] italic">{quest.reward}</span>
           </div>
           {isClaimable ? (
              <button className="w-full py-2 bg-[#00FFA3] text-black font-black uppercase text-[8px] tracking-widest italic shadow-[0_0_15px_rgba(0,255,163,0.3)]">
                CLAIM
              </button>
           ) : (
             <div className="w-full py-1.5 bg-white/5 text-zinc-600 font-black uppercase text-[7px] tracking-widest italic text-center border border-white/5">
               {quest.status}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default QuestsView;

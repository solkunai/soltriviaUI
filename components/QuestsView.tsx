import React, { useState, useEffect } from 'react';

interface QuestsViewProps {
  onGoToProfile?: () => void;
  onOpenGuide?: () => void;
}

const QuestsView: React.FC<QuestsViewProps> = ({ onGoToProfile, onOpenGuide }) => {
  const [globalProgress, setGlobalProgress] = useState(64.2);
  const [raiderUrl, setRaiderUrl] = useState('');
  const [showRaiderInput, setShowRaiderInput] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalProgress(prev => (prev >= 99 ? 64.2 : +(prev + 0.01).toFixed(2)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const questCategories = [
    {
      title: 'Priority Missions',
      quests: [
        { title: 'GENESIS STREAK', desc: '7-day daily login chain', progress: 5, max: 7, reward: '1,500 QP', status: 'ACTIVE', type: 'ELITE' },
        { title: 'HEALING MASTER', desc: 'Secure 15 total Vitality Lives from the store', progress: 0, max: 15, reward: 'HEALER BADGE', status: 'ACTIVE', type: 'ELITE' },
        { title: 'KNOWLEDGE BOWL', desc: 'Win 3 high-stakes games', progress: 1, max: 3, reward: '5,000 QP', status: 'CLAIM', type: 'ELITE' },
      ]
    },
    {
      title: 'Social Operations',
      quests: [
        { 
          title: 'TRUE RAIDER', 
          desc: 'Like, RT & Reply to our latest tweet. Paste reply URL to verify.', 
          progress: 0, 
          max: 1, 
          reward: '2,500 QP', 
          status: 'RAID', 
          type: 'SOCIAL',
          isRaider: true,
          action: () => {
            window.open('https://x.com/solana', '_blank');
            setShowRaiderInput(true);
          }
        },
      ]
    },
    {
      title: 'Active Operations',
      quests: [
        { title: 'IDENTITY SYNC', desc: 'Set up your trivia profile', progress: 0, max: 1, reward: '1,000 QP', status: 'GO', type: 'STANDARD', action: onGoToProfile },
        { title: 'DAILY QUIZZER', desc: 'Play all 4 scheduled daily games', progress: 2, max: 4, reward: '250 QP', status: 'ACTIVE', type: 'STANDARD' },
      ]
    }
  ];

  return (
    <div className="min-h-full bg-[#050505] overflow-x-hidden safe-top relative flex flex-col">
      {/* Sticky Quests Header */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-[#050505] sticky top-0 z-[60]">
        <h2 className="text-2xl font-[1000] italic uppercase tracking-tighter text-white">QUESTS</h2>
        <button 
          onClick={onOpenGuide}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9945FF] via-[#3b82f6] to-[#14F195] flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <span className="text-white font-[1000] text-xl italic leading-none">?</span>
        </button>
      </div>

      <div className="p-6 md:p-12 lg:p-20 max-w-[1400px] mx-auto w-full pb-48 relative">
        <div className="relative z-10 mb-10 md:mb-16 flex flex-col md:flex-row md:items-end justify-between gap-6 md:gap-8">
          <div className="flex-1">
            <h1 className="text-5xl sm:text-7xl md:text-[110px] font-[1000] italic leading-[0.75] tracking-tight uppercase text-white pr-8">
              MISSION<br /><span className="sol-gradient-text">BOARD</span>
            </h1>
            <div className="h-1.5 w-16 md:w-20 bg-[#14F195] mt-4 md:mt-6 shadow-[0_0_15px_#14F195]"></div>
          </div>

          <div className="bg-[#0A0A0A] border border-white/5 p-6 md:p-8 rounded-2xl md:rounded-3xl text-left md:text-right min-w-[240px] md:min-w-[280px] shadow-2xl">
               <span className="text-zinc-500 text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] mb-1 md:mb-2 italic block">TRIVIA POINTS</span>
               <div className="flex items-baseline gap-2 md:justify-end">
                  <span className="text-[#14F195] text-4xl md:text-5xl font-[1000] italic leading-none tracking-tighter drop-shadow-[0_0_15px_rgba(20,241,149,0.3)]">8,402</span>
                  <span className="text-[#14F195] text-[10px] md:text-sm font-black italic">PTS</span>
               </div>
          </div>
        </div>

        <div className="space-y-12 md:space-y-16 relative z-10">
          {questCategories.map((category, catIdx) => (
            <div key={catIdx}>
              <div className="flex items-center gap-4 mb-6 md:mb-8">
                <h2 className="text-zinc-500 font-black uppercase text-[9px] md:text-[10px] tracking-[0.5em] whitespace-nowrap italic">{category.title}</h2>
                <div className="h-[1px] w-full bg-gradient-to-r from-white/10 to-transparent"></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10">
                {category.quests.map((quest, qIdx) => (
                  <QuestCard 
                    key={qIdx}
                    quest={quest} 
                    showInput={quest.isRaider && showRaiderInput} 
                    inputValue={raiderUrl}
                    onInputChange={setRaiderUrl}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const QuestCard: React.FC<{ quest: any, showInput?: boolean, inputValue?: string, onInputChange?: (v: string) => void }> = ({ quest, showInput, inputValue, onInputChange }) => {
  const isClaimable = quest.status === 'CLAIM';
  const progressPercent = Math.floor((quest.progress / quest.max) * 100);
  const timeLeftPercent = 100 - progressPercent;

  let badgeColor = 'bg-[#14F195]';
  let badgeLabel = 'MISSION';
  if (quest.type === 'ELITE') {
    badgeColor = 'bg-[#FFD700]';
    badgeLabel = 'ELITE UNIT';
  } else if (quest.type === 'SOCIAL') {
    badgeColor = 'bg-[#3b82f6]';
    badgeLabel = 'SOCIAL MISSION';
  }

  const statusText = quest.status === 'RAID' ? 'START RAID' : quest.status;

  return (
    <div className={`relative bg-[#050505] border rounded-sm p-4 md:p-8 flex flex-col transition-all duration-300 ${isClaimable ? 'border-[#14F195] shadow-[0_0_30px_rgba(20,241,149,0.1)]' : 'border-white/5'}`}>
      <div className={`absolute top-0 right-0 px-2 md:px-3 py-0.5 md:py-1 ${badgeColor} text-black font-[1000] text-[7px] md:text-[8px] uppercase tracking-widest italic rounded-bl-sm shadow-md`}>
        {badgeLabel}
      </div>
      
      <div className="mb-3 md:mb-6">
        <h3 className="text-xl md:text-3xl font-[1000] italic uppercase tracking-tighter mb-1 md:mb-2 text-[#14F195] leading-none">
          {quest.title}
        </h3>
        <p className="text-zinc-500 text-[9px] md:text-xs font-black uppercase tracking-tight leading-relaxed italic">
          {quest.desc}
        </p>
      </div>

      {showInput ? (
        <div className="mb-4 md:mb-8 animate-fade-in">
           <label className="text-[8px] md:text-[9px] font-black uppercase tracking-widest text-zinc-500 italic block mb-1 md:mb-2">Paste Post URL</label>
           <div className="flex gap-2">
              <input 
                type="text" 
                value={inputValue}
                onChange={(e) => onInputChange?.(e.target.value)}
                placeholder="https://x.com/..."
                className="flex-1 bg-black border border-white/10 p-2 md:p-3 text-white font-bold text-[10px] md:text-xs focus:outline-none focus:border-[#14F195]/50 transition-all rounded-sm"
              />
              <button className="px-3 md:px-4 bg-[#14F195] text-black font-black uppercase text-[8px] md:text-[9px] italic rounded-sm hover:scale-105 active:scale-95 shadow-md">
                VERIFY
              </button>
           </div>
        </div>
      ) : (
        <div className="mb-4 md:mb-8">
          <div className="flex justify-between items-end mb-1 md:mb-2">
            <span className="text-zinc-600 text-[8px] md:text-[9px] font-black uppercase italic tracking-widest">
              PROGRESS ({timeLeftPercent}% LEFT)
            </span>
            <span className="text-white text-[10px] md:text-sm font-[1000] italic">
              {quest.progress}/{quest.max}
            </span>
          </div>
          <div className="w-full h-1 md:h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
            <div className="h-full bg-[#14F195]" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      )}

      <div className="mt-auto flex items-end justify-between">
         <div className="flex flex-col">
            <span className="text-zinc-600 text-[7px] md:text-[8px] font-black uppercase italic mb-0.5 md:mb-1 tracking-widest">BOUNTY</span>
            <span className="text-[#14F195] text-lg md:text-3xl font-[1000] italic leading-none">{quest.reward}</span>
         </div>
         <button 
           onClick={() => quest.action && quest.action()} 
           className={`px-4 md:px-8 py-2 md:py-3 font-[1000] uppercase text-[9px] md:text-xs italic shadow-lg active:scale-95 transition-all rounded-sm ${isClaimable ? 'bg-[#14F195] text-black' : quest.status === 'RAID' ? 'bg-[#3b82f6] text-white' : 'bg-white/5 text-zinc-600'}`}
         >
           {statusText}
         </button>
      </div>
    </div>
  );
};

export default QuestsView;

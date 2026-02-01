
import React from 'react';

const QuestsView: React.FC = () => {
  const quests = [
    { title: 'DAILY QUIZZER', desc: 'Play 3 games today', progress: 2, max: 3, reward: '0.05 SOL', status: 'LOCKED', iconColor: 'bg-purple-900/30 text-purple-400' },
    { title: 'STREAK MASTER', desc: '5-Day login streak', progress: 5, max: 5, reward: '0.25 SOL', status: 'CLAIM', iconColor: 'bg-yellow-900/30 text-yellow-500' },
    { title: 'SOCIAL SHARER', desc: 'Share results on X', progress: 0, max: 1, reward: '0.10 SOL', status: 'GO', iconColor: 'bg-blue-900/30 text-blue-400' },
    { title: 'TRIVIA TITAN', desc: 'Get 10 perfect scores', progress: 7, max: 10, reward: '1.00 SOL', status: 'LOCKED', iconColor: 'bg-red-900/30 text-red-500' },
    { title: 'WHALE HUNTER', desc: 'Win a 10+ SOL prize pool', progress: 0, max: 1, reward: '2.50 SOL', status: 'LOCKED', iconColor: 'bg-zinc-800 text-zinc-400' },
    { title: 'EARLY BIRD', desc: 'Join a game in < 10s', progress: 1, max: 1, reward: '0.15 SOL', status: 'CLAIM', iconColor: 'bg-green-900/30 text-green-400' },
  ];

  return (
    <div className="p-12">
      <div className="flex justify-between items-end mb-12">
        <div>
          <span className="bg-[#FFD700] text-black font-black text-[9px] px-2 py-1 uppercase mb-4 inline-block">Active Missions</span>
          <h1 className="text-[120px] font-black italic leading-none tracking-tighter uppercase">Quests</h1>
        </div>
        <div className="flex gap-4">
          <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-sm">
            <span className="text-zinc-600 text-[9px] uppercase font-bold block mb-1">Total Earnings</span>
            <span className="text-[#00FFA3] text-2xl font-black italic">12.50 SOL</span>
          </div>
          <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-sm">
            <span className="text-zinc-600 text-[9px] uppercase font-bold block mb-1 text-right">Completed</span>
            <span className="text-white text-2xl font-black italic">42/100</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {quests.map((quest, idx) => (
          <div key={idx} className="bg-[#0A0A0A] border border-white/5 p-8 group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-gradient-to-bl from-white/5 to-transparent pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-3xl font-black italic italic uppercase tracking-tighter mb-1">{quest.title}</h3>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">{quest.desc}</p>
              </div>
              <div className={`w-12 h-12 flex items-center justify-center ${quest.iconColor}`}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /></svg>
              </div>
            </div>

            <div className="mb-10">
              <div className="flex justify-between items-center mb-2">
                <span className="text-zinc-600 text-[10px] font-bold uppercase">Progress</span>
                <span className={`text-[12px] font-bold ${quest.progress === quest.max ? 'text-[#00FFA3]' : 'text-zinc-400'}`}>{quest.progress} / {quest.max}</span>
              </div>
              <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-500 ${quest.progress === quest.max ? 'bg-[#00FFA3]' : 'bg-[#00FFA3]/50'}`} 
                    style={{ width: `${(quest.progress/quest.max)*100}%` }}
                ></div>
              </div>
            </div>

            <div className="flex justify-between items-end">
              <div>
                <span className="text-zinc-600 text-[9px] font-bold uppercase block mb-1">Reward</span>
                <span className="text-[#00FFA3] text-xl font-black italic">{quest.reward}</span>
              </div>
              
              {quest.status === 'LOCKED' && (
                <button className="bg-zinc-800 text-zinc-600 px-10 py-3 italic font-bold uppercase text-[10px] border border-white/5 cursor-not-allowed">Locked</button>
              )}
              {quest.status === 'CLAIM' && (
                <button className="bg-[#00FFA3] hover:bg-[#00e592] text-black px-10 py-3 italic font-black uppercase text-xs transition-colors shadow-[0_0_15px_rgba(0,255,163,0.3)]">Claim</button>
              )}
              {quest.status === 'GO' && (
                <button className="bg-[#FFD700] hover:bg-[#f2cc00] text-black px-10 py-3 italic font-black uppercase text-xs transition-colors">Go To X</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-[84px] right-0 h-16 bg-black border-t border-white/5 px-8 flex justify-between items-center z-20">
          <div className="flex items-center gap-8 text-[10px]">
              <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-zinc-500 font-bold uppercase">Solana Mainnet: Operational</span>
              </div>
              <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#00FFA3]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zM11 11H9v2h2v2h2v-2h2v-2h-2V9h-2v2z" /></svg>
                  <span className="text-zinc-500 font-bold uppercase">12,482 Quests Active</span>
              </div>
          </div>
          <div className="flex items-center gap-6">
              <span className="text-zinc-700 font-bold text-[9px]">V2.0.4-BETA</span>
              <button className="text-zinc-500 hover:text-white"><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" /></svg></button>
              <button className="text-zinc-500 hover:text-white relative">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6V10c0-3.07-1.63-5.64-4.5-6.32V3c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 4.36 6 6.92 6 10v6l-2 2v1h16v-1l-2-2z" /></svg>
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
          </div>
      </div>
    </div>
  );
};

export default QuestsView;

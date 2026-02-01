
import React from 'react';

const LeaderboardView: React.FC = () => {
  const topPlayers = [
    { rank: '#1', username: 'SOLANA_KING', level: 'GRANDMASTER', winnings: '1,240.50', avatar: 'https://picsum.photos/id/111/400/400?grayscale', isFirst: true, style: 'podium-gold' },
    { rank: '#2', username: 'CRYPTOWIZ_01', level: 'DIAMOND TIER', winnings: '450.20', avatar: 'https://picsum.photos/id/88/200/200?grayscale', style: 'podium-silver' },
    { rank: '#3', username: 'HODL_QUEEN', level: 'PLATINUM TIER', winnings: '285.15', avatar: 'https://picsum.photos/id/72/200/200?grayscale', style: 'podium-bronze' },
    { rank: '#4', username: 'SAMURAI_SOL', level: 'ELITE WARRIOR', winnings: '150.00', avatar: 'https://picsum.photos/id/168/200/200?grayscale', style: 'podium-elite' },
    { rank: '#5', username: 'NEODEV_X', level: 'MASTER CODER', winnings: '120.40', avatar: 'https://picsum.photos/id/64/200/200?grayscale', style: 'podium-elite' },
  ];

  const runnersUp = [
    { rank: '#6', username: 'GASFEES_HIGH', score: '21,900', reward: '+8.45 SOL', avatar: 'https://picsum.photos/id/20/40/40?grayscale' },
    { rank: '#1,204', username: 'YOU (SAGE)', score: '1,450', reward: '--', avatar: 'https://picsum.photos/id/21/40/40?grayscale', isHighlighted: true },
    { rank: '#7', username: 'RUGPULL_SURVIVOR', score: '19,420', reward: '--', avatar: 'https://picsum.photos/id/22/40/40?grayscale' },
  ];

  const desktopPodium = [topPlayers[3], topPlayers[1], topPlayers[0], topPlayers[2], topPlayers[4]];

  return (
    <div className="p-5 md:p-12 lg:p-20 max-w-[1500px] mx-auto pb-48 relative">
      {/* Brainy Mascot - Winning Pose */}
      <div className="absolute left-[2%] top-[5%] w-[300px] pointer-events-none z-0 hidden xl:block opacity-60 floating">
        <img 
          src="brainy-winning.png" 
          alt="Brainy Winner" 
          className="w-full h-auto drop-shadow-[0_0_50px_rgba(255,215,0,0.3)]"
          onError={(e) => (e.currentTarget.style.display = 'none')} 
        />
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 md:mb-24 gap-6 md:gap-8 relative z-10">
        <div className="w-full md:w-auto">
          <h4 className="text-[#00FFA3] text-[9px] md:text-sm tracking-[0.4em] font-black uppercase mb-2 animate-pulse">
            Protocol Apex Global Ranking
          </h4>
          <h2 className="text-5xl md:text-7xl lg:text-8xl font-[1000] italic uppercase tracking-tighter text-white leading-[0.8] pr-8">
            TOP<br/><span className="sol-gradient-text pr-4 inline-block">RANKINGS</span>
          </h2>
        </div>
        <div className="bg-[#0A0A0A] border border-white/10 p-4 md:p-6 rounded-sm text-left md:text-right backdrop-blur-md w-full md:min-w-[280px]">
            <span className="text-zinc-600 text-[8px] md:text-[10px] uppercase font-black block mb-1 tracking-widest">Seasonal Yield Pool</span>
            <span className="text-[#FFD700] text-2xl md:text-4xl font-black italic tabular-nums">12,500 <span className="text-xs md:text-sm">SOL</span></span>
        </div>
      </div>

      {/* MOBILE PODIUM: Hierarchical One-View Layout */}
      <div className="md:hidden flex flex-col gap-3 mb-16 relative z-10">
         <MobilePodiumCard player={topPlayers[0]} isProminent />
         <div className="grid grid-cols-2 gap-3">
            <MobilePodiumCard player={topPlayers[1]} />
            <MobilePodiumCard player={topPlayers[2]} />
            <MobilePodiumCard player={topPlayers[3]} />
            <MobilePodiumCard player={topPlayers[4]} />
         </div>
      </div>

      {/* DESKTOP PODIUM */}
      <div className="hidden md:flex flex-row items-end justify-center gap-4 lg:gap-8 mb-32 relative z-10 px-4">
        {desktopPodium.map((player, idx) => {
          const isWinner = player.rank === '#1';
          const isSecondThird = player.rank === '#2' || player.rank === '#3';
          const heightClass = isWinner ? 'h-[420px] lg:h-[480px]' : isSecondThird ? 'h-[320px] lg:h-[380px]' : 'h-[250px] lg:h-[310px]';
          const scaleClass = isWinner ? 'z-30 scale-110' : isSecondThird ? 'z-20 scale-95' : 'z-10 scale-90';
          
          return (
            <div key={idx} className={`relative flex flex-col items-center flex-shrink-0 w-56 lg:w-64 transition-all duration-700 ${scaleClass}`}>
              <div className={`absolute -top-4 px-4 py-1.5 font-black text-xl italic z-40 skew-x-[-10deg] ${isWinner ? 'bg-[#FFD700] text-black shadow-[0_0_20px_rgba(255,215,0,0.6)]' : 'bg-white text-black'}`}>
                {player.rank}
              </div>

              <div className="mb-6 relative">
                 <div className={`w-28 lg:w-32 h-28 lg:h-32 rounded-full border-4 ${isWinner ? 'border-[#FFD700]' : 'border-white/10'} overflow-hidden bg-[#111]`}>
                    <img src={player.avatar} alt={player.username} className="w-full h-full object-cover grayscale" />
                 </div>
              </div>
              
              <div className={`rounded-sm flex flex-col items-center w-full transition-all duration-500 overflow-hidden relative ${player.style} ${heightClass} justify-start pt-8 pb-8 px-4`}>
                <h3 className={`font-black uppercase tracking-tighter text-center mb-1 leading-tight break-words w-full ${isWinner ? 'text-xl md:text-2xl sol-gradient-text' : 'text-sm md:text-lg text-zinc-300'}`}>
                  {player.username}
                </h3>
                <p className="text-zinc-600 italic text-[9px] font-black mb-auto tracking-[0.2em] uppercase">{player.level}</p>
                <div className={`w-full border border-white/5 p-3 rounded-sm text-center backdrop-blur-md ${isWinner ? 'bg-[#FFD700]/5' : 'bg-black/40'}`}>
                  <span className="text-zinc-700 text-[8px] font-black uppercase block mb-1">Yield</span>
                  <span className={`font-black text-base lg:text-lg tabular-nums ${isWinner ? 'text-[#FFD700]' : 'text-[#00FFA3]'}`}>{player.winnings} <span className="text-[10px] opacity-70">SOL</span></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Table */}
      <div className="bg-[#0A0A0A] border border-white/10 overflow-hidden shadow-2xl relative z-10">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left min-w-[700px] border-collapse">
            <thead className="text-[8px] md:text-[10px] uppercase text-zinc-600 font-black tracking-widest border-b border-white/10">
              <tr>
                <th className="px-6 md:px-14 py-6 md:py-8">Rank</th>
                <th className="px-6 md:px-14 py-6 md:py-8">User</th>
                <th className="px-6 md:px-14 py-6 md:py-8 text-right">Score</th>
                <th className="px-6 md:px-14 py-6 md:py-8 text-right">Reward</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {runnersUp.map((player, idx) => (
                <tr key={idx} className={`group transition-all duration-300 hover:bg-white/[0.04] ${player.isHighlighted ? 'bg-[#00FFA3]/5 border-y border-[#00FFA3]/20' : ''}`}>
                  <td className="px-6 md:px-14 py-6 md:py-10 font-[1000] italic text-2xl md:text-4xl text-zinc-700">{player.rank}</td>
                  <td className="px-6 md:px-14 py-6 md:py-10">
                    <div className="flex items-center gap-4 md:gap-8">
                      <img src={player.avatar} className="w-10 h-10 md:w-14 md:h-14 grayscale group-hover:grayscale-0 transition-all border border-white/10 p-0.5 bg-[#111]" alt={player.username} />
                      <span className={`font-black text-lg md:text-2xl uppercase ${player.isHighlighted ? 'text-[#FFD700]' : 'text-zinc-400 group-hover:text-white'}`}>{player.username}</span>
                    </div>
                  </td>
                  <td className="px-6 md:px-14 py-6 md:py-10 text-right font-black italic text-xl md:text-3xl tabular-nums text-zinc-600">{player.score}</td>
                  <td className={`px-6 md:px-14 py-6 md:py-10 text-right font-[1000] italic text-xl md:text-3xl tabular-nums ${player.reward === '--' ? 'text-zinc-800' : 'text-[#00FFA3]'}`}>{player.reward}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MobilePodiumCard: React.FC<{ player: any, isProminent?: boolean }> = ({ player, isProminent }) => (
    <div className={`relative overflow-hidden border border-white/10 rounded-sm p-3 flex items-center gap-3 ${player.style} ${isProminent ? 'py-5' : ''}`}>
        <div className="relative flex-shrink-0 z-10">
            <div className={`w-12 h-12 ${isProminent ? 'w-16 h-16' : ''} rounded-full border-2 ${player.isFirst ? 'border-[#FFD700]' : 'border-white/10'} overflow-hidden bg-black/50`}>
                <img src={player.avatar} alt={player.username} className="w-full h-full object-cover grayscale" />
            </div>
            <div className={`absolute -top-1.5 -right-1.5 px-2 py-0.5 font-black text-[9px] italic ${player.isFirst ? 'bg-[#FFD700] text-black' : 'bg-white text-black'}`}>
                {player.rank}
            </div>
        </div>
        <div className="flex-1 min-w-0 z-10">
            <h3 className={`font-black uppercase tracking-tighter truncate ${isProminent ? 'text-xl sol-gradient-text' : 'text-xs text-white'}`}>
                {player.username}
            </h3>
            <div className="mt-0.5 flex items-baseline gap-1">
                <span className={`font-black italic ${isProminent ? 'text-lg text-[#00FFA3]' : 'text-sm text-[#00FFA3]'}`}>{player.winnings}</span>
                <span className="text-[7px] font-black text-zinc-600">SOL</span>
            </div>
        </div>
    </div>
);

export default LeaderboardView;

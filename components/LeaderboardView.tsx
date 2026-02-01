
import React from 'react';

const LeaderboardView: React.FC = () => {
  const topPlayers = [
    { rank: '#5', username: 'NEODEV_X', level: '64', winnings: '10.00', avatar: 'https://picsum.photos/id/64/200/200?grayscale' },
    { rank: '#3', username: 'HODL_QUEEN', level: '72', winnings: '285.15', avatar: 'https://picsum.photos/id/72/200/200?grayscale' },
    { rank: '#1', username: 'SOLANA_KING', level: 'GRANDMASTER', winnings: '1,240.50', avatar: 'https://picsum.photos/id/111/400/400?grayscale', isFirst: true },
    { rank: '#2', username: 'CRYPTOWIZ_01', level: '88', winnings: '450.20', avatar: 'https://picsum.photos/id/88/200/200?grayscale' },
    { rank: '#4', username: 'SAMURAI_SOL', level: '68', winnings: '12.50', avatar: 'https://picsum.photos/id/168/200/200?grayscale' },
  ];

  return (
    <div className="p-12 max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-12">
        <div>
          <h4 className="text-[#00FFA3] text-sm tracking-[0.4em] font-bold uppercase">Hall of Fame</h4>
          <h2 className="text-7xl font-[900] italic uppercase tracking-tighter">Leaderboard</h2>
        </div>
        <div className="flex gap-4">
          <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-sm min-w-[150px]">
            <span className="text-zinc-600 text-[9px] uppercase font-bold block mb-1">Season Ends In</span>
            <span className="text-[#FFD700] text-xl font-mono font-bold">14:22:05:08</span>
          </div>
          <div className="bg-[#0A0A0A] border border-white/5 p-4 rounded-sm min-w-[150px]">
            <span className="text-zinc-600 text-[9px] uppercase font-bold block mb-1">Global Players</span>
            <span className="text-white text-xl font-bold">142,850</span>
          </div>
        </div>
      </div>

      {/* Top Players Row */}
      <div className="flex items-end justify-center gap-4 mb-20">
        {topPlayers.map((player, idx) => (
          <div key={idx} className={`relative group ${player.isFirst ? 'scale-110 z-10' : 'scale-90 opacity-60'}`}>
            <div className={`absolute -top-4 -left-4 px-3 py-1 font-black text-xl z-20 ${player.isFirst ? 'bg-[#FFD700] text-black' : idx === 3 ? 'bg-[#94A3B8] text-black' : 'bg-blue-600 text-white'}`}>
              {player.rank}
            </div>
            <div className={`bg-[#0A0A0A] border-2 ${player.isFirst ? 'border-[#FFD700] p-6' : 'border-zinc-800 p-4'} flex flex-col items-center w-64`}>
              <div className={`relative overflow-hidden mb-4 ${player.isFirst ? 'w-40 h-40' : 'w-24 h-24'}`}>
                <img src={player.avatar} alt={player.username} className="w-full h-full object-cover grayscale brightness-75 group-hover:grayscale-0 group-hover:brightness-100 transition-all duration-300" />
                <div className="absolute inset-0 border border-white/10"></div>
              </div>
              <h3 className={`font-black uppercase tracking-tight text-center ${player.isFirst ? 'text-4xl sol-gradient-text' : 'text-xl'}`}>
                {player.username}
              </h3>
              <p className="text-[#FFD700] italic text-[10px] font-bold mb-6 tracking-widest">{player.level}</p>
              
              <div className="w-full bg-[#050505] p-3 border border-white/5 text-center">
                <span className="text-zinc-600 text-[8px] font-bold uppercase block">Winnings</span>
                <span className="text-[#00FFA3] font-black text-lg">{player.winnings} <span className="text-[10px] opacity-70">SOL</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table Section */}
      <div className="bg-[#0A0A0A] border border-white/5">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-[#FFD700]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" /></svg>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Global Rankings (6 - 1,000)</h3>
          </div>
          <div className="flex bg-[#050505] p-1 gap-1">
            <button className="px-6 py-2 text-[10px] font-bold text-zinc-500 uppercase">Daily</button>
            <button className="px-6 py-2 text-[10px] font-bold bg-[#00FFA3] text-black uppercase">All-Time</button>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest border-b border-white/5">
            <tr>
              <th className="px-8 py-4">Rank</th>
              <th className="px-8 py-4">Username</th>
              <th className="px-8 py-4 text-right">Score</th>
              <th className="px-8 py-4 text-right">Reward</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <RankingRow rank="#6" username="GASFEES_HIGH" avatar="https://picsum.photos/id/20/40/40?grayscale" score="21,900" reward="+8.45 SOL" rewardColor="text-[#00FFA3]" />
            <RankingRow rank="#1,204" username="YOU (CURRENT)" avatar="https://picsum.photos/id/21/40/40?grayscale" score="1,450" reward="+0.00 SOL" isHighlighted={true} />
            <RankingRow rank="#7" username="RUGPULL_SURVIVOR" avatar="https://picsum.photos/id/22/40/40?grayscale" score="19,420" reward="--" />
          </tbody>
        </table>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-10 right-10 flex items-center gap-4 z-50">
          <div className="bg-[#0A0A0A] border border-white/10 p-4 relative group cursor-pointer animate-pulse">
              <div className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Your Prize Claim</div>
              <div className="text-[#00FFA3] font-bold italic">READY TO WITHDRAW</div>
              <div className="absolute -top-12 left-0 w-full bg-black border border-white/20 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[8px] text-white whitespace-nowrap">Connect wallet to withdraw SOL</span>
              </div>
          </div>
          <button className="bg-[#00FFA3] hover:bg-[#00e592] transition-colors py-6 px-12 italic font-black text-2xl text-black">
            CLAIM REWARDS
          </button>
      </div>
    </div>
  );
};

const RankingRow: React.FC<{ rank: string, username: string, avatar: string, score: string, reward: string, rewardColor?: string, isHighlighted?: boolean }> = ({ rank, username, avatar, score, reward, rewardColor = "text-zinc-500", isHighlighted = false }) => (
  <tr className={`${isHighlighted ? 'bg-[#00FFA3]/5 border-y-2 border-[#FFD700]/30' : ''} hover:bg-white/5 transition-colors`}>
    <td className="px-8 py-6 font-black italic text-xl">{rank}</td>
    <td className="px-8 py-6">
      <div className="flex items-center gap-3">
        <img src={avatar} className="w-8 h-8 grayscale" alt={username} />
        <span className={`font-bold ${isHighlighted ? 'text-[#FFD700]' : ''}`}>{username}</span>
      </div>
    </td>
    <td className="px-8 py-6 text-right font-black italic text-lg">{score}</td>
    <td className={`px-8 py-6 text-right font-black ${rewardColor} italic text-lg`}>{reward}</td>
  </tr>
);

export default LeaderboardView;

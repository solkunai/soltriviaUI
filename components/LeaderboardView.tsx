import React, { useState } from 'react';

type RankPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';

interface PlayerStats {
  rank: string;
  username: string;
  winnings: string;
  avatar: string;
  score: string;
  correct: string;
  time: string;
  gamesPlayed: string;
}

interface LeaderboardViewProps {
  onOpenGuide?: () => void;
}

const LeaderboardView: React.FC<LeaderboardViewProps> = ({ onOpenGuide }) => {
  const [period, setPeriod] = useState<RankPeriod>('WEEKLY');
  
  const statsByPeriod = {
    'DAILY': { totalWon: '850.50' },
    'WEEKLY': { totalWon: '25,402' },
    'MONTHLY': { totalWon: '125,402' }
  };

  const allPlayers: PlayerStats[] = [
    { rank: '1', username: '@DIANA.LOVE', winnings: '1,240.50 SOL', avatar: 'https://picsum.photos/id/64/400/400?grayscale', score: '8,805', correct: '10/10', time: '42s', gamesPlayed: '242' },
    { rank: '2', username: '@JOHN_LIFE', winnings: '450.20 SOL', avatar: 'https://picsum.photos/id/1025/400/400?grayscale', score: '8,239', correct: '10/10', time: '48s', gamesPlayed: '185' },
    { rank: '3', username: '@PHIL.GAMER', winnings: '285.15 SOL', avatar: 'https://picsum.photos/id/168/400/400?grayscale', score: '7,987', correct: '9/10', time: '45s', gamesPlayed: '156' },
    { rank: '4', username: '@KENDAL4848', winnings: '150.00 SOL', avatar: 'https://picsum.photos/id/88/200/200?grayscale', score: '7,568', correct: '9/10', time: '52s', gamesPlayed: '120' },
    { rank: '5', username: '@SHIV.RAJPUT', winnings: '120.40 SOL', avatar: 'https://picsum.photos/id/20/200/200?grayscale', score: '7,532', correct: '8/10', time: '41s', gamesPlayed: '98' },
    { rank: '6', username: '@SAILY.STEWART45', winnings: '0.00 SOL', score: '7,218', correct: '8/10', time: '55s', avatar: 'https://picsum.photos/id/22/200/200?grayscale', gamesPlayed: '45' },
    { rank: '7', username: '@KABIR_SEN2345', winnings: '0.00 SOL', score: '7,199', correct: '8/10', time: '58s', avatar: 'https://picsum.photos/id/24/200/200?grayscale', gamesPlayed: '32' },
    { rank: '8', username: '@natalie.fun', winnings: '0.00 SOL', score: '6,980', correct: '7/10', time: '44s', avatar: 'https://picsum.photos/id/26/200/200?grayscale', gamesPlayed: '28' },
    { rank: '9', username: '@veronica6794', winnings: '0.00 SOL', score: '6,757', correct: '7/10', time: '51s', avatar: 'https://picsum.photos/id/28/200/200?grayscale', gamesPlayed: '15' },
    { rank: '10', username: '@lex.crypto', winnings: '0.00 SOL', score: '6,420', correct: '6/10', time: '39s', avatar: 'https://picsum.photos/id/32/200/200?grayscale', gamesPlayed: '10' },
  ];

  return (
    <div className="min-h-full bg-[#050505] text-white safe-top relative flex flex-col overflow-x-hidden">
      <style>{`
        .active-tab-shadow {
            box-shadow: 0 0 20px rgba(20, 241, 149, 0.4);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Persistent Sticky Header */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-[#050505] sticky top-0 z-[100]">
        <h2 className="text-2xl font-[1000] italic uppercase tracking-tighter">LEADERBOARD</h2>
        <button 
          onClick={onOpenGuide}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-[#9945FF] via-[#3b82f6] to-[#14F195] flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <span className="text-white font-[1000] text-xl italic leading-none">?</span>
        </button>
      </div>

      <div className="p-6 md:p-12 lg:p-20 max-w-[1400px] mx-auto w-full">
        {/* Title & Stats Section */}
        <div className="flex justify-between items-start mb-16">
          <div>
            <h1 className="text-5xl md:text-[100px] font-[1000] italic uppercase tracking-tighter leading-[0.75] pr-6">
              GLOBAL<br/>
              <span className="sol-gradient-text">LEGENDS</span>
            </h1>
            <div className="w-16 h-1 bg-[#14F195] mt-4 shadow-[0_0_10px_#14F195]"></div>
          </div>

          <div className="text-right">
            <span className="text-zinc-500 text-[9px] md:text-[11px] font-black uppercase tracking-widest italic block mb-1">TOTAL SOL WON</span>
            <div className="flex items-baseline justify-end gap-1">
               <span className="text-[#14F195] text-3xl md:text-6xl font-[1000] italic tracking-tighter tabular-nums leading-none">{statsByPeriod[period].totalWon}</span>
               <span className="text-[#14F195] text-sm md:text-xl font-black italic">SOL</span>
            </div>
          </div>
        </div>

        {/* Period Tabs */}
        <div className="flex justify-center mb-24 px-4">
          <div className="flex w-full max-w-md items-center justify-between bg-black/40 p-1.5 rounded-full border border-white/10">
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as RankPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 text-[11px] font-black uppercase tracking-[0.2em] py-3.5 rounded-full transition-all ${
                  period === p 
                    ? 'bg-[#14F195] text-black active-tab-shadow scale-105 shadow-xl shadow-[#14F195]/20' 
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* TOP PODIUM AREA */}
        <div>
          {/* Mobile Podium (Top 3) */}
          <div className="md:hidden flex items-end justify-center gap-2 mb-24 px-2">
            {[allPlayers[1], allPlayers[0], allPlayers[2]].map((player, idx) => {
              const isFirst = player.rank === '1';
              const rankColor = isFirst ? 'border-[#FFD700]' : player.rank === '2' ? 'border-zinc-500' : 'border-[#D97706]';
              const badgeColor = isFirst ? 'bg-[#FFD700]' : player.rank === '2' ? 'bg-zinc-400' : 'bg-[#D97706]';
              
              return (
                <div key={idx} className={`flex flex-col items-center flex-1 ${isFirst ? 'max-w-[150px] -translate-y-8' : 'max-w-[120px]'}`}>
                   <div className="relative mb-6">
                      <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-full border-[6px] ${rankColor} overflow-hidden bg-zinc-900 shadow-2xl`}>
                        <img src={player.avatar} className="w-full h-full object-cover grayscale" alt="" />
                      </div>
                      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full ${badgeColor} border-[3px] border-white flex items-center justify-center shadow-lg`}>
                        <span className="text-black font-[1000] italic text-[11px] leading-none">{player.rank}</span>
                      </div>
                   </div>
                   <div className="text-center space-y-1">
                     <p className="text-[11px] font-black italic uppercase text-white truncate w-full">{player.username}</p>
                     <p className="text-[#14F195] font-[1000] text-lg italic leading-none">{player.score}</p>
                     
                     {/* Mobile top 3 extra stats */}
                     <div className="flex flex-col items-center gap-0.5 pt-1.5 opacity-90">
                        <div className="flex items-center gap-1">
                            <span className="text-zinc-500 text-[6px] font-black italic uppercase leading-none">WON:</span>
                            <span className="text-[#14F195] text-[7px] font-black italic uppercase tracking-tighter leading-none">{player.winnings}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-zinc-600 text-[6px] font-black italic uppercase leading-none">GAMES:</span>
                            <span className="text-white text-[7px] font-black italic uppercase tracking-tighter leading-none">{player.gamesPlayed}</span>
                        </div>
                     </div>
                   </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Podium (Top 5) */}
          <div className="hidden md:flex items-end justify-center gap-10 lg:gap-14 mb-32">
            {[allPlayers[4], allPlayers[2], allPlayers[0], allPlayers[1], allPlayers[3]].map((player, idx) => {
              const rankInt = parseInt(player.rank);
              const isCenter = rankInt === 1;
              const isInner = rankInt === 2 || rankInt === 3;
              
              const size = isCenter ? 'w-56 h-56' : isInner ? 'w-44 h-44' : 'w-36 h-36';
              const containerY = isCenter ? '-translate-y-14' : isInner ? '-translate-y-6' : '';
              
              let rankColor = 'border-white/10';
              let badgeColor = 'bg-white/10 text-white';
              let glowColor = '';
              
              if (rankInt === 1) { 
                rankColor = 'border-[#FFD700]'; 
                badgeColor = 'bg-[#FFD700] text-black';
                glowColor = 'shadow-[0_0_60px_rgba(255,215,0,0.3)]';
              } else if (rankInt === 2) { 
                rankColor = 'border-[#E2E2E2]'; 
                badgeColor = 'bg-[#E2E2E2] text-black';
                glowColor = 'shadow-[0_0_40px_rgba(226,226,226,0.2)]';
              } else if (rankInt === 3) { 
                rankColor = 'border-[#CD7F32]'; 
                badgeColor = 'bg-[#CD7F32] text-white';
                glowColor = 'shadow-[0_0_40px_rgba(205,127,50,0.2)]';
              } else if (rankInt === 4) { 
                rankColor = 'border-[#9945FF]'; 
                badgeColor = 'bg-[#9945FF] text-white';
                glowColor = 'shadow-[0_0_30px_rgba(153,69,255,0.15)]';
              } else if (rankInt === 5) { 
                rankColor = 'border-[#3B82F6]'; 
                badgeColor = 'bg-[#3B82F6] text-white';
                glowColor = 'shadow-[0_0_30px_rgba(59,130,246,0.15)]';
              }

              return (
                <div key={idx} className={`flex flex-col items-center ${containerY} transition-all duration-500`}>
                   <div className="relative mb-6">
                      <div className={`${size} rounded-full border-[6px] ${rankColor} ${glowColor} overflow-hidden bg-zinc-900`}>
                        <img src={player.avatar} className="w-full h-full object-cover grayscale" alt="" />
                      </div>
                      <div className={`absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 lg:w-16 lg:h-16 rounded-full ${badgeColor} border-[4px] border-[#050505] flex items-center justify-center shadow-xl`}>
                        <span className="font-[1000] italic text-base lg:text-3xl leading-none">{player.rank}</span>
                      </div>
                   </div>
                   <div className="text-center">
                     <p className="font-[1000] italic uppercase text-white text-base lg:text-2xl mb-1 tracking-tight">{player.username}</p>
                     <p className="text-[#14F195] font-[1000] text-2xl lg:text-5xl italic leading-none">{player.score}</p>
                     <div className="flex items-center justify-center gap-3 mt-3">
                        <span className="text-zinc-500 font-black italic text-[10px] uppercase">{player.winnings}</span>
                        <div className="w-1 h-1 bg-zinc-700 rounded-full"></div>
                        <span className="text-zinc-500 font-black italic text-[10px] uppercase">{player.correct}</span>
                     </div>
                   </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RANKINGS LIST SECTION */}
        <div className="pb-48">
          {/* Desktop Version: Sleek Row-Based Layout */}
          <div className="hidden md:block space-y-4">
              <div className="flex items-center gap-4 px-10 text-xs font-black text-zinc-600 uppercase tracking-widest italic border-b border-white/5 pb-6">
                <span className="w-12 text-center">Rank</span>
                <span className="w-20">Avatar</span>
                <span className="flex-1">Identity</span>
                <span className="w-32 text-center">Accuracy</span>
                <span className="w-32 text-center">Time Taken</span>
                <span className="w-40 text-right">Trivia Points</span>
              </div>
              {allPlayers.slice(5).map((player, idx) => (
                <div key={idx} className="flex items-center gap-8 p-6 bg-white/[0.02] border border-white/5 rounded-2xl group hover:bg-white/[0.04] transition-all duration-300">
                    <span className="w-12 text-center font-[1000] italic text-zinc-600 group-hover:text-[#14F195] text-4xl tabular-nums transition-colors leading-none">{player.rank}</span>
                    <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 grayscale group-hover:grayscale-0 transition-all flex-shrink-0">
                        <img src={player.avatar} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 truncate">
                        <p className="font-[1000] italic text-2xl uppercase text-white truncate tracking-tight">{player.username}</p>
                        <p className="text-xs font-bold text-zinc-500 mt-1 uppercase">Sol Won: {player.winnings}</p>
                    </div>
                    <div className="w-32 text-center font-black italic text-xl text-white">{player.correct}</div>
                    <div className="w-32 text-center font-black italic text-xl text-[#14F195]">{player.time}</div>
                    <div className="w-40 text-right">
                        <p className="text-white font-[1000] italic text-4xl leading-none tabular-nums group-hover:text-[#14F195] transition-colors">{player.score}</p>
                        <p className="text-zinc-600 text-[10px] font-black uppercase italic tracking-widest mt-1">TRIVIA PTS</p>
                    </div>
                </div>
              ))}
          </div>

          {/* Mobile Version: Compact Row Layout */}
          <div className="md:hidden space-y-2">
            {allPlayers.slice(3).map((player, idx) => {
              let rankColor = 'text-zinc-600';
              let scoreColor = 'text-[#14F195]';
              let cardStyle = 'bg-zinc-900/40 border-white/5';
              
              if (player.rank === '4') {
                  rankColor = 'text-[#9945FF]';
                  cardStyle = 'bg-[#9945FF]/5 border-[#9945FF]/10';
              } else if (player.rank === '5') {
                  rankColor = 'text-[#3b82f6]';
                  cardStyle = 'bg-[#3b82f6]/5 border-[#3b82f6]/10';
              }

              return (
                <div key={idx} className={`${cardStyle} border rounded-xl p-3 flex items-center gap-3 relative overflow-hidden transition-all active:scale-[0.98]`}>
                  <span className={`${rankColor} text-2xl font-[1000] italic leading-none w-8 text-center tabular-nums`}>
                    {player.rank}
                  </span>
                  
                  <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 grayscale flex-shrink-0">
                      <img src={player.avatar} className="w-full h-full object-cover" alt="" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                      <p className="font-[1000] italic text-[13px] uppercase text-white truncate tracking-tight leading-tight mb-0.5">{player.username}</p>
                      <div className="flex items-center gap-2">
                         <span className="text-zinc-500 text-[7px] font-black uppercase italic tracking-tighter">{player.correct}</span>
                         <span className="w-0.5 h-0.5 rounded-full bg-zinc-700"></span>
                         <span className="text-[#14F195]/60 text-[7px] font-black uppercase italic tracking-tighter">{player.time}</span>
                         <span className="w-0.5 h-0.5 rounded-full bg-zinc-700"></span>
                         <span className="text-zinc-500 text-[7px] font-black uppercase italic tracking-tighter truncate max-w-[50px]">{player.winnings}</span>
                      </div>
                  </div>
                  
                  <div className="text-right flex-shrink-0">
                      <p className={`${scoreColor} font-[1000] italic text-lg leading-none tabular-nums`}>{player.score}</p>
                      <p className="text-zinc-600 text-[6px] font-black uppercase italic tracking-widest leading-none mt-1">POINTS</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeaderboardView;

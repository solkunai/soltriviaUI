
import React from 'react';

const ProfileView: React.FC = () => {
  return (
    <div className="p-12 max-w-7xl mx-auto pb-32">
      {/* Profile Header Card */}
      <div className="bg-[#0A0A0A] border border-white/5 p-10 mb-8 flex items-center gap-12 relative overflow-hidden">
        <div className="relative group">
            <div className="w-48 h-48 bg-zinc-800 relative overflow-hidden border-2 border-zinc-700">
                <img src="https://picsum.photos/id/237/400/400?grayscale" alt="Avatar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-[#00FFA3] text-black font-black text-xs px-3 py-1 italic">LVL 42</div>
        </div>

        <div className="flex-1">
            <h1 className="text-8xl font-black sol-gradient-text italic leading-none mb-6 uppercase">Solana_Sage</h1>
            <div className="flex items-center gap-4">
                <div className="bg-[#050505] border border-white/10 px-4 py-2 rounded-sm flex items-center gap-3">
                    <div className="w-6 h-6 bg-[#00FFA3]/20 flex items-center justify-center text-[#00FFA3]">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </div>
                    <span className="text-xs text-zinc-400 font-mono tracking-widest">7xVp . . . 9K2m</span>
                    <button className="text-zinc-600 hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
                    </button>
                </div>
            </div>
        </div>

        <div className="text-right">
            <span className="text-zinc-600 text-[9px] uppercase font-bold tracking-[0.3em] block mb-2">Member Since</span>
            <span className="text-white text-3xl font-black italic uppercase">Jan 2024</span>
        </div>

        <div className="absolute -right-20 -top-20 text-[200px] font-black italic text-white/[0.02] pointer-events-none select-none">
            #842
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-4 gap-6 mb-12">
          <ProfileStatCard icon="wallet" label="TOTAL SOL WON" value="124.50" unit="SOL" />
          <ProfileStatCard icon="trophy" label="LIFETIME RANK" value="#842" />
          <ProfileStatCard icon="fire" label="CURRENT STREAK" value="12" suffix="🔥" />
          <ProfileStatCard icon="help" label="QUESTIONS ANSWERED" value="2,408" />
      </div>

      {/* Recent Games Table */}
      <div className="bg-[#0A0A0A] border border-white/5">
        <div className="p-8 border-b border-white/5 flex justify-between items-end">
            <h2 className="text-5xl font-black italic uppercase tracking-tighter">Recent Games</h2>
            <button className="text-zinc-500 hover:text-white text-[10px] font-bold uppercase tracking-widest pb-1 transition-colors">View All History</button>
        </div>
        <table className="w-full">
            <thead className="text-[9px] uppercase text-zinc-600 font-bold tracking-widest border-b border-white/5 text-left">
                <tr>
                    <th className="px-10 py-4">Date</th>
                    <th className="px-10 py-4">Competition Name</th>
                    <th className="px-10 py-4 text-center">Score</th>
                    <th className="px-10 py-4 text-center">Ranking</th>
                    <th className="px-10 py-4 text-right">SOL Earned</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
                <tr className="hover:bg-white/5 transition-colors group">
                    <td className="px-10 py-8 font-black uppercase text-zinc-300">Oct 12, 2024</td>
                    <td className="px-10 py-8 font-black uppercase text-[#00FFA3] group-hover:underline cursor-pointer">The Genesis Pool #224</td>
                    <td className="px-10 py-8 text-center font-black italic text-zinc-300">18/20</td>
                    <td className="px-10 py-8 text-center font-black italic text-zinc-300">#04</td>
                    <td className="px-10 py-8 text-right font-black italic text-[#00FFA3] text-xl">+2.50 SOL</td>
                </tr>
                <tr className="hover:bg-white/5 transition-colors group">
                    <td className="px-10 py-8 font-black uppercase text-zinc-300">Oct 11, 2024</td>
                    <td className="px-10 py-8 font-black uppercase text-[#00FFA3] group-hover:underline cursor-pointer">Sol Speedrun Sprint</td>
                    <td className="px-10 py-8 text-center font-black italic text-zinc-300">15/20</td>
                    <td className="px-10 py-8 text-center font-black italic text-zinc-300">#112</td>
                    <td className="px-10 py-8 text-right font-black italic text-[#00FFA3] text-xl">+0.15 SOL</td>
                </tr>
            </tbody>
        </table>
      </div>

      {/* Footer Connectivity Bar */}
      <div className="fixed bottom-0 left-[84px] right-0 h-16 bg-black border-t border-white/5 px-10 flex justify-between items-center z-30">
        <div className="flex items-center gap-10">
            <div className="flex items-center gap-4">
                <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Wallet</span>
                <div className="w-24 h-1 bg-zinc-800 overflow-hidden rounded-full">
                    <div className="w-3/4 h-full bg-zinc-600"></div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">Security</span>
                <div className="flex items-center gap-2 text-[9px] font-bold text-white uppercase">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    Hardware Encrypted
                </div>
            </div>
        </div>
        <div className="flex items-center gap-8">
            <div className="text-right">
                <span className="text-[7px] text-zinc-700 font-bold uppercase block tracking-widest">Network</span>
                <span className="text-[9px] text-white font-bold uppercase">Solana Mainnet-Beta</span>
            </div>
            <button className="bg-[#FFD700] hover:bg-[#f2cc00] text-black px-6 py-2 italic font-black text-[10px] uppercase transition-colors">Disconnect</button>
        </div>
      </div>
    </div>
  );
};

const ProfileStatCard: React.FC<{ icon: string, label: string, value: string, unit?: string, suffix?: string }> = ({ icon, label, value, unit, suffix }) => (
    <div className="bg-[#0A0A0A] border border-white/5 p-8 flex flex-col items-start">
        <div className="flex justify-between w-full mb-10 items-start">
            <div className={`w-12 h-12 flex items-center justify-center ${icon === 'wallet' ? 'bg-green-900/20 text-green-400' : icon === 'trophy' ? 'bg-yellow-900/20 text-yellow-500' : icon === 'fire' ? 'bg-red-900/20 text-red-500' : 'bg-purple-900/20 text-purple-400'}`}>
                {icon === 'wallet' && <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M21 18v1c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2h14c1.1 0 2 .9 2 2v1h-9c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h9zm-9-2h10V8H12v8zm4-2.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" /></svg>}
                {icon === 'trophy' && <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v3c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0011 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 003.61-1.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" /></svg>}
                {icon === 'fire' && <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8c0-3.12-1.21-5.96-3.17-8.07l-1.33 1.33c.69 1 1.1 2.21 1.1 3.51 0 3.31-2.69 6-6 6s-6-2.69-6-6c0-1.63.65-3.11 1.71-4.2l.06.06c.09.11.19.22.3.31 1.25 1.13 3.32.72 4.02-1.02.1-.26.15-.53.15-.81 0-1.84-1.25-3.84-1.25-3.84z" /></svg>}
                {icon === 'help' && <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z" /></svg>}
            </div>
            <div className="flex gap-1">
                <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
                <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
            </div>
        </div>
        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest block mb-2">{label}</span>
        <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white italic leading-none">{value}</span>
            {unit && <span className="text-[#00FFA3] font-black text-xs italic">{unit}</span>}
            {suffix && <span className="text-xl">{suffix}</span>}
        </div>
    </div>
);

export default ProfileView;

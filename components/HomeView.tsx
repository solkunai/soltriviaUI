
import React from 'react';

interface HomeViewProps {
  onEnterTrivia: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onEnterTrivia }) => {
  return (
    <div className="flex h-full">
      {/* Left Main Content */}
      <div className="flex-1 p-20 flex flex-col justify-center">
        <div className="mb-6">
          <span className="bg-[#1A1A1A] text-zinc-400 text-[10px] tracking-[0.3em] font-bold py-2 px-6 border border-white/5 uppercase">
            Testing your crypto knowledge
          </span>
        </div>
        
        <h1 className="text-[180px] font-[900] leading-[0.85] sol-gradient-text italic uppercase mb-12 tracking-tight">
          SOL<br />TRIVIA
        </h1>

        <button 
          onClick={onEnterTrivia}
          className="group relative w-full max-w-md bg-[#00FFA3] hover:bg-[#00e592] transition-colors py-10 px-12 flex items-center justify-between"
        >
          <div className="text-black italic font-black text-4xl leading-tight">
            ENTER<br />TRIVIA
          </div>
          <svg className="w-12 h-12 text-black transition-transform group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>

        <div className="mt-20 flex gap-6">
          <StatCard icon="wallet" label="AVAILABLE BALANCE" value="--" />
          <StatCard icon="heart" label="REMAINING LIVES" value="--" />
          <StatCard icon="trophy" label="GLOBAL RANKING" value="--" />
        </div>
      </div>

      {/* Right Sidebar - Prize Pool Info */}
      <div className="w-[380px] bg-[#0A0A0A] border-l border-white/5 p-8 flex flex-col">
        <div className="relative aspect-[4/3] rounded-sm overflow-hidden mb-8">
            <img src="https://picsum.photos/400/300?grayscale" alt="Featured" className="w-full h-full object-cover opacity-60" />
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-[#0A0A0A] to-transparent"></div>
            <div className="absolute top-4 left-4 bg-[#FFD700] text-black font-bold text-[8px] px-2 py-1">FEATURED SESSION</div>
        </div>

        <div className="text-center">
            <span className="text-[#00FFA3] text-[10px] tracking-[0.2em] font-bold">NEXT COMPETITION</span>
            <h3 className="text-zinc-500 font-bold text-xs mt-2">PRIZE POOL STATUS</h3>
            <div className="text-[90px] font-black text-white leading-none my-4">50.5</div>
            <div className="text-blue-400 font-bold text-lg tracking-[0.5em] uppercase">SOLANA</div>
        </div>

        <div className="mt-auto bg-[#050505] p-6 rounded-sm border border-white/5 flex flex-col items-center">
            <div className="flex items-center gap-3 text-[#00FFA3] mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-2xl font-mono font-bold">04:12:30</span>
            </div>
            <span className="text-zinc-600 text-[9px] font-bold tracking-widest uppercase">Registration closing soon</span>
        </div>

        <div className="mt-12 space-y-4 pt-8 border-t border-white/5">
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500 uppercase font-bold">Network Status</span>
                <div className="flex items-center gap-2 text-white">
                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    SOLANA MAINNET
                </div>
            </div>
            <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500 uppercase font-bold">Active Players</span>
                <span className="text-[#00FFA3] font-bold">12,482 ONLINE</span>
            </div>
            <p className="text-[8px] text-zinc-700 text-center mt-4">© 2024 SOL TRIVIA PROTOCOL V2.0</p>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ icon: string, label: string, value: string }> = ({ icon, label, value }) => (
  <div className="flex-1 bg-[#0A0A0A] border border-white/5 p-6 rounded-sm">
    <div className="flex justify-between items-start mb-10">
      <div className="w-10 h-10 bg-[#00FFA3]/10 flex items-center justify-center text-[#00FFA3]">
        {icon === 'wallet' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
        {icon === 'heart' && <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>}
        {icon === 'trophy' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
      </div>
      <div className="flex gap-0.5">
          <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
          <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
          <div className="w-1 h-1 bg-zinc-800 rounded-full"></div>
      </div>
    </div>
    <div className="text-zinc-500 text-[10px] font-bold tracking-widest uppercase">{label}</div>
    <div className="text-2xl font-bold mt-1 text-zinc-300 italic">{value}</div>
  </div>
);

export default HomeView;

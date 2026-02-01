
import React from 'react';

interface ProfileViewProps {
  username: string;
  avatar: string;
  onEdit: () => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ username, avatar, onEdit }) => {
  return (
    <div className="p-6 md:p-12 max-w-7xl mx-auto pb-40 relative">
      {/* Brainy Mascot - Thinking Pose */}
      <div className="absolute right-[5%] bottom-[10%] w-[300px] pointer-events-none z-0 hidden lg:block opacity-40">
        <img 
          src="brainy-worried.png" 
          alt="Brainy Thinking" 
          className="w-full h-auto drop-shadow-[0_0_40px_rgba(168,85,247,0.3)]"
          onError={(e) => (e.currentTarget.style.display = 'none')} 
        />
      </div>

      {/* Profile Header Card */}
      <div className="bg-[#0A0A0A] border border-white/5 p-6 md:p-10 mb-8 flex flex-col md:flex-row items-center gap-6 md:gap-12 relative overflow-hidden z-10">
        <div className="relative group flex-shrink-0">
            <div className="w-32 h-32 md:w-48 md:h-48 bg-zinc-800 relative overflow-hidden border-2 border-zinc-700">
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-[#00FFA3] text-black font-black text-[10px] md:text-xs px-2 md:px-3 py-1 italic">LVL 42</div>
        </div>

        <div className="flex-1 text-center md:text-left flex flex-col md:flex-row items-center md:items-end gap-4">
            <div className="flex-1">
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black sol-gradient-text italic leading-none mb-2 uppercase break-all">
                {username}
              </h1>
              <p className="text-zinc-600 text-[10px] font-black uppercase tracking-widest italic">Identity Sync: 100%</p>
            </div>
            <button 
              onClick={onEdit}
              className="px-6 py-2.5 bg-white/5 border border-white/10 hover:bg-[#00FFA3]/10 hover:border-[#00FFA3]/30 text-white hover:text-[#00FFA3] font-black uppercase text-[10px] tracking-widest italic transition-all"
            >
              Edit Profile
            </button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-12 relative z-10">
          <ProfileStatCard icon="wallet" label="TOTAL WON" value="124.50" unit="SOL" />
          <ProfileStatCard icon="trophy" label="RANK" value="#842" />
          <ProfileStatCard icon="fire" label="STREAK" value="12" suffix="🔥" />
          <ProfileStatCard icon="help" label="ANSWERS" value="2,408" />
      </div>

      {/* Recent Games Table */}
      <div className="bg-[#0A0A0A] border border-white/5 overflow-hidden relative z-10">
        <div className="p-6 md:p-8 border-b border-white/5">
            <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white">History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
              <tbody className="divide-y divide-white/5">
                  <tr className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 md:px-10 py-6 font-black uppercase text-[#00FFA3] text-sm italic">Genesis Pool #224</td>
                      <td className="px-6 md:px-10 py-6 text-center font-black italic text-zinc-300">#04</td>
                      <td className="px-6 md:px-10 py-6 text-right font-black italic text-[#00FFA3] text-lg tabular-nums">+2.50 SOL</td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors group opacity-50">
                      <td className="px-6 md:px-10 py-6 font-black uppercase text-zinc-500 text-sm italic">Cyber Arena #223</td>
                      <td className="px-6 md:px-10 py-6 text-center font-black italic text-zinc-600">#12</td>
                      <td className="px-6 md:px-10 py-6 text-right font-black italic text-zinc-600 text-lg tabular-nums">--</td>
                  </tr>
              </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const ProfileStatCard: React.FC<{ icon: string, label: string, value: string, unit?: string, suffix?: string }> = ({ label, value, unit, suffix }) => (
    <div className="bg-[#0A0A0A] border border-white/5 p-4 md:p-8 flex flex-col items-start overflow-hidden backdrop-blur-md shadow-lg group hover:border-white/10 transition-colors">
        <span className="text-[7px] md:text-[9px] text-zinc-600 font-bold uppercase tracking-widest block mb-1 md:mb-2 truncate w-full">{label}</span>
        <div className="flex items-baseline gap-1 md:gap-2">
            <span className="text-xl md:text-4xl font-black text-white italic leading-none">{value}</span>
            {unit && <span className="text-[#00FFA3] font-black text-[10px] italic">{unit}</span>}
            {suffix && <span className="text-base md:text-xl">{suffix}</span>}
        </div>
    </div>
);

export default ProfileView;


import React from 'react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: View.HOME, label: 'HOME', icon: (color: string) => (
      <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { id: View.QUESTS, label: 'QUESTS', icon: (color: string) => (
      <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { 
      id: View.PLAY, 
      label: 'PLAY', 
      isPlayButton: true 
    },
    { id: View.RANKS, label: 'RANKS', icon: (color: string) => (
      <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { id: View.PROFILE, label: 'PROFILE', icon: (color: string) => (
      <svg className="w-5 h-5" fill="none" stroke={color} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )},
  ];

  return (
    <>
      {/* Mobile Bottom Navigation - Replicating Screenshot Style */}
      <nav className="md:hidden fixed bottom-6 left-6 right-6 bg-[#0A0A0A]/90 backdrop-blur-xl border border-white/5 grid grid-cols-5 h-[76px] z-[60] px-2 rounded-[24px] shadow-2xl items-center ring-1 ring-white/5">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          
          if (item.isPlayButton) {
            return (
              <div key={item.id} className="relative flex flex-col items-center justify-center">
                <button
                  onClick={() => setView(item.id)}
                  className="absolute -top-11 flex flex-col items-center justify-center outline-none group"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-[#818cf8] via-[#3b82f6] to-[#2dd4bf] rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(59,130,246,0.5)] border-[5px] border-[#0A0A0A] group-hover:scale-105 transition-transform">
                    <div className="w-8 h-8 rounded-full border-[1.5px] border-white flex items-center justify-center pl-0.5">
                        <svg className="w-3.5 h-3.5 text-white fill-white" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black tracking-tighter mt-1 ${isActive ? 'text-[#00FFA3]' : 'text-zinc-500'}`}>
                    {item.label}
                  </span>
                </button>
              </div>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="flex flex-col items-center justify-center gap-1.5 w-full outline-none"
            >
              <div className="transition-all duration-300">
                {item.icon && item.icon(isActive ? '#00FFA3' : '#52525b')}
              </div>
              <span className={`text-[9px] font-black tracking-tighter transition-colors ${isActive ? 'text-[#00FFA3]' : 'text-zinc-600'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Desktop Sidebar (Simplified) */}
      <aside className="hidden md:flex w-[84px] h-full bg-[#050505] border-r border-white/10 flex-col items-center py-10 z-50">
        <div className="flex flex-col gap-12">
           {navItems.map(item => (
              <button 
                key={item.id} 
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center gap-1.5 transition-all ${currentView === item.id ? 'text-[#00FFA3] scale-110' : 'text-zinc-600 hover:text-white'}`}
              >
                {item.icon && item.icon(currentView === item.id ? '#00FFA3' : 'currentColor')}
                <span className="text-[9px] font-black">{item.label}</span>
              </button>
           ))}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

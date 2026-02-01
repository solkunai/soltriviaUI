
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
    { id: View.LEADERBOARD, label: 'LEADERBOARD', icon: (color: string) => (
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
      {/* Mobile Bottom Navigation - Docked to bottom to prevent bleed-through */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#080808] border-t border-white/10 grid grid-cols-5 h-[84px] z-[60] px-2 shadow-[0_-10px_40px_rgba(0,0,0,0.8)] items-center safe-bottom">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          
          if (item.isPlayButton) {
            return (
              <div key={item.id} className="relative flex justify-center items-center h-full">
                <button
                  onClick={() => setView(item.id)}
                  className="absolute bottom-6 flex flex-col items-center outline-none group"
                >
                  <div className="relative flex items-center justify-center">
                    {/* Concentric Aura Ring */}
                    <div className="absolute w-[80px] h-[80px] bg-gradient-to-br from-[#8B5CF6]/25 to-[#2DD4BF]/25 rounded-full blur-[4px] z-0 opacity-80 group-hover:scale-110 transition-transform duration-300"></div>
                    
                    {/* Main Circle - Vibrant Gradient */}
                    <div className="w-[64px] h-[64px] bg-gradient-to-br from-[#8B5CF6] via-[#3B82F6] to-[#2DD4BF] rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.6)] relative z-10 border border-white/20 active:scale-95 transition-all">
                      {/* Play Triangle */}
                      <svg className="w-7 h-7 text-white fill-current translate-x-[2px]" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* PLAY Text */}
                  <span className={`text-[10px] font-[1000] tracking-[0.25em] mt-3 uppercase transition-colors select-none ${isActive ? 'text-[#00FFA3]' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
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
              className="flex flex-col items-center justify-center gap-1.5 w-full h-full outline-none"
            >
              <div className="transition-all duration-300">
                {item.icon && item.icon(isActive ? '#00FFA3' : '#3f3f46')}
              </div>
              <span className={`text-[9px] font-black tracking-tighter transition-colors select-none ${isActive ? 'text-[#00FFA3]' : 'text-zinc-600'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-[84px] h-full bg-[#050505] border-r border-white/10 flex-col items-center py-10 z-50">
        <div className="flex flex-col gap-10 items-center">
           {navItems.map(item => {
              const isActive = currentView === item.id;
              
              if (item.isPlayButton) {
                return (
                  <button 
                    key={item.id} 
                    onClick={() => setView(item.id)}
                    className="relative group outline-none flex flex-col items-center"
                  >
                    <div className="relative flex items-center justify-center">
                      <div className="absolute w-[68px] h-[68px] bg-white/5 rounded-full blur-[1px] opacity-40 group-hover:scale-110 transition-transform"></div>
                      
                      <div className={`w-14 h-14 bg-gradient-to-br from-[#8B5CF6] via-[#3B82F6] to-[#2DD4BF] rounded-full flex items-center justify-center shadow-lg border border-white/10 group-hover:scale-110 transition-all relative z-10 ${isActive ? 'ring-2 ring-[#00FFA3] ring-offset-4 ring-offset-[#050505]' : ''}`}>
                        <svg className="w-6 h-6 text-white fill-current translate-x-[2px]" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                    <span className={`text-[10px] font-[1000] uppercase tracking-[0.15em] mt-3 block text-center transition-colors select-none ${isActive ? 'text-[#00FFA3]' : 'text-zinc-500 group-hover:text-white'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              }

              return (
                <button 
                  key={item.id} 
                  onClick={() => setView(item.id)}
                  className={`flex flex-col items-center gap-1.5 transition-all outline-none ${isActive ? 'text-[#00FFA3] scale-110' : 'text-zinc-600 hover:text-white'}`}
                >
                  <div className="transition-all duration-300">
                    {item.icon && item.icon(isActive ? '#00FFA3' : 'currentColor')}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-tighter select-none">{item.label}</span>
                </button>
              );
           })}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

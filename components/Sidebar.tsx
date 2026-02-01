import React from 'react';
import { View } from '../types';

interface SidebarProps {
  currentView: View;
  setView: (view: View) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: View.HOME, label: 'HOME', icon: (color: string) => (
      <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth={1.5} viewBox="0 0 24 24">
        <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    )},
    { id: View.QUESTS, label: 'QUESTS', icon: (color: string) => (
      <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth={1.5} viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { 
      id: View.PLAY, 
      label: 'PLAY', 
      isPlayButton: true 
    },
    { id: View.LEADERBOARD, label: 'LEADERBOARD', icon: (color: string) => (
      <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth={1.5} viewBox="0 0 24 24">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
    { id: View.PROFILE, label: 'PROFILE', icon: (color: string) => (
      <svg className="w-6 h-6" fill="none" stroke={color} strokeWidth={1.5} viewBox="0 0 24 24">
        <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )},
  ];

  const solanaGradient = "linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #14F195 100%)";

  return (
    <>
      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#050505] border-t border-white/5 grid grid-cols-5 h-[95px] z-[200] safe-bottom items-center px-1 shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          
          if (item.isPlayButton) {
            return (
              <div key={item.id} className="relative flex flex-col justify-center items-center h-full">
                <button
                  onClick={() => setView(item.id)}
                  className="flex flex-col items-center outline-none group -translate-y-4"
                >
                  <div className="relative mb-1">
                    <div className="absolute w-[80px] h-[80px] bg-[#14F195]/20 rounded-full blur-[20px] -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 opacity-60"></div>
                    <div 
                      className="w-[68px] h-[68px] rounded-full flex items-center justify-center shadow-2xl relative z-10 active:scale-90 transition-all border border-white/10"
                      style={{ background: solanaGradient }}
                    >
                      <svg className="w-8 h-8 text-white fill-current translate-x-[2px]" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                  <span className={`text-[9px] font-black tracking-widest uppercase transition-colors select-none italic ${isActive ? 'text-[#14F195]' : 'text-zinc-600'}`}>
                    {item.label}
                  </span>
                </button>
              </div>
            );
          }

          // Smaller font size for LEADERBOARD to ensure it fits mobile widths without overlap
          const labelSize = item.id === View.LEADERBOARD ? 'text-[7px]' : 'text-[9px]';

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="flex flex-col items-center justify-center gap-2 w-full h-full outline-none"
            >
              <div className="transition-all duration-300">
                {item.icon && item.icon(isActive ? '#14F195' : '#3f3f46')}
              </div>
              <span className={`${labelSize} font-black tracking-[0.15em] transition-colors select-none uppercase italic ${isActive ? 'text-[#14F195]' : 'text-zinc-600'}`}>
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
                    <div 
                      className="w-14 h-14 rounded-full flex items-center justify-center shadow-xl border border-white/20 group-hover:scale-110 transition-all relative z-10"
                      style={{ background: solanaGradient }}
                    >
                        <svg className="w-6 h-6 text-white fill-current translate-x-[2px]" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest mt-3 block text-center transition-colors select-none italic ${isActive ? 'text-[#14F195]' : 'text-zinc-500'}`}>
                      {item.label}
                    </span>
                  </button>
                );
              }

              return (
                <button 
                  key={item.id} 
                  onClick={() => setView(item.id)}
                  className={`flex flex-col items-center gap-2 transition-all outline-none ${isActive ? 'text-[#14F195] scale-110' : 'text-zinc-600 hover:text-white'}`}
                >
                  <div className="transition-all duration-300">
                    {item.icon && item.icon(isActive ? '#14F195' : 'currentColor')}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest select-none italic">{item.label}</span>
                </button>
              );
           })}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;

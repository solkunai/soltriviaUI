import React, { useState, useEffect } from 'react';
import WalletConnectButton from './WalletConnectButton';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { getBalanceSafely } from '../src/utils/balance';
import { fetchCurrentRoundStats, subscribeCurrentRoundStats, getCurrentRoundKey, getRoundLabel } from '../src/utils/api';

interface HomeViewProps {
  lives: number;
  onEnterTrivia: () => void;
  onOpenGuide: () => void;
  onOpenBuyLives: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ lives, onEnterTrivia, onOpenGuide, onOpenBuyLives }) => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [prizePool, setPrizePool] = useState(0);
  const [playersEntered, setPlayersEntered] = useState(0);
  const [nextRoundCountdown, setNextRoundCountdown] = useState('');

  // Calculate time until next round (6-hour intervals)
  const calculateNextRoundTime = () => {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinutes = now.getUTCMinutes();
    const currentSeconds = now.getUTCSeconds();
    
    // Rounds start at: 00:00, 06:00, 12:00, 18:00 UTC
    const roundStartHours = [0, 6, 12, 18];
    
    // Find the next round start hour
    let nextRoundHour = roundStartHours.find(h => h > currentHour);
    if (!nextRoundHour) {
      // If past 18:00, next round is 00:00 tomorrow
      nextRoundHour = 24; // Will become 00:00 next day
    }
    
    // Calculate time difference
    const hoursUntilNextRound = nextRoundHour - currentHour;
    const minutesUntilNextRound = 60 - currentMinutes;
    const secondsUntilNextRound = 60 - currentSeconds;
    
    // Adjust for minutes/seconds overflow
    let hours = hoursUntilNextRound - 1;
    let minutes = minutesUntilNextRound - 1;
    let seconds = secondsUntilNextRound;
    
    if (seconds === 60) {
      seconds = 0;
      minutes++;
    }
    if (minutes === 60) {
      minutes = 0;
      hours++;
    }
    
    // Format as HH:MM:SS
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Fetch wallet balance when connected
  useEffect(() => {
    if (connected && publicKey && connection) {
      setLoadingBalance(true);
      getBalanceSafely(connection, publicKey)
        .then((bal) => {
          setBalance(bal);
        })
        .finally(() => {
          setLoadingBalance(false);
        });
    } else {
      setBalance(null);
    }
  }, [connected, publicKey, connection]);

  // Countdown timer: Update every second
  useEffect(() => {
    const updateCountdown = () => {
      setNextRoundCountdown(calculateNextRoundTime());
    };
    
    updateCountdown(); // Initial update
    const timer = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Trivia pool + players: fast initial fetch, then 2s polling (works without Supabase Realtime)
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      fetchCurrentRoundStats()
        .then((stats) => {
          if (mounted) {
            setPrizePool(stats.prizePoolSol);
            setPlayersEntered(stats.playersEntered);
          }
        })
        .catch(() => {});
    };
    refresh();
    const interval = setInterval(refresh, 2000);
    const sub = subscribeCurrentRoundStats((stats) => {
      if (mounted) {
        setPrizePool(stats.prizePoolSol);
        setPlayersEntered(stats.playersEntered);
      }
    });
    return () => {
      mounted = false;
      clearInterval(interval);
      sub.unsubscribe();
    };
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto custom-scrollbar relative px-6 md:px-12 lg:px-24">
      {/* Top Header Row - Mobile: Integrated Balance & Quick Buy */}
      <div className="flex flex-col md:flex-row md:justify-end items-stretch md:items-center pt-4 md:pt-12 z-20 gap-3 md:gap-4 w-full safe-top">
        
        {/* Mobile-Only Balance Display: Enhanced with Buy Lives Button */}
        <div className="md:hidden flex items-center justify-between bg-[#0A0A0A] border border-white/5 p-4 rounded-2xl shadow-xl backdrop-blur-md mb-2">
            <div>
              <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-0.5 italic">YOUR BALANCE</span>
              <div className="flex items-baseline gap-1.5">
                {connected && balance !== null ? (
                  <span className="text-xl font-[1000] italic text-white leading-none tabular-nums">
                    {balance.toFixed(2)}
                  </span>
                ) : connected && loadingBalance ? (
                  <span className="text-xl font-[1000] italic text-white/50 leading-none">...</span>
                ) : (
                  <span className="text-xl font-[1000] italic text-white/30 leading-none">0.00</span>
                )}
                <span className="text-[#14F195] text-[9px] font-[1000] italic uppercase">SOL</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-[1px] h-8 bg-white/5"></div>
              <div className="text-right flex flex-col items-end">
                <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest block mb-0.5 italic">LIVES</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#FF3131] text-xl font-[1000] italic leading-none">{lives.toString().padStart(2, '0')}</span>
                  <button 
                    onClick={onOpenBuyLives}
                    className="px-2 py-1 bg-[#FF3131] text-white text-[8px] font-black uppercase italic rounded-sm shadow-[0_0_15px_rgba(255,49,49,0.3)] active:scale-95 transition-all"
                  >
                    BUY MORE
                  </button>
                </div>
              </div>
            </div>
        </div>

        <div className="flex justify-between md:justify-end items-center gap-3 w-full md:w-auto">
          {/* How to Play */}
          <button 
            onClick={onOpenGuide}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 md:gap-1.5 bg-[#14F195] hover:bg-[#14F195]/90 h-11 md:h-10 px-4 md:px-6 rounded-full transition-all group shadow-[0_0_15px_rgba(20,241,149,0.15)] active:scale-95 min-h-[44px] md:min-h-0"
          >
            <span className="text-[10px] md:text-[10px] font-black uppercase tracking-wider text-black whitespace-nowrap">HOW TO PLAY</span>
            <div className="flex w-4 h-4 md:w-5 md:h-5 rounded-full bg-gradient-to-br from-[#9945FF] via-[#3b82f6] to-[#14F195] items-center justify-center text-white font-black text-[9px] md:text-[10px] italic shadow-sm">?</div>
          </button>

          {/* Connect Wallet */}
          <div className="flex-1 md:flex-none">
            <WalletConnectButton />
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto w-full flex-1 flex flex-col justify-center pb-32 md:pb-12 z-10 pt-6 md:pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
          
          {/* Left Side: Branding & CTA */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="mb-6 md:mb-10">
              <h1 className="text-[64px] sm:text-[100px] md:text-[130px] leading-[0.7] font-[1000] italic text-white uppercase tracking-tighter ml-[-4px]">
                SOL
              </h1>
              <h1 className="text-[64px] sm:text-[100px] md:text-[130px] leading-[0.9] font-[1000] italic sol-gradient-text uppercase tracking-tighter ml-[-4px]">
                TRIVIA
              </h1>
              <div className="h-0.5 w-16 md:w-32 bg-[#00FFA3] opacity-30 mt-4 shadow-[0_0_10px_#00FFA3]"></div>
              <p className="text-zinc-300 font-black uppercase tracking-[0.3em] text-[10px] md:text-[11px] mt-6 max-w-sm leading-relaxed italic">
                THE HIGH-STAKES INTELLIGENCE TRIVIA ON SOLANA
              </p>
            </div>

            {/* Play Now Area */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:max-w-2xl">
              <button 
                onClick={onEnterTrivia}
                className="flex-1 h-20 md:h-24 bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#14F195] rounded-full flex items-center justify-between px-8 md:px-10 active:scale-[0.98] transition-all group shadow-[0_15px_40px_-10px_rgba(153,69,255,0.4)] hover:shadow-[0_20px_60px_-10px_rgba(20,241,149,0.5)] border-t border-white/20 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>
                
                <div className="flex flex-col items-start relative z-10">
                  <span className="text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white/60 mb-1 group-hover:text-white/80 transition-colors">INITIALIZE ARENA</span>
                  <div className="text-white text-2xl md:text-4xl font-[1000] italic leading-none uppercase tracking-tighter">
                    PLAY NOW
                  </div>
                </div>
                
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center transition-all group-hover:bg-white/20 group-hover:scale-110 relative z-10">
                  <svg className="w-5 h-5 md:w-6 md:h-6 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
              </button>

              <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4 flex flex-col justify-center gap-2 min-w-[180px] shadow-xl">
                <div className="mb-0.5">
                   <span className="text-zinc-500 text-[7px] font-black uppercase tracking-widest italic leading-none block">CURRENT ROUND</span>
                   <span className="text-zinc-400 text-[9px] font-bold italic leading-tight block">{getRoundLabel(getCurrentRoundKey().date, getCurrentRoundKey().roundNumber)}</span>
                </div>
                <div>
                   <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic leading-none block mb-1">TRIVIA POOL</span>
                   <div className="flex items-baseline gap-1">
                      <span className="text-[#00FFA3] text-lg font-black italic tabular-nums leading-none">
                        {prizePool.toFixed(2)}
                      </span>
                      <span className="text-[#00FFA3] text-[8px] font-black italic">SOL</span>
                   </div>
                </div>
                <div className="pt-2 border-t border-white/5">
                   <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic leading-none block mb-1">PLAYERS</span>
                   <span className="text-white text-base font-black italic tabular-nums leading-none">
                     {playersEntered.toLocaleString()} <span className="text-[8px] text-zinc-500">UNIT</span>
                   </span>
                </div>
                <div className="pt-2 border-t border-white/5">
                   <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic leading-none block mb-1">NEXT ROUND IN</span>
                   <div className="flex items-center gap-1">
                     <span className="text-white text-lg font-black italic tabular-nums leading-none">
                       {nextRoundCountdown}
                     </span>
                     <div className="w-1.5 h-1.5 rounded-full bg-[#00FFA3] animate-pulse"></div>
                   </div>
                </div>
              </div>
            </div>

            {/* Social: Discord & X (mobile) */}
            <div className="flex lg:hidden items-center gap-3 mt-6">
              <a
                href="https://x.com/soltrivia_app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A0A0A] border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all shadow-xl"
                aria-label="X (Twitter)"
              >
                <svg className="w-5 h-5 text-zinc-300 hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://discord.gg/uXHBy4BuHp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A0A0A] border border-white/5 hover:border-[#5865F2]/50 hover:bg-[#5865F2]/10 transition-all shadow-xl"
                aria-label="Discord"
              >
                <svg className="w-5 h-5 text-zinc-300 hover:text-[#5865F2] transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Right Side: Secondary Stats Grid */}
          <div className="hidden lg:grid lg:col-span-5 grid-cols-1 gap-4">
            
            <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-xl min-h-[140px] flex flex-col justify-center shadow-xl backdrop-blur-md relative overflow-hidden group">
              <div>
                <span className="text-zinc-300 text-[10px] font-black uppercase tracking-widest block mb-1 italic">Balance</span>
                <div className="flex items-baseline gap-2">
                  {connected && balance !== null ? (
                    <span className="text-[28px] font-[1000] italic text-white tabular-nums">
                      {balance.toFixed(2)}
                    </span>
                  ) : connected && loadingBalance ? (
                    <span className="text-[28px] font-[1000] italic text-white/50">...</span>
                  ) : (
                    <span className="text-[28px] font-[1000] italic text-white/30">0.00</span>
                  )}
                  <span className="text-[#14F195] text-xs font-[1000] italic uppercase">SOL</span>
                </div>
              </div>
            </div>

            <div className="bg-[#0A0A0A] border border-white/5 p-6 rounded-xl min-h-[140px] flex flex-col justify-center shadow-xl text-left hover:border-[#FF3131]/30 transition-all group relative overflow-hidden">
              <div>
                <span className="text-zinc-300 text-[10px] font-black uppercase tracking-widest block mb-1 italic">VITALITY LIVES</span>
                <div className="flex items-center justify-between">
                  <div className="text-[28px] font-[1000] italic text-[#FF3131] tabular-nums">
                    {lives.toString().padStart(2, '0')}
                  </div>
                  <button 
                    onClick={onOpenBuyLives}
                    className="px-5 py-2.5 bg-[#FF3131] hover:bg-[#FF3131]/90 text-white text-[10px] font-black uppercase italic rounded-full shadow-[0_0_20px_rgba(255,49,49,0.3)] hover:scale-105 active:scale-95 transition-all border border-white/10"
                  >
                    BUY MORE LIVES
                  </button>
                </div>
              </div>
            </div>

            {/* Social: Discord & X */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://x.com/soltrivia_app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A0A0A] border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all shadow-xl"
                aria-label="X (Twitter)"
              >
                <svg className="w-5 h-5 text-zinc-300 hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a
                href="https://discord.gg/uXHBy4BuHp"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#0A0A0A] border border-white/5 hover:border-[#5865F2]/50 hover:bg-[#5865F2]/10 transition-all shadow-xl"
                aria-label="Discord"
              >
                <svg className="w-5 h-5 text-zinc-300 hover:text-[#5865F2] transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
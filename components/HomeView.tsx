import React, { useState, useEffect } from 'react';
import WalletConnectButton from './WalletConnectButton';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { getBalanceSafely } from '../src/utils/balance';
import { fetchCurrentRoundStats, subscribeCurrentRoundStats } from '../src/utils/api';

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
                   <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic leading-none block mb-1">PLAYERS ENTERED</span>
                   <span className="text-white text-base font-black italic tabular-nums leading-none">
                     {playersEntered.toLocaleString()}
                   </span>
                </div>
              </div>
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeView;
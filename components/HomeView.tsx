import React, { useState, useEffect } from 'react';
import WalletConnectButton from './WalletConnectButton';
import FAQModal from './FAQModal';
import { useWallet } from '../src/contexts/WalletContext';
import { fetchCurrentRoundStats, subscribeCurrentRoundStats, getCurrentRoundKey, getRoundLabel } from '../src/utils/api';
import { supabase } from '../src/utils/supabase';
import { PAID_TRIVIA_ENABLED } from '../src/utils/constants';

// Toggle to false to hide round stats & timer (re-enable when paid trivia rounds are live)
const SHOW_ROUND_STATS = true;

interface PlayedGame {
  game_id: string;
  game_name: string;
  slug: string;
  best_score: number;
  question_count: number;
}

interface HomeViewProps {
  lives: number | null;
  onEnterTrivia: () => void;
  onOpenGuide: () => void;
  onOpenBuyLives: () => void;
  onStartPractice: () => void;
  practiceRunsLeft: number;
  hasGamePass?: boolean;
  isSeekerVerified?: boolean;
  onBuyGamePass?: () => void;
  onCreateCustomGame?: () => void;
  onViewCustomGame?: (slug: string) => void;
  onEnterDuels?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ lives, onEnterTrivia, onOpenGuide, onOpenBuyLives, onStartPractice, practiceRunsLeft, hasGamePass, isSeekerVerified, onBuyGamePass, onCreateCustomGame, onViewCustomGame, onEnterDuels }) => {
  const { publicKey, connected } = useWallet();
  const [showFAQ, setShowFAQ] = useState(false);
  const [prizePool, setPrizePool] = useState(0);
  const [playersEntered, setPlayersEntered] = useState(0);
  const [nextRoundCountdown, setNextRoundCountdown] = useState('');
  const [myPlayedGames, setMyPlayedGames] = useState<PlayedGame[]>([]);

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

  // Countdown timer: Update every second
  useEffect(() => {
    const updateCountdown = () => {
      setNextRoundCountdown(calculateNextRoundTime());
    };

    updateCountdown(); // Initial update
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch custom games the user has played
  useEffect(() => {
    if (!connected || !publicKey) {
      setMyPlayedGames([]);
      return;
    }
    const walletAddr = publicKey.toBase58();
    (async () => {
      try {
        const { data } = await supabase
          .from('custom_game_sessions')
          .select('game_id, score, correct_count, status, custom_games(name, slug, question_count)')
          .eq('wallet_address', walletAddr)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(20);
        if (!data) return;
        const map = new Map<string, PlayedGame>();
        for (const row of data as any[]) {
          const game = row.custom_games;
          if (!game) continue;
          const existing = map.get(row.game_id);
          if (!existing || row.score > existing.best_score) {
            map.set(row.game_id, {
              game_id: row.game_id,
              game_name: game.name,
              slug: game.slug,
              best_score: row.score,
              question_count: game.question_count,
            });
          }
        }
        setMyPlayedGames(Array.from(map.values()));
      } catch { /* non-fatal */ }
    })();
  }, [connected, publicKey]);

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
    <div className="flex flex-col h-full bg-[#050505] overflow-y-auto custom-scrollbar relative">
      {/* Sticky Top Bar */}
      <div className="sticky top-0 z-30 bg-[#050505]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Left: Lives */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic">LIVES</span>
              <span className="text-[#FF3131] text-xl font-[1000] italic leading-none tabular-nums" data-lives={lives === null ? 'null' : String(lives)}>
                {lives === null ? '—' : Number(lives).toString().padStart(2, '0')}
              </span>
            </div>
            <button
              onClick={onOpenBuyLives}
              className="px-2 py-1 bg-[#FF3131] text-white text-[8px] font-black uppercase italic rounded-sm shadow-[0_0_12px_rgba(255,49,49,0.3)] active:scale-95 transition-all"
            >
              +
            </button>
          </div>

          {/* Right: How to Play, FAQ, Wallet */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenGuide}
              className="h-8 px-3 bg-[#14F195] hover:bg-[#14F195]/90 rounded-full flex items-center justify-center transition-all active:scale-95"
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-black">HOW TO PLAY</span>
            </button>
            <button
              onClick={() => setShowFAQ(true)}
              className="h-8 px-3 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center transition-all active:scale-95"
            >
              <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400">FAQ</span>
            </button>
            <WalletConnectButton />
          </div>
        </div>
      </div>

      {/* Main Stacked Content */}
      <div className="flex-1 px-4 pb-32 md:pb-12">
        <div className="max-w-2xl mx-auto pt-6 md:pt-10 space-y-4">

          {/* Hero Branding */}
          <div className="mb-2">
            <div className="flex items-end gap-1">
              <h1 className="text-[56px] sm:text-[72px] md:text-[88px] leading-[0.85] font-[1000] italic text-white uppercase tracking-tighter">
                SOL
              </h1>
              <h1 className="text-[56px] sm:text-[72px] md:text-[88px] leading-[0.85] font-[1000] italic sol-gradient-text uppercase tracking-tighter">
                TRIVIA
              </h1>
            </div>
            <div className="h-0.5 w-12 bg-[#00FFA3] opacity-30 mt-3"></div>
            <p className="text-zinc-500 font-black uppercase tracking-[0.25em] text-[9px] mt-3 italic">
              THE HIGH-STAKES INTELLIGENCE TRIVIA
            </p>
          </div>

          {/* Main CTA: Compete for SOL */}
          <button
            onClick={PAID_TRIVIA_ENABLED ? onEnterTrivia : undefined}
            disabled={!PAID_TRIVIA_ENABLED}
            className={`w-full rounded-2xl flex items-center justify-between px-6 py-5 md:px-8 md:py-6 transition-all relative overflow-hidden ${PAID_TRIVIA_ENABLED ? 'bg-gradient-to-r from-[#00FFA3] to-[#14F195] active:scale-[0.99] group shadow-[0_12px_40px_-10px_rgba(20,241,149,0.4)] hover:shadow-[0_20px_60px_-10px_rgba(20,241,149,0.5)]' : 'bg-zinc-800/60 border border-zinc-700/40 cursor-not-allowed'}`}
          >
            {PAID_TRIVIA_ENABLED && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>}
            <div className="flex flex-col items-start relative z-10">
              <span className={`text-[8px] md:text-[9px] font-black uppercase tracking-[0.3em] mb-1 ${PAID_TRIVIA_ENABLED ? 'text-black/50' : 'text-zinc-500'}`}>
                {PAID_TRIVIA_ENABLED ? 'WIN REAL SOL' : 'PAUSED — UPGRADING'}
              </span>
              <span className={`${PAID_TRIVIA_ENABLED ? 'text-black' : 'text-zinc-500'} text-2xl md:text-3xl font-[1000] italic leading-none uppercase tracking-tighter`}>
                COMPETE FOR SOL
              </span>
              {!PAID_TRIVIA_ENABLED && (
                <span className="text-yellow-400 text-[8px] font-black italic uppercase mt-1">Free play still available below</span>
              )}
            </div>
            <div className={`w-9 h-9 rounded-full ${PAID_TRIVIA_ENABLED ? 'bg-black/10' : 'bg-white/10'} backdrop-blur-md flex items-center justify-center relative z-10`}>
              <svg className={`w-4 h-4 ${PAID_TRIVIA_ENABLED ? 'text-black' : 'text-zinc-500'}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </button>

          {/* Round Timer */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse"></div>
              <span className="text-zinc-500 text-[9px] font-black uppercase tracking-widest italic">
                {getRoundLabel(getCurrentRoundKey().date, getCurrentRoundKey().roundNumber)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-600 text-[9px] font-black uppercase tracking-widest italic">NEXT ROUND IN</span>
              <span className="text-[#14F195] text-base font-[1000] italic tabular-nums leading-none">{nextRoundCountdown}</span>
            </div>
          </div>

          {/* Two-up: Free Play + Duels */}
          <div className="grid grid-cols-2 gap-3">
            {/* Free Play */}
            <button
              onClick={onStartPractice}
              disabled={!hasGamePass && practiceRunsLeft <= 0}
              className={`p-4 md:p-5 rounded-xl text-left transition-all active:scale-[0.98] ${(hasGamePass || practiceRunsLeft > 0) ? 'bg-[#0A0A0A] border border-[#14F195]/20 hover:border-[#14F195]/40' : 'bg-[#0A0A0A] border border-zinc-800 opacity-50 cursor-not-allowed'}`}
            >
              <span className="text-[#14F195]/60 text-[8px] font-black uppercase tracking-[0.3em] block mb-1.5">
                {hasGamePass ? 'GAME PASS' : 'FREE TO PLAY'}
              </span>
              <span className="text-[#14F195] text-lg md:text-xl font-[1000] italic leading-none uppercase tracking-tighter block">
                {hasGamePass ? 'PLAY NOW' : 'FREE PLAY'}
              </span>
              <div className="mt-3 flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${(hasGamePass || practiceRunsLeft > 0) ? 'bg-[#14F195]' : 'bg-zinc-600'}`}></div>
                <span className="text-zinc-500 text-[9px] font-bold italic">
                  {hasGamePass ? 'Unlimited' : practiceRunsLeft > 0 ? `${practiceRunsLeft}/5 LIVES` : 'No runs left'}
                </span>
              </div>
            </button>

            {/* Duels */}
            {onEnterDuels ? (
              <button
                onClick={onEnterDuels}
                className="p-4 md:p-5 bg-[#0A0A0A] border border-[#FF3131]/20 hover:border-[#FF3131]/40 rounded-xl text-left transition-all active:scale-[0.98]"
              >
                <span className="text-[#FF3131]/60 text-[8px] font-black uppercase tracking-[0.3em] block mb-1.5">1V1 ARENA</span>
                <span className="text-[#FF3131] text-lg md:text-xl font-[1000] italic leading-none uppercase tracking-tighter block">DUELS</span>
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#FF3131] animate-pulse"></div>
                  <span className="text-zinc-500 text-[9px] font-bold italic">0.01–1 SOL</span>
                </div>
              </button>
            ) : (
              <div className="p-4 md:p-5 bg-[#0A0A0A] border border-zinc-800 rounded-xl opacity-40">
                <span className="text-zinc-600 text-[8px] font-black uppercase tracking-[0.3em] block mb-1.5">1V1 ARENA</span>
                <span className="text-zinc-500 text-lg md:text-xl font-[1000] italic leading-none uppercase tracking-tighter block">DUELS</span>
                <div className="mt-3">
                  <span className="text-zinc-600 text-[9px] font-bold italic">Coming soon</span>
                </div>
              </div>
            )}
          </div>

          {/* Custom Game */}
          {onCreateCustomGame && (
            <button
              onClick={onCreateCustomGame}
              className="w-full p-4 md:p-5 bg-[#0A0A0A] border border-[#38BDF8]/20 hover:border-[#38BDF8]/40 rounded-xl flex items-center justify-between transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#38BDF8]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#38BDF8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div className="text-left">
                  <span className="text-[#38BDF8]/60 text-[8px] font-black uppercase tracking-[0.3em] block mb-0.5">CREATE & SHARE</span>
                  <span className="text-[#38BDF8] text-base md:text-lg font-[1000] italic leading-none uppercase tracking-tighter">CUSTOM GAME</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasGamePass ? (
                  <span className="text-[#14F195] text-[8px] font-black italic uppercase">FREE</span>
                ) : (
                  <span className="text-zinc-500 text-[9px] font-black italic">0.0225 SOL</span>
                )}
              </div>
            </button>
          )}

          {/* Game Pass Promo */}
          {!hasGamePass && (
            <button
              onClick={onBuyGamePass}
              className="w-full p-4 md:p-5 bg-[#0A0A0A] border border-[#14F195]/15 hover:border-[#14F195]/35 rounded-xl flex items-center justify-between transition-all active:scale-[0.98] group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00FFA3] to-[#14F195] flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-white text-xs font-[1000] italic uppercase tracking-tight block">GAME PASS</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[#14F195] text-base font-[1000] italic leading-none">${isSeekerVerified ? '10' : '20'}</span>
                      <span className="text-[#14F195] text-[7px] font-black italic uppercase">USD</span>
                      <span className="text-zinc-600 text-[8px] font-bold italic ml-1">one-time</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-1 pl-0.5">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-[#14F195] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-zinc-400 text-[9px] font-bold">Unlimited daily practice plays</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-[#14F195] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-zinc-400 text-[9px] font-bold">All 7 trivia categories unlocked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-[#14F195] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    <span className="text-zinc-400 text-[9px] font-bold">Cheap custom game creation (0.0025 vs 0.0225 SOL)</span>
                  </div>
                </div>
                {!isSeekerVerified && (
                  <span className="text-[#14F195] text-[8px] font-bold italic mt-2 block pl-0.5">Seeker holders get 50% off</span>
                )}
              </div>
            </button>
          )}

          {/* Round Stats (hidden by default — enable when paid trivia is live) */}
          {SHOW_ROUND_STATS && (
            <div className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A] border border-white/5 rounded-xl">
              <div>
                <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic block">TRIVIA POOL</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-[#00FFA3] text-lg font-[1000] italic tabular-nums leading-none">{prizePool.toFixed(2)}</span>
                  <span className="text-[#00FFA3] text-[8px] font-black italic">SOL</span>
                </div>
              </div>
              <div className="w-px h-8 bg-white/5"></div>
              <div className="text-right">
                <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic block">PLAYERS</span>
                <span className="text-white text-lg font-[1000] italic tabular-nums leading-none">{playersEntered.toLocaleString()}</span>
              </div>
            </div>
          )}

          {/* My Played Custom Games */}
          {myPlayedGames.length > 0 && onViewCustomGame && (
            <div className="bg-[#0A0A0A] border border-[#38BDF8]/10 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#38BDF8]/70 italic">My Custom Games</span>
                <span className="text-zinc-600 text-[9px] font-bold">{myPlayedGames.length}</span>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {myPlayedGames.slice(0, 3).map((game) => (
                  <button
                    key={game.game_id}
                    onClick={() => onViewCustomGame(game.slug)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.02] transition-colors active:scale-[0.99] text-left"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <span className="text-white text-xs font-[1000] italic truncate block">{game.game_name}</span>
                      <span className="text-zinc-500 text-[9px] font-bold">{game.best_score.toLocaleString()} pts</span>
                    </div>
                    <svg className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Referral Welcome Banner */}
          {(() => {
            try {
              const hasRef = localStorage.getItem('soltrivia_referral_code');
              if (!hasRef) return null;
              return (
                <div className="px-4 py-3 bg-[#14F195]/10 border border-[#14F195]/25 rounded-xl flex items-center gap-3">
                  <div>
                    <span className="text-[#14F195] text-xs font-[1000] italic uppercase">You were referred!</span>
                    <p className="text-zinc-400 text-[10px] font-bold">Connect your wallet and play your first game to activate the referral.</p>
                  </div>
                </div>
              );
            } catch { return null; }
          })()}

          {/* Social Links */}
          <div className="flex items-center gap-2.5 pt-2">
            <a
              href="https://x.com/soltrivia_app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0A0A0A] border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all"
              aria-label="X (Twitter)"
            >
              <svg className="w-4 h-4 text-zinc-400 hover:text-white transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://discord.gg/uXHBy4BuHp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#0A0A0A] border border-white/5 hover:border-[#5865F2]/50 hover:bg-[#5865F2]/10 transition-all"
              aria-label="Discord"
            >
              <svg className="w-4 h-4 text-zinc-400 hover:text-[#5865F2] transition-colors" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </a>
          </div>

        </div>
      </div>

      {/* FAQ Modal */}
      <FAQModal isOpen={showFAQ} onClose={() => setShowFAQ(false)} />
    </div>
  );
};

export default HomeView;

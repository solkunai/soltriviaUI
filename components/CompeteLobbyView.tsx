import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useConnection } from '../src/contexts/WalletContext';
import { fetchTierRound, contractRoundIdFromDateAndNumber, type TierRoundData } from '../src/utils/soltriviaContract';
import { fetchRoundsWithWinnersPaginated, getCurrentRoundKey, getRoundLabel, type RoundWithWinner } from '../src/utils/api';
import { V2_TIER_FEES, V2_TIER_LABELS, TXN_FEE_LAMPORTS, TRIVIA_PRIZE_BPS, TRIVIA_PRIZE_LABELS } from '../src/utils/constants';
import { supabase } from '../src/utils/supabase';

interface CompeteLobbyViewProps {
  lives: number | null;
  roundEntriesUsed: number;
  roundEntriesMax: number;
  onStartQuiz: (tierIndex: number) => void;
  onOpenBuyLives: () => void;
  onBack: () => void;
  onConnectWallet: () => void;
  walletConnected: boolean;
  onStartPractice: () => void;
  onEnterDuels: () => void;
  onCreateCustomGame: () => void;
  hasGamePass: boolean;
}

function getContractRoundId(): { contractRoundId: number; roundNumber: number } {
  const { date, roundNumber } = getCurrentRoundKey();
  return { contractRoundId: contractRoundIdFromDateAndNumber(date, roundNumber), roundNumber };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getNextRoundMs(): number {
  const now = new Date();
  const currentBlock = Math.floor(now.getUTCHours() / 6);
  const nextBlockHour = (currentBlock + 1) * 6;
  const next = new Date(now);
  if (nextBlockHour >= 24) {
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(0, 0, 0, 0);
  } else {
    next.setUTCHours(nextBlockHour, 0, 0, 0);
  }
  return next.getTime() - now.getTime();
}

export default function CompeteLobbyView({
  lives,
  roundEntriesUsed,
  roundEntriesMax,
  onStartQuiz,
  onOpenBuyLives,
  onBack,
  onConnectWallet,
  walletConnected,
  onStartPractice,
  onEnterDuels,
  onCreateCustomGame,
  hasGamePass,
}: CompeteLobbyViewProps) {
  const { connection } = useConnection();
  const [selectedTier, setSelectedTier] = useState(0);
  const [tierData, setTierData] = useState<(TierRoundData | null)[]>([null, null, null, null]);
  const [tierLoading, setTierLoading] = useState(true);
  const [countdown, setCountdown] = useState(formatCountdown(getNextRoundMs()));
  const [recentRounds, setRecentRounds] = useState<RoundWithWinner[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentPage, setRecentPage] = useState(0);
  const [activeDuelCount, setActiveDuelCount] = useState(0);
  const [activeCustomGameCount, setActiveCustomGameCount] = useState(0);
  const lastRoundNumberRef = useRef(getContractRoundId().roundNumber);

  const roundEntriesLeft = Math.max(0, roundEntriesMax - roundEntriesUsed);
  const livesNum = lives ?? 0;
  const canPlay = roundEntriesLeft > 0 || livesNum > 0;
  const tierFee = V2_TIER_FEES[selectedTier];
  const totalFee = (tierFee + TXN_FEE_LAMPORTS) / 1_000_000_000;

  // Total pot across all tiers
  const totalPotLamports = tierData.reduce((sum, td) => sum + (td?.totalPot ?? 0), 0);
  const totalPotSol = totalPotLamports / 1_000_000_000;
  const totalPlayers = tierData.reduce((sum, td) => sum + (td?.entryCount ?? 0), 0);

  const { date, roundNumber } = getCurrentRoundKey();
  const roundLabel = getRoundLabel(date, roundNumber);

  // Fetch all 4 tier PDAs
  const fetchTierData = useCallback(async () => {
    if (!connection) return;
    const { contractRoundId } = getContractRoundId();
    try {
      const results = await Promise.allSettled(
        [0, 1, 2, 3].map(i => fetchTierRound(connection, contractRoundId, i))
      );
      setTierData(results.map(r => r.status === 'fulfilled' ? r.value : null));
    } catch (e) {
      console.warn('Failed to fetch tier data:', e);
    } finally {
      setTierLoading(false);
    }
  }, [connection]);

  // Fetch recent winners
  const fetchRecent = useCallback(async () => {
    try {
      const { rounds } = await fetchRoundsWithWinnersPaginated(0, 50);
      setRecentRounds(rounds);
    } catch (e) {
      console.warn('Failed to fetch recent rounds:', e);
    } finally {
      setRecentLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchTierData();
    fetchRecent();
  }, [fetchTierData, fetchRecent]);

  // Poll tier data every 15s
  useEffect(() => {
    const id = setInterval(fetchTierData, 15_000);
    return () => clearInterval(id);
  }, [fetchTierData]);

  // Countdown timer (1s) + round flip detection
  useEffect(() => {
    const id = setInterval(() => {
      setCountdown(formatCountdown(getNextRoundMs()));
      const { roundNumber: currentRound } = getContractRoundId();
      if (currentRound !== lastRoundNumberRef.current) {
        lastRoundNumberRef.current = currentRound;
        setTierLoading(true);
        setTierData([null, null, null, null]);
        fetchTierData();
        fetchRecent();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [fetchTierData, fetchRecent]);

  // Active duels & custom games counts
  useEffect(() => {
    const fetchCounts = async () => {
      const now = new Date().toISOString();
      const [duels, cg] = await Promise.all([
        supabase.from('duels').select('*', { count: 'exact', head: true }).in('status', ['waiting', 'active']).gt('expires_at', now),
        supabase.from('custom_games').select('*', { count: 'exact', head: true }).in('status', ['active', 'started']),
      ]);
      setActiveDuelCount(duels.count ?? 0);
      setActiveCustomGameCount(cg.count ?? 0);
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleCTA = () => {
    if (!walletConnected) { onConnectWallet(); return; }
    if (!canPlay) { onOpenBuyLives(); return; }
    onStartQuiz(selectedTier);
  };

  return (
    <div className="relative min-h-full pb-[250px] md:pb-[120px]">
      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="text-white/60 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          </button>
          <h1 className="text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter text-white">Compete for SOL</h1>
          <div className="w-6" /> {/* spacer */}
        </div>

        {/* Game Modes */}
        <div className="grid grid-cols-3 gap-2">
          {/* 1v1 Duels */}
          <button
            onClick={onEnterDuels}
            className="bg-[#0A0A0A] border border-[#FF3131]/20 hover:border-[#FF3131]/40 rounded-xl p-3 text-left transition-all active:scale-[0.98]"
          >
            <span className="text-[#FF3131]/60 text-[7px] font-black uppercase tracking-[0.15em] block mb-1">1V1 ARENA</span>
            <span className="text-[#FF3131] text-xs md:text-sm font-[1000] italic leading-none uppercase tracking-tighter block">
              Enter the Arena
            </span>
            <div className="mt-2 flex items-center gap-1.5">
              {activeDuelCount > 0 && (
                <span className="bg-[#FF3131]/20 text-[#FF3131] text-[7px] font-black italic uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                  {activeDuelCount} ACTIVE
                </span>
              )}
              <span className="text-zinc-500 text-[8px] font-bold italic">0.01–1 SOL</span>
            </div>
          </button>

          {/* Custom Games */}
          <button
            onClick={onCreateCustomGame}
            className="bg-[#0A0A0A] border border-[#38BDF8]/20 hover:border-[#38BDF8]/40 rounded-xl p-3 text-left transition-all active:scale-[0.98]"
          >
            <span className="text-[#38BDF8]/60 text-[7px] font-black uppercase tracking-[0.15em] block mb-1">CREATE & SHARE</span>
            <span className="text-[#38BDF8] text-xs md:text-sm font-[1000] italic leading-none uppercase tracking-tighter block">
              Join a Game
            </span>
            <div className="mt-2 flex items-center gap-1.5">
              {activeCustomGameCount > 0 && (
                <span className="bg-[#38BDF8]/20 text-[#38BDF8] text-[7px] font-black italic uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                  {activeCustomGameCount} ACTIVE
                </span>
              )}
              <span className="text-zinc-500 text-[8px] font-bold italic">{hasGamePass ? '0.0025' : '0.0225'} SOL</span>
            </div>
          </button>

          {/* Free Play */}
          <button
            onClick={onStartPractice}
            className="bg-[#0A0A0A] border border-white/10 hover:border-white/20 rounded-xl p-3 text-left transition-all active:scale-[0.98]"
          >
            <span className="text-white/40 text-[7px] font-black uppercase tracking-[0.15em] block mb-1">PRACTICE</span>
            <span className="text-white/80 text-xs md:text-sm font-[1000] italic leading-none uppercase tracking-tighter block">
              Free Play
            </span>
            <div className="mt-2">
              <span className="text-zinc-500 text-[8px] font-bold italic">No SOL needed</span>
            </div>
          </button>
        </div>

        {/* Live Round Info */}
        <div className="flex items-center justify-between bg-[#0A0A0A] border border-white/5 rounded-xl px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#14F195] opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#14F195]" />
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-white">Round {roundNumber + 1} Live</span>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-bold uppercase tracking-wider text-white/70">Next round in</div>
            <div className="text-lg font-[1000] italic text-[#14F195] tabular-nums tracking-tight">{countdown}</div>
          </div>
        </div>

        {/* Total Prize Pool Hero */}
        <div className="text-center py-4">
          <div className="text-[9px] font-black uppercase tracking-[0.3em] text-white/70 mb-1">Total Prize Pool</div>
          {tierLoading ? (
            <div className="h-10 w-40 mx-auto bg-white/5 rounded-lg animate-pulse" />
          ) : (
            <div className="text-4xl md:text-5xl font-[1000] italic tracking-tight bg-gradient-to-r from-[#00FFA3] to-[#14F195] bg-clip-text text-transparent">
              {totalPotSol.toFixed(totalPotSol >= 1 ? 2 : 4)} SOL
            </div>
          )}
          <div className="text-[10px] font-bold text-white/70 mt-1">
            {totalPlayers} player{totalPlayers !== 1 ? 's' : ''} across all tiers
          </div>
        </div>

        {/* Tier Cards */}
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.3em] text-white/70 mb-2">Choose Your Tier</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {V2_TIER_LABELS.map((label, i) => {
              const td = tierData[i];
              const pot = (td?.totalPot ?? 0) / 1_000_000_000;
              const players = td?.entryCount ?? 0;
              const firstPrize = pot * (TRIVIA_PRIZE_BPS[0] / 10000);
              const active = selectedTier === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedTier(i)}
                  className={`relative rounded-xl border p-3 text-left transition-all ${
                    active
                      ? 'bg-[#14F195]/10 border-[#14F195] shadow-[0_0_20px_rgba(20,241,149,0.15)]'
                      : 'bg-[#0A0A0A] border-white/10 hover:border-white/20'
                  }`}
                >
                  {active && (
                    <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#14F195]" />
                  )}
                  <div className={`text-sm font-[1000] italic tracking-tight ${active ? 'text-[#14F195]' : 'text-white'}`}>
                    {label}
                  </div>
                  <div className="mt-2 space-y-0.5">
                    {tierLoading ? (
                      <>
                        <div className="h-3 w-16 bg-white/5 rounded animate-pulse" />
                        <div className="h-3 w-12 bg-white/5 rounded animate-pulse mt-1" />
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] font-bold text-white/80">
                          Pot: <span className="text-white">{pot.toFixed(pot >= 1 ? 2 : 4)} SOL</span>
                        </div>
                        <div className="text-[10px] font-bold text-white/80">
                          {players > 0
                            ? <>{players} player{players !== 1 ? 's' : ''}</>
                            : <span className="text-[#14F195] italic">Be first!</span>
                          }
                        </div>
                        {pot > 0 && (
                          <div className="text-[9px] font-bold text-[#14F195]/70 mt-0.5">
                            1st: ~{firstPrize.toFixed(firstPrize >= 1 ? 2 : 4)} SOL
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* How It Works */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4 space-y-3">
          <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/80">How It Works</div>
          <div className="text-[11px] text-white/80 leading-relaxed space-y-1.5">
            <p>10 questions &middot; 10 seconds each &middot; Score = speed + accuracy</p>
            <p>Top 5 players split 100% of the prize pool. Platform fee (0.0025 SOL) is collected at entry, NOT from the pot.</p>
            <p>Fewer than 5 finishers? Full refund to all players.</p>
          </div>
          {/* Prize split bar */}
          <div className="flex gap-1 mt-2">
            {TRIVIA_PRIZE_BPS.map((bps, i) => {
              const pct = bps / 100;
              const colors = ['bg-[#14F195]', 'bg-[#14F195]', 'bg-[#14F195]', 'bg-[#14F195]', 'bg-[#14F195]'];
              return (
                <div key={i} className="flex-1 text-center">
                  <div className={`h-6 rounded ${colors[i]} flex items-center justify-center`}>
                    <span className="text-[9px] font-black text-black/80">{TRIVIA_PRIZE_LABELS[i]}</span>
                  </div>
                  <div className="text-[8px] font-black text-white/80 mt-0.5">{i + 1}{['st','nd','rd','th','th'][i]}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Rounds */}
        <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] font-black uppercase tracking-[0.25em] text-white/80">Recent Rounds</div>
            {recentRounds.length > 5 && (
              <div className="text-[9px] font-bold text-white/50 tabular-nums">
                {recentPage + 1}/{Math.ceil(recentRounds.length / 5)}
              </div>
            )}
          </div>
          {recentLoading ? (
            <div className="space-y-2">
              {[0,1,2].map(i => <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />)}
            </div>
          ) : recentRounds.length === 0 ? (
            <div className="text-center text-[11px] text-white/30 py-6 italic">No completed rounds yet</div>
          ) : (
            <>
              <div className="space-y-2">
                {recentRounds.slice(recentPage * 5, recentPage * 5 + 5).map((round) => (
                  <div key={round.round_id} className="bg-white/[0.03] border border-white/5 rounded-lg px-3.5 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] font-bold text-white/90">{round.round_title}</div>
                      {round.status === 'refund' ? (
                        <span className="text-[8px] font-black uppercase tracking-wider bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded-full">Refunded</span>
                      ) : round.status === 'completed' ? (
                        <span className="text-[8px] font-black uppercase tracking-wider bg-[#14F195]/20 text-[#14F195] px-1.5 py-0.5 rounded-full">Completed</span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-white/80 mb-2">
                      <span>Pot: {(round.pot_lamports / 1_000_000_000).toFixed(4)} SOL</span>
                      <span>{round.player_count} player{round.player_count !== 1 ? 's' : ''}</span>
                    </div>
                    {round.payouts && round.payouts.length > 0 && (
                      <div className="space-y-1">
                        {round.payouts.slice(0, 3).map((p, pi) => (
                          <div key={pi} className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-black ${pi === 0 ? 'text-[#FFD700]' : pi === 1 ? 'text-[#C0C0C0]' : 'text-[#CD7F32]'}`}>
                                {pi + 1}{['st','nd','rd'][pi]}
                              </span>
                              <span className="text-white truncate max-w-[120px]">
                                {p.winner_display_name || (p.wallet_address?.slice(0, 4) + '...' + p.wallet_address?.slice(-4))}
                              </span>
                            </div>
                            <span className="text-[#14F195] font-bold">{(p.prize_lamports / 1_000_000_000).toFixed(4)} SOL</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {recentRounds.length > 5 && (
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    onClick={() => setRecentPage(p => Math.max(0, p - 1))}
                    disabled={recentPage === 0}
                    className="px-3 py-1 rounded-lg bg-white/5 text-[10px] font-bold text-white/70 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setRecentPage(p => Math.min(Math.ceil(recentRounds.length / 5) - 1, p + 1))}
                    disabled={recentPage >= Math.ceil(recentRounds.length / 5) - 1}
                    className="px-3 py-1 rounded-lg bg-white/5 text-[10px] font-bold text-white/70 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Round info line */}
        <div className="text-[9px] text-white/50 text-center pb-2">{roundLabel}</div>
      </div>

      {/* Sticky Bottom CTA */}
      <div className="fixed bottom-[100px] md:bottom-0 left-0 right-0 z-[100] bg-gradient-to-t from-[#050505] via-[#050505]/95 to-transparent pt-4 pb-4 px-4 md:pb-6">
        <div className="max-w-2xl mx-auto">
          {/* Entry info bar */}
          <div className="flex items-center justify-center gap-4 text-[9px] font-bold text-white/70 mb-2">
            <span>Round entries: {roundEntriesLeft}/{roundEntriesMax}</span>
            {lives !== null && <span>Lives: {livesNum}</span>}
            {!canPlay && walletConnected && (
              <button onClick={onOpenBuyLives} className="text-[#14F195] underline underline-offset-2">Buy Lives</button>
            )}
          </div>
          <button
            onClick={handleCTA}
            className="w-full relative overflow-hidden rounded-xl py-3.5 font-[1000] italic uppercase tracking-tight text-base transition-all active:scale-[0.98] shadow-[0_10px_30px_rgba(20,241,149,0.3)] bg-gradient-to-r from-[#00FFA3] to-[#14F195] text-black"
          >
            {/* Shimmer */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" />
            <span className="relative z-10">
              {!walletConnected
                ? 'Connect Wallet'
                : !canPlay
                  ? 'Get Extra Lives'
                  : `Compete for SOL — ${totalFee} SOL`
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PAID_TRIVIA_ENABLED, V2_TIER_FEES, V2_TIER_LABELS, TXN_FEE_LAMPORTS } from '../src/utils/constants';
import type { ClaimablePayout, ClaimableCustomGameWin, RefundableEntry, RefundableCustomGame } from '../src/utils/api';
import { supabase } from '../src/utils/supabase';

interface PlayViewProps {
  lives: number | null;
  roundEntriesUsed: number;
  roundEntriesMax: number;
  onStartQuiz: (tierIndex: number) => void;
  onOpenBuyLives: () => void;
  onStartPractice: () => void;
  practiceRunsLeft: number;
  hasGamePass?: boolean;
  onCreateCustomGame?: () => void;
  onEnterDuels?: () => void;
  // Optional claims data
  claimableRoundPayouts?: ClaimablePayout[];
  claimableCustomGames?: ClaimableCustomGameWin[];
  refundableEntries?: RefundableEntry[];
  refundableCustomGames?: RefundableCustomGame[];
  onClaimRoundPrize?: (payout: ClaimablePayout) => void;
  onClaimCustomPrize?: (onChainGameId: number) => void;
  onClaimRefund?: (entry: RefundableEntry) => void;
  onClaimCGRefund?: (cg: RefundableCustomGame) => void;
  claimingId?: string | null;
}

const PlayView: React.FC<PlayViewProps> = ({ lives, roundEntriesUsed, roundEntriesMax, onStartQuiz, onOpenBuyLives, onStartPractice, practiceRunsLeft, hasGamePass, onCreateCustomGame, onEnterDuels, claimableRoundPayouts, claimableCustomGames, refundableEntries, refundableCustomGames, onClaimRoundPrize, onClaimCustomPrize, onClaimRefund, onClaimCGRefund, claimingId }) => {
  const { t } = useTranslation();
  const [selectedTier, setSelectedTier] = useState(0);
  const [claimsExpanded, setClaimsExpanded] = useState(false);
  const [activeDuelCount, setActiveDuelCount] = useState(0);
  const [activeCustomGameCount, setActiveCustomGameCount] = useState(0);
  const roundEntriesLeft = Math.max(0, roundEntriesMax - roundEntriesUsed);

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
  const livesNum = lives ?? 0;
  const canPlay = roundEntriesLeft > 0 || livesNum > 0;

  const tierFee = V2_TIER_FEES[selectedTier];
  const totalFee = (tierFee + TXN_FEE_LAMPORTS) / 1_000_000_000;

  const totalClaimable = (claimableRoundPayouts?.length ?? 0) + (claimableCustomGames?.length ?? 0) + (refundableEntries?.length ?? 0) + (refundableCustomGames?.length ?? 0);

  return (
    <div className="h-full flex flex-col items-center justify-start md:justify-center p-4 pt-6 md:p-12 relative overflow-hidden bg-[#050505] overflow-y-auto">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="scan-line opacity-10"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#14F195]/5 rounded-full blur-[150px]"></div>
      </div>

      <div className="relative z-10 w-full max-w-md md:max-w-lg flex flex-col items-center">
        {/* Mascot + Title */}
        <div className="flex flex-col items-center mb-5 md:mb-6">
          <div className="w-20 h-20 md:w-32 md:h-32 mb-2 md:mb-3 floating">
            <img
              src="brainy-gaming.png"
              alt="Brainy"
              className="w-full h-full object-contain drop-shadow-[0_0_40px_rgba(20,241,149,0.3)]"
              onError={(e) => (e.currentTarget.style.display = 'none')}
            />
          </div>
          <h2 className="text-3xl md:text-7xl font-[1000] italic uppercase tracking-tighter leading-none text-center mb-1.5 md:mb-3">
            ENTER THE<br/><span className="sol-gradient-text">ARENA</span>
          </h2>
          <p className="text-zinc-500 font-black uppercase tracking-[0.3em] text-[9px] md:text-xs italic">
            {t('play.knowledgeIsAsset')}
          </p>
        </div>

        {/* Unclaimed Rewards Banner */}
        {totalClaimable > 0 && (
          <div className="w-full mb-3 md:mb-4">
            <button
              onClick={() => setClaimsExpanded(!claimsExpanded)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#14F195]/5 border border-[#14F195]/20 rounded-xl hover:bg-[#14F195]/10 transition-all"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-[#14F195] rounded-full animate-pulse"></div>
                <span className="text-[#14F195] text-xs font-[1000] italic uppercase tracking-tight">
                  {t('play.unclaimedRewards', { count: totalClaimable })}
                </span>
              </div>
              <svg className={`w-4 h-4 text-[#14F195] transition-transform ${claimsExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {claimsExpanded && (
              <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                {/* Round Prizes */}
                {claimableRoundPayouts?.map((p) => (
                  <div key={`r-${p.round_id}-${p.tier_index}`} className="flex items-center justify-between px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <span className="text-[#14F195] text-xs font-bold truncate block">{p.round_title}</span>
                      <span className="text-zinc-500 text-[10px]">#{p.rank} — {(p.prize_lamports / 1e9).toFixed(4)} SOL</span>
                    </div>
                    <button
                      disabled={claimingId === `round-${p.round_id}-${p.rank}`}
                      onClick={() => onClaimRoundPrize?.(p)}
                      className="ml-2 px-3 py-1.5 bg-[#14F195] text-black text-[10px] font-[1000] italic uppercase rounded-md disabled:opacity-50"
                    >
                      {claimingId === `round-${p.round_id}-${p.rank}` ? '...' : 'Claim'}
                    </button>
                  </div>
                ))}

                {/* Custom Game Prizes */}
                {claimableCustomGames?.map((cg) => (
                  <div key={`cg-${cg.game_id}`} className="flex items-center justify-between px-3 py-2.5 bg-[#0A0A0A] border border-white/10 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <span className="text-purple-400 text-xs font-bold truncate block">{cg.name}</span>
                      <span className="text-zinc-500 text-[10px]">#{cg.winner_index + 1} — {(cg.prize_lamports / 1e9).toFixed(4)} SOL</span>
                    </div>
                    <button
                      disabled={claimingId === String(cg.on_chain_game_id)}
                      onClick={() => onClaimCustomPrize?.(cg.on_chain_game_id)}
                      className="ml-2 px-3 py-1.5 bg-[#14F195] text-black text-[10px] font-[1000] italic uppercase rounded-md disabled:opacity-50"
                    >
                      {claimingId === String(cg.on_chain_game_id) ? '...' : 'Claim'}
                    </button>
                  </div>
                ))}

                {/* Refundable Entries */}
                {refundableEntries?.map((re) => (
                  <div key={`ref-${re.round_id}-${re.tier_index}`} className="flex items-center justify-between px-3 py-2.5 bg-[#0A0A0A] border border-yellow-500/20 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <span className="text-yellow-400 text-xs font-bold truncate block">{re.round_title}</span>
                      <span className="text-zinc-500 text-[10px]">Refund — {(re.entry_fee_lamports / 1e9).toFixed(4)} SOL</span>
                    </div>
                    <button
                      disabled={claimingId === `refund-${re.round_id}-${re.tier_index}`}
                      onClick={() => onClaimRefund?.(re)}
                      className="ml-2 px-3 py-1.5 bg-yellow-500 text-black text-[10px] font-[1000] italic uppercase rounded-md disabled:opacity-50"
                    >
                      {claimingId === `refund-${re.round_id}-${re.tier_index}` ? '...' : 'Refund'}
                    </button>
                  </div>
                ))}

                {/* Custom Game Refunds */}
                {refundableCustomGames?.map((cg) => (
                  <div key={`cgref-${cg.on_chain_game_id}`} className="flex items-center justify-between px-3 py-2.5 bg-[#0A0A0A] border border-orange-500/20 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <span className="text-orange-400 text-xs font-bold truncate block">{cg.name}</span>
                      <span className="text-zinc-500 text-[10px]">Game Refund — {(cg.entry_fee_lamports / 1e9).toFixed(4)} SOL</span>
                    </div>
                    <button
                      disabled={claimingId === `cgref-${cg.on_chain_game_id}`}
                      onClick={() => onClaimCGRefund?.(cg)}
                      className="ml-2 px-3 py-1.5 bg-orange-500 text-black text-[10px] font-[1000] italic uppercase rounded-md disabled:opacity-50"
                    >
                      {claimingId === `cgref-${cg.on_chain_game_id}` ? '...' : 'Refund'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Game Mode Cards — 3 column grid */}
        <div className="grid grid-cols-3 gap-2 md:gap-3 w-full mb-3 md:mb-4">
          {/* Compete for SOL */}
          <button
            onClick={PAID_TRIVIA_ENABLED ? (canPlay ? () => onStartQuiz(selectedTier) : onOpenBuyLives) : undefined}
            disabled={!PAID_TRIVIA_ENABLED}
            className={`p-3 md:p-4 rounded-xl text-left transition-all active:scale-[0.98] ${PAID_TRIVIA_ENABLED ? 'bg-[#0A0A0A] border border-[#14F195]/30 hover:border-[#14F195]/60' : 'bg-[#0A0A0A] border border-zinc-800 opacity-50 cursor-not-allowed'}`}
          >
            <span className="text-[#14F195]/60 text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] block mb-1">{t('play.entry', { amount: totalFee })}</span>
            <span className="text-[#14F195] text-sm md:text-lg font-[1000] italic leading-none uppercase tracking-tighter block">
              {t('play.competeForSol')}
            </span>
            <div className="mt-2 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse"></div>
              <span className="text-zinc-500 text-[8px] md:text-[9px] font-bold italic">{roundEntriesLeft}/{roundEntriesMax} {t('play.roundEntries').toLowerCase()}</span>
            </div>
          </button>

          {/* 1v1 Duels */}
          {onEnterDuels && (
            <button
              onClick={onEnterDuels}
              className="p-3 md:p-4 bg-[#0A0A0A] border border-[#FF3131]/20 hover:border-[#FF3131]/40 rounded-xl text-left transition-all active:scale-[0.98]"
            >
              <span className="text-[#FF3131]/60 text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] block mb-1">1V1 ARENA</span>
              <span className="text-[#FF3131] text-sm md:text-lg font-[1000] italic leading-none uppercase tracking-tighter block">
                {t('play.enterArena')}
              </span>
              <div className="mt-2 flex items-center gap-1.5">
                {activeDuelCount > 0 && (
                  <span className="bg-[#FF3131]/20 text-[#FF3131] text-[7px] font-black italic uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                    {activeDuelCount} {t('play.active')}
                  </span>
                )}
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF3131] animate-pulse"></div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] font-bold italic">{t('play.duelPriceRange')}</span>
              </div>
            </button>
          )}

          {/* Custom Games */}
          {onCreateCustomGame && (
            <button
              onClick={onCreateCustomGame}
              className="p-3 md:p-4 bg-[#0A0A0A] border border-[#38BDF8]/20 hover:border-[#38BDF8]/40 rounded-xl text-left transition-all active:scale-[0.98]"
            >
              <span className="text-[#38BDF8]/60 text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] block mb-1">{t('play.createAndShare')}</span>
              <span className="text-[#38BDF8] text-sm md:text-lg font-[1000] italic leading-none uppercase tracking-tighter block">
                {t('play.joinGame')}
              </span>
              <div className="mt-2 flex items-center gap-1.5">
                {activeCustomGameCount > 0 && (
                  <span className="bg-[#38BDF8]/20 text-[#38BDF8] text-[7px] font-black italic uppercase tracking-wider px-1.5 py-0.5 rounded-full">
                    {activeCustomGameCount} {t('play.active')}
                  </span>
                )}
                <div className="w-1.5 h-1.5 rounded-full bg-[#38BDF8]"></div>
                <span className="text-zinc-500 text-[8px] md:text-[9px] font-bold italic">{hasGamePass ? '0.0025 SOL' : '0.0225 SOL'}</span>
              </div>
            </button>
          )}
        </div>

        {/* Tier Selector */}
        {PAID_TRIVIA_ENABLED && (
          <div className="w-full mb-3 md:mb-4">
            <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic block mb-2 text-center">{t('play.selectEntryTier')}</span>
            <div className="grid grid-cols-4 gap-1.5 md:gap-2">
              {V2_TIER_LABELS.map((label, i) => {
                const active = selectedTier === i;
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedTier(i)}
                    className={`py-2.5 md:py-3 rounded-xl text-center transition-all border ${
                      active
                        ? 'bg-[#14F195]/20 border-[#14F195] text-[#14F195]'
                        : 'bg-[#0A0A0A] border-white/10 text-zinc-500 hover:border-white/20'
                    }`}
                  >
                    <span className="font-[1000] text-sm md:text-base italic leading-none block">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2.5 w-full mb-3 md:mb-4">
          <div className={`bg-[#0A0A0A] border rounded-xl p-3 md:p-4 text-center ${roundEntriesLeft > 0 ? 'border-[#14F195]/20' : 'border-white/5'}`}>
            <span className="text-zinc-500 text-[8px] font-black uppercase block mb-1 tracking-widest italic">{t('play.roundEntries')}</span>
            <span className={`font-[1000] text-lg md:text-xl italic tabular-nums leading-none ${roundEntriesLeft > 0 ? 'text-[#14F195]' : 'text-zinc-600'}`}>
              {roundEntriesLeft}<span className="text-zinc-600 text-xs">/{roundEntriesMax}</span>
            </span>
          </div>
          <button
            onClick={onOpenBuyLives}
            className={`border rounded-xl p-3 md:p-4 text-center transition-colors ${livesNum > 0 ? 'bg-[#0A0A0A] border-white/10 hover:border-white/20' : 'bg-[#FF3131]/5 border-[#FF3131]/20 hover:bg-[#FF3131]/10'}`}
          >
            <span className={`text-[8px] font-black uppercase block mb-1 tracking-widest italic ${livesNum > 0 ? 'text-zinc-500' : 'text-[#FF3131]'}`}>{t('play.extraLives')}</span>
            <span className={`font-[1000] text-lg md:text-xl italic tabular-nums leading-none ${livesNum > 0 ? 'text-white' : 'text-[#FF3131]'}`}>
              {livesNum > 0 ? livesNum : t('play.buy')}
            </span>
          </button>
        </div>

        {/* Free Play */}
        <button
          onClick={onStartPractice}
          disabled={!hasGamePass && practiceRunsLeft <= 0}
          className={`w-full h-12 md:h-14 bg-[#0A0A0A] border-2 rounded-2xl flex items-center justify-center px-6 active:scale-[0.98] transition-all group relative overflow-hidden mb-2.5 ${(hasGamePass || practiceRunsLeft > 0) ? 'border-[#14F195]/30 hover:border-[#14F195]/60' : 'border-zinc-700/30 opacity-50 cursor-not-allowed'}`}
        >
          <span className="text-[#14F195] text-sm md:text-base font-[1000] italic leading-none uppercase tracking-tighter">
            {hasGamePass ? t('play.freePlay') : practiceRunsLeft > 0 ? t('play.tryFreePlay') : t('play.noRunsLeft')}
          </span>
          {hasGamePass ? (
            <span className="absolute right-5 text-[#14F195]/60 text-[9px] font-black italic uppercase tracking-wider">{t('play.unlimited')}</span>
          ) : practiceRunsLeft > 0 ? (
            <span className="absolute right-5 text-zinc-600 text-xs font-black italic">{t('play.runsLeft', { count: practiceRunsLeft })}</span>
          ) : null}
        </button>

        {/* Game Pass Promo */}
        {!hasGamePass && (
          <button
            onClick={onOpenBuyLives}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#0A0A0A] border border-[#14F195]/15 hover:border-[#14F195]/35 rounded-xl transition-all active:scale-[0.98] mb-3"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#14F195]/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#14F195]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-left">
                <span className="text-[#14F195] text-[10px] font-[1000] italic uppercase tracking-tight block">Game Pass — $20</span>
                <span className="text-zinc-500 text-[8px] font-bold italic">Unlimited practice + cheap custom games</span>
              </div>
            </div>
            <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        )}

        {/* Info */}
        <p className="text-[8px] md:text-[9px] text-zinc-500 text-center font-black uppercase tracking-widest px-4 opacity-50 italic leading-relaxed">
          {t('play.infoText')}
        </p>
      </div>
    </div>
  );
};

export default PlayView;

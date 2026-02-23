import React, { useState } from 'react';
import { PAID_TRIVIA_ENABLED, V2_TIER_FEES, V2_TIER_LABELS, TXN_FEE_LAMPORTS } from '../src/utils/constants';
import type { ClaimablePayout, ClaimableCustomGameWin, RefundableEntry, RefundableCustomGame } from '../src/utils/api';

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
  const [selectedTier, setSelectedTier] = useState(0);
  const [claimsExpanded, setClaimsExpanded] = useState(false);
  const roundEntriesLeft = Math.max(0, roundEntriesMax - roundEntriesUsed);
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
            Knowledge is the Ultimate Asset
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
                  {totalClaimable} Unclaimed Reward{totalClaimable > 1 ? 's' : ''}
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
                      disabled={claimingId === p.round_id}
                      onClick={() => onClaimRoundPrize?.(p)}
                      className="ml-2 px-3 py-1.5 bg-[#14F195] text-black text-[10px] font-[1000] italic uppercase rounded-md disabled:opacity-50"
                    >
                      {claimingId === p.round_id ? '...' : 'Claim'}
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
                      disabled={claimingId === re.round_id}
                      onClick={() => onClaimRefund?.(re)}
                      className="ml-2 px-3 py-1.5 bg-yellow-500 text-black text-[10px] font-[1000] italic uppercase rounded-md disabled:opacity-50"
                    >
                      {claimingId === re.round_id ? '...' : 'Refund'}
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

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2.5 w-full mb-3 md:mb-4">
          <div className={`bg-[#0A0A0A] border rounded-xl p-3 md:p-4 text-center ${roundEntriesLeft > 0 ? 'border-[#14F195]/20' : 'border-white/5'}`}>
            <span className="text-zinc-500 text-[8px] font-black uppercase block mb-1 tracking-widest italic">Round Entries</span>
            <span className={`font-[1000] text-lg md:text-xl italic tabular-nums leading-none ${roundEntriesLeft > 0 ? 'text-[#14F195]' : 'text-zinc-600'}`}>
              {roundEntriesLeft}<span className="text-zinc-600 text-xs">/{roundEntriesMax}</span>
            </span>
          </div>
          <button
            onClick={onOpenBuyLives}
            className={`border rounded-xl p-3 md:p-4 text-center transition-colors ${livesNum > 0 ? 'bg-[#0A0A0A] border-white/10 hover:border-white/20' : 'bg-[#FF3131]/5 border-[#FF3131]/20 hover:bg-[#FF3131]/10'}`}
          >
            <span className={`text-[8px] font-black uppercase block mb-1 tracking-widest italic ${livesNum > 0 ? 'text-zinc-500' : 'text-[#FF3131]'}`}>Extra Lives</span>
            <span className={`font-[1000] text-lg md:text-xl italic tabular-nums leading-none ${livesNum > 0 ? 'text-white' : 'text-[#FF3131]'}`}>
              {livesNum > 0 ? livesNum : 'BUY'}
            </span>
          </button>
        </div>

        {/* Tier Selector */}
        {PAID_TRIVIA_ENABLED && (
          <div className="w-full mb-3 md:mb-4">
            <span className="text-zinc-500 text-[8px] font-black uppercase tracking-widest italic block mb-2 text-center">Select Entry Tier</span>
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

        {/* Primary: Compete for SOL */}
        <button
          onClick={PAID_TRIVIA_ENABLED ? (canPlay ? () => onStartQuiz(selectedTier) : onOpenBuyLives) : undefined}
          disabled={!PAID_TRIVIA_ENABLED}
          className={`w-full h-16 md:h-20 rounded-2xl flex items-center justify-between px-6 md:px-8 transition-all relative overflow-hidden mb-2.5 ${PAID_TRIVIA_ENABLED ? 'bg-gradient-to-r from-[#00FFA3] to-[#14F195] active:scale-[0.98] group shadow-[0_10px_30px_-8px_rgba(20,241,149,0.4)] hover:shadow-[0_15px_40px_-8px_rgba(20,241,149,0.6)] border border-white/20' : 'bg-zinc-800/60 border border-zinc-700/40 cursor-not-allowed'}`}
        >
          {PAID_TRIVIA_ENABLED && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-150%] group-hover:translate-x-[150%] transition-transform duration-1000 ease-in-out pointer-events-none"></div>}
          <div className="flex flex-col items-start relative z-10">
            <span className={`text-[8px] md:text-[10px] font-black uppercase tracking-[0.3em] mb-0.5 ${PAID_TRIVIA_ENABLED ? 'text-black/50' : 'text-zinc-500'}`}>{PAID_TRIVIA_ENABLED ? `ENTRY: ${totalFee} SOL` : 'PAUSED — UPGRADING'}</span>
            <span className={`${PAID_TRIVIA_ENABLED ? 'text-black' : 'text-zinc-500'} text-xl md:text-3xl font-[1000] italic leading-none uppercase tracking-tighter`}>
              {canPlay ? 'COMPETE FOR SOL' : 'GET EXTRA LIVES'}
            </span>
          </div>
          <div className={`w-8 h-8 rounded-full ${PAID_TRIVIA_ENABLED ? 'bg-black/10' : 'bg-white/10'} flex items-center justify-center relative z-10`}>
            <svg className={`w-4 h-4 ${PAID_TRIVIA_ENABLED ? 'text-black' : 'text-zinc-500'}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </button>

        {/* Secondary: Practice / Free Play */}
        <button
          onClick={onStartPractice}
          disabled={!hasGamePass && practiceRunsLeft <= 0}
          className={`w-full h-14 md:h-16 bg-[#0A0A0A] border-2 rounded-2xl flex items-center justify-center px-6 active:scale-[0.98] transition-all group relative overflow-hidden mb-2.5 ${(hasGamePass || practiceRunsLeft > 0) ? 'border-[#14F195]/30 hover:border-[#14F195]/60' : 'border-zinc-700/30 opacity-50 cursor-not-allowed'}`}
        >
          <div className="flex items-center gap-2 relative z-10">
            <svg className="w-5 h-5 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="text-[#14F195] text-base md:text-xl font-[1000] italic leading-none uppercase tracking-tighter">
              {hasGamePass ? 'FREE PLAY' : practiceRunsLeft > 0 ? 'TRY FREE PLAY' : 'NO RUNS LEFT'}
            </span>
          </div>
          {hasGamePass ? (
            <span className="absolute right-5 text-[#14F195]/60 text-[9px] font-black italic uppercase tracking-wider">Unlimited</span>
          ) : practiceRunsLeft > 0 ? (
            <span className="absolute right-5 text-zinc-600 text-xs font-black italic">{practiceRunsLeft}/5</span>
          ) : null}
        </button>

        {/* 1v1 Duels */}
        {onEnterDuels && (
          <button
            onClick={onEnterDuels}
            className="w-full h-12 md:h-14 bg-[#0A0A0A] border-2 border-[#FF3131]/30 hover:border-[#FF3131]/60 rounded-2xl flex items-center justify-between px-6 active:scale-[0.98] transition-all group relative overflow-hidden mb-2.5"
          >
            <div className="flex items-center gap-2 relative z-10">
              <svg className="w-4 h-4 text-[#FF3131]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[#FF3131] text-sm md:text-base font-[1000] italic leading-none uppercase tracking-tighter">
                1V1 DUELS
              </span>
            </div>
            <div className="flex items-center gap-2 relative z-10">
              <span className="bg-[#FF3131]/20 text-[#FF3131] text-[7px] font-black italic uppercase tracking-wider px-1.5 py-0.5 rounded-full">LIVE</span>
              <span className="text-zinc-500 text-[9px] font-black italic">0.01–1 SOL</span>
            </div>
          </button>
        )}

        {/* Create Custom Game */}
        {onCreateCustomGame && (
          <button
            onClick={onCreateCustomGame}
            className="w-full h-12 md:h-14 bg-[#0A0A0A] border-2 border-white/10 hover:border-white/25 rounded-2xl flex items-center justify-between px-6 active:scale-[0.98] transition-all group relative overflow-hidden mb-4"
          >
            <div className="flex items-center gap-2 relative z-10">
              <svg className="w-4 h-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-zinc-300 text-sm md:text-base font-[1000] italic leading-none uppercase tracking-tighter">
                CREATE CUSTOM GAME
              </span>
            </div>
            <span className="text-zinc-600 text-[9px] font-black italic uppercase tracking-wider relative z-10">
              {hasGamePass ? '0.0025 SOL' : '0.0225 SOL'}
            </span>
          </button>
        )}

        {/* Info */}
        <p className="text-[8px] md:text-[9px] text-zinc-500 text-center font-black uppercase tracking-widest px-4 opacity-50 italic leading-relaxed">
          2 free entries every 6h • Top 5 split prize pool
        </p>
      </div>
    </div>
  );
};

export default PlayView;

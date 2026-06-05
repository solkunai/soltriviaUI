/**
 * RoundsViewV2 — web W2 (Daily Round entry, desktop scale).
 * Lives inside WebShell. Header → big prize hero → 2-col (prize split + how
 * it works) → sticky bottom CTA.
 */
import React, { useEffect, useState } from 'react';
import { useConnection } from '../src/contexts/WalletContext';
import { useIsMobile } from '../src/hooks/useIsMobile';
import { getCurrentRoundKey } from '../src/utils/api';
import {
  fetchTierRound,
  contractRoundIdFromDateAndNumber,
} from '../src/utils/soltriviaContract';
import { TRIVIA_PRIZE_BPS } from '../src/utils/constants';

interface Props {
  lives: number | null;
  walletConnected: boolean;
  entering?: boolean;
  /** How many times the player has already entered THIS round. First entry is free of life cost; entries 2-5 cost 1 life each. */
  roundEntriesUsed: number;
  /** Cap on entries per round (5). */
  roundEntriesMax: number;
  onStartQuiz: () => void;
  onConnectWallet: () => void;
  onOpenBuyLives: () => void;
}

function getNextRoundCountdown(): string {
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
  const diffMs = Math.max(0, next.getTime() - now.getTime());
  const totalSec = Math.floor(diffMs / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function getCurrentRoundNumber(): number {
  return Math.floor(new Date().getUTCHours() / 6) + 1;
}

// Derived from the canonical on-chain split (TRIVIA_PRIZE_BPS) so the display
// can never drift out of sync with the contract: 50 / 20 / 15 / 10 / 5.
const PRIZE_EMOJI = ['🥇', '🥈', '🥉', null, null];
const PRIZE_SPLITS = TRIVIA_PRIZE_BPS.map((bps, i) => ({
  rank: i + 1,
  pct: bps / 100,
  emoji: PRIZE_EMOJI[i],
}));

const HOW_STEPS = [
  { t: 'Pay 0.02 SOL to enter', d: 'Your fee stacks into the pool' },
  { t: '10 random questions, 10s each', d: 'No category picking' },
  { t: 'Fastest + most correct wins', d: 'Speed bonus on every correct' },
  { t: 'Top 5 split the pool', d: '50 / 25 / 15 / 7 / 3%' },
];

const RoundsViewV2: React.FC<Props> = ({
  lives,
  walletConnected,
  entering = false,
  roundEntriesUsed,
  roundEntriesMax,
  onStartQuiz,
  onConnectWallet,
  onOpenBuyLives,
}) => {
  const { connection } = useConnection();
  const isMobile = useIsMobile();
  const [pool, setPool] = useState(0);
  const [players, setPlayers] = useState(0);
  const [countdown, setCountdown] = useState(getNextRoundCountdown());

  useEffect(() => {
    const id = setInterval(() => setCountdown(getNextRoundCountdown()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!connection) return;
    let mounted = true;
    const refresh = async () => {
      try {
        const { date, roundNumber } = getCurrentRoundKey();
        const contractRoundId = contractRoundIdFromDateAndNumber(date, roundNumber);
        const results = await Promise.allSettled(
          [0, 1, 2, 3].map((i) => fetchTierRound(connection, contractRoundId, i)),
        );
        if (!mounted) return;
        let totalPot = 0;
        let totalPlayers = 0;
        for (const r of results) {
          if (r.status === 'fulfilled' && r.value) {
            totalPot += r.value.totalPot;
            totalPlayers += r.value.entryCount;
          }
        }
        setPool(totalPot / 1_000_000_000);
        setPlayers(totalPlayers);
      } catch {
        /* non-fatal */
      }
    };
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [connection]);

  // Entry state. First entry is free of life cost; entries 2-5 each consume 1 life;
  // after 5 entries the player is locked out of this round (the contract enforces
  // this server-side as well — see App.tsx handleStartQuiz pre-flight check).
  const entriesLeft = Math.max(0, roundEntriesMax - roundEntriesUsed);
  const isFirstEntry = roundEntriesUsed === 0;
  const isAtMax = entriesLeft <= 0;
  const hasLives = (lives ?? 0) > 0;
  const canPlay = walletConnected && !isAtMax && (isFirstEntry || hasLives);

  const poolDisplay = pool >= 1 ? pool.toFixed(2) : pool.toFixed(4);
  const ctaLabel = !walletConnected
    ? 'CONNECT WALLET →'
    : isAtMax
      ? 'MAX ENTRIES REACHED · JOIN NEXT ROUND'
      : isFirstEntry
        ? 'ENTER ROUND · 0.02 SOL →'
        : hasLives
          ? `RE-ENTER · 0.02 SOL + 1 LIFE (${roundEntriesUsed}/${roundEntriesMax}) →`
          : 'GET LIVES TO RE-ENTER →';

  const handleCta = () => {
    if (entering || isAtMax) return;
    if (!walletConnected) onConnectWallet();
    else if (!isFirstEntry && !hasLives) onOpenBuyLives();
    else onStartQuiz();
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 11, color: '#14F195', letterSpacing: '0.18em' }}
        >
          ROUND #{getCurrentRoundNumber()} · 4/DAY · EVERY 6H
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 54, lineHeight: 0.9, letterSpacing: '-0.02em' }}
        >
          COMPETE FOR{' '}
          <span
            style={{
              background: 'linear-gradient(90deg,#14F195 0%,#7C8DFF 50%,#9945FF 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            SOL
          </span>
        </h1>
      </div>

      {/* Hero pool */}
      <div
        className="rounded-2xl mb-5 flex items-end justify-between gap-6"
        style={{
          background: 'linear-gradient(110deg,#14F195 0%,#00FFA3 60%,#7CD9FF 100%)',
          color: '#000',
          padding: '28px 32px',
          boxShadow: '0 26px 60px -22px rgba(20,241,149,0.6)',
        }}
      >
        <div>
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.14em' }}
          >
            PRIZE POOL · GROWING
          </div>
          <div
            className="font-black italic mt-1"
            style={{
              fontSize: 88,
              lineHeight: 0.85,
              letterSpacing: '-0.04em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {poolDisplay}
          </div>
          <div
            className="font-black italic uppercase mt-2"
            style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em' }}
          >
            SOL · {players} ENTRIES
          </div>
        </div>
        <div
          className="text-center"
          style={{ background: 'rgba(0,0,0,0.16)', padding: '14px 18px', borderRadius: 10 }}
        >
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em' }}
          >
            ENDS IN
          </div>
          <div
            className="font-black italic mt-1"
            style={{
              fontSize: 30,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {countdown}
          </div>
        </div>
      </div>

      {/* 2-col: Prize split + How it works */}
      <div
        className="mb-5"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.2fr 1fr', gap: 18 }}
      >
        {/* Prize split */}
        <div
          className="rounded-2xl"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255,215,0,0.33)',
            padding: '18px 20px',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="font-black italic uppercase"
              style={{ fontSize: 10, color: '#FFD700', letterSpacing: '0.14em' }}
            >
              TOP 5 SPLIT 90% OF POOL
            </span>
            <span
              className="font-black italic uppercase"
              style={{
                fontSize: 9,
                color: '#71717a',
                letterSpacing: '0.14em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              10% PLATFORM
            </span>
          </div>
          {PRIZE_SPLITS.map((p, i) => {
            const prizeSol = pool * (p.pct / 100) * 0.9;
            const barColor =
              p.rank === 1
                ? '#FFD700'
                : p.rank === 2
                  ? '#FFE680'
                  : p.rank === 3
                    ? '#FFC857'
                    : 'rgba(255,255,255,0.2)';
            return (
              <div
                key={p.rank}
                className="flex items-center gap-3 py-2.5"
                style={{
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <span style={{ fontSize: 18, width: 24 }}>{p.emoji || ''}</span>
                <span
                  className="font-black italic"
                  style={{
                    fontSize: 16,
                    color: p.rank === 1 ? '#FFD700' : '#a1a1aa',
                    width: 30,
                  }}
                >
                  #{p.rank}
                </span>
                <div
                  className="flex-1 rounded-full overflow-hidden"
                  style={{ background: '#000', height: 8 }}
                >
                  <div
                    style={{ height: '100%', width: `${p.pct * 2}%`, background: barColor }}
                  />
                </div>
                <span
                  className="font-black italic uppercase"
                  style={{
                    fontSize: 10,
                    color: '#71717a',
                    width: 36,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {p.pct}%
                </span>
                <span
                  className="font-black italic"
                  style={{
                    fontSize: 18,
                    color: '#FFD700',
                    width: 80,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {prizeSol.toFixed(3)}
                </span>
              </div>
            );
          })}
        </div>

        {/* How it works */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div
            className="font-black italic uppercase"
            style={{
              fontSize: 10,
              color: '#14F195',
              letterSpacing: '0.18em',
              padding: '14px 18px 8px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            HOW IT WORKS
          </div>
          {HOW_STEPS.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <span
                className="font-black italic"
                style={{
                  fontSize: 22,
                  color: '#14F195',
                  width: 30,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.03em',
                }}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="flex-1 min-w-0">
                <div
                  className="font-black italic uppercase"
                  style={{ fontSize: 12, color: '#fff', letterSpacing: '0.12em' }}
                >
                  {s.t}
                </div>
                <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                  {s.d}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky bottom CTA */}
      <div
        className="sticky"
        style={{
          bottom: 20,
          background: 'rgba(2,2,2,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(20,241,149,0.33)',
          borderRadius: 14,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
        }}
      >
        <div className="flex-1">
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.14em' }}
          >
            TOTAL COST
          </div>
          <div
            className="font-black italic mt-1 text-white"
            style={{
              fontSize: 22,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            0.0225{' '}
            <span style={{ fontSize: 11, color: '#71717a' }}>SOL</span>
          </div>
        </div>
        <button
          onClick={handleCta}
          disabled={entering || isAtMax}
          className="font-black italic uppercase rounded-full active:opacity-90"
          style={{
            background: isAtMax ? '#27272a' : '#14F195',
            color: isAtMax ? '#a1a1aa' : '#000',
            padding: '14px 32px',
            fontSize: 13,
            letterSpacing: '0.14em',
            border: 'none',
            cursor: entering || isAtMax ? 'not-allowed' : 'pointer',
            opacity: entering ? 0.65 : isAtMax ? 0.55 : 1,
            transition: 'opacity 0.15s ease, background 0.15s ease',
          }}
        >
          {entering ? 'ENTERING...' : ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default RoundsViewV2;

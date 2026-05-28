/**
 * FreePlayViewV2 — web Free Play / Train Up page. Lives inside WebShell.
 * Lifetime stats + quick-start tiles + 7-category grid + Mixed tile.
 * Game Pass gate: Pass = unlimited + pick category. No Pass = 10 lifetime
 * free games + Mixed only.
 */
import React, { useState } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';

interface Props {
  hasGamePass?: boolean;
  practiceRunsLeft?: number;
  onStartPractice?: () => void;
  onBuyGamePass?: () => void;
}

type Category = {
  id: string;
  label: string;
  sub: string;
  color: string;
  acc: number;
  played: number;
};

const CATEGORIES: Category[] = [
  { id: 'sports', label: 'SPORTS', sub: 'GOALS · RECORDS', color: '#14F195', acc: 78, played: 24 },
  { id: 'history', label: 'HISTORY', sub: 'EMPIRES · WARS', color: '#FFD700', acc: 62, played: 18 },
  { id: 'ent', label: 'ENTERTAINMENT', sub: 'FILM · MUSIC', color: '#a855f7', acc: 71, played: 31 },
  { id: 'geo', label: 'GEOGRAPHY', sub: 'MAPS · CAPITALS', color: '#3b82f6', acc: 55, played: 12 },
  { id: 'tech', label: 'SCIENCE & TECH', sub: 'PHYSICS · BIO', color: '#22D3EE', acc: 68, played: 22 },
  { id: 'web3', label: 'CRYPTO & WEB3', sub: 'CHAINS · DEFI', color: '#F472B6', acc: 84, played: 42 },
  { id: 'gk', label: 'GENERAL KNOWLEDGE', sub: 'TRIVIA · MIX', color: '#a1a1aa', acc: 60, played: 15 },
];

function getWeakest(): Category {
  return CATEGORIES.reduce((a, b) => (a.acc < b.acc ? a : b));
}

const FREE_GAMES_LIFETIME_CAP = 10;

const FreePlayViewV2: React.FC<Props> = ({
  hasGamePass,
  practiceRunsLeft = 10,
  onStartPractice,
  onBuyGamePass,
}) => {
  const [pick, setPick] = useState<string>('mixed');
  const isMobile = useIsMobile();
  const weakest = getWeakest();
  const freeGamesRemaining = hasGamePass
    ? Infinity
    : Math.max(0, practiceRunsLeft);
  const canPickCategory = hasGamePass;
  const canPlayMixed = hasGamePass || freeGamesRemaining > 0;

  const selectedColor =
    pick === 'daily'
      ? '#FFD700'
      : pick === 'mixed'
        ? '#14F195'
        : CATEGORIES.find((c) => c.id === pick)?.color || '#14F195';

  const handlePick = (id: string) => {
    if (!canPickCategory && id !== 'mixed') return;
    setPick(id);
  };

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 11, color: '#14F195', letterSpacing: '0.18em' }}
        >
          FREE PLAY · NO STAKES
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}
        >
          TRAIN <span style={{ color: '#14F195' }}>UP</span>
        </h1>
        {!hasGamePass && (
          <div
            className="font-black italic uppercase mt-2"
            style={{
              fontSize: 10,
              color: '#71717a',
              letterSpacing: '0.14em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {freeGamesRemaining} OF {FREE_GAMES_LIFETIME_CAP} FREE PLAYS LEFT · MIXED ONLY
          </div>
        )}
      </div>

      {/* Lifetime stats strip */}
      <div
        className="rounded-2xl mb-4 flex"
        style={{
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.08)',
          padding: '14px 0',
        }}
      >
        {[
          { label: 'Q ANSWERED', value: '164', color: '#fff' },
          { label: 'AVG ACC', value: '68%', color: '#14F195' },
          { label: 'BEST CAT', value: 'WEB3', color: '#F472B6' },
          { label: 'STREAK', value: '🔥 5', color: '#FFD700' },
        ].map((s, i) => (
          <div
            key={s.label}
            className="flex-1 text-center"
            style={{
              borderRight: i < 3 ? '1px solid rgba(255,255,255,0.08)' : 'none',
              padding: '0 12px',
            }}
          >
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.18em' }}
            >
              {s.label}
            </div>
            <div
              className="font-black italic mt-1"
              style={{
                fontSize: 22,
                color: s.color,
                letterSpacing: '-0.02em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Quick-start tiles */}
      <div
        className="mb-4"
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
      >
        {/* Daily Challenge */}
        <button
          onClick={() => handlePick('daily')}
          className="text-left rounded-xl active:opacity-90 relative"
          style={{
            background: 'linear-gradient(135deg,#FFD700 0%,#FFE680 100%)',
            color: '#000',
            padding: '14px 18px',
            border: pick === 'daily' ? '2px solid #fff' : '2px solid transparent',
            cursor: canPickCategory ? 'pointer' : 'not-allowed',
            opacity: canPickCategory ? 1 : 0.55,
            minHeight: 96,
          }}
        >
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 9, opacity: 0.7, letterSpacing: '0.14em' }}
          >
            DAILY · 02:14 LEFT
          </div>
          <div
            className="font-black italic uppercase mt-2"
            style={{ fontSize: 22, lineHeight: 1, letterSpacing: '-0.02em' }}
          >
            CHALLENGE
          </div>
          <div
            className="font-black italic uppercase mt-2"
            style={{ fontSize: 8, opacity: 0.6, letterSpacing: '0.14em' }}
          >
            10Q · LEADERBOARD
          </div>
        </button>

        {/* Weakest */}
        <button
          onClick={() => handlePick(weakest.id)}
          className="text-left rounded-xl active:opacity-90"
          style={{
            background: '#0a0a0a',
            border: `1.5px solid ${pick === weakest.id ? '#FF3131' : 'rgba(255,49,49,0.4)'}`,
            color: '#fff',
            padding: '14px 18px',
            cursor: canPickCategory ? 'pointer' : 'not-allowed',
            opacity: canPickCategory ? 1 : 0.55,
            minHeight: 96,
          }}
        >
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 9, color: '#FF3131', letterSpacing: '0.14em' }}
          >
            DUE FOR PRACTICE
          </div>
          <div
            className="font-black italic uppercase mt-2"
            style={{ fontSize: 22, lineHeight: 1, letterSpacing: '-0.02em' }}
          >
            {weakest.label.split(' ')[0]}
          </div>
          <div
            className="font-black italic uppercase mt-2"
            style={{
              fontSize: 9,
              color: '#71717a',
              letterSpacing: '0.14em',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {weakest.acc}% ACC · WEAKEST
          </div>
        </button>
      </div>

      {/* All categories */}
      <div
        className="font-black italic uppercase mb-2"
        style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}
      >
        ALL CATEGORIES
      </div>
      <div
        className="mb-3"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 10 }}
      >
        {CATEGORIES.map((c) => {
          const sel = pick === c.id;
          const lowAcc = c.acc < 65;
          return (
            <button
              key={c.id}
              onClick={() => handlePick(c.id)}
              className="text-left rounded-xl active:opacity-90"
              style={{
                background: sel ? `${c.color}1F` : '#0a0a0a',
                border: `1.5px solid ${sel ? c.color : `${c.color}55`}`,
                padding: '12px 14px',
                color: '#fff',
                cursor: canPickCategory ? 'pointer' : 'not-allowed',
                opacity: canPickCategory ? 1 : 0.45,
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="font-black italic uppercase"
                  style={{ fontSize: 12, color: c.color, letterSpacing: '-0.01em' }}
                >
                  {c.label.split(' & ')[0].split(' ')[0]}
                </div>
                {lowAcc ? (
                  <span
                    className="font-black italic"
                    style={{ fontSize: 11, color: '#FF3131' }}
                  >
                    !
                  </span>
                ) : null}
              </div>
              <div className="flex items-baseline justify-between mt-2">
                <span
                  className="font-black italic uppercase"
                  style={{
                    fontSize: 9,
                    color: '#71717a',
                    letterSpacing: '0.14em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {c.played} PLAYED
                </span>
                <span
                  className="font-black italic"
                  style={{
                    fontSize: 16,
                    color: c.color,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {c.acc}
                  <span style={{ fontSize: 10, color: '#71717a', marginLeft: 1 }}>
                    %
                  </span>
                </span>
              </div>
              <div
                className="rounded-full overflow-hidden mt-2"
                style={{ height: 4, background: 'rgba(255,255,255,0.06)' }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${c.acc}%`,
                    background: c.color,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* MIXED tile */}
      <button
        onClick={() => handlePick('mixed')}
        className="w-full rounded-xl flex items-center gap-3 active:opacity-90 mb-4"
        style={{
          background: pick === 'mixed' ? 'rgba(20,241,149,0.08)' : '#0a0a0a',
          border: `1.5px dashed ${pick === 'mixed' ? '#14F195' : 'rgba(255,255,255,0.2)'}`,
          padding: '14px 18px',
          color: '#fff',
          cursor: canPlayMixed ? 'pointer' : 'not-allowed',
          opacity: canPlayMixed ? 1 : 0.55,
        }}
      >
        <div
          className="rounded-md flex items-center justify-center"
          style={{
            width: 34,
            height: 34,
            background: 'rgba(20,241,149,0.13)',
            border: '1px solid rgba(20,241,149,0.33)',
            color: '#14F195',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#14F195" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.582a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0Z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 15, letterSpacing: '-0.01em' }}
          >
            MIXED · SURPRISE ME
          </div>
          <div
            className="font-black italic uppercase mt-1"
            style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}
          >
            10 RANDOM QUESTIONS ACROSS ALL CATEGORIES
          </div>
        </div>
        <span className="font-black italic" style={{ fontSize: 18, color: '#14F195' }}>
          →
        </span>
      </button>

      {/* Game Pass nudge */}
      {!hasGamePass && (
        <button
          onClick={onBuyGamePass}
          className="w-full rounded-xl flex items-center gap-3 active:opacity-90 mb-4"
          style={{
            background: 'rgba(20,241,149,0.08)',
            border: '1px solid rgba(20,241,149,0.4)',
            padding: '14px 18px',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          <div className="flex-1 text-left">
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 11, color: '#14F195', letterSpacing: '0.14em' }}
            >
              UNLOCK ALL CATEGORIES
            </div>
            <div
              className="text-zinc-300 font-bold mt-1"
              style={{ fontSize: 11, lineHeight: 1.3 }}
            >
              Game Pass = unlimited practice + pick any category + daily challenge
            </div>
          </div>
          <span
            className="font-black italic uppercase"
            style={{ fontSize: 13, color: '#14F195', letterSpacing: '0.14em' }}
          >
            GET →
          </span>
        </button>
      )}

      {/* Sticky CTA */}
      <button
        onClick={onStartPractice}
        className="w-full font-black italic uppercase rounded-full active:opacity-90"
        style={{
          background: selectedColor,
          color: '#000',
          padding: '14px 0',
          fontSize: 14,
          letterSpacing: '0.14em',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        START PRACTICE →
      </button>
    </div>
  );
};

export default FreePlayViewV2;

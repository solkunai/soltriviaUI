/**
 * DuelsViewV2 — web W4. Editorial header + red CREATE gradient hero with
 * inline wager picker + 2-col (open duels list + recent duels). Mock data
 * for v1; wire real fetches in follow-up.
 */
import React, { useState } from 'react';

interface Props {
  walletConnected: boolean;
  onCreateDuel?: (wagerSol: number) => void;
  onJoinDuel?: (duelId: number) => void;
}

const MOCK_OPEN = [
  { user: '@nftking', wager: 0.1, cat: 'CRYPTO', win: 62, expires: '10:00', avatar: '#FFC857' },
  { user: '@bonkmaxi', wager: 0.05, cat: 'GENERAL', win: 48, expires: '05:00', avatar: '#FF8C42' },
  { user: '@anchor_legend', wager: 0.5, cat: 'HISTORY', win: 71, expires: '03:00', avatar: '#A78BFA' },
  { user: '@seeker_pro', wager: 0.02, cat: 'SCI & TECH', win: 55, expires: '08:14', avatar: '#22D3EE' },
  { user: '@trivia_king', wager: 0.25, cat: 'GEOGRAPHY', win: 78, expires: '06:30', avatar: '#FACC15', hot: true },
];

const MOCK_RECENT = [
  { winner: '@solana_sage', loser: '@bonkmaxi', pot: 0.2, when: '2h ago' },
  { winner: '@anchor_legend', loser: '@degenmaxi', pot: 0.1, when: '4h ago' },
  { winner: '@nftking', loser: '@apemaxi', pot: 0.5, when: '6h ago' },
];

const WAGER_PRESETS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];

const DuelsViewV2: React.FC<Props> = ({ onCreateDuel }) => {
  const [wager, setWager] = useState(0.1);
  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 11, color: '#FF3131', letterSpacing: '0.18em' }}
        >
          1V1 · WINNER TAKES POT
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 54, lineHeight: 0.9, letterSpacing: '-0.02em' }}
        >
          DUELS
        </h1>
      </div>

      {/* Create hero */}
      <div
        className="rounded-2xl mb-5"
        style={{
          background: 'linear-gradient(135deg,#FF3131 0%,#FF7373 100%)',
          color: '#000',
          padding: '24px 28px',
          boxShadow: '0 22px 50px -22px rgba(255,49,49,0.7)',
        }}
      >
        <div className="flex items-end justify-between gap-6">
          <div>
            <div
              className="font-black italic uppercase"
              style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.14em' }}
            >
              CREATE A DUEL
            </div>
            <div
              className="font-black italic uppercase mt-1"
              style={{ fontSize: 42, lineHeight: 1, letterSpacing: '-0.02em' }}
            >
              READY TO 1V1?
            </div>
          </div>
          <button
            onClick={() => onCreateDuel?.(wager)}
            className="font-black italic uppercase rounded-full active:opacity-90"
            style={{
              background: '#000',
              color: '#fff',
              padding: '14px 28px',
              fontSize: 13,
              letterSpacing: '0.14em',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            CREATE DUEL · {(wager + 0.0025).toFixed(4)} SOL →
          </button>
        </div>
        <div
          className="font-black italic uppercase mt-5"
          style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.14em' }}
        >
          WAGER · SOL
        </div>
        <div
          className="mt-2"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}
        >
          {WAGER_PRESETS.map((w) => {
            const on = wager === w;
            return (
              <button
                key={w}
                onClick={() => setWager(w)}
                className="font-black italic rounded-lg active:opacity-90"
                style={{
                  padding: '12px 0',
                  fontSize: 18,
                  background: on ? '#000' : 'rgba(0,0,0,0.15)',
                  color: on ? '#FF3131' : '#000',
                  border: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  cursor: 'pointer',
                }}
              >
                {w < 1 ? w.toFixed(2) : w.toFixed(0)}
              </button>
            );
          })}
          <button
            className="font-black italic uppercase rounded-lg active:opacity-90"
            style={{
              padding: '12px 0',
              fontSize: 11,
              background: 'rgba(0,0,0,0.15)',
              color: '#000',
              border: 'none',
              letterSpacing: '0.14em',
              cursor: 'pointer',
            }}
          >
            CUSTOM
          </button>
        </div>
      </div>

      {/* 2-col: Open duels + Recent */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span
              className="font-black italic uppercase"
              style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}
            >
              OPEN DUELS
            </span>
            <span
              className="font-black italic uppercase"
              style={{ fontSize: 9, color: '#14F195', letterSpacing: '0.14em' }}
            >
              ↻ REFRESH
            </span>
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {MOCK_OPEN.map((o, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-4 py-3"
                style={{
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                {/* Placeholder avatar — circular gradient + username initial.
                    Swap to real player PFP URL once available from the duels
                    fetch (currently mock). */}
                <div
                  className="rounded-full flex items-center justify-center font-black italic"
                  style={{
                    width: 36,
                    height: 36,
                    background: `linear-gradient(135deg, ${o.avatar}, ${o.avatar}77)`,
                    border: `1.5px solid ${o.hot ? '#FF3131' : 'rgba(255,255,255,0.2)'}`,
                    color: '#000',
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {o.user[1]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="font-black italic text-white truncate"
                      style={{ fontSize: 15, letterSpacing: '-0.01em' }}
                    >
                      {o.user}
                    </span>
                    {o.hot ? (
                      <span
                        className="font-black italic uppercase rounded-full"
                        style={{
                          fontSize: 7,
                          color: '#FF3131',
                          background: 'rgba(255,49,49,0.18)',
                          border: '1px solid rgba(255,49,49,0.4)',
                          padding: '2px 6px',
                          letterSpacing: '0.14em',
                        }}
                      >
                        HOT
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="font-black italic uppercase mt-0.5"
                    style={{
                      fontSize: 9,
                      color: '#71717a',
                      letterSpacing: '0.14em',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {o.cat} · {o.win}% WIN RATE · EXPIRES {o.expires}
                  </div>
                </div>
                <span
                  className="font-black italic"
                  style={{
                    fontSize: 16,
                    color: '#FFD700',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {o.wager.toFixed(2)} SOL
                </span>
                <button
                  className="font-black italic uppercase rounded-full active:opacity-90"
                  style={{
                    background: '#FF3131',
                    color: '#000',
                    padding: '8px 16px',
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  JOIN
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            className="font-black italic uppercase mb-2"
            style={{ fontSize: 10, color: '#a1a1aa', letterSpacing: '0.18em' }}
          >
            RECENT DUELS
          </div>
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: '#0a0a0a',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {MOCK_RECENT.map((r, i) => (
              <div
                key={i}
                className="px-4 py-3"
                style={{
                  borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                }}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-black italic uppercase"
                    style={{ fontSize: 11, color: '#fff', letterSpacing: '-0.01em' }}
                  >
                    {r.winner}
                  </span>
                  <span
                    className="font-black italic uppercase"
                    style={{ fontSize: 9, color: '#71717a', letterSpacing: '0.14em' }}
                  >
                    BEAT {r.loser}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mt-1">
                  <span
                    className="font-black italic uppercase"
                    style={{
                      fontSize: 9,
                      color: '#52525b',
                      letterSpacing: '0.14em',
                    }}
                  >
                    {r.when}
                  </span>
                  <span
                    className="font-black italic"
                    style={{
                      fontSize: 13,
                      color: '#FFD700',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    +{r.pot.toFixed(3)} SOL
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DuelsViewV2;

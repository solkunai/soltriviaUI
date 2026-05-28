/**
 * GamePassViewV2 — web W7. Editorial header + 2-col (NFT ticket left,
 * perks right) + NERD callout + sticky CTA.
 */
import React, { useState } from 'react';
import { useIsMobile } from '../src/hooks/useIsMobile';

type PaymentToken = 'SOL' | 'USDC' | 'SKR' | 'NERD';
const TOKEN_CHIPS: PaymentToken[] = ['SOL', 'USDC', 'SKR', 'NERD'];

interface Props {
  hasGamePass?: boolean;
  isSeekerVerified?: boolean;
  onBuyGamePass?: (token: PaymentToken) => void;
}

const PERKS = [
  { t: 'Unlimited daily practice', d: 'No lives used, endless rounds' },
  { t: 'All 7 categories unlocked', d: 'Sports · Web3 · Sci-Tech · etc' },
  { t: '10% off all lives', d: 'Forever, stacks every purchase' },
  { t: 'Pass-only weekly leagues', d: 'Private boards · 0.5 SOL pools' },
  { t: '+25% XP every round', d: 'Climb all-time ranks faster' },
  { t: 'Custom game discount', d: 'Create rooms for 0.003 SOL' },
];

const GamePassViewV2: React.FC<Props> = ({ hasGamePass, onBuyGamePass }) => {
  const [token, setToken] = useState<PaymentToken>('SOL');
  const isMobile = useIsMobile();
  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-5">
        <div
          className="font-black italic uppercase"
          style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}
        >
          ONE-TIME UNLOCK · NON-TRANSFERABLE
        </div>
        <h1
          className="font-black italic uppercase mt-1 text-white"
          style={{ fontSize: 42, lineHeight: 0.95, letterSpacing: '-0.02em' }}
        >
          UNLOCK{' '}
          <span
            style={{
              background: 'linear-gradient(90deg,#14F195 0%,#7C8DFF 50%,#9945FF 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            EVERYTHING
          </span>
        </h1>
      </div>

      {/* 2-col layout */}
      <div
        className="mb-5"
        style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1fr', gap: 20 }}
      >
        {/* NFT ticket hero */}
        <div
          className="relative rounded-2xl flex flex-col"
          style={{
            background:
              'linear-gradient(135deg,#14F195 0%,#00FFA3 25%,#7C8DFF 60%,#9945FF 100%)',
            color: '#000',
            padding: '22px 26px',
            boxShadow:
              '0 30px 60px -22px rgba(153,69,255,0.6), inset 0 0 0 1px rgba(255,255,255,0.18)',
            minHeight: 280,
          }}
        >
          {/* perf circles */}
          <div
            style={{
              position: 'absolute',
              left: -10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#020202',
            }}
          />
          <div
            style={{
              position: 'absolute',
              right: -10,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#020202',
            }}
          />
          {/* Top row */}
          <div className="flex justify-between items-center">
            <span
              className="font-black italic uppercase"
              style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.18em' }}
            >
              SOL TRIVIA
            </span>
            <span
              className="font-black italic"
              style={{
                fontSize: 10,
                opacity: 0.7,
                letterSpacing: '0.14em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              #04217
            </span>
          </div>

          {/* Title block — centered vertically in the leftover space */}
          <div className="flex-1 flex flex-col justify-center">
            <div
              className="font-black italic"
              style={{ fontSize: 52, lineHeight: 0.9, letterSpacing: '-0.02em' }}
            >
              GAME PASS
            </div>
            <div
              className="font-black italic uppercase mt-2"
              style={{ fontSize: 10, opacity: 0.7, letterSpacing: '0.18em' }}
            >
              SEEKER EDITION · NON-TRANSFERABLE
            </div>
          </div>

          {/* Price row — pinned to the bottom of the ticket */}
          <div
            className="pt-3 flex items-end justify-between"
            style={{ borderTop: '1.5px dashed rgba(0,0,0,0.25)' }}
          >
            <div>
              <div
                className="font-black italic uppercase"
                style={{ fontSize: 9, opacity: 0.6, letterSpacing: '0.14em' }}
              >
                PRICE
              </div>
              <div
                className="font-black italic mt-1"
                style={{
                  fontSize: 32,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                }}
              >
                0.0625 <span style={{ fontSize: 13 }}>SOL</span>
              </div>
            </div>
            <span
              className="font-black italic uppercase"
              style={{
                fontSize: 10,
                opacity: 0.6,
                letterSpacing: '0.14em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ≈ $10 USD
            </span>
          </div>
        </div>

        {/* Perks */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#0a0a0a',
            border: '1px solid rgba(20,241,149,0.27)',
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
            WHAT YOU GET
          </div>
          {PERKS.map((p, i) => (
            <div
              key={p.t}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              <div
                className="rounded-md flex items-center justify-center flex-shrink-0"
                style={{
                  width: 26,
                  height: 26,
                  background: 'rgba(20,241,149,0.12)',
                  border: '1px solid rgba(20,241,149,0.33)',
                  color: '#14F195',
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                ✓
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-black italic uppercase text-white"
                  style={{ fontSize: 11, letterSpacing: '0.12em' }}
                >
                  {p.t}
                </div>
                <div style={{ fontSize: 10, color: '#71717a', marginTop: 2 }}>
                  {p.d}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Seeker discount callout */}
      <div
        className="rounded-xl mb-4 flex items-center gap-4"
        style={{
          background: 'rgba(20,241,149,0.06)',
          border: '1px solid rgba(20,241,149,0.27)',
          padding: '14px 18px',
        }}
      >
        <img
          src="/seeker-badge.png"
          alt="Seeker"
          style={{ width: 28, height: 28, objectFit: 'contain' }}
        />
        <div className="flex-1 min-w-0">
          <div
            className="font-black italic uppercase"
            style={{ fontSize: 10, color: '#14F195', letterSpacing: '0.18em' }}
          >
            ● SEEKER HOLDERS
          </div>
          <div style={{ fontSize: 12, color: '#d4d4d8', marginTop: 4 }}>
            Verify your Seeker Genesis Token for 50% off Game Pass and lives,{' '}
            <span className="font-black italic uppercase" style={{ color: '#14F195' }}>FOREVER!</span>
          </div>
        </div>
      </div>

      {/* Token picker — PAY WITH SOL/USDC/SKR/NERD */}
      {!hasGamePass && (
        <div className="mb-4">
          <div
            className="font-black italic uppercase mb-2"
            style={{ fontSize: 10, color: '#71717a', letterSpacing: '0.18em' }}
          >
            PAY WITH
          </div>
          <div className="flex gap-2">
            {TOKEN_CHIPS.map((t) => {
              const on = token === t;
              return (
                <button
                  key={t}
                  onClick={() => setToken(t)}
                  className="flex-1 font-black italic uppercase rounded-full active:opacity-90 flex items-center justify-center"
                  style={{
                    background: on ? 'rgba(20,241,149,0.13)' : '#0a0a0a',
                    border: `1px solid ${on ? '#14F195' : 'rgba(255,255,255,0.1)'}`,
                    color: on ? '#14F195' : '#a1a1aa',
                    padding: '10px 0',
                    fontSize: 11,
                    letterSpacing: '0.18em',
                    cursor: 'pointer',
                    gap: 6,
                  }}
                >
                  <img
                    src={`/token-${t.toLowerCase()}.png`}
                    alt={t}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      objectFit: 'contain',
                    }}
                  />
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={() => onBuyGamePass?.(token)}
        disabled={hasGamePass}
        className="w-full font-black italic uppercase rounded-xl active:opacity-90"
        style={{
          background: hasGamePass ? '#0a0a0a' : '#14F195',
          color: hasGamePass ? '#71717a' : '#000',
          border: hasGamePass ? '1px solid rgba(255,255,255,0.1)' : 'none',
          padding: '16px 0',
          fontSize: 13,
          letterSpacing: '0.14em',
          cursor: hasGamePass ? 'not-allowed' : 'pointer',
        }}
      >
        {hasGamePass
          ? 'PASS UNLOCKED ✓'
          : token === 'SOL'
            ? 'UNLOCK GAME PASS · 0.0625 SOL →'
            : token === 'USDC'
              ? 'UNLOCK GAME PASS · $10 USDC →'
              : `UNLOCK GAME PASS · ≈ $10 IN ${token} →`}
      </button>
    </div>
  );
};

export default GamePassViewV2;

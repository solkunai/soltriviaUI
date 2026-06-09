/**
 * ShareCardLib , shared primitives for the 16-card share-card system.
 *
 * Ported from `/Users/solkunai/Downloads/sharecards-handoff/src/components/`
 * (st-shared.jsx + st-sharecards.jsx). All cards render at 1200x630 (the
 * X / Twitter `summary_large_image` spec) on a dark `#020202` background,
 * with a colored radial glow, brand bug, diagonal headline tape, and an
 * optional 4-up stat report at the bottom.
 *
 * Used by RoundShareCard + DuelShareCard. Each renders ONE of 4 variants
 * per outcome (win/loss) based on the result data.
 */

import * as React from 'react';

// ── Design tokens (mirrors handoff ST object) ─────────────────────────────

export const ST = {
  bg: '#050505',
  surface: '#0A0A0A',
  primary: '#14F195',
  secondary: '#00FFA3',
  purple: '#a855f7',
  blue: '#3b82f6',
  red: '#FF3131',
  gold: '#FFD700',
  white: '#FFFFFF',
  textMuted: '#71717a',
  textDim: '#3f3f46',
  borderLight: 'rgba(255,255,255,0.10)',
  fontDisplay: '"Saira Condensed", "Bebas Neue", system-ui, sans-serif',
  fontBody: 'Inter, system-ui, sans-serif',
};

// CSS class shortcuts (loaded globally via index.html st-display + st-uplabel rules)
const cls = {
  display: 'st-display',
  uplabel: 'st-uplabel',
  num: 'st-num',
};

// ── BrandBug ─────────────────────────────────────────────────────────────

export function BrandBug({ size = 22 }: { size?: number }) {
  return (
    <div className={cls.display} style={{ fontSize: size, letterSpacing: '-0.01em' }}>
      <span style={{ color: '#fff' }}>SOL </span>
      <span
        style={{
          background: `linear-gradient(110deg, ${ST.primary}, #7C8DFF, ${ST.purple})`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        TRIVIA
      </span>
    </div>
  );
}

// ── CardFooter ───────────────────────────────────────────────────────────

export function CardFooter() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 42,
        borderTop: `1px solid ${ST.borderLight}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        background: 'rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 18,
            height: 18,
            borderRadius: 5,
            background: `linear-gradient(135deg, ${ST.primary}, ${ST.purple})`,
            display: 'grid',
            placeItems: 'center',
            color: '#000',
            fontSize: 9,
            fontWeight: 900,
          }}
        >
          ◎
        </div>
        <span
          className={cls.uplabel}
          style={{ fontSize: 11, color: '#a1a1aa', letterSpacing: '0.18em' }}
        >
          PLAY ON SOLANA · WIN REAL SOL
        </span>
      </div>
      <div
        className={cls.uplabel}
        style={{ fontSize: 13, color: '#fff', letterSpacing: '0.22em', fontWeight: 900 }}
      >
        SOLTRIVIA.APP →
      </div>
    </div>
  );
}

// ── CardShell ────────────────────────────────────────────────────────────

interface CardShellProps {
  accent: string;
  meta?: string; // top-right "ROUND #14 · MAY 26" style label
  children: React.ReactNode;
}

export function CardShell({ accent, meta, children }: CardShellProps) {
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        position: 'relative',
        overflow: 'hidden',
        background: '#020202',
        color: '#fff',
        fontFamily: ST.fontBody,
        borderRadius: 16,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 600,
          height: 600,
          borderRadius: '50%',
          filter: 'blur(80px)',
          opacity: 0.25,
          background: `radial-gradient(circle, ${accent}, transparent 60%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 40,
          right: 40,
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <BrandBug />
        {meta && (
          <div
            className={cls.uplabel}
            style={{ fontSize: 11, color: '#71717a', letterSpacing: '0.2em' }}
          >
            {meta}
          </div>
        )}
      </div>
      {children}
      <CardFooter />
    </div>
  );
}

// ── DiagonalTape ─────────────────────────────────────────────────────────

export function DiagonalTape({
  color = ST.gold,
  text,
  top = 84,
}: {
  color?: string;
  text: string;
  top?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: -50,
        right: -50,
        height: 36,
        background: color,
        transform: 'rotate(-3deg)',
        display: 'flex',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        boxShadow: `0 12px 30px -10px ${color}aa`,
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className={cls.uplabel}
          style={{
            fontSize: 18,
            color: '#000',
            padding: '0 16px',
            letterSpacing: '0.2em',
            fontFamily: ST.fontDisplay,
            fontWeight: 900,
            fontStyle: 'italic',
            whiteSpace: 'nowrap',
          }}
        >
          {text}
        </span>
      ))}
    </div>
  );
}

// ── StatReport ───────────────────────────────────────────────────────────

export interface StatItem {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: string;
  subColor?: string;
  gradient?: string;
}

export function StatReport({ items }: { items: StatItem[] }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 62,
        left: 40,
        right: 40,
        zIndex: 3,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1.4fr',
        gap: 24,
        alignItems: 'flex-end',
      }}
    >
      {items.map((s, i) => (
        <div key={i} style={{ textAlign: i === 3 ? 'right' : 'left' }}>
          <div
            className={cls.uplabel}
            style={{ fontSize: 10, color: '#71717a' }}
          >
            {s.label}
          </div>
          {i < 3 ? (
            <>
              <div
                className={`${cls.display} ${cls.num}`}
                style={{
                  fontSize: 46,
                  color: s.color || '#fff',
                  lineHeight: 0.9,
                  marginTop: 2,
                  ...(s.gradient
                    ? {
                        background: s.gradient,
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                      }
                    : {}),
                }}
              >
                {s.value}
              </div>
              <div
                className={cls.uplabel}
                style={{ fontSize: 9, color: s.subColor || '#52525b', marginTop: 2 }}
              >
                {s.sub}
              </div>
            </>
          ) : (
            <div
              className={cls.display}
              style={{ fontSize: 20, color: '#fff', lineHeight: 1.2, fontStyle: 'italic' }}
            >
              {s.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── BigGlyph ─────────────────────────────────────────────────────────────

export function BigGlyph({
  text,
  color,
  size = 280,
  rotate = -2,
  gradient,
  top = 160,
}: {
  text: string;
  color: string;
  size?: number;
  rotate?: number;
  gradient?: string;
  top?: number;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: 40,
        right: 40,
        textAlign: 'center',
        zIndex: 3,
      }}
    >
      <div
        className={cls.display}
        style={{
          fontSize: size,
          lineHeight: 0.85,
          letterSpacing: '-0.04em',
          transform: `rotate(${rotate}deg)`,
          ...(gradient
            ? {
                background: gradient,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                textShadow: `0 0 100px ${color}77`,
              }
            : {
                color,
                textShadow: `12px 12px 0 ${color}30, 0 0 100px ${color}77`,
              }),
        }}
      >
        {text}
      </div>
    </div>
  );
}

// ── PixelAvatar (8x8 grid, pacman-ghost style) ────────────────────────────

export function PixelAvatar({
  size = 160,
  color = '#D9E833',
  border = ST.primary,
  eyes = '#0a0a0a',
  mouthDown = false,
  style,
}: {
  size?: number;
  color?: string;
  border?: string;
  eyes?: string;
  mouthDown?: boolean;
  style?: React.CSSProperties;
}) {
  const grid = mouthDown
    ? ['11111111', '11111111', '12211221', '12211221', '11111111', '11211211', '12211221', '11111111']
    : ['11111111', '11111111', '12211221', '12211221', '11111111', '11211211', '11222211', '11111111'];
  return (
    <div
      style={{
        width: size,
        height: size,
        padding: size * 0.08,
        borderRadius: size * 0.22,
        background: '#0a0a0a',
        border: `2px solid ${border}`,
        boxShadow: `0 0 14px ${border}55`,
        display: 'inline-block',
        ...style,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gridTemplateRows: 'repeat(8, 1fr)',
        }}
      >
        {grid.flatMap((row, r) =>
          row.split('').map((cell, c) => (
            <div
              key={`${r}-${c}`}
              style={{
                background: cell === '1' ? color : cell === '2' ? eyes : 'transparent',
              }}
            />
          )),
        )}
      </div>
    </div>
  );
}

// ── CrownBadge (gold crown for duel winner avatar) ────────────────────────

export function CrownBadge() {
  return (
    <div
      style={{
        position: 'absolute',
        top: -20,
        right: -20,
        background: ST.gold,
        color: '#000',
        borderRadius: '50%',
        width: 56,
        height: 56,
        display: 'grid',
        placeItems: 'center',
        transform: 'rotate(8deg)',
        fontSize: 28,
        boxShadow: `0 8px 20px -6px ${ST.gold}aa`,
      }}
    >
      👑
    </div>
  );
}

// ── DuelVsLayout (used by 6 of 8 duel cards) ─────────────────────────────

interface DuelVsLayoutProps {
  won: boolean;
  myScore: number | string;
  oppScore: number | string;
  oppName?: string;
  stamp?: string; // 'W' or 'L' faded watermark
  myHandle?: string;
}

export function DuelVsLayout({
  won,
  myScore,
  oppScore,
  oppName = '@anchor_legend',
  stamp,
  myHandle = '@YOU',
}: DuelVsLayoutProps) {
  const accent = won ? ST.primary : ST.red;
  return (
    <div
      style={{
        position: 'absolute',
        top: 170,
        left: 40,
        right: 40,
        zIndex: 3,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 20,
      }}
    >
      {stamp && (
        <div
          style={{
            position: 'absolute',
            top: -10,
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: -1,
          }}
        >
          <div
            className={cls.display}
            style={{
              fontSize: 340,
              lineHeight: 0.85,
              color: accent,
              letterSpacing: '-0.04em',
              opacity: 0.15,
              transform: 'rotate(-3deg)',
            }}
          >
            {stamp}
          </div>
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-block', position: 'relative' }}>
          <PixelAvatar size={160} color="#D9E833" border={won ? accent : ST.red} mouthDown={!won} />
          {won && <CrownBadge />}
        </div>
        <div className={cls.display} style={{ fontSize: 32, color: '#fff', marginTop: 14 }}>
          {myHandle}
        </div>
        <div
          className={`${cls.display} ${cls.num}`}
          style={{
            fontSize: 96,
            color: won ? accent : '#52525b',
            lineHeight: 0.85,
            marginTop: 4,
            textShadow: won ? `0 0 40px ${accent}88` : 'none',
          }}
        >
          {myScore}
        </div>
      </div>
      <div
        className={cls.display}
        style={{
          fontSize: 96,
          color: ST.gold,
          textShadow: `6px 6px 0 rgba(0,0,0,0.5), 0 0 50px ${ST.gold}66`,
        }}
      >
        VS
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ display: 'inline-block', position: 'relative' }}>
          <PixelAvatar size={160} color="#A78BFA" border={won ? ST.red : accent} mouthDown={won} />
          {!won && <CrownBadge />}
        </div>
        <div className={cls.display} style={{ fontSize: 32, color: '#fff', marginTop: 14 }}>
          {oppName}
        </div>
        <div
          className={`${cls.display} ${cls.num}`}
          style={{
            fontSize: 96,
            color: won ? '#52525b' : accent,
            lineHeight: 0.85,
            marginTop: 4,
            textShadow: won ? 'none' : `0 0 40px ${accent}88`,
          }}
        >
          {oppScore}
        </div>
      </div>
    </div>
  );
}

// ── DuelPayoutBanner (used by 4 of 8 duel cards) ─────────────────────────

export function DuelPayoutBanner({
  won,
  amount = '0.10',
}: {
  won: boolean;
  amount?: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 62,
        left: 40,
        right: 40,
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <div>
        <div className={cls.uplabel} style={{ fontSize: 10, color: '#71717a' }}>
          {won ? 'PAYOUT · STRAIGHT TO WALLET' : 'LOST TO POT'}
        </div>
        <div
          className={`${cls.display} ${cls.num}`}
          style={{
            fontSize: 54,
            lineHeight: 0.85,
            marginTop: 4,
            color: won ? ST.gold : '#71717a',
            textShadow: won ? `0 0 30px ${ST.gold}66` : 'none',
          }}
        >
          {won ? `+${amount}` : `−${amount}`} <span style={{ fontSize: 22 }}>SOL</span>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div className={cls.uplabel} style={{ fontSize: 10, color: '#71717a' }}>
          WHO'S NEXT?
        </div>
        <div
          className={cls.display}
          style={{ fontSize: 24, color: '#fff', marginTop: 4, lineHeight: 1.1, fontStyle: 'italic' }}
        >
          {won ? '"too easy."' : '"I want a rematch."'}
        </div>
      </div>
    </div>
  );
}

/**
 * RoundShareCard , the daily-round "FLEX (or COPE) YOUR SCORE" stats card.
 *
 * Pattern matches DuelShareCard. 480x600 forwarded-ref node, screenshotted
 * to PNG via html-to-image, then attached to the X share intent.
 *
 * Four tier variants per [[project-share-cards-todo]]:
 *
 *   - wagmi  (rank 1-5  | score 10)   green  #14F195   "I PLACED #N"
 *   - almost (rank 6-15 | score 8-9)  gold   #FFD700   "ALMOST WAGMI"
 *   - ngmi   (rank 16-30| score 5-7)  zinc   #A1A1AA   "NGMI"
 *   - rekt   (rank 31+  | score 0-4)  red    #FF3131   "GOT REKT"
 *
 * Asset rules ([[feedback-check-design-handoff-first]] §6): real
 * `/trivia-logo-black.png`, no "ST" placeholder.
 *
 * Native port pending per [[feedback-native-and-web-must-ship-together]].
 */
import React from 'react';

export type RoundTier = 'wagmi' | 'almost' | 'ngmi' | 'rekt';

const TIER_THEME: Record<RoundTier, {
  accent: string;
  accentLight: string;
  accentDark: string;
  hero: string;
  eyebrow: string;
  pillBg: string;
  pillBorder: string;
  pillColor: string;
}> = {
  wagmi: {
    accent: '#14F195',
    accentLight: '#6EFFC4',
    accentDark: '#0AA968',
    hero: 'WAGMI',
    eyebrow: 'ROUND CLOSED',
    pillBg: 'rgba(20,241,149,0.12)',
    pillBorder: 'rgba(20,241,149,0.45)',
    pillColor: '#14F195',
  },
  almost: {
    accent: '#FFD700',
    accentLight: '#FFE26B',
    accentDark: '#D9A91A',
    hero: 'ALMOST WAGMI',
    eyebrow: 'ROUND CLOSED',
    pillBg: 'rgba(255,215,0,0.12)',
    pillBorder: 'rgba(255,215,0,0.45)',
    pillColor: '#FFD700',
  },
  ngmi: {
    accent: '#A1A1AA',
    accentLight: '#D4D4D8',
    accentDark: '#71717A',
    hero: 'NGMI',
    eyebrow: 'ROUND CLOSED',
    pillBg: 'rgba(161,161,170,0.12)',
    pillBorder: 'rgba(161,161,170,0.45)',
    pillColor: '#D4D4D8',
  },
  rekt: {
    accent: '#FF3131',
    accentLight: '#FF6B6B',
    accentDark: '#B82424',
    hero: 'GOT REKT',
    eyebrow: 'ROUND CLOSED',
    pillBg: 'rgba(255,49,49,0.12)',
    pillBorder: 'rgba(255,49,49,0.45)',
    pillColor: '#FF3131',
  },
};

export interface RoundShareCardProps {
  /** Tier picked by getRoundTier(score, rank). Drives accent + hero. */
  tier: RoundTier;
  /** Score out of 10 (e.g. 7). Rendered as the hero number. */
  score: number;
  /** Total points / XP earned this round. */
  points: number;
  /** Elapsed seconds. */
  timeSec: number;
  /** Final rank when known (round may not be finalized yet). */
  rank?: number | null;
}

const RoundShareCard = React.forwardRef<HTMLDivElement, RoundShareCardProps>(
  function RoundShareCard({ tier, score, points, timeSec, rank }, ref) {
    const t = TIER_THEME[tier];

    return (
      <div
        ref={ref}
        style={{
          width: 480,
          height: 600,
          background: '#08080a',
          color: '#fff',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: 28,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Tier-colored radial wash top-right */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(120% 100% at 80% 0%, ${t.accent}26, transparent 55%)`,
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            border: `1px solid ${t.accent}55`,
            borderRadius: 18,
            padding: 24,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header: brand logo + DAILY ROUND pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: '#0a0a0a',
                  border: `1px solid ${t.accent}40`,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 6,
                }}
              >
                <img
                  src="/trivia-logo-black.png"
                  alt="Sol Trivia"
                  crossOrigin="anonymous"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', filter: 'invert(1)' }}
                />
              </div>
              <span
                style={{
                  fontFamily: '"Saira Condensed", system-ui, sans-serif',
                  fontStyle: 'italic',
                  fontWeight: 900,
                  fontSize: 22,
                  letterSpacing: '-0.01em',
                }}
              >
                SOL TRIVIA
              </span>
            </div>
            <span
              style={{
                fontFamily: '"Saira Condensed", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 800,
                fontSize: 10,
                color: t.pillColor,
                padding: '5px 10px',
                borderRadius: 999,
                background: t.pillBg,
                border: `1px solid ${t.pillBorder}`,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              Daily Round
            </span>
          </div>

          {/* Hero */}
          <div style={{ textAlign: 'center', padding: '32px 0 16px', marginTop: 16 }}>
            <div
              style={{
                fontFamily: '"Saira Condensed", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 800,
                fontSize: 12,
                color: t.accent,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              {t.eyebrow}
            </div>
            <div
              style={{
                fontFamily: '"Saira Condensed", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: 34,
                color: '#fff',
                letterSpacing: '-0.02em',
                marginTop: 4,
              }}
            >
              {t.hero}
            </div>
            {/* Score gradient */}
            <div
              style={{
                fontFamily: '"Saira Condensed", "JetBrains Mono", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: 80,
                lineHeight: 1,
                marginTop: 6,
                background: `linear-gradient(135deg, ${t.accentLight}, ${t.accent} 50%, ${t.accentDark})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {score}
              <span style={{ fontSize: 32, color: '#71717a', WebkitTextFillColor: '#71717a' }}>
                /10
              </span>
            </div>
            <div
              style={{
                fontFamily: '"Saira Condensed", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 800,
                fontSize: 14,
                color: '#fff',
                marginTop: 6,
                letterSpacing: '0.04em',
              }}
            >
              {points.toLocaleString()} XP
            </div>
          </div>

          {/* Stat boxes */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {[
              ['Rank', rank ? `#${rank}` : 'TBD'],
              ['Time', `${timeSec}s`],
              ['XP', points.toLocaleString()],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 12,
                  padding: '11px 8px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontWeight: 700,
                    fontSize: 17,
                    color: '#fff',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {value}
                </div>
                <div
                  style={{
                    fontFamily: '"Saira Condensed", system-ui, sans-serif',
                    fontStyle: 'italic',
                    fontWeight: 800,
                    fontSize: 9,
                    color: '#71717a',
                    letterSpacing: '0.18em',
                    marginTop: 4,
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </div>
              </div>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <div
            style={{
              fontFamily: '"Saira Condensed", system-ui, sans-serif',
              fontStyle: 'italic',
              fontWeight: 800,
              fontSize: 10,
              color: t.accentDark,
              letterSpacing: '0.32em',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            Daily Trivia · soltrivia.app
          </div>
        </div>
      </div>
    );
  },
);

export default RoundShareCard;

/**
 * Pick the tier + tweet moment for a round result. Prefers rank when known
 * (rank only set after the round is finalized; mid-round it's null). Falls
 * back to raw score tier when rank not available.
 *
 * Returns the tier (for the card) and the matching share-moment (for pickTweet).
 */
export function getRoundTier(
  score: number,
  rank: number | null | undefined,
): { tier: RoundTier; moment: 'daily_round_wagmi' | 'daily_round_almost' | 'daily_round_ngmi' | 'daily_round_rekt' } {
  if (rank != null) {
    if (rank <= 5) return { tier: 'wagmi', moment: 'daily_round_wagmi' };
    if (rank <= 15) return { tier: 'almost', moment: 'daily_round_almost' };
    if (rank <= 30) return { tier: 'ngmi', moment: 'daily_round_ngmi' };
    return { tier: 'rekt', moment: 'daily_round_rekt' };
  }
  if (score >= 8) return { tier: 'wagmi', moment: 'daily_round_wagmi' };
  if (score >= 6) return { tier: 'almost', moment: 'daily_round_almost' };
  if (score >= 3) return { tier: 'ngmi', moment: 'daily_round_ngmi' };
  return { tier: 'rekt', moment: 'daily_round_rekt' };
}

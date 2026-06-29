/**
 * CustomGameShareCard , the post-custom-game stats card.
 *
 * Same pattern as DuelShareCard + RoundShareCard. 480x600 forwarded-ref
 * node, screenshotted via html-to-image and attached to the X share intent.
 *
 * Four tier variants per [[project-share-cards-todo]] (custom games brand
 * accent is cyan #38BDF8 per [[feedback-use-cyan-not-purple-for-nft]]):
 *
 *   - won    (rank 1)            cyan #38BDF8     "TOP OF LEADERBOARD"
 *   - podium (rank 2-3)          sky  #7DD3FC     "PODIUM FINISH"
 *   - played (rank 4+ or none)   zinc             "JUST PLAYED"
 *   - rekt   (low accuracy)      red  #FF3131     "GOT REKT"
 *
 * Creator-funded games get an amber pill instead of cyan (matches the
 * existing CustomGameResultsView header treatment).
 *
 * Native port pending per [[feedback-native-and-web-must-ship-together]].
 */
import React from 'react';

export type CustomGameTier = 'won' | 'podium' | 'played' | 'rekt';

const TIER_THEME: Record<CustomGameTier, {
  accent: string;
  accentLight: string;
  accentDark: string;
  hero: string;
  eyebrow: string;
}> = {
  won: {
    accent: '#38BDF8',
    accentLight: '#7DD3FC',
    accentDark: '#0284C7',
    hero: 'TOP OF LEADERBOARD',
    eyebrow: '#1 FINISH',
  },
  podium: {
    accent: '#7DD3FC',
    accentLight: '#BAE6FD',
    accentDark: '#38BDF8',
    hero: 'PODIUM FINISH',
    eyebrow: 'TOP 3',
  },
  played: {
    accent: '#A1A1AA',
    accentLight: '#D4D4D8',
    accentDark: '#71717A',
    hero: 'JUST PLAYED',
    eyebrow: 'GAME COMPLETE',
  },
  rekt: {
    accent: '#FF3131',
    accentLight: '#FF6B6B',
    accentDark: '#B82424',
    hero: 'GOT REKT',
    eyebrow: 'GAME COMPLETE',
  },
};

export interface CustomGameShareCardProps {
  tier: CustomGameTier;
  /** Game title shown above the hero (truncated to fit). */
  gameName: string;
  /** Correct answers, e.g. 7. */
  correctCount: number;
  /** Total questions, e.g. 10. */
  totalQuestions: number;
  /** Total XP earned. */
  points: number;
  /** Elapsed seconds. */
  timeSec: number;
  /** Final rank when known (null mid-round). */
  rank?: number | null;
  /** Optional prize pool line, e.g. "5.0 SOL" or null when free game. */
  prizeLabel?: string | null;
  /** Pill flavor: cyan for paid, amber for creator-funded, zinc for free. */
  mode: 'paid' | 'creator-funded' | 'free';
}

const MODE_PILL: Record<CustomGameShareCardProps['mode'], { bg: string; border: string; color: string; label: string }> = {
  paid: {
    bg: 'rgba(56,189,248,0.12)',
    border: 'rgba(56,189,248,0.45)',
    color: '#38BDF8',
    label: 'Prize Game',
  },
  'creator-funded': {
    bg: 'rgba(251,191,36,0.12)',
    border: 'rgba(251,191,36,0.45)',
    color: '#FBBF24',
    label: 'Creator Funded',
  },
  free: {
    bg: 'rgba(161,161,170,0.12)',
    border: 'rgba(161,161,170,0.45)',
    color: '#D4D4D8',
    label: 'Custom Game',
  },
};

/**
 * Truncate long game names so they fit on a single line of the card.
 * Soft limit ~28 chars; ellipsize beyond that. Keeps the hero block
 * height consistent regardless of name length.
 */
function truncate(s: string, max = 28): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

const CustomGameShareCard = React.forwardRef<HTMLDivElement, CustomGameShareCardProps>(
  function CustomGameShareCard(
    { tier, gameName, correctCount, totalQuestions, points, timeSec, rank, prizeLabel, mode },
    ref,
  ) {
    const t = TIER_THEME[tier];
    const pill = MODE_PILL[mode];

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
          {/* Header: logo + mode pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  overflow: 'hidden',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <img
                  src="/sol_trivia_logo_final.png"
                  alt="Sol Trivia"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
                color: pill.color,
                padding: '5px 10px',
                borderRadius: 999,
                background: pill.bg,
                border: `1px solid ${pill.border}`,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              {pill.label}
            </span>
          </div>

          {/* Hero */}
          <div style={{ textAlign: 'center', padding: '24px 0 12px', marginTop: 12 }}>
            <div
              style={{
                fontFamily: '"Saira Condensed", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 800,
                fontSize: 11,
                color: t.accent,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              {t.eyebrow}
            </div>
            <div
              style={{
                fontFamily: '"Saira Condensed", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: 28,
                color: '#fff',
                letterSpacing: '-0.02em',
                marginTop: 2,
              }}
            >
              {t.hero}
            </div>
            <div
              style={{
                fontFamily: '"Saira Condensed", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 800,
                fontSize: 14,
                color: '#71717a',
                marginTop: 8,
                letterSpacing: '0.04em',
              }}
            >
              {truncate(gameName)}
            </div>
            <div
              style={{
                fontFamily: '"Saira Condensed", "JetBrains Mono", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: 64,
                lineHeight: 1,
                marginTop: 12,
                color: t.accent,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {correctCount}
              <span style={{ fontSize: 28, color: '#71717a' }}>
                /{totalQuestions}
              </span>
            </div>
            {prizeLabel && (
              <div
                style={{
                  fontFamily: '"Saira Condensed", system-ui, sans-serif',
                  fontStyle: 'italic',
                  fontWeight: 800,
                  fontSize: 11,
                  color: pill.color,
                  marginTop: 8,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                }}
              >
                Prize Pool · {prizeLabel}
              </div>
            )}
          </div>

          {/* Stat boxes */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
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
            Custom Trivia · soltrivia.app
          </div>
        </div>
      </div>
    );
  },
);

export default CustomGameShareCard;

/**
 * Pick the tier + tweet bank for a custom-game outcome. Rank-based when known
 * (rank == 1 → won; 2-3 → podium; else played/rekt by accuracy). Tweet bank
 * is custom_game_won when rank == 1, else custom_game_played.
 *
 * Custom game claim copy (custom_game_claim bank) lives in tweetVariants but
 * fires from the leaderboard/claim flow, NOT from this Results screen.
 */
export function getCustomGameTier(
  correctCount: number,
  totalQuestions: number,
  rank: number | null | undefined,
): { tier: CustomGameTier; moment: 'custom_game_won' | 'custom_game_played' } {
  const accuracy = totalQuestions > 0 ? correctCount / totalQuestions : 0;
  if (rank === 1) return { tier: 'won', moment: 'custom_game_won' };
  if (rank != null && rank <= 3) return { tier: 'podium', moment: 'custom_game_played' };
  if (accuracy < 0.4) return { tier: 'rekt', moment: 'custom_game_played' };
  return { tier: 'played', moment: 'custom_game_played' };
}

/**
 * DuelShareCard , the "FLEX THE DUEL" stats card.
 *
 * Renders the shareable PNG-ready stats graphic. Pattern matches the handoff
 * design at /tmp/sol-trivia-handoff-2026-06-03/claude-code-handoff/src/st-flows2.jsx
 * line 315 (`DuelShare` component). Used by DuelResultsView , an html-to-image
 * snapshot of this card gets attached to the share intent.
 *
 * Real stats only , no mock data. Pulls myScore, opponentScore, pot, etc.
 * from the live duel record.
 *
 * Native port note: SolTriviaNative needs a matching RN component using the
 * same data shape. react-native-view-shot replaces html-to-image there.
 * Per [[feedback-native-and-web-must-ship-together]] sync gap will be
 * tracked when the native duel flow port happens.
 */
import React from 'react';

const GOLD = '#FFD700';
const GOLD_LIGHT = '#FFE26B';
const GOLD_DARK = '#D9A91A';
const RED = '#FF3131';

export interface DuelShareCardProps {
  /** True = winner card, false = loss card. */
  won: boolean;
  /** Formatted prize line, e.g. "0.18 SOL" or "100 NERD". */
  prizeLabel: string;
  /** Formatted wager line, e.g. "0.1 SOL each". */
  wagerLabel: string;
  /** This player's score (tabular). */
  myScore: number;
  /** Opponent's score (tabular). */
  opponentScore: number;
  /** Opponent display name, e.g. username or short wallet. */
  opponentName: string;
  /** This player's correct count out of 5. */
  myCorrect: number;
  /** Opponent's correct count out of 5. */
  opponentCorrect: number;
}

/**
 * Fixed-size 480×600 card. Designed to be rendered off-screen + screenshotted
 * to PNG via html-to-image. Always dark canvas + gold accents on win, zinc
 * accents on loss.
 *
 * Receives a ref so the caller can target it for image capture. Forwards via
 * React.forwardRef so the DOM node is reachable.
 */
const DuelShareCard = React.forwardRef<HTMLDivElement, DuelShareCardProps>(
  function DuelShareCard(
    { won, prizeLabel, wagerLabel, myScore, opponentScore, opponentName, myCorrect, opponentCorrect },
    ref,
  ) {
    const accent = won ? GOLD : '#a1a1aa';
    const accentDim = won ? GOLD_DARK : '#52525b';

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
          // No box-shadow on the capture itself , the rendered card should
          // be flat. Shadows are applied by the surrounding UI when previewed.
        }}
      >
        {/* Top-right corner radial wash (gold for win, neutral for loss) */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(120% 100% at 80% 0%, ${accent}26, transparent 55%)`,
            pointerEvents: 'none',
          }}
        />

        {/* Inner card with brand border */}
        <div
          style={{
            position: 'relative',
            border: `1px solid ${accent}55`,
            borderRadius: 18,
            padding: 24,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header: logo + duel pill */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 9,
                  background: '#0a0a0a',
                  border: `1px solid ${accent}40`,
                  display: 'grid',
                  placeItems: 'center',
                  padding: 6,
                }}
              >
                {/* Real brand asset , NEVER the navy variant per
                    [[feedback-sol-trivia-logo]]. Lives under /public so it's
                    same-origin , html-to-image can read the bitmap without
                    a CORS dance. */}
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
                color: RED,
                padding: '5px 10px',
                borderRadius: 999,
                background: `${RED}1f`,
                border: `1px solid ${RED}55`,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
              }}
            >
              1v1 Duel
            </span>
          </div>

          {/* Hero text */}
          <div style={{ textAlign: 'center', padding: '32px 0 16px', marginTop: 16 }}>
            <div
              style={{
                fontFamily: '"Saira Condensed", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 800,
                fontSize: 12,
                color: accent,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              {won ? '⚔ DUEL WON' : '⚔ DUEL LOST'}
              {' '}
              <span style={{ color: '#71717a' }}>vs {opponentName}</span>
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
              {won ? 'I JUST WON' : 'GOT REKT'}
            </div>
            <div
              style={{
                fontFamily: '"Saira Condensed", "JetBrains Mono", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 900,
                fontSize: 60,
                lineHeight: 1,
                marginTop: 6,
                background: won
                  ? `linear-gradient(135deg, ${GOLD_LIGHT}, ${GOLD} 50%, ${GOLD_DARK})`
                  : 'linear-gradient(135deg, #d4d4d8, #a1a1aa 50%, #71717a)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {prizeLabel}
            </div>
            <div
              style={{
                fontFamily: '"Saira Condensed", system-ui, sans-serif',
                fontStyle: 'italic',
                fontWeight: 800,
                fontSize: 10,
                color: '#71717a',
                letterSpacing: '0.18em',
                marginTop: 10,
                textTransform: 'uppercase',
              }}
            >
              {wagerLabel}
            </div>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            {[
              ['My Score', myScore.toLocaleString()],
              ['Opp', opponentScore.toLocaleString()],
              ['Correct', `${myCorrect}/5 · ${opponentCorrect}/5`],
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

          {/* Spacer pushes footer to bottom */}
          <div style={{ flex: 1 }} />

          {/* Footer */}
          <div
            style={{
              fontFamily: '"Saira Condensed", system-ui, sans-serif',
              fontStyle: 'italic',
              fontWeight: 800,
              fontSize: 10,
              color: accentDim,
              letterSpacing: '0.32em',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            Play on Solana · soltrivia.app
          </div>
        </div>
      </div>
    );
  },
);

export default DuelShareCard;

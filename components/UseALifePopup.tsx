/**
 * UseALifePopup , v2.1 LIVES mechanic re-answer modal.
 *
 * Shows when a player picks a wrong answer (or runs out of time) and has both:
 *   - livesUsedA < 2     (per-game retry budget, server-enforced via v52 EF)
 *   - livesRemaining >= 1 (real lives count from player_lives table)
 *
 * Behavior:
 *   - Modal renders with a 5-second countdown ring
 *   - YES → onUse() , consume a life, the question is re-presented with a
 *     fresh 15-second clock; submit-answer fires with attempt_idx > 0
 *   - SKIP / countdown hits 0 → onSkip() , existing wrong-answer flow
 *     continues (reveal correct + advance to next question)
 *
 * Brand:
 *   - Gold #FFD700 USE LIFE button (the "spend" action)
 *   - Zinc outlined SKIP button (the safe-default action)
 *   - Saira italic uppercase headlines per the prototype
 */
import React, { useEffect, useState } from 'react';

interface UseALifePopupProps {
  /** Lives the player has left right now (after this retry would be N-1). */
  livesRemaining: number;
  /** Retries already used this game (max 2 total). Display only. */
  livesUsedA: number;
  /** Server is mid-submit. Disables buttons + dim until response. */
  disabled?: boolean;
  /** Spend a life and retry. */
  onUse: () => void;
  /** Skip the retry and let the existing wrong-answer flow run. */
  onSkip: () => void;
}

const COUNTDOWN_MS = 3000;
const RING_R = 48;
const RING_CIRC = 2 * Math.PI * RING_R;

const UseALifePopup: React.FC<UseALifePopupProps> = ({
  livesRemaining,
  livesUsedA,
  disabled,
  onUse,
  onSkip,
}) => {
  // Countdown ticks from 5.0 → 0 over COUNTDOWN_MS. When it hits 0, auto-skip.
  const [elapsedMs, setElapsedMs] = useState(0);
  const remainingMs = Math.max(0, COUNTDOWN_MS - elapsedMs);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const progress = elapsedMs / COUNTDOWN_MS; // 0 → 1

  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const e = Date.now() - startedAt;
      if (e >= COUNTDOWN_MS) {
        clearInterval(id);
        setElapsedMs(COUNTDOWN_MS);
        if (!disabled) onSkip();
      } else {
        setElapsedMs(e);
      }
    }, 60);
    return () => clearInterval(id);
    // We intentionally do NOT depend on disabled , the ref-stable startedAt
    // anchors the clock; pausing on disabled is handled by ignoring the
    // auto-skip when disabled is true at the moment of expiry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stroke offset for the SVG ring (drains as time passes).
  const dashoffset = RING_CIRC * progress;
  const ringColor = remainingSec <= 2 ? '#FF3131' : '#FFD700';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="use-a-life-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 200ms ease-out',
      }}
    >
      <div
        style={{
          background: '#0A0A0A',
          border: '1px solid rgba(255,215,0,0.45)',
          borderRadius: 20,
          padding: '28px 24px 24px',
          maxWidth: 360,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 30px 90px rgba(255,215,0,0.18)',
        }}
      >
        {/* Countdown ring */}
        <div style={{ position: 'relative', width: 112, height: 112, margin: '0 auto 18px' }}>
          <svg width="112" height="112" viewBox="0 0 112 112" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="56"
              cy="56"
              r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="6"
            />
            <circle
              cx="56"
              cy="56"
              r={RING_R}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={dashoffset}
              style={{ transition: 'stroke-dashoffset 60ms linear, stroke 200ms ease' }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
              fontWeight: 900,
              fontStyle: 'italic',
              fontSize: 44,
              color: ringColor,
              fontVariantNumeric: 'tabular-nums',
              transition: 'color 200ms ease',
            }}
          >
            {remainingSec}
          </div>
        </div>

        {/* Headlines */}
        <div
          id="use-a-life-title"
          style={{
            fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: 28,
            color: '#fff',
            letterSpacing: '-0.01em',
            textTransform: 'uppercase',
            lineHeight: 1,
          }}
        >
          USE A LIFE?
        </div>
        <div
          style={{
            fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
            fontWeight: 800,
            fontStyle: 'italic',
            fontSize: 11,
            color: '#FFD700',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginTop: 6,
          }}
        >
          RETRY {livesUsedA + 1} OF 2 · {livesRemaining} {livesRemaining === 1 ? 'LIFE' : 'LIVES'} LEFT
        </div>
        <p
          style={{
            color: '#a1a1aa',
            fontSize: 13,
            lineHeight: 1.4,
            margin: '14px 0 22px',
            fontWeight: 500,
          }}
        >
          Re-answer this question with a fresh 15-second clock. Costs 1 life.
        </p>

        {/* Buttons */}
        <button
          onClick={onUse}
          disabled={disabled}
          style={{
            width: '100%',
            background: '#FFD700',
            color: '#0a0a0a',
            border: 'none',
            borderRadius: 12,
            padding: '14px 18px',
            fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: 16,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            boxShadow: disabled ? 'none' : '0 12px 30px rgba(255,215,0,0.35)',
            transition: 'opacity 200ms, box-shadow 200ms',
          }}
        >
          {disabled ? 'WORKING…' : `USE LIFE (${livesRemaining})`}
        </button>
        <button
          onClick={onSkip}
          disabled={disabled}
          style={{
            width: '100%',
            background: 'transparent',
            color: '#a1a1aa',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 12,
            padding: '12px 18px',
            marginTop: 10,
            fontFamily: '"Saira Condensed", "Saira", system-ui, sans-serif',
            fontWeight: 800,
            fontStyle: 'italic',
            fontSize: 13,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.55 : 1,
            transition: 'opacity 200ms',
          }}
        >
          SKIP
        </button>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.96); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default UseALifePopup;

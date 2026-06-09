/**
 * JupiterVerifiedBadge — small inline badge that fetches the Jupiter token
 * metadata by mint and renders the Jupiter Verified logo when verified.
 *
 * Used anywhere a token symbol is displayed (custom game lobby/results, duel
 * waiting/results, profile claim cards) so users can spot legit tokens at a
 * glance. Hidden when:
 *   - mint is null/undefined (e.g., SOL games)
 *   - Jupiter hasn't indexed the token yet
 *   - token exists on Jupiter but is not verified (e.g., memecoins)
 *
 * Cheap: getJupiterToken is cached behind a single in-memory TTL map, so
 * many badges for the same mint share one fetch.
 */
import React, { useEffect, useState } from 'react';
import { getJupiterToken } from '../src/utils/jupiterTokens';

interface Props {
  /** SPL token mint to look up. null/undefined = render nothing (SOL game).
   *  Ignored when `verified` is passed in (caller already knows the answer). */
  mint?: string | null;
  /** Pre-known verification status. When provided, skips the Jupiter fetch.
   *  Use this in pickers/lists where the parent already has token metadata
   *  to avoid one HTTP request per badge. */
  verified?: boolean;
  /** Badge height in px (logo scales to width). Default 12. */
  size?: number;
  /** Optional inline style overrides (e.g., marginLeft / verticalAlign). */
  style?: React.CSSProperties;
}

export function JupiterVerifiedBadge({ mint, verified: verifiedProp, size = 12, style }: Props) {
  const [verifiedLocal, setVerifiedLocal] = useState(false);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    // Skip the fetch when the caller already provided the verification state.
    if (typeof verifiedProp === 'boolean') return;
    let cancelled = false;
    setVerifiedLocal(false);
    if (!mint) return;
    getJupiterToken(mint)
      .then((t) => {
        if (!cancelled) setVerifiedLocal(t?.isVerified === true);
      })
      .catch(() => {
        /* swallow — badge just stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [mint, verifiedProp]);

  const verified = typeof verifiedProp === 'boolean' ? verifiedProp : verifiedLocal;
  if (!verified) return null;

  // Wrap in span so the VRFD hover tooltip can position absolutely relative to
  // the badge. The native `title` is left in place as a fallback (touch devices
  // + accessibility tooling), but the styled span is what shows on desktop hover.
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 4,
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src="/jup_vrfd_nobg.png"
        alt="Jupiter Verified"
        title="VRFD"
        style={{
          height: size,
          width: 'auto',
          display: 'inline-block',
          verticalAlign: 'middle',
        }}
      />
      {hovered && (
        <span
          className="font-black italic uppercase"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#000',
            color: '#14F195',
            fontSize: 9,
            letterSpacing: '0.16em',
            padding: '4px 7px',
            borderRadius: 4,
            border: '1px solid rgba(20,241,149,0.45)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.55)',
          }}
        >
          VRFD
        </span>
      )}
    </span>
  );
}

export default JupiterVerifiedBadge;

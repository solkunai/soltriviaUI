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
  /** SPL token mint to look up. null/undefined = render nothing (SOL game). */
  mint?: string | null;
  /** Badge height in px (logo scales to width). Default 12. */
  size?: number;
  /** Optional inline style overrides (e.g., marginLeft / verticalAlign). */
  style?: React.CSSProperties;
}

export function JupiterVerifiedBadge({ mint, size = 12, style }: Props) {
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setVerified(false);
    if (!mint) return;
    getJupiterToken(mint)
      .then((t) => {
        if (!cancelled) setVerified(t?.isVerified === true);
      })
      .catch(() => {
        /* swallow — badge just stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, [mint]);

  if (!verified) return null;

  return (
    <img
      src="/jup_vrfd_nobg.png"
      alt="Jupiter Verified"
      title="Jupiter Verified"
      style={{
        height: size,
        width: 'auto',
        display: 'inline-block',
        verticalAlign: 'middle',
        marginLeft: 4,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

export default JupiterVerifiedBadge;

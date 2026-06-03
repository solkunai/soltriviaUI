/**
 * Pump.fun token-metadata fallback.
 *
 * When the user pastes a CA that's not in Jupiter's /all list (typical case:
 * a pump.fun token launched in the last few minutes, OR a pre-graduation
 * bonding-curve token that may never reach Jupiter), we try Pump.fun's
 * public frontend API to fetch metadata.
 *
 * Endpoint (community-known, unofficial): https://frontend-api-v3.pump.fun/coins/{mint}
 * Returns null if 404 or any error — caller treats as "not indexed".
 *
 * Note: this is purely for METADATA lookup (name, symbol, logo, decimals).
 * Routing a swap through pump.fun's bonding curve is a SEPARATE concern
 * handled by the backend swap-quote EF migration (next session).
 */
import type { JupiterToken } from './jupiterTokens';

const PUMP_API_BASE = 'https://frontend-api-v3.pump.fun/coins';

interface PumpCoin {
  mint: string;
  name?: string;
  symbol?: string;
  image_uri?: string;
  decimals?: number;
  // …many other fields irrelevant for our metadata lookup
}

const cache = new Map<string, JupiterToken | null>();

/**
 * Fetch a Pump.fun token's metadata by mint. Returns a JupiterToken-shape
 * object so callers can drop it into the same picker list as Jupiter tokens.
 *
 * Returns null if:
 *   - The mint isn't on Pump.fun (404)
 *   - The Pump.fun API is unreachable
 *   - The response is malformed
 *
 * Caches results (positive + negative) in-process for the session to keep
 * the picker fast on repeated lookups.
 */
export async function fetchPumpFunToken(mint: string): Promise<JupiterToken | null> {
  if (cache.has(mint)) return cache.get(mint) || null;
  try {
    const res = await fetch(`${PUMP_API_BASE}/${mint}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) {
      cache.set(mint, null);
      return null;
    }
    const data = (await res.json()) as PumpCoin;
    if (!data || !data.mint) {
      cache.set(mint, null);
      return null;
    }
    const token: JupiterToken = {
      address: data.mint,
      symbol: String(data.symbol || mint.slice(0, 4)),
      name: String(data.name || 'Pump.fun token'),
      // All pump.fun tokens are 6 decimals by default
      decimals: typeof data.decimals === 'number' ? data.decimals : 6,
      logoURI: data.image_uri || undefined,
      // Tag so callers can show a "Pump.fun" badge or pre-graduation warning
      tags: ['pump.fun'],
    };
    cache.set(mint, token);
    return token;
  } catch {
    cache.set(mint, null);
    return null;
  }
}

/** Best-guess detection of a base58 Solana mint address. */
export function looksLikeMintCA(s: string): boolean {
  const t = s.trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t);
}

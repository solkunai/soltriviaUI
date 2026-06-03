/**
 * Jupiter strict token list + metadata helpers.
 *
 * Fetches https://tokens.jup.ag/strict (Jupiter's curated whitelist of ~250
 * well-vetted Solana tokens with logos + decimals + symbols) and caches the
 * response for 5 min (TTL per the design handoff §5 WIRE marker).
 *
 * Used by SwapModal's TokenPickerSheet for the token list + logos. No client
 * API key needed (the endpoint is public). Logos served from Jupiter's CDN.
 */
import { useEffect, useState } from 'react';

export interface JupiterToken {
  /** SPL mint address (base58) */
  address: string;
  /** Display symbol like 'SOL', 'USDC', 'NERD' */
  symbol: string;
  /** Full name like 'Solana', 'USD Coin' */
  name: string;
  /** Mint decimals (9 for SOL, 6 for USDC, etc.) */
  decimals: number;
  /** CDN URL to the 64x64 logo PNG */
  logoURI?: string;
  /** Jupiter category tags (e.g. ['old-registry', 'community']) */
  tags?: string[];
}

/** Jupiter has multiple token lists:
 *    'strict'   ~250 — hand-curated, highest safety. USE FOR DUELS.
 *    'verified' ~2-3k — Jupiter's Verified tag filter from /all.
 *    'all'      ~10k+ — full registry. USE FOR SWAPS so users can swap any token. */
export type JupiterListMode = 'strict' | 'verified' | 'all';

const JUPITER_URLS: Record<JupiterListMode, string> = {
  strict: 'https://tokens.jup.ag/strict',
  // For verified, we fetch /all and filter to tokens carrying the 'verified' tag.
  // (Jupiter doesn't publish a dedicated /verified endpoint.)
  verified: 'https://tokens.jup.ag/all',
  all: 'https://tokens.jup.ag/all',
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min per design spec

// Per-mode in-memory caches. Survive mount/unmount cycles in the same session.
const caches: Partial<Record<JupiterListMode, { ts: number; tokens: JupiterToken[] }>> = {};
const inflights: Partial<Record<JupiterListMode, Promise<JupiterToken[]>>> = {};

/**
 * Tokens we consider "whitelisted" for ordering in the picker (shown first
 * with a ★ badge). Match by symbol on top of whatever Jupiter returns.
 *
 * SOL + USDC + USDT are universal. NERD + SKR are Sol Trivia ecosystem.
 * JUP + BONK + WIF are top Solana memes that often show up in user portfolios.
 */
const APP_WHITELIST_SYMBOLS = ['SOL', 'USDC', 'USDT', 'NERD', 'SKR', 'JUP', 'BONK', 'WIF'];

/**
 * Fetch a Jupiter token list. Defaults to `'all'` for the swap modal use case.
 * Use `'strict'` for duel token picker (more restrictive for wager safety).
 *
 * Cached per mode for 5 min. Multiple concurrent callers share the in-flight req.
 *
 * @param mode  'strict' | 'verified' | 'all'  (default 'all')
 */
export async function fetchJupiterTokens(mode: JupiterListMode = 'all'): Promise<JupiterToken[]> {
  const now = Date.now();
  const cached = caches[mode];
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.tokens;
  const existingInflight = inflights[mode];
  if (existingInflight) return existingInflight;

  const url = JUPITER_URLS[mode];
  const promise = (async () => {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`Jupiter token list HTTP ${res.status}`);
      const raw = await res.json();
      if (!Array.isArray(raw)) throw new Error('Unexpected Jupiter response shape');
      let tokens: JupiterToken[] = raw.map((t: any) => ({
        address: String(t.address),
        symbol: String(t.symbol || ''),
        name: String(t.name || t.symbol || ''),
        decimals: Number(t.decimals ?? 9),
        logoURI: t.logoURI ? String(t.logoURI) : undefined,
        tags: Array.isArray(t.tags) ? t.tags.map(String) : undefined,
      }));
      // For 'verified' mode, filter /all down to tokens carrying the Verified tag.
      if (mode === 'verified') {
        tokens = tokens.filter((t) => t.tags?.includes('verified'));
      }
      caches[mode] = { ts: Date.now(), tokens };
      return tokens;
    } finally {
      delete inflights[mode];
    }
  })();
  inflights[mode] = promise;
  return promise;
}

/** Find a single token by mint address. Returns null if not in the requested list. */
export async function getJupiterToken(
  mint: string,
  mode: JupiterListMode = 'all',
): Promise<JupiterToken | null> {
  const list = await fetchJupiterTokens(mode);
  return list.find((t) => t.address === mint) || null;
}

/** Synchronous read of the in-memory cache for a given mode. */
export function readCachedJupiterTokens(mode: JupiterListMode = 'all'): JupiterToken[] | null {
  const cached = caches[mode];
  if (!cached || Date.now() - cached.ts >= CACHE_TTL_MS) return null;
  return cached.tokens;
}

/**
 * Search the token list. Match by symbol/name (case-insensitive substring) OR
 * exact mint address. Returns whitelisted matches first, then everything else.
 */
export function searchTokens(query: string, list: JupiterToken[]): JupiterToken[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    // No query: whitelist first, then alphabetical for the rest.
    const wl = APP_WHITELIST_SYMBOLS
      .map((sym) => list.find((t) => t.symbol === sym))
      .filter(Boolean) as JupiterToken[];
    const wlSet = new Set(wl.map((t) => t.address));
    const rest = list
      .filter((t) => !wlSet.has(t.address))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    return [...wl, ...rest];
  }

  // Exact mint match wins.
  const exactMint = list.find((t) => t.address.toLowerCase() === q);
  if (exactMint) return [exactMint];

  // Substring match on symbol or name.
  const matches = list.filter((t) => {
    const blob = `${t.symbol} ${t.name}`.toLowerCase();
    return blob.includes(q);
  });

  // Whitelisted matches first.
  return matches.sort((a, b) => {
    const aWl = APP_WHITELIST_SYMBOLS.indexOf(a.symbol);
    const bWl = APP_WHITELIST_SYMBOLS.indexOf(b.symbol);
    if (aWl !== -1 && bWl === -1) return -1;
    if (bWl !== -1 && aWl === -1) return 1;
    if (aWl !== -1 && bWl !== -1) return aWl - bWl;
    return a.symbol.localeCompare(b.symbol);
  });
}

/** Is this symbol in our app whitelist? Used by the ★ badge in the picker. */
export function isWhitelisted(symbol: string): boolean {
  return APP_WHITELIST_SYMBOLS.includes(symbol);
}

/** Short-form CA display: '8Hb1…u3kP'. */
export function shortCA(mint: string): string {
  if (mint.length <= 10) return mint;
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

/** Recently-used token persistence in localStorage (max 5 entries, most-recent first). */
const RECENT_KEY = 'soltrivia:swap:recent_tokens';
const RECENT_MAX = 5;

export function getRecentTokenMints(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m: any) => typeof m === 'string').slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

export function pushRecentTokenMint(mint: string): void {
  try {
    const existing = getRecentTokenMints().filter((m) => m !== mint);
    const next = [mint, ...existing].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // localStorage not available (private browsing, etc.) — silent no-op
  }
}

/**
 * React hook: load tokens on mount, return [tokens, loading, error].
 * Defaults to `'all'` for swap UIs. Pass `'strict'` for duel token picker.
 */
export function useJupiterTokens(mode: JupiterListMode = 'all'): {
  tokens: JupiterToken[];
  loading: boolean;
  error: string | null;
} {
  const [tokens, setTokens] = useState<JupiterToken[]>(() => readCachedJupiterTokens(mode) || []);
  const [loading, setLoading] = useState<boolean>(() => readCachedJupiterTokens(mode) === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchJupiterTokens(mode);
        if (cancelled) return;
        setTokens(list);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load token list');
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  return { tokens, loading, error };
}

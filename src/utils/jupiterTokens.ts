/**
 * Jupiter Token V2 API client.
 *
 * Single source of truth for token data. V2 returns EVERYTHING in one call:
 * USD price, market cap, 24h change, holder count, verified status, audit
 * info (mint/freeze authority, top holders %), organic quality score, social
 * links, full trading stats for 5m/1h/6h/24h, and the icon URL.
 *
 * Replaces what we previously cobbled together from Jupiter strict + Jupiter
 * Price API + Birdeye. Free, no API key, no rate limits.
 *
 * Endpoints used:
 *   GET /tokens/v2/toptraded/24h          — default browse list (50 tokens)
 *   GET /tokens/v2/search?query=<text>    — search by name / symbol / mint
 *
 * Covers ALL Solana tokens including pre-graduation pump.fun, bags-launched,
 * and brand-new mints. Verified test: searched a pump.fun token launched
 * hours earlier and got full data back including the icon.
 */
import { useEffect, useState } from 'react';

/** Stats per interval (5m/1h/6h/24h) returned by V2. */
export interface TokenStatsInterval {
  priceChange?: number;        // percent (-29.67 = down 29.67%)
  liquidityChange?: number;
  volumeChange?: number;
  buyVolume?: number;
  sellVolume?: number;
  buyOrganicVolume?: number;
  sellOrganicVolume?: number;
  numBuys?: number;
  numSells?: number;
  numTraders?: number;
  numOrganicBuyers?: number;
  numNetBuyers?: number;
}

/** Security audit signal — used to warn users about risky tokens. */
export interface TokenAudit {
  /** Top holder concentration as percentage (e.g. 24.07 = top 10 hold 24%) */
  topHoldersPercentage?: number;
  /** Dev wallet balance as percentage of supply */
  devBalancePercentage?: number;
  /** Number of mint addresses controlled by dev */
  devMints?: number;
}

/** Full token data as returned by Jupiter V2. */
export interface JupiterToken {
  /** Mint address (base58). The "id" field in the API. */
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  /** Logo URL — points to Jupiter's metadata CDN. */
  logoURI?: string;
  /** Live USD price. */
  usdPrice?: number;
  /** Market cap in USD. */
  mcap?: number;
  /** Fully diluted valuation. */
  fdv?: number;
  /** Total on-chain liquidity in USD. */
  liquidity?: number;
  /** Number of unique holders. */
  holderCount?: number;
  /** Jupiter Verified status. true = officially verified, null = unverified. */
  isVerified?: boolean | null;
  /** 0-100 quality score (low = sketchy, high = legitimate). */
  organicScore?: number;
  organicScoreLabel?: 'low' | 'medium' | 'high' | string;
  /** Trading stats per interval. */
  stats5m?: TokenStatsInterval;
  stats1h?: TokenStatsInterval;
  stats6h?: TokenStatsInterval;
  stats24h?: TokenStatsInterval;
  /** Security audit signal. */
  audit?: TokenAudit;
  /** Mint authority — non-null = supply can be inflated (centralized risk). */
  mintAuthority?: string | null;
  /** Freeze authority — non-null = wallet can be frozen. */
  freezeAuthority?: string | null;
  /** ISO timestamp of token creation. */
  createdAt?: string;
  updatedAt?: string;
  /** Social links. */
  twitter?: string;
  discord?: string;
  website?: string;
  /** Jupiter category tags. */
  tags?: string[];
  /** SPL Token program vs Token-2022 program. */
  tokenProgram?: string;
  /** Dev wallet address. */
  dev?: string;
}

const V2_BASE = 'https://api.jup.ag/tokens/v2';
const CACHE_TTL_MS = 60 * 1000; // 60s — prices move, refresh often

/** Our app's preferred whitelist symbols. Surface first in the picker. */
const APP_WHITELIST_SYMBOLS = ['SOL', 'USDC', 'USDT', 'NERD', 'SKR', 'JUP', 'BONK', 'WIF'];

// In-memory caches, keyed by query/path. Multiple concurrent calls share inflight.
const caches = new Map<string, { ts: number; tokens: JupiterToken[] }>();
const inflights = new Map<string, Promise<JupiterToken[]>>();

/** Convert one raw V2 record to our JupiterToken shape. */
function normalize(raw: any): JupiterToken {
  return {
    address: String(raw.id),
    symbol: String(raw.symbol || ''),
    name: String(raw.name || raw.symbol || ''),
    decimals: Number(raw.decimals ?? 9),
    logoURI: raw.icon ? String(raw.icon) : undefined,
    usdPrice: typeof raw.usdPrice === 'number' ? raw.usdPrice : undefined,
    mcap: typeof raw.mcap === 'number' ? raw.mcap : undefined,
    fdv: typeof raw.fdv === 'number' ? raw.fdv : undefined,
    liquidity: typeof raw.liquidity === 'number' ? raw.liquidity : undefined,
    holderCount: typeof raw.holderCount === 'number' ? raw.holderCount : undefined,
    isVerified: typeof raw.isVerified === 'boolean' ? raw.isVerified : null,
    organicScore: typeof raw.organicScore === 'number' ? raw.organicScore : undefined,
    organicScoreLabel: raw.organicScoreLabel,
    stats5m: raw.stats5m,
    stats1h: raw.stats1h,
    stats6h: raw.stats6h,
    stats24h: raw.stats24h,
    audit: raw.audit,
    mintAuthority: raw.mintAuthority || null,
    freezeAuthority: raw.freezeAuthority || null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    twitter: raw.twitter,
    discord: raw.discord,
    website: raw.website,
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : undefined,
    tokenProgram: raw.tokenProgram,
    dev: raw.dev,
  };
}

/** Shared fetch helper with TTL + inflight dedup. */
async function fetchAndCache(cacheKey: string, url: string): Promise<JupiterToken[]> {
  const cached = caches.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.tokens;
  const existing = inflights.get(cacheKey);
  if (existing) return existing;
  const promise = (async () => {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) throw new Error(`Jupiter V2 HTTP ${res.status}`);
      const raw = await res.json();
      if (!Array.isArray(raw)) return [];
      const tokens = raw.map(normalize);
      caches.set(cacheKey, { ts: Date.now(), tokens });
      return tokens;
    } finally {
      inflights.delete(cacheKey);
    }
  })();
  inflights.set(cacheKey, promise);
  return promise;
}

/**
 * Default browse list — top traded over 24h. Returns 50 tokens with full data.
 * Used when the user opens the picker with no search query.
 */
export async function fetchTopTraded(): Promise<JupiterToken[]> {
  return fetchAndCache('toptraded24h', `${V2_BASE}/toptraded/24h`);
}

/**
 * Search by name, symbol, OR mint address. Returns up to 20 matches.
 * For mint pastes, the first (or only) match is the target token.
 */
export async function searchJupiterTokens(query: string): Promise<JupiterToken[]> {
  const q = query.trim();
  if (!q) return [];
  const key = `search:${q.toLowerCase()}`;
  return fetchAndCache(key, `${V2_BASE}/search?query=${encodeURIComponent(q)}`);
}

/**
 * Fetch a specific token by mint. Uses /search with the mint as query and
 * filters to the exact match. Returns null if Jupiter hasn't indexed yet
 * (extremely fresh mints or non-tradable accounts).
 */
export async function getJupiterToken(mint: string): Promise<JupiterToken | null> {
  const list = await searchJupiterTokens(mint);
  return list.find((t) => t.address === mint) || null;
}

/** Is this symbol in our app whitelist? Used by the ★ pin in picker. */
export function isAppWhitelisted(symbol: string): boolean {
  return APP_WHITELIST_SYMBOLS.includes(symbol);
}

/** Sort tokens with app whitelist pinned first, then by 24h volume (highest first). */
export function sortWithWhitelistFirst(tokens: JupiterToken[]): JupiterToken[] {
  const wl: JupiterToken[] = [];
  const rest: JupiterToken[] = [];
  for (const t of tokens) {
    if (isAppWhitelisted(t.symbol)) wl.push(t);
    else rest.push(t);
  }
  wl.sort((a, b) => APP_WHITELIST_SYMBOLS.indexOf(a.symbol) - APP_WHITELIST_SYMBOLS.indexOf(b.symbol));
  return [...wl, ...rest];
}

/** Short-form CA display: '8Hb1…u3kP'. */
export function shortCA(mint: string): string {
  if (mint.length <= 10) return mint;
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`;
}

/** Base58 mint shape detection — used to branch on CA paste. */
export function looksLikeMintCA(s: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s.trim());
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
    // localStorage unavailable (private browsing, etc.) — silent no-op
  }
}

/** Derived risk signals for picker warnings. */
export interface TokenRiskSignals {
  /** Verified by Jupiter. */
  verified: boolean;
  /** Quality score is low (potential wash trading / sketchy). */
  lowOrganic: boolean;
  /** Mint authority hasn't been revoked — token supply can be inflated. */
  mintAuthorityActive: boolean;
  /** Freeze authority hasn't been revoked — wallets can be frozen. */
  freezeAuthorityActive: boolean;
  /** Top holders control more than 50% of supply. */
  topHoldersConcentrated: boolean;
  /** Holder count is very low (potentially manipulated / fresh launch). */
  fewHolders: boolean;
}

/** Compute risk signals for a token. Used to render warning badges in the picker. */
export function getRiskSignals(t: JupiterToken): TokenRiskSignals {
  return {
    verified: t.isVerified === true,
    lowOrganic: t.organicScoreLabel === 'low' || (typeof t.organicScore === 'number' && t.organicScore < 30),
    mintAuthorityActive: !!t.mintAuthority,
    freezeAuthorityActive: !!t.freezeAuthority,
    topHoldersConcentrated: (t.audit?.topHoldersPercentage || 0) > 50,
    fewHolders: typeof t.holderCount === 'number' && t.holderCount < 100,
  };
}

/**
 * React hook: load tokens for the picker. Two modes:
 *   • No query → fetch top-traded 24h (50 tokens).
 *   • Query (search text or mint paste) → fetch /search results.
 *
 * Returns { tokens, loading, error }. Re-fetches whenever query changes.
 */
export function useJupiterTokens(query: string = ''): {
  tokens: JupiterToken[];
  loading: boolean;
  error: string | null;
} {
  const [tokens, setTokens] = useState<JupiterToken[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const list = query.trim() ? await searchJupiterTokens(query) : await fetchTopTraded();
        if (cancelled) return;
        setTokens(sortWithWhitelistFirst(list));
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        setError(err?.message || 'Failed to load tokens');
        setTokens([]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return { tokens, loading, error };
}

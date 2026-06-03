/**
 * Jupiter Price API client , free, no API key required.
 *
 * Endpoint: https://api.jup.ag/price/v2?ids=<comma-separated-mints>
 * Returns current USD prices for the requested tokens (uses Jupiter's
 * internal route discovery to derive prices from on-chain liquidity).
 *
 * Used by SwapModal's TokenPickerSheet to enrich row display with live
 * prices. 24h change + market cap are NOT in this API , Birdeye is the
 * follow-up upgrade path (see TODO note below).
 *
 * Cache: 60s per batch in module memory. Multiple components sharing the
 * same mint list within the window share one fetch.
 */

export interface JupiterPriceEntry {
  /** Token mint address (the key in the map) */
  id: string;
  /** Current USD price per whole token unit (NOT base units) */
  price: number;
  /** Symbol if known (Jupiter echoes this for convenience) */
  mintSymbol?: string;
  /** Optional last-updated UNIX seconds */
  priceChange?: { percent24h?: number };
}

const PRICE_TTL_MS = 60 * 1000; // 60s — prices are stable enough
const BATCH_LIMIT = 100; // Jupiter accepts up to ~100 mints per call

interface CacheEntry {
  ts: number;
  prices: Record<string, JupiterPriceEntry>;
}
const cache = new Map<string, CacheEntry>(); // key = sorted comma-joined mints
const inflight = new Map<string, Promise<Record<string, JupiterPriceEntry>>>();

/**
 * Fetch current USD prices for a batch of mints. Returns a map from mint
 * → price entry. Missing tokens are absent from the map (no error thrown).
 *
 * Splits large batches across multiple requests automatically.
 *
 * TODO(birdeye): once BIRDEYE_API_KEY is set in Supabase secrets, add a
 * companion call to a `token-data` EF that fetches 24h change + market
 * cap for each mint. Merge the results into the same entry shape. Until
 * then, picker rows show price-only.
 */
export async function fetchPrices(mints: string[]): Promise<Record<string, JupiterPriceEntry>> {
  if (mints.length === 0) return {};

  // De-dupe + chunk
  const unique = Array.from(new Set(mints));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_LIMIT) {
    chunks.push(unique.slice(i, i + BATCH_LIMIT));
  }

  const out: Record<string, JupiterPriceEntry> = {};
  await Promise.all(
    chunks.map(async (chunk) => {
      const key = chunk.sort().join(',');
      const cached = cache.get(key);
      if (cached && Date.now() - cached.ts < PRICE_TTL_MS) {
        Object.assign(out, cached.prices);
        return;
      }
      const existing = inflight.get(key);
      if (existing) {
        Object.assign(out, await existing);
        return;
      }
      const promise = fetchChunk(chunk);
      inflight.set(key, promise);
      try {
        const result = await promise;
        cache.set(key, { ts: Date.now(), prices: result });
        Object.assign(out, result);
      } finally {
        inflight.delete(key);
      }
    }),
  );
  return out;
}

async function fetchChunk(mints: string[]): Promise<Record<string, JupiterPriceEntry>> {
  try {
    const url = `https://api.jup.ag/price/v2?ids=${mints.join(',')}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) return {};
    const body: any = await res.json();
    // Response shape: { data: { [mint]: { id, mintSymbol, price, ... } } }
    const data = body?.data;
    if (!data || typeof data !== 'object') return {};
    const out: Record<string, JupiterPriceEntry> = {};
    for (const [mint, raw] of Object.entries(data)) {
      const r = raw as any;
      if (r?.price != null) {
        out[mint] = {
          id: mint,
          price: Number(r.price),
          mintSymbol: r.mintSymbol,
        };
      }
    }
    return out;
  } catch {
    return {}; // Silent fail , picker rows just show no price
  }
}

/**
 * Single-token convenience helper. Equivalent to `fetchPrices([mint])[mint]`.
 */
export async function fetchPrice(mint: string): Promise<JupiterPriceEntry | null> {
  const map = await fetchPrices([mint]);
  return map[mint] || null;
}

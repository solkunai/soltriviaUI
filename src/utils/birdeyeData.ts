/**
 * Birdeye data client , routed through the `birdeye-multi-price` EF.
 *
 * The API key lives in Supabase secrets (BIRDEYE_API_KEY). Client never
 * touches the key. Returns `{ price, priceChange24h }` per mint for up to
 * 100 mints per batch.
 *
 * Cached in module memory for 60s to reduce CU consumption (Kyle's standard
 * tier is 30k CU/month, ~1 CU per batch call). Effective rate: a picker
 * open = 1 CU, multiple opens within 60s reuse the cache.
 */
import { SUPABASE_FUNCTIONS_URL } from './constants';
import { getAuthHeaders } from './api';

export interface BirdeyePriceEntry {
  /** Current USD price per whole token unit */
  price: number;
  /** 24h price change in percent (e.g. -3.2 means down 3.2%) */
  priceChange24h: number;
}

const TTL_MS = 60 * 1000;
const BATCH_LIMIT = 100;

interface CacheEntry {
  ts: number;
  data: Record<string, BirdeyePriceEntry>;
}
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<Record<string, BirdeyePriceEntry>>>();

/**
 * Fetch price + 24h change for a batch of mints. Returns a map keyed by mint.
 * Missing mints (not in Birdeye's index) are absent from the result.
 *
 * Splits batches over 100 across multiple EF calls. Never throws , degrades
 * to empty result on failure so picker rows fall back to the Jupiter-only price.
 */
export async function fetchBirdeyeData(mints: string[]): Promise<Record<string, BirdeyePriceEntry>> {
  if (mints.length === 0) return {};
  const unique = Array.from(new Set(mints));
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_LIMIT) chunks.push(unique.slice(i, i + BATCH_LIMIT));

  const out: Record<string, BirdeyePriceEntry> = {};
  await Promise.all(
    chunks.map(async (chunk) => {
      const key = chunk.sort().join(',');
      const cached = cache.get(key);
      if (cached && Date.now() - cached.ts < TTL_MS) {
        Object.assign(out, cached.data);
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
        cache.set(key, { ts: Date.now(), data: result });
        Object.assign(out, result);
      } finally {
        inflight.delete(key);
      }
    }),
  );
  return out;
}

async function fetchChunk(mints: string[]): Promise<Record<string, BirdeyePriceEntry>> {
  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/birdeye-multi-price`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ mints }),
    });
    if (!res.ok) return {};
    const body: any = await res.json();
    if (!body?.success || !body?.data || typeof body.data !== 'object') return {};
    return body.data;
  } catch {
    return {}; // Silent degradation
  }
}

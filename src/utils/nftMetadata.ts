/**
 * Single-asset Helius DAS fetcher with in-memory cache.
 * Mirrors the cluster-aware endpoint selection used by useWalletNFTs.
 *
 * Used by NftPrizeCard (and any other place we need to render an NFT by mint
 * without already having it in the wallet's owned-assets list).
 */

export type NftStandard = 'core' | 'pnft' | 'legacy';

export interface NftMetadata {
  mint: string;
  name: string;
  collectionName: string;
  thumbnail: string;
  /** Full-resolution image if DAS returns one separate from the thumbnail. */
  image: string;
  standard: NftStandard;
  /** True if the asset is in a Metaplex-verified collection. */
  verified: boolean;
}

// ── DAS endpoint (matches useWalletNFTs.ts) ─────────────

const SOLANA_NETWORK = (import.meta.env.VITE_SOLANA_NETWORK as string | undefined) || 'mainnet-beta';
const IS_DEVNET = SOLANA_NETWORK === 'devnet';

const HELIUS_MAINNET_PROXY =
  (import.meta.env.VITE_HELIUS_RPC_PROXY_URL as string | undefined) ||
  'https://soltrivia-helius-proxy.solkunai.workers.dev';

const HELIUS_DEVNET_DAS =
  (import.meta.env.VITE_HELIUS_DEVNET_DAS_URL as string | undefined) || null;

const DAS_ENDPOINT = IS_DEVNET && HELIUS_DEVNET_DAS ? HELIUS_DEVNET_DAS : HELIUS_MAINNET_PROXY;

// ── Cache ──────────────────────────────────────────────

interface CacheEntry {
  data: NftMetadata;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<NftMetadata | null>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

// ── Helpers ────────────────────────────────────────────

function classifyStandard(daseInterface: string | undefined): NftStandard {
  switch (daseInterface) {
    case 'MplCoreAsset':
      return 'core';
    case 'ProgrammableNFT':
      return 'pnft';
    default:
      return 'legacy';
  }
}

function pickThumbnail(asset: any): string {
  const c = asset?.content;
  return (
    c?.links?.image ||
    c?.files?.[0]?.cdn_uri ||
    c?.files?.[0]?.uri ||
    ''
  );
}

function pickFullImage(asset: any): string {
  const c = asset?.content;
  // CDN URI is typically the highest quality. Falls back to the raw file uri.
  return (
    c?.files?.[0]?.cdn_uri ||
    c?.links?.image ||
    c?.files?.[0]?.uri ||
    ''
  );
}

function pickCollectionName(asset: any): string {
  // Helius gives several places a collection name might live; try them in
  // order of canonicalness.
  const c = asset?.content;
  const grouping = asset?.grouping ?? [];
  const collectionGroup = grouping.find((g: any) => g?.group_key === 'collection');
  return (
    c?.metadata?.collection?.name ||
    collectionGroup?.collection_metadata?.name ||
    'Unknown collection'
  );
}

function isVerifiedCollection(asset: any): boolean {
  const grouping = asset?.grouping ?? [];
  const collectionGroup = grouping.find((g: any) => g?.group_key === 'collection');
  // DAS marks verified collections in the group_value's verified field on some
  // shapes; otherwise fall back to creators[].verified.
  if (collectionGroup?.verified === true) return true;
  const creators = asset?.creators ?? [];
  return creators.some((c: any) => c?.verified === true);
}

// ── Public API ─────────────────────────────────────────

/**
 * Fetch a single NFT's display metadata by mint.
 * Returns null if the asset doesn't exist on the active cluster or if DAS
 * returns malformed data. Throws on hard network errors.
 *
 * Cached per mint for 5 minutes. In-flight requests are deduplicated so a
 * burst of useNftMetadata(mint) calls only hits DAS once.
 */
export async function fetchNftMetadata(mint: string): Promise<NftMetadata | null> {
  if (!mint || typeof mint !== 'string') return null;

  // Cache hit
  const cached = cache.get(mint);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // In-flight dedup
  const inflightReq = inflight.get(mint);
  if (inflightReq) return inflightReq;

  const req = (async (): Promise<NftMetadata | null> => {
    try {
      const res = await fetch(DAS_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: `getAsset-${mint}`,
          method: 'getAsset',
          params: { id: mint },
        }),
      });

      if (!res.ok) {
        // 404 from Helius is rare but possible for very new mints
        if (res.status === 404) return null;
        throw new Error(`Helius DAS HTTP ${res.status}`);
      }

      const body = await res.json();
      if (body?.error) {
        // DAS returns { error: { code, message } } for invalid id, etc.
        console.warn('[nftMetadata] DAS error:', body.error);
        return null;
      }

      const asset = body?.result;
      if (!asset) return null;

      const meta: NftMetadata = {
        mint,
        name: asset?.content?.metadata?.name || 'Unknown NFT',
        collectionName: pickCollectionName(asset),
        thumbnail: pickThumbnail(asset),
        image: pickFullImage(asset),
        standard: classifyStandard(asset?.interface),
        verified: isVerifiedCollection(asset),
      };

      cache.set(mint, { data: meta, fetchedAt: Date.now() });
      return meta;
    } finally {
      inflight.delete(mint);
    }
  })();

  inflight.set(mint, req);
  return req;
}

/** Force a cache invalidation, e.g. after a transfer/mint operation. */
export function invalidateNftMetadata(mint: string): void {
  cache.delete(mint);
}

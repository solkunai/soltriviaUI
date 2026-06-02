/**
 * useWalletNFTs — fetches the connected wallet's NFTs from Helius DAS via the
 * Cloudflare Worker proxy (`HELIUS_RPC_PROXY_URL`). API key stays server-side.
 *
 * Maps each DAS asset to the app's `WalletNFT` shape and classifies the standard
 * (`core` / `pnft` / `legacy`) so the caller can branch its on-chain ix variant.
 *
 * Status state machine: 'loading' → 'ready' | 'empty' | 'error'. Refetch is
 * exposed for retry buttons.
 */
import { useEffect, useState, useCallback } from 'react';

export type NFTStandard = 'core' | 'pnft' | 'legacy';

export interface WalletNFT {
  /** Asset address (mint, or compressed asset id for cNFTs). */
  mint: string;
  /** Display name. */
  name: string;
  /** Collection name (best-effort — falls back to "Unknown collection"). */
  collectionName: string;
  /** Thumbnail image URL. */
  thumbnail: string;
  /** Asset standard — drives which on-chain ix variant to use. */
  standard: NFTStandard;
  /** True if the asset is a Bubblegum compressed NFT. */
  compressed: boolean;
}

export type FetchStatus = 'loading' | 'ready' | 'empty' | 'error';

// Public Cloudflare Worker proxy that fronts Helius. The upstream Helius API
// key lives only inside the Worker; it is NEVER shipped to the client.
const HELIUS_RPC_PROXY_URL =
  (import.meta.env.VITE_HELIUS_RPC_PROXY_URL as string | undefined) ||
  'https://soltrivia-helius-proxy.solkunai.workers.dev';

/** Map a Helius DAS `interface` value to our standard classification. */
function classifyStandard(daseInterface: string | undefined): NFTStandard {
  switch (daseInterface) {
    case 'MplCoreAsset':
      return 'core';
    case 'ProgrammableNFT':
      return 'pnft';
    // V1_NFT / V2_NFT / LEGACY_NFT / etc.
    default:
      return 'legacy';
  }
}

/** Extract the asset's preferred thumbnail URL, falling back through DAS shapes. */
function pickThumbnail(asset: any): string {
  const c = asset?.content;
  return (
    c?.links?.image ||
    c?.files?.[0]?.cdn_uri ||
    c?.files?.[0]?.uri ||
    c?.json_uri ||
    ''
  );
}

/** Extract a friendly collection name from DAS grouping + metadata. */
function pickCollectionName(asset: any): string {
  // 1. Helius sometimes inlines a collection_metadata.name in groupings
  const groups: any[] = asset?.grouping ?? [];
  for (const g of groups) {
    if (g?.group_key === 'collection' && g?.collection_metadata?.name) {
      return g.collection_metadata.name as string;
    }
  }
  // 2. Fall back to top-level metadata.collection name
  const collectionName = asset?.content?.metadata?.collection?.name;
  if (typeof collectionName === 'string' && collectionName.trim()) {
    return collectionName.trim();
  }
  // 3. Last resort
  return 'Unknown collection';
}

/** Filter out anything that isn't a transferable NFT-like asset. */
function isDisplayableNFT(asset: any): boolean {
  const iface = asset?.interface;
  // Exclude fungibles / SPL tokens
  if (iface === 'FungibleToken' || iface === 'FungibleAsset') return false;
  // Must have a name OR an image to be displayable
  const hasName = !!asset?.content?.metadata?.name;
  const hasImage = !!pickThumbnail(asset);
  return hasName || hasImage;
}

export function useWalletNFTs(walletAddress: string | null | undefined): {
  assets: WalletNFT[];
  status: FetchStatus;
  refetch: () => void;
} {
  const [assets, setAssets] = useState<WalletNFT[]>([]);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [refetchTick, setRefetchTick] = useState(0);

  const refetch = useCallback(() => {
    setRefetchTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!walletAddress) {
      setAssets([]);
      setStatus('empty');
      return;
    }
    setStatus('loading');
    (async () => {
      try {
        const res = await fetch(HELIUS_RPC_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'wallet-nfts',
            method: 'getAssetsByOwner',
            params: {
              ownerAddress: walletAddress,
              page: 1,
              limit: 1000,
              displayOptions: { showFungible: false },
            },
          }),
        });
        if (!res.ok) throw new Error(`Helius proxy HTTP ${res.status}`);
        const body = await res.json();
        if (body?.error) throw new Error(body.error.message || 'DAS error');

        const items: any[] = body?.result?.items ?? [];
        const mapped: WalletNFT[] = items
          .filter(isDisplayableNFT)
          .map<WalletNFT>((a) => ({
            mint: a.id as string,
            name: (a.content?.metadata?.name as string) || 'Unnamed',
            collectionName: pickCollectionName(a),
            thumbnail: pickThumbnail(a),
            standard: classifyStandard(a.interface),
            compressed: !!a.compression?.compressed,
          }));

        if (cancelled) return;
        setAssets(mapped);
        setStatus(mapped.length === 0 ? 'empty' : 'ready');
      } catch {
        if (cancelled) return;
        setAssets([]);
        setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, refetchTick]);

  return { assets, status, refetch };
}

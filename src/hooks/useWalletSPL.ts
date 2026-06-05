/**
 * useWalletSPL — fetches the connected wallet's SPL token holdings from
 * Helius DAS via the Cloudflare Worker proxy (API key stays server-side).
 *
 * Returns a normalized list of `TokenAsset` with held=true. Used by the
 * SPLSelector component plus any future "what does the user hold" surface.
 *
 * NOTE: DAS only returns tokens with metadata + non-zero balance. For raw
 * SPL accounts without metadata, fall back to `getTokenAccountsByOwner`
 * (not implemented here — most user-relevant tokens have metadata).
 */
import { useEffect, useState, useCallback } from 'react';

export interface TokenAsset {
  /** SPL token mint address. */
  mint: string;
  symbol: string;
  name: string;
  /** Logo URL or null (caller renders a monogram fallback). */
  logo: string | null;
  /** Token balance formatted for display ("2.41", "1.94M"). */
  balance: string;
  /** Optional USD value display ("$406.12"). Null if price unknown. */
  usd: string | null;
  /** True if the wallet holds a non-zero amount. */
  held: boolean;
  /** Optional monogram tint color (used when logo is null). */
  tint?: string;
  /** Token decimals (6 for USDC, 9 for SOL/NERD, etc.). Populated from
   *  Jupiter when available, otherwise inferred at site of use. */
  decimals?: number;
  /** Jupiter Verified status — true = officially verified by Jupiter. */
  isVerified?: boolean;
  /** Jupiter organic score label — 'low' suggests possible wash trading. */
  organicScoreLabel?: 'low' | 'medium' | 'high' | string;
  /** Raw UI amount, for upstream sizing math (held tokens only). */
  uiAmount?: number;
}

export type SPLFetchStatus = 'loading' | 'ready' | 'empty' | 'error';

const HELIUS_RPC_PROXY_URL =
  (import.meta.env.VITE_HELIUS_RPC_PROXY_URL as string | undefined) ||
  'https://soltrivia-helius-proxy.solkunai.workers.dev';

/** Compact a number for display: 1234567 → "1.23M", 12345 → "12.3K", 12.345 → "12.3". */
function formatTokenAmount(uiAmount: number): string {
  if (uiAmount === 0) return '0';
  const abs = Math.abs(uiAmount);
  if (abs >= 1e9) return (uiAmount / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return (uiAmount / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return (uiAmount / 1e3).toFixed(2) + 'K';
  if (abs >= 1) return uiAmount.toFixed(2);
  if (abs >= 0.001) return uiAmount.toFixed(4);
  return uiAmount.toPrecision(2);
}

function pickLogo(asset: any): string | null {
  const c = asset?.content;
  return c?.links?.image || c?.files?.[0]?.cdn_uri || c?.files?.[0]?.uri || null;
}

/** Map a DAS fungible asset → normalized TokenAsset. */
function mapDasToken(a: any): TokenAsset | null {
  const tokenInfo = a?.token_info;
  // Must have a balance > 0
  const uiAmount = tokenInfo?.balance && tokenInfo?.decimals != null
    ? Number(tokenInfo.balance) / Math.pow(10, tokenInfo.decimals)
    : 0;
  if (uiAmount <= 0) return null;

  const symbol = (tokenInfo?.symbol as string) || (a?.content?.metadata?.symbol as string) || 'UNK';
  const name = (a?.content?.metadata?.name as string) || symbol;
  const mint = a?.id || tokenInfo?.token_program === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' ? a?.id : a?.id;
  if (!mint) return null;

  const pricePerToken: number | undefined = tokenInfo?.price_info?.price_per_token;
  const totalPriceUsd: number | undefined = tokenInfo?.price_info?.total_price;

  return {
    mint,
    symbol,
    name,
    logo: pickLogo(a),
    balance: formatTokenAmount(uiAmount),
    usd:
      typeof totalPriceUsd === 'number'
        ? `$${totalPriceUsd.toFixed(2)}`
        : typeof pricePerToken === 'number'
          ? `$${(pricePerToken * uiAmount).toFixed(2)}`
          : null,
    held: true,
    decimals: tokenInfo?.decimals,
    uiAmount,
  };
}

export function useWalletSPL(walletAddress: string | null | undefined): {
  assets: TokenAsset[];
  status: SPLFetchStatus;
  refetch: () => void;
} {
  const [assets, setAssets] = useState<TokenAsset[]>([]);
  const [status, setStatus] = useState<SPLFetchStatus>('loading');
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
            id: 'wallet-spl',
            method: 'getAssetsByOwner',
            params: {
              ownerAddress: walletAddress,
              page: 1,
              limit: 1000,
              displayOptions: { showFungible: true, showNativeBalance: false },
            },
          }),
        });
        if (!res.ok) throw new Error(`Helius proxy HTTP ${res.status}`);
        const body = await res.json();
        if (body?.error) throw new Error(body.error.message || 'DAS error');

        const items: any[] = body?.result?.items ?? [];
        const mapped: TokenAsset[] = items
          .filter((a: any) => a?.interface === 'FungibleToken' || a?.interface === 'FungibleAsset')
          .map(mapDasToken)
          .filter((t): t is TokenAsset => t !== null)
          // Sort: USD value DESC, then by symbol
          .sort((a, b) => {
            const av = a.uiAmount ?? 0;
            const bv = b.uiAmount ?? 0;
            if (av !== bv) return bv - av;
            return a.symbol.localeCompare(b.symbol);
          });

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

/**
 * Catalog of popular SPL tokens shown when the user searches but doesn't hold
 * a match. Tap → onBuy(token) → caller opens swap. Curated for v2.1 launch.
 *
 * Long-term: replace with Jupiter strict-list (`tokens.jup.ag/strict`) fetched
 * server-side. For now this stays hardcoded so the selector works offline.
 */
export const SPL_CATALOG: TokenAsset[] = [
  {
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', // WIF
    symbol: 'WIF',
    name: 'dogwifhat',
    logo: 'https://bafkreibk3covs5ltyqxa272uodhculbr6kea6betidfwy3ajsav2vjzyum.ipfs.nftstorage.link',
    balance: '0',
    usd: null,
    held: false,
  },
  {
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
    symbol: 'BONK',
    name: 'Bonk',
    logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
    balance: '0',
    usd: null,
    held: false,
  },
  {
    mint: '2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv', // PENGU
    symbol: 'PENGU',
    name: 'Pudgy Penguins',
    logo: null,
    balance: '0',
    usd: null,
    held: false,
    tint: '#4FC3F7',
  },
  {
    mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', // JUP
    symbol: 'JUP',
    name: 'Jupiter',
    logo: 'https://static.jup.ag/jup/icon.png',
    balance: '0',
    usd: null,
    held: false,
  },
  {
    mint: 'pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn', // PUMP (placeholder mint)
    symbol: 'PUMP',
    name: 'Pump',
    logo: null,
    balance: '0',
    usd: null,
    held: false,
    tint: '#FF6E3C',
  },
];

/** Quick base58 length check for "looks like a Solana CA". */
export function looksLikeCA(q: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q.trim());
}

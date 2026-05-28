/**
 * mintFlow (web) — display reads for the Sol Trivia Elementals mint.
 *
 * READS (live now): mint eligibility (button state), the wallet's collection
 * holdings via Helius DAS (Set Completion / Legend), and the recent-mints feed.
 *
 * MINT ACTION (NOT live yet): the real mint is an on-chain `mint_commemorative`
 * instruction folded into the V2 program upgrade (no server-held signing key).
 * Until that ships, MintViewV2 renders an "opens soon" placeholder. When the
 * program lands, wire the build→sign→send here via the wallet adapter.
 */
import { supabase } from './supabase';
import { VARIANT_TO_ARCHETYPE, type ArchetypeKey } from './mintData';

// Cloudflare Worker proxy that hides the Helius key from clients (same as native).
const HELIUS_RPC_URL = 'https://soltrivia-helius-proxy.solkunai.workers.dev';

export const MINT_VARIANTS = ['lightning', 'fire', 'earth', 'ice'] as const;
export type MintVariant = (typeof MINT_VARIANTS)[number];

const BRAIN_TYPE_TO_ARCHETYPE: Record<string, ArchetypeKey> = {
  lightning: 'champion',
  fire: 'competitor',
  earth: 'genius',
  ice: 'scholar',
};

export type CollectionState = {
  counts: Record<ArchetypeKey, number>;
  typesOwned: number;
  isLegend: boolean;
};

// ── Mint eligibility (GATE STEP 1) ────────────────────────────────────────────
// Must have completed a live trivia game. Client check drives button state; the
// on-chain program ENFORCES the rule by reading the V2 game accounts.
export async function fetchMintEligibility(walletAddress: string): Promise<boolean> {
  const wallet = walletAddress?.trim();
  if (!wallet) return false;
  const { count } = await supabase
    .from('game_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
    .not('completed_at', 'is', null)
    .limit(1);
  return (count ?? 0) > 0;
}

// ── Collection counts (Set Completion / Your Collection / Legend) ─────────────
export async function fetchCollection(
  walletAddress: string,
  collectionAddress: string,
): Promise<CollectionState> {
  const counts: Record<ArchetypeKey, number> = { genius: 0, scholar: 0, competitor: 0, champion: 0 };
  if (!walletAddress || !collectionAddress || collectionAddress.startsWith('<')) {
    return { counts, typesOwned: 0, isLegend: false };
  }
  try {
    const res = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'collection',
        method: 'getAssetsByOwner',
        params: { ownerAddress: walletAddress, page: 1, limit: 1000 },
      }),
    });
    const { result } = await res.json();
    for (const asset of (result?.items ?? []) as any[]) {
      const inCollection = (asset.grouping ?? []).some(
        (g: any) => g.group_key === 'collection' && g.group_value === collectionAddress,
      );
      if (!inCollection) continue;
      const brain = (asset.content?.metadata?.attributes ?? []).find(
        (a: any) => a.trait_type === 'Brain Type',
      )?.value;
      const arch = BRAIN_TYPE_TO_ARCHETYPE[String(brain ?? '').toLowerCase()];
      if (arch) counts[arch] += 1;
    }
  } catch {
    /* non-fatal */
  }
  const typesOwned = (Object.values(counts) as number[]).filter((n) => n > 0).length;
  return { counts, typesOwned, isLegend: typesOwned >= 4 };
}

// ── Total minted counter ──────────────────────────────────────────────────────
// Live count of completed mints (drives the "X / 100,000 minted" + remaining
// countdown). Sourced from nft_mints (status=done); the on-chain mint indexer
// populates it post-launch. Returns 0 gracefully pre-launch.
export async function fetchMintedCount(): Promise<number> {
  try {
    const { count } = await supabase
      .from('nft_mints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'done');
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ── Recent Mints feed (social proof) ──────────────────────────────────────────
export type RecentMint = {
  wallet: string;
  username: string | null;
  archetype: ArchetypeKey;
  createdAt: string;
};

/** Recent successful mints, newest first. Reads nft_mints + joins
 *  player_profiles for @username. Returns [] gracefully pre-launch. */
export async function fetchRecentMints(limit = 8): Promise<RecentMint[]> {
  const { data } = await supabase
    .from('nft_mints')
    .select('wallet, variant, created_at')
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as { wallet: string; variant: string; created_at: string }[];
  if (!rows.length) return [];

  const wallets = Array.from(new Set(rows.map((r) => r.wallet)));
  const nameByWallet: Record<string, string | null> = {};
  const { data: profiles } = await supabase
    .from('player_profiles')
    .select('wallet_address, username')
    .in('wallet_address', wallets);
  for (const p of (profiles ?? []) as any[]) nameByWallet[p.wallet_address] = p.username ?? null;

  return rows.map((r) => ({
    wallet: r.wallet,
    username: nameByWallet[r.wallet] ?? null,
    archetype: VARIANT_TO_ARCHETYPE[r.variant] ?? 'genius',
    createdAt: r.created_at,
  }));
}

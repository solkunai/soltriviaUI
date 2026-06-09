/**
 * mintFlow (web) — display reads + mint execution for the Sol Trivia Elementals.
 *
 * READS: mint eligibility, on-chain mint config + per-wallet mint count,
 * wallet collection holdings (Helius DAS), recent-mints feed, total supply.
 *
 * MINT EXECUTION: `executeMintCommemorative` builds the on-chain ix, wraps in
 * a VersionedTransaction, hands it to the wallet adapter for signing, and
 * confirms. The mint is gated client-side by the `mint_live` feature flag, and
 * gated server-side by the V2 program (eligibility + cap + paused check).
 */
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { supabase } from './supabase';
import { VARIANT_TO_ARCHETYPE, type ArchetypeKey } from './mintData';
import {
  SOLTRIVIA_PROGRAM_ID,
  buildMintCommemorativeIx,
  fetchMinterRecord,
  fetchNftMintConfig,
} from './soltriviaContract';

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
// Two paths to qualify (Kyle 2026-06-08):
//   A. ANY paid play — round, custom game, or duel session in game_sessions
//      with completed_at set. One play = eligible forever.
//   B. Practice-only path — 3+ practice_runs entries AND username + onboarded
//      timestamp set on player_profiles.
// On-chain eligibility check was REMOVED from the contract; the contract only
// enforces the per-wallet cap (max 15). Bypassing this client gate just means
// the user paid 0.02/0.01 SOL to mint without "earning" it through gameplay.
export async function fetchMintEligibility(walletAddress: string): Promise<boolean> {
  const wallet = walletAddress?.trim();
  if (!wallet) return false;

  // Path A: any completed paid game session.
  const { count: paidCount } = await supabase
    .from('game_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_address', wallet)
    .not('completed_at', 'is', null)
    .limit(1);
  if ((paidCount ?? 0) > 0) return true;

  // Path B: profile + 3+ practice runs.
  const { data: profile } = await supabase
    .from('player_profiles')
    .select('username, onboarded_at')
    .eq('wallet_address', wallet)
    .maybeSingle();
  if (!profile?.username || !profile?.onboarded_at) return false;

  const { count: practiceCount } = await supabase
    .from('practice_runs')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_address', wallet);
  return (practiceCount ?? 0) >= 3;
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

// ── Mint execution (on-chain) ─────────────────────────────────────────────────

// Anchor account discriminator for `EntryReceipt` = sha256("account:EntryReceipt")[0..8].
// Used to scan the program's on-chain accounts for a proof of eligibility.
const ENTRY_RECEIPT_DISC = Uint8Array.from([2, 205, 191, 242, 12, 71, 135, 29]);
// In EntryReceipt the `player` field is at offset 17 (disc[8] + round_id[8] + tier_index[1]).
const ENTRY_RECEIPT_PLAYER_OFFSET = 17;

/**
 * Find an on-chain eligibility proof PDA for this player.
 *
 * Scans the program's `EntryReceipt` accounts via memcmp on the player field.
 * The first match is returned — any valid EntryReceipt counts as a proof of a
 * completed paid round, and the contract verifies it cryptographically.
 *
 * Returns null if the player has no paid round entry on-chain. The user can
 * still mint after they pay into a tier round.
 *
 * (We do NOT scan Duel / CustomGameEntry here — getProgramAccounts is heavy,
 * one scan covers the most-common case; players who only paid into duels or
 * custom games will see the "play a paid round first" CTA.)
 */
export async function findEligibilityProof(
  player: PublicKey,
  connection: Connection,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID,
): Promise<PublicKey | null> {
  try {
    const accounts = await connection.getProgramAccounts(programId, {
      commitment: 'confirmed',
      dataSlice: { offset: 0, length: 0 }, // we only need pubkeys
      filters: [
        { memcmp: { offset: 0, bytes: bs58.encode(ENTRY_RECEIPT_DISC) } },
        { memcmp: { offset: ENTRY_RECEIPT_PLAYER_OFFSET, bytes: player.toBase58() } },
      ],
    });
    return accounts[0]?.pubkey ?? null;
  } catch {
    return null;
  }
}

export type MintExecutionResult = {
  signature: string;
};

export type MintExecutionErrorKind =
  | 'not_initialized' // nft_config not on-chain yet (deploy not done)
  | 'paused'          // admin flipped paused=true
  | 'cap_reached'     // player has hit max_per_wallet
  | 'not_eligible'    // no EntryReceipt on chain
  | 'rpc_error'       // network/RPC failure
  | 'send_failed'     // signing/sending failed (rejected, balance, etc.)
  | 'confirm_failed'; // tx submitted but did not confirm

export class MintExecutionError extends Error {
  kind: MintExecutionErrorKind;
  cause?: unknown;
  constructor(kind: MintExecutionErrorKind, message: string, cause?: unknown) {
    super(message);
    this.kind = kind;
    this.cause = cause;
  }
}

/**
 * Execute the on-chain mint_commemorative instruction.
 *
 * Flow:
 *   1. Read nft_config (revenue_wallet, merkle_tree, collection, paused flag).
 *   2. Read minter_record to fail-fast on cap (the contract enforces this too).
 *   3. Find an EntryReceipt PDA on-chain for the player (eligibility proof).
 *   4. Build the ix with `buildMintCommemorativeIx`.
 *   5. Wrap in a v0 VersionedTransaction, hand to wallet for signing+send.
 *   6. Confirm with a 30s timeout.
 *
 * @param sendTransaction - wallet-adapter callback (typically `useWallet().sendTransaction`).
 *
 * The variant (Scholar/Genius/Competitor/Champion) is RANDOMIZED ON-CHAIN —
 * after the tx confirms, the client should poll Helius DAS for the new asset
 * to learn which archetype was revealed.
 */
export async function executeMintCommemorative(args: {
  player: PublicKey;
  connection: Connection;
  sendTransaction: (tx: VersionedTransaction, connection: Connection) => Promise<string>;
  sgtTokenAccount?: PublicKey | null;
  sgtMint?: PublicKey | null;
  programId?: PublicKey;
}): Promise<MintExecutionResult> {
  const programId = args.programId ?? SOLTRIVIA_PROGRAM_ID;

  // 1. nft_config
  let cfg;
  try {
    cfg = await fetchNftMintConfig(args.connection, programId);
  } catch (e) {
    throw new MintExecutionError('rpc_error', 'Failed to load mint config.', e);
  }
  if (!cfg) {
    throw new MintExecutionError(
      'not_initialized',
      'Mint is not yet configured on-chain. Check back at launch.',
    );
  }
  if (cfg.paused) {
    throw new MintExecutionError('paused', 'Mint is currently paused.');
  }

  // 2. cap pre-check (the contract also enforces — this is for UX)
  try {
    const record = await fetchMinterRecord(args.connection, args.player, programId);
    if (record && record.mintCount >= cfg.maxPerWallet) {
      throw new MintExecutionError(
        'cap_reached',
        `You've reached the per-wallet cap (${cfg.maxPerWallet}).`,
      );
    }
  } catch (e) {
    if (e instanceof MintExecutionError) throw e;
    // non-fatal — let the on-chain check decide
  }

  // 3. Eligibility check REMOVED (Kyle 2026-06-08). The on-chain
  //    eligibility proof was dropped from the contract; the only on-chain
  //    enforcement is the per-wallet cap (Step 2 above). The CLIENT-side
  //    check in fetchMintEligibility() gates the UI button so users who
  //    haven't played 3 practice OR a paid game can't reach this code path.

  // 4. build ix
  const ix = buildMintCommemorativeIx({
    player: args.player,
    revenueWallet: new PublicKey(cfg.revenueWallet),
    merkleTree: new PublicKey(cfg.merkleTree),
    coreCollection: new PublicKey(cfg.collection),
    sgtTokenAccount: args.sgtTokenAccount,
    sgtMint: args.sgtMint,
    programId,
  });

  // 5. wrap in versioned tx
  let blockhash: string;
  let lastValidBlockHeight: number;
  try {
    const bh = await args.connection.getLatestBlockhash('confirmed');
    blockhash = bh.blockhash;
    lastValidBlockHeight = bh.lastValidBlockHeight;
  } catch (e) {
    throw new MintExecutionError('rpc_error', 'Failed to fetch recent blockhash.', e);
  }
  const message = new TransactionMessage({
    payerKey: args.player,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);

  // 6. sign + send via wallet
  let signature: string;
  try {
    signature = await args.sendTransaction(tx, args.connection);
  } catch (e) {
    throw new MintExecutionError('send_failed', extractRpcMessage(e), e);
  }

  // 7. confirm with timeout
  try {
    await Promise.race([
      args.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Confirmation timeout')), 30_000)),
    ]);
  } catch (e) {
    throw new MintExecutionError('confirm_failed', 'Mint sent but did not confirm in time. It may still succeed — check Solscan.', e);
  }

  return { signature };
}

function extractRpcMessage(e: unknown): string {
  if (e instanceof Error) {
    const msg = e.message || 'Transaction failed.';
    // Strip noisy Anchor codes when present
    const m = msg.match(/custom program error: 0x([0-9a-fA-F]+)/);
    if (m) {
      const code = parseInt(m[1], 16);
      return `On-chain error (code ${code}).`;
    }
    return msg;
  }
  return 'Transaction failed.';
}

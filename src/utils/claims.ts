/**
 * On-chain-truth wrappers for claim/refund queries.
 *
 * The pure DB fetches in `api.ts` return every candidate row from Supabase but
 * cannot tell whether a player has already claimed on chain — the DB doesn't
 * mirror on-chain claim/refund state reliably. Using those raw functions on
 * the UI shows ghost prizes for already-claimed/already-refunded items.
 *
 * Every function below wraps a DB fetch with an on-chain filter:
 *   - Prize claims: `claimed[rank|index]` or `winnerClaimed` flag must be
 *     false on the relevant TierRound / Duel / CustomGame account.
 *   - Refunds: the per-player receipt PDA must still exist (the contract
 *     closes EntryReceipt / CustomEntry / Duel on refund). A null
 *     getAccountInfo means refund already claimed (or never qualified).
 *
 * All callers that render claim/refund UI should use these wrappers, not the
 * raw `fetch*` functions. The pure DB ones remain available for admin tools
 * or audit-style queries that want every candidate regardless of state.
 */
import type { Connection } from '@solana/web3.js';
import {
  fetchClaimableRoundPayouts,
  fetchMyDuelWins,
  fetchMyCustomGameWins,
  fetchRefundableEntries,
  fetchRefundableCustomGames,
  fetchMyRefundableDuels,
  type ClaimablePayout,
  type MyDuelWin,
  type ClaimableCustomGameWin,
  type RefundableEntry,
  type RefundableCustomGame,
  type RefundableDuel,
} from './api';
import {
  fetchDuel,
  fetchCustomGame,
  fetchTierRound,
  getEntryReceiptPda,
  getCustomEntryPda,
  getDuelPda,
  getTierVaultPda,
  getCustomVaultPda,
  getDuelVaultPda,
} from './soltriviaContract';
import { PublicKey } from '@solana/web3.js';

/** Daily-round top-5 finishes that the wallet hasn't claimed on-chain yet. */
export async function fetchUnpaidRoundPayouts(
  connection: Connection,
  walletAddress: string,
): Promise<ClaimablePayout[]> {
  const candidates = await fetchClaimableRoundPayouts(walletAddress).catch(() => []);
  if (candidates.length === 0) return [];
  const minRent = await connection.getMinimumBalanceForRentExemption(0);
  const checks = await Promise.all(
    candidates.map(async (p) => {
      try {
        const tr = await fetchTierRound(connection, p.contract_round_id, p.tier_index ?? 0);
        if (!tr) return p; // can't read on-chain → assume unclaimed, claim attempt will tell us
        // claimed[rank-1] === true means this rank has already been paid out on-chain
        if (tr.claimed?.[p.rank - 1] === true) return null;
        // Vault-sweep guard: if admin swept the vault, claim would fail on-chain
        const vaultInfo = await connection.getAccountInfo(getTierVaultPda(p.contract_round_id, p.tier_index ?? 0));
        const myPrize = Number(tr.prizeAmounts?.[p.rank - 1] ?? 0);
        if (!vaultInfo || vaultInfo.lamports - minRent < myPrize) return null;
        return p;
      } catch {
        return p;
      }
    }),
  );
  return checks.filter((x): x is ClaimablePayout => x != null);
}

/** Duels the wallet won that haven't been claimed on-chain yet. */
export async function fetchUnclaimedDuelWins(
  connection: Connection,
  walletAddress: string,
): Promise<MyDuelWin[]> {
  const candidates = await fetchMyDuelWins(walletAddress).catch(() => []);
  if (candidates.length === 0) return [];
  const minRent = await connection.getMinimumBalanceForRentExemption(0);
  const checks = await Promise.all(
    candidates.map(async (d) => {
      try {
        const onChain = await fetchDuel(connection, d.duel_id);
        if (!onChain || onChain.winnerClaimed) return null;
        // Vault-sweep guard: if admin swept the vault, claim would fail on-chain
        const vaultInfo = await connection.getAccountInfo(getDuelVaultPda(d.duel_id));
        const winnerPrize = Number(onChain.totalPot ?? 0) - Number(onChain.houseCutLamports ?? 0);
        if (!vaultInfo || vaultInfo.lamports - minRent < winnerPrize) return null;
        return d;
      } catch {
        return d;
      }
    }),
  );
  return checks.filter((x): x is MyDuelWin => x != null);
}

/** Custom-game wins where the wallet's winner slot hasn't been claimed on-chain. */
export async function fetchUnclaimedCustomWins(
  connection: Connection,
  walletAddress: string,
): Promise<ClaimableCustomGameWin[]> {
  const candidates = await fetchMyCustomGameWins(walletAddress).catch(() => []);
  if (candidates.length === 0) return [];
  const minRent = await connection.getMinimumBalanceForRentExemption(0);
  const checks = await Promise.all(
    candidates.map(async (c) => {
      try {
        const onChain = await fetchCustomGame(connection, c.on_chain_game_id);
        if (!onChain) return c;
        if (onChain.claimed?.[c.winner_index] === true) return null;
        // Vault-sweep guard: if admin swept the vault, claim would fail on-chain
        const vaultInfo = await connection.getAccountInfo(getCustomVaultPda(c.on_chain_game_id));
        const myPrize = Number(onChain.winnerAmounts?.[c.winner_index] ?? 0);
        if (!vaultInfo || vaultInfo.lamports - minRent < myPrize) return null;
        return c;
      } catch {
        return c;
      }
    }),
  );
  return checks.filter((x): x is ClaimableCustomGameWin => x != null);
}

/** Round entries refundable on-chain (EntryReceipt PDA still exists). */
export async function fetchClaimableRefundEntries(
  connection: Connection,
  walletAddress: string,
): Promise<RefundableEntry[]> {
  const candidates = await fetchRefundableEntries(walletAddress).catch(() => []);
  if (candidates.length === 0) return [];
  const playerKey = new PublicKey(walletAddress);
  const checks = await Promise.all(
    candidates.map(async (e) => {
      try {
        const pda = getEntryReceiptPda(e.contract_round_id, e.tier_index, playerKey);
        const info = await connection.getAccountInfo(pda);
        return info ? e : null; // null => already refunded / never existed
      } catch {
        return e;
      }
    }),
  );
  return checks.filter((x): x is RefundableEntry => x != null);
}

/** Custom-game entries refundable on-chain (CustomEntry PDA still exists). */
export async function fetchClaimableRefundCustoms(
  connection: Connection,
  walletAddress: string,
): Promise<RefundableCustomGame[]> {
  const candidates = await fetchRefundableCustomGames(walletAddress).catch(() => []);
  if (candidates.length === 0) return [];
  const playerKey = new PublicKey(walletAddress);
  const checks = await Promise.all(
    candidates.map(async (cg) => {
      try {
        const pda = getCustomEntryPda(cg.on_chain_game_id, playerKey);
        const info = await connection.getAccountInfo(pda);
        return info ? cg : null;
      } catch {
        return cg;
      }
    }),
  );
  return checks.filter((x): x is RefundableCustomGame => x != null);
}

/** Duels refundable on-chain (Duel PDA still exists; closes on cancel/expire refund). */
export async function fetchClaimableRefundDuels(
  connection: Connection,
  walletAddress: string,
): Promise<RefundableDuel[]> {
  const candidates = await fetchMyRefundableDuels(walletAddress).catch(() => []);
  if (candidates.length === 0) return [];
  const checks = await Promise.all(
    candidates.map(async (d) => {
      try {
        const pda = getDuelPda(d.duel_id);
        const info = await connection.getAccountInfo(pda);
        return info ? d : null;
      } catch {
        return d;
      }
    }),
  );
  return checks.filter((x): x is RefundableDuel => x != null);
}

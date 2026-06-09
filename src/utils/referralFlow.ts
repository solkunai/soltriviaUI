/**
 * Referral commission orchestration (web, v2.1).
 *
 * Two surfaces, mirroring native's referralFlow.ts:
 *   1. fetchReferralBalanceOnChain(referrer) — wraps fetchReferralBalance with
 *      a mainnet Connection so callers don't touch RPC URL plumbing.
 *   2. submitClaimReferralBalanceOnChain(referrer, sendTransaction, connection)
 *      — wallet-signed claim_referral_balance tx that drains the ReferralBalance
 *      PDA back to the referrer's wallet. Returns a discriminated result so
 *      callers branch without try/catch (matches the round/duel claim helpers).
 *
 * Cross-platform invariant: native equivalent at SolTriviaNative/src/utils/
 * referralFlow.ts. Same ix builder + same PDA. Same audit hookup via
 * claim-referral-payout EF (api.ts claimReferralPayout).
 */
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import {
  buildClaimReferralBalanceIx,
  fetchReferralBalance,
} from './soltriviaContract';

/** Read the on-chain referral commission balance (in lamports). Returns 0 when
 *  the PDA hasn't been credited yet (never throws). */
export async function fetchReferralBalanceOnChain(
  connection: Connection,
  referrer: PublicKey,
): Promise<number> {
  return fetchReferralBalance(connection, referrer);
}

/** Discriminated claim result so the caller doesn't need try/catch.
 *   success         — tx confirmed, lamports landed in the wallet
 *   nothingToSweep  — on-chain says PDA is empty (race or already drained)
 *   userCancelled   — wallet sheet dismissed (silent, no error UI)
 *   error           — anything else
 */
export type ClaimReferralResult =
  | { kind: 'success'; signature: string }
  | { kind: 'nothingToSweep' }
  | { kind: 'userCancelled' }
  | { kind: 'error'; message: string };

/** Drain the referrer's accumulated commission PDA back to their wallet.
 *  Single-ix tx, no preflight reads (the on-chain check enforces non-empty
 *  PDA + matching referrer signer). */
export async function submitClaimReferralBalanceOnChain(
  referrer: PublicKey,
  sendTransaction: (tx: VersionedTransaction, conn: Connection) => Promise<string>,
  connection: Connection,
): Promise<ClaimReferralResult> {
  try {
    const ix = buildClaimReferralBalanceIx({ referrer });
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const msg = new TransactionMessage({
      payerKey: referrer,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    const signature = await sendTransaction(tx, connection);
    await connection.confirmTransaction(signature, 'confirmed');
    return { kind: 'success', signature };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    if (/nothing.*sweep|NothingToSweep/i.test(message)) {
      return { kind: 'nothingToSweep' };
    }
    if (/rejected|cancelled|user denied/i.test(message)) {
      return { kind: 'userCancelled' };
    }
    return { kind: 'error', message: message || 'Claim failed' };
  }
}

/**
 * Sol Trivia on-chain contract (Anchor): round vault, post_winners, claim_prize.
 * Program ID: HDa691QBrV9S5e491p187jKUpkpguYms3cuPBbcTuG1J
 */

import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';

export const SOLTRIVIA_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_SOLTRIVIA_PROGRAM_ID || 'HDa691QBrV9S5e491p187jKUpkpguYms3cuPBbcTuG1J'
);

/** claim_prize instruction discriminator (first 8 bytes of sha256("global:claim_prize")) */
const CLAIM_PRIZE_DISCRIMINATOR = new Uint8Array([157, 233, 139, 121, 246, 62, 234, 235]);

const ROUND_SEED = new TextEncoder().encode('round');
const VAULT_SEED = new TextEncoder().encode('vault');

/**
 * Derive contract round_id (u64) from daily_rounds date + round_number.
 * Same formula must be used by backend when creating rounds and posting winners.
 */
export function contractRoundIdFromDateAndNumber(dateStr: string, roundNumber: number): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const epoch = new Date(Date.UTC(1970, 0, 1)).getTime();
  const day = new Date(Date.UTC(y, m - 1, d)).getTime();
  const daysSinceEpoch = Math.floor((day - epoch) / 86400_000);
  return daysSinceEpoch * 4 + (roundNumber & 3);
}

/**
 * Build claim_prize instruction. Caller must be a winner for this round (enforced on-chain).
 */
export function buildClaimPrizeInstruction(
  roundIdU64: number,
  claimer: PublicKey,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID
): TransactionInstruction {
  const roundIdLe = new Uint8Array(8);
  new DataView(roundIdLe.buffer).setBigUint64(0, BigInt(roundIdU64), true);

  const [roundPda] = PublicKey.findProgramAddressSync(
    [ROUND_SEED, roundIdLe],
    programId
  );
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [VAULT_SEED, roundIdLe],
    programId
  );

  const data = new Uint8Array(8 + 8);
  data.set(CLAIM_PRIZE_DISCRIMINATOR, 0);
  data.set(roundIdLe, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: roundPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: claimer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data as unknown as Buffer,
  });
}

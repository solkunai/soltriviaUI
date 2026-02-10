/**
 * Sol Trivia on-chain contract (Anchor): round vault, enter_round, post_winners, claim_prize.
 * Program ID: 4XCpxbDvwtbtY3S3WZjkWdcFweMVAazzMbVDKBudFSwo; set VITE_SOLTRIVIA_PROGRAM_ID to override.
 */

import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';

export const SOLTRIVIA_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_SOLTRIVIA_PROGRAM_ID || '4XCpxbDvwtbtY3S3WZjkWdcFweMVAazzMbVDKBudFSwo'
);

/** claim_prize instruction discriminator */
const CLAIM_PRIZE_DISCRIMINATOR = new Uint8Array([157, 233, 139, 121, 246, 62, 234, 235]);
/** enter_round instruction discriminator */
const ENTER_ROUND_DISCRIMINATOR = new Uint8Array([166, 162, 71, 230, 92, 51, 37, 43]);

const CONFIG_SEED = new TextEncoder().encode('config');
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

/** Derive round and vault PDAs for a contract round_id (for start-game verification). */
export function getRoundAndVaultPdas(
  roundIdU64: number,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID
): { roundPda: PublicKey; vaultPda: PublicKey } {
  const roundIdLe = new Uint8Array(8);
  new DataView(roundIdLe.buffer).setBigUint64(0, BigInt(roundIdU64), true);
  const [roundPda] = PublicKey.findProgramAddressSync([ROUND_SEED, roundIdLe], programId);
  const [vaultPda] = PublicKey.findProgramAddressSync([VAULT_SEED, roundIdLe], programId);
  return { roundPda, vaultPda };
}

/**
 * Build enter_round instruction. Player pays 0.02 SOL to vault + 0.0025 SOL to revenue.
 * Requires round to exist on-chain (create_round / ensure-round-on-chain).
 */
export function buildEnterRoundInstruction(
  roundIdU64: number,
  player: PublicKey,
  revenueWallet: PublicKey,
  programId: PublicKey = SOLTRIVIA_PROGRAM_ID
): TransactionInstruction {
  const roundIdLe = new Uint8Array(8);
  new DataView(roundIdLe.buffer).setBigUint64(0, BigInt(roundIdU64), true);

  const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], programId);
  const [roundPda] = PublicKey.findProgramAddressSync([ROUND_SEED, roundIdLe], programId);
  const [vaultPda] = PublicKey.findProgramAddressSync([VAULT_SEED, roundIdLe], programId);

  const data = new Uint8Array(8 + 8);
  data.set(ENTER_ROUND_DISCRIMINATOR, 0);
  data.set(roundIdLe, 8);

  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: false },
      { pubkey: roundPda, isSigner: false, isWritable: true },
      { pubkey: vaultPda, isSigner: false, isWritable: true },
      { pubkey: revenueWallet, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data as unknown as Buffer,
  });
}

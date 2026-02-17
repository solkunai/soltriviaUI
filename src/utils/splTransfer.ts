// SPL Token transfer instruction builder for USDC and SKR payments
// Builds the instructions needed to send SPL tokens to the revenue wallet.

import {
  PublicKey,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import type { PaymentToken } from './constants';
import { USDC_MINT, SKR_MINT, TOKEN_DECIMALS, REVENUE_WALLET } from './constants';

const MINT_MAP: Record<Exclude<PaymentToken, 'SOL'>, PublicKey> = {
  USDC: new PublicKey(USDC_MINT),
  SKR: new PublicKey(SKR_MINT),
};

/**
 * Build SPL token transfer instructions for USDC or SKR.
 * Returns an array of instructions:
 * 1. (safety) Create the recipient ATA if it doesn't exist (idempotent — no-op if it does)
 * 2. Transfer the token amount using transferChecked (validates mint + decimals)
 *
 * @param payer     The user's wallet public key (pays tx fees + sends tokens)
 * @param token     'USDC' or 'SKR'
 * @param amount    Amount in smallest unit (e.g. 20_000_000 for 20 USDC)
 */
export function buildSplTransferInstructions(
  payer: PublicKey,
  token: Exclude<PaymentToken, 'SOL'>,
  amount: bigint
): TransactionInstruction[] {
  const mint = MINT_MAP[token];
  const decimals = TOKEN_DECIMALS[token];
  const revenueWallet = new PublicKey(REVENUE_WALLET);

  // Derive Associated Token Accounts
  const senderAta = getAssociatedTokenAddressSync(mint, payer, false, TOKEN_PROGRAM_ID);
  const recipientAta = getAssociatedTokenAddressSync(mint, revenueWallet, true, TOKEN_PROGRAM_ID);

  const instructions: TransactionInstruction[] = [];

  // Safety: ensure recipient ATA exists (idempotent — free if already created)
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,        // payer for rent if ATA needs creation
      recipientAta, // the ATA to create
      revenueWallet, // owner of the ATA
      mint,
      TOKEN_PROGRAM_ID,
    )
  );

  // Transfer tokens using transferChecked (validates mint + decimals on-chain)
  instructions.push(
    createTransferCheckedInstruction(
      senderAta,     // source ATA
      mint,          // token mint
      recipientAta,  // destination ATA
      payer,         // owner/authority of source ATA
      amount,        // amount in smallest units
      decimals,      // decimals for validation
      [],            // no multisig signers
      TOKEN_PROGRAM_ID,
    )
  );

  return instructions;
}

/**
 * Get the user's SPL token balance (in smallest units).
 * Returns 0n if the account doesn't exist.
 */
export async function getSplTokenBalance(
  connection: { getTokenAccountBalance: (address: PublicKey) => Promise<any> },
  owner: PublicKey,
  token: Exclude<PaymentToken, 'SOL'>
): Promise<bigint> {
  const mint = MINT_MAP[token];
  const ata = getAssociatedTokenAddressSync(mint, owner, false, TOKEN_PROGRAM_ID);

  try {
    const balanceResult = await connection.getTokenAccountBalance(ata);
    return BigInt(balanceResult.value.amount);
  } catch {
    // Account doesn't exist → zero balance
    return 0n;
  }
}

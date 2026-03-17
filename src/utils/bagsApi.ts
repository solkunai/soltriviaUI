// Bags.fm REST API client for in-app SOL↔NERD swaps.
// Uses direct fetch calls — no SDK needed (avoids heavy Anchor/Meteora deps).
// Docs: https://docs.bags.fm/how-to-guides/trade-tokens

import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const BAGS_API_BASE = 'https://public-api-v2.bags.fm/api/v1';
const BAGS_API_KEY = import.meta.env.VITE_BAGS_API_KEY || '';

const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
const NERD_MINT = 'DEc6Gf57RfFJbjqGrzo4zeRBr5iQS8vTV8r11ZuyBAGS';

// ── Types ──────────────────────────────────────────────

export interface SwapQuote {
  inAmount: string;
  outAmount: string;
  minOutAmount: string;
  priceImpactPct: string;
  slippageBps: number;
  routePlan: Array<{
    venue: string;
    inAmount: string;
    outAmount: string;
    inputMint: string;
    outputMint: string;
  }>;
  platformFee?: { amount: string; feeBps: number };
  requestId: string;
  /** Full raw response — passed back to createSwapTransaction */
  _raw: Record<string, unknown>;
}

interface BagsApiResponse<T> {
  success: boolean;
  response: T;
  error?: string;
}

interface SwapTransactionResponse {
  swapTransaction: string;
  computeUnitLimit: number;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

// ── API Functions ──────────────────────────────────────

/**
 * Fetch a swap quote from Bags API.
 * @param direction 'buy' = SOL→NERD, 'sell' = NERD→SOL
 * @param amount    Amount in smallest units (lamports for SOL, atoms for NERD)
 */
export async function getSwapQuote(
  direction: 'buy' | 'sell',
  amount: number,
): Promise<SwapQuote> {
  if (!BAGS_API_KEY) throw new Error('Bags API key not configured');
  if (amount <= 0) throw new Error('Amount must be positive');

  const inputMint = direction === 'buy' ? WRAPPED_SOL_MINT : NERD_MINT;
  const outputMint = direction === 'buy' ? NERD_MINT : WRAPPED_SOL_MINT;

  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageMode: 'auto',
  });

  const res = await fetch(`${BAGS_API_BASE}/trade/quote?${params}`, {
    headers: { 'x-api-key': BAGS_API_KEY },
  });

  if (!res.ok) {
    throw new Error(`Bags API error: ${res.status}`);
  }

  const data: BagsApiResponse<Record<string, unknown>> = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to get swap quote');
  }

  const r = data.response;
  return {
    inAmount: r.inAmount as string,
    outAmount: r.outAmount as string,
    minOutAmount: r.minOutAmount as string,
    priceImpactPct: r.priceImpactPct as string,
    slippageBps: r.slippageBps as number,
    routePlan: (r.routePlan as SwapQuote['routePlan']) || [],
    platformFee: r.platformFee as SwapQuote['platformFee'] | undefined,
    requestId: r.requestId as string,
    _raw: r,
  };
}

/**
 * Create a swap transaction from a quote.
 * Returns a VersionedTransaction ready for wallet signing.
 */
export async function createSwapTransaction(
  quote: SwapQuote,
  userPublicKey: string,
): Promise<{ transaction: VersionedTransaction; lastValidBlockHeight: number }> {
  if (!BAGS_API_KEY) throw new Error('Bags API key not configured');

  const res = await fetch(`${BAGS_API_BASE}/trade/swap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': BAGS_API_KEY,
    },
    body: JSON.stringify({
      quoteResponse: quote._raw,
      userPublicKey,
    }),
  });

  if (!res.ok) {
    throw new Error(`Bags API error: ${res.status}`);
  }

  const data: BagsApiResponse<SwapTransactionResponse> = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'Failed to create swap transaction');
  }

  const { swapTransaction, lastValidBlockHeight } = data.response;
  const txBytes = bs58.decode(swapTransaction);
  const transaction = VersionedTransaction.deserialize(txBytes);

  return { transaction, lastValidBlockHeight };
}

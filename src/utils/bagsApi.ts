// Bags.fm swap client — proxied through Supabase Edge Functions.
// API key lives server-side (EF secret), not in the frontend bundle.
// EFs: swap-quote, swap-transaction

import { VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { SUPABASE_FUNCTIONS_URL } from './constants';
import { getAuthHeaders } from './api';

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
  /**
   * v14 fields, set by swap-quote v14. Older v13 quotes omit these and the
   * UI falls back to legacy display. Frontend must NOT depend on these
   * being present until the v14 backend is live for the request path.
   */
  platformFeeSolLamports?: string;
  feeWallet?: string;
  _provider?: 'jupiter' | 'bags';
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
 * Fetch a swap quote via the swap-quote Edge Function.
 * @param direction 'buy' = SOL→NERD, 'sell' = NERD→SOL
 * @param amount    Amount in smallest units (lamports for SOL, atoms for NERD)
 */
export async function getSwapQuote(
  direction: 'buy' | 'sell',
  amount: number,
): Promise<SwapQuote> {
  if (amount <= 0) throw new Error('Amount must be positive');

  const inputMint = direction === 'buy' ? WRAPPED_SOL_MINT : NERD_MINT;
  const outputMint = direction === 'buy' ? NERD_MINT : WRAPPED_SOL_MINT;

  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/swap-quote`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      inputMint,
      outputMint,
      amount: String(amount),
      slippageMode: 'auto',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error('[BagsAPI] Quote error:', res.status, body);
    throw new Error(`Swap quote error: ${res.status}`);
  }

  const data: BagsApiResponse<Record<string, unknown>> = await res.json();
  if (!data.success) {
    console.error('[BagsAPI] Quote failed:', data.error);
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
 * Generic multi-token swap quote via the swap-quote Edge Function.
 *
 * Use this for arbitrary token pairs (the v2.1 multi-token swap modal).
 * Returns null if the EF returns 'no route' (graceful — caller renders the
 * design's `noroute` state). Throws on hard network/server errors.
 *
 * NOTE: the EF currently routes through Bags only. Many pairs (SOL→USDC,
 * USDC→JUP, etc.) will return no-route until the Jupiter v6 backend
 * migration ships. That's the designed `noroute` state in the UI.
 */
export async function getSwapQuoteFor(
  inputMint: string,
  outputMint: string,
  amount: number | bigint,
  slippageBps?: number,
  inputDecimals?: number,
): Promise<SwapQuote | null> {
  const amt = typeof amount === 'bigint' ? amount.toString() : String(Math.round(amount));
  if (!amt || amt === '0' || amt.startsWith('-')) {
    throw new Error('Amount must be positive');
  }

  const body: Record<string, unknown> = {
    inputMint,
    outputMint,
    amount: amt,
    slippageMode: slippageBps !== undefined ? 'manual' : 'auto',
  };
  if (slippageBps !== undefined) body.slippageBps = slippageBps;
  if (inputDecimals !== undefined) body.inputDecimals = inputDecimals;

  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/swap-quote`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Treat 404/422 (route not found) as the designed `noroute` state — return null.
    // Treat 5xx as a real error worth surfacing.
    if (res.status === 404 || res.status === 422) return null;
    const txt = await res.text().catch(() => '');
    throw new Error(`Swap quote HTTP ${res.status}${txt ? ': ' + txt.slice(0, 200) : ''}`);
  }

  const data: BagsApiResponse<Record<string, unknown>> = await res.json();
  if (!data.success) {
    // EF reports "no route" via { success: false, error: 'no route' }.
    const errLow = (data.error || '').toLowerCase();
    if (errLow.includes('no route') || errLow.includes('noroute') || errLow.includes('not found')) {
      return null;
    }
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
    platformFeeSolLamports: r.platformFeeSolLamports as string | undefined,
    feeWallet: r.feeWallet as string | undefined,
    _provider: r._provider as 'jupiter' | 'bags' | undefined,
    _raw: r,
  };
}

/**
 * Create a swap transaction via the swap-transaction Edge Function.
 * Returns a VersionedTransaction ready for wallet signing.
 */
export async function createSwapTransaction(
  quote: SwapQuote,
  userPublicKey: string,
): Promise<{ transaction: VersionedTransaction; lastValidBlockHeight: number }> {
  const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/swap-transaction`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      quoteResponse: quote._raw,
      userPublicKey,
    }),
  });

  if (!res.ok) {
    throw new Error(`Swap transaction error: ${res.status}`);
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

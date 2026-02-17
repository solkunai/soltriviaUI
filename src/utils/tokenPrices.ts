// Jupiter v3 Price API — fetches live USD prices for SOL and SKR
// USDC is always $1 so no lookup needed.

import type { PaymentToken } from './constants';
import { TOKEN_DECIMALS } from './constants';

const JUPITER_API_URL = 'https://api.jup.ag/price/v3';
const JUPITER_API_KEY = import.meta.env.VITE_JUPITER_API_KEY || '';

// Solana native SOL mint (wrapped SOL)
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';

export interface TokenPrices {
  SOL: number;
  SKR: number;
  USDC: 1;
}

// Cache to avoid hammering the API
let cachedPrices: TokenPrices | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15_000; // 15 seconds

/**
 * Fetch current USD prices for SOL and SKR from Jupiter v3.
 * Returns cached result if less than 15 seconds old.
 */
export async function fetchTokenPrices(): Promise<TokenPrices> {
  const now = Date.now();
  if (cachedPrices && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedPrices;
  }

  const url = `${JUPITER_API_URL}?ids=${SOL_MINT},${SKR_MINT}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (JUPITER_API_KEY) {
    headers['x-api-key'] = JUPITER_API_KEY;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Jupiter API error: ${response.status}`);
  }

  const data = await response.json();

  const solPrice = data?.[SOL_MINT]?.usdPrice;
  const skrPrice = data?.[SKR_MINT]?.usdPrice;

  if (typeof solPrice !== 'number' || solPrice <= 0) {
    throw new Error('Invalid SOL price from Jupiter');
  }
  if (typeof skrPrice !== 'number' || skrPrice <= 0) {
    throw new Error('Invalid SKR price from Jupiter');
  }

  cachedPrices = { SOL: solPrice, SKR: skrPrice, USDC: 1 };
  cacheTimestamp = now;
  return cachedPrices;
}

/**
 * Calculate the token amount (in smallest unit) for a given USD amount.
 * For SOL: returns lamports (9 decimals)
 * For USDC: returns micro-USDC (6 decimals)
 * For SKR: returns smallest SKR unit (6 decimals)
 */
export function calculateTokenAmount(
  usdAmount: number,
  token: PaymentToken,
  prices: TokenPrices
): bigint {
  const decimals = TOKEN_DECIMALS[token];
  const price = prices[token];
  // How many whole tokens needed: usdAmount / price
  // Convert to smallest unit: * 10^decimals
  const rawAmount = (usdAmount / price) * Math.pow(10, decimals);
  // Round up to avoid underpaying (user pays a fraction of a cent more, not less)
  return BigInt(Math.ceil(rawAmount));
}

/**
 * Format a token amount from smallest unit to human-readable string.
 */
export function formatTokenAmount(
  smallestUnit: bigint,
  token: PaymentToken
): string {
  const decimals = TOKEN_DECIMALS[token];
  const divisor = Math.pow(10, decimals);
  const amount = Number(smallestUnit) / divisor;
  // Show enough decimal places to be useful
  if (token === 'USDC') return amount.toFixed(2);
  if (token === 'SOL') return amount.toFixed(4);
  // SKR — show 2 decimals for clean display
  return amount.toFixed(2);
}

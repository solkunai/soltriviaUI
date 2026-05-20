// RPC utility with retry logic and fallback endpoints
import { Connection } from '@solana/web3.js';

const getMainnetEndpoints = (): string[] => {
  const endpoints: string[] = [];

  // Priority 1: Helius via Cloudflare Worker proxy (API key NEVER exposed to browser)
  const heliusProxy = import.meta.env.VITE_HELIUS_RPC_PROXY_URL;
  if (heliusProxy) {
    endpoints.push(heliusProxy);
  }

  // Priority 2: Legacy direct Helius (if proxy not set, falls back to api-key URL)
  // Deprecated — keep only for transition period, remove once proxy is verified in prod.
  const heliusKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (!heliusProxy && heliusKey) {
    endpoints.push(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`);
  }

  // Priority 3: Alchemy (if API key available) - generous free tier
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY;
  if (alchemyKey) {
    endpoints.push(`https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`);
  }

  // Priority 4: Reliable public endpoints (fallback)
  endpoints.push(
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana',
    'https://solana-mainnet.rpc.extrnode.com'
  );

  return endpoints;
};

/**
 * Get the primary RPC endpoint (for ConnectionProvider)
 * Uses Helius proxy > legacy Helius > Alchemy > Public endpoints in order of preference
 */
export function getSolanaRpcEndpoint(): string {
  const heliusProxy = import.meta.env.VITE_HELIUS_RPC_PROXY_URL;
  if (heliusProxy) {
    return heliusProxy;
  }

  const heliusKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (heliusKey) {
    return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  }

  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY;
  if (alchemyKey) {
    return `https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`;
  }

  // Fallback to public endpoint
  return 'https://api.mainnet-beta.solana.com';
}

/**
 * Get recent blockhash with retry logic and fallback RPC endpoints
 * Uses wallet's RPC if available, otherwise tries fallback endpoints
 */
export async function getRecentBlockhashWithRetry(
  connection: Connection,
  maxRetries: number = 2
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  let lastError: Error | null = null;
  const endpoints = getMainnetEndpoints();
  
  // Try the current connection first (might be wallet's RPC)
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await connection.getLatestBlockhash('confirmed');
      return result;
    } catch (error: any) {
      lastError = error;
      
      // If it's a 403 or rate limit error, try fallback endpoints immediately
      if (error.message?.includes('403') || error.message?.includes('forbidden') || error.message?.includes('rate limit')) {
        break; // Exit retry loop and try fallbacks
      }
      
      // Wait before retry (exponential backoff)
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 500));
      }
    }
  }

  // Try fallback endpoints (silently, don't log warnings)
  for (const endpoint of endpoints) {
    // Skip if it's the same as current endpoint
    const endpointBase = endpoint.split('?')[0].split('/v2/')[0];
    if (connection.rpcEndpoint.includes(endpointBase)) continue;
    
    try {
      const fallbackConnection = new Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });
      const result = await fallbackConnection.getLatestBlockhash('confirmed');
      return result;
    } catch (fallbackError: any) {
      // Silently continue to next endpoint
      continue;
    }
  }

  // If all else fails, throw the last error
  throw lastError || new Error('Failed to get recent blockhash. All RPC endpoints are unavailable. Please check your API keys in .env.local (VITE_HELIUS_API_KEY or VITE_ALCHEMY_API_KEY)');
}

// Balance fetching utility with error handling and fallback RPC endpoints
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

const getMainnetEndpoints = (): string[] => {
  const endpoints: string[] = [];
  
  // Priority 1: Helius (if API key available)
  const heliusKey = import.meta.env.VITE_HELIUS_API_KEY;
  if (heliusKey) {
    endpoints.push(`https://mainnet.helius-rpc.com/?api-key=${heliusKey}`);
  }
  
  // Priority 2: Alchemy (if API key available)
  const alchemyKey = import.meta.env.VITE_ALCHEMY_API_KEY;
  if (alchemyKey) {
    endpoints.push(`https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`);
  }
  
  // Priority 3: Public endpoints (fallback)
  endpoints.push(
    'https://api.mainnet-beta.solana.com',
    'https://rpc.ankr.com/solana'
  );
  
  return endpoints;
};

/**
 * Safely fetch balance with timeout, error handling, and fallback RPC endpoints
 * Returns null if balance cannot be fetched (fails silently)
 */
export async function getBalanceSafely(
  connection: Connection,
  publicKey: PublicKey,
  timeout: number = 5000
): Promise<number | null> {
  const endpoints = getMainnetEndpoints();
  
  // Try current connection first
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Balance fetch timeout')), timeout);
    });
    
    const balancePromise = connection.getBalance(publicKey, 'confirmed');
    const lamports = await Promise.race([balancePromise, timeoutPromise]);
    return (lamports as number) / LAMPORTS_PER_SOL;
  } catch (error: any) {
    // If it's a 403 or rate limit, try fallback endpoints
    if (!error.message?.includes('403') && !error.message?.includes('forbidden') && !error.message?.includes('timeout')) {
      return null; // Other errors, just fail silently
    }
  }

  // Try fallback endpoints silently
  for (const endpoint of endpoints) {
    // Skip if it's the same as current endpoint
    const endpointBase = endpoint.split('?')[0].split('/v2/')[0];
    if (connection.rpcEndpoint.includes(endpointBase)) continue;
    
    try {
      const fallbackConnection = new Connection(endpoint, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Balance fetch timeout')), timeout);
      });
      
      const balancePromise = fallbackConnection.getBalance(publicKey, 'confirmed');
      const lamports = await Promise.race([balancePromise, timeoutPromise]);
      return (lamports as number) / LAMPORTS_PER_SOL;
    } catch (fallbackError) {
      // Silently continue to next endpoint
      continue;
    }
  }

  // All endpoints failed, return null silently
  return null;
}

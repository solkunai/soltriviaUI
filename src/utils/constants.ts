// Wallet addresses (from environment variables)
export const PRIZE_POOL_WALLET = import.meta.env.VITE_PRIZE_POOL_WALLET || 'C9U6pL7FcroUBcSGQR2iCEGmAydVjzEE7ZYaJuVJuEEo'; // Entry fees (0.02 SOL) go here
export const REVENUE_WALLET = import.meta.env.VITE_REVENUE_WALLET || '4u1UTyMBX8ghSQBagZHCzArt32XMFSw4CUXbdgo2Cv74'; // Transaction fees (0.0025 SOL) and lives purchases (0.03 SOL)

// Entry fee and lives pricing (from environment variables)
export const ENTRY_FEE_LAMPORTS = parseInt(import.meta.env.VITE_ENTRY_FEE_LAMPORTS || '20000000', 10); // 0.02 SOL entry fee
export const TXN_FEE_LAMPORTS = parseInt(import.meta.env.VITE_TXN_FEE_LAMPORTS || '2500000', 10); // 0.0025 SOL transaction fee
export const TOTAL_ENTRY_FEE_LAMPORTS = ENTRY_FEE_LAMPORTS + TXN_FEE_LAMPORTS; // 0.0225 SOL total
export const LIVES_PRICE_LAMPORTS = parseInt(import.meta.env.VITE_LIVES_PRICE_LAMPORTS || '30000000', 10); // 0.03 SOL for 3 lives (does NOT include entry fee)
export const LIVES_PER_PURCHASE = 3;

export const APP_IDENTITY = {
  name: 'SOL Trivia',
  uri: 'https://soltrivia.app',
  icon: 'favicon.ico',
};

// Network configuration
export const SOLANA_NETWORK: 'devnet' | 'mainnet-beta' = 
  (import.meta.env.VITE_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'mainnet-beta';

export const QUESTIONS_PER_ROUND = 10;
export const SECONDS_PER_QUESTION = 10;

// Scoring
export const MAX_POINTS_PER_QUESTION = 1000;
export const MIN_POINTS_PER_QUESTION = 100;

// Round timing
export const ROUND_DURATION_HOURS = 6; // 4 rounds per day
export const ROUNDS_PER_DAY = 4;

// Supabase Edge Functions URL
export const SUPABASE_FUNCTIONS_URL = 
  import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || 
  'https://uekqrkjiunezsytzyjmx.supabase.co/functions/v1';

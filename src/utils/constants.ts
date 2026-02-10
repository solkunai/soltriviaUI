// Wallet addresses (from environment variables)
export const PRIZE_POOL_WALLET = import.meta.env.VITE_PRIZE_POOL_WALLET || 'C9U6pL7FcroUBcSGQR2iCEGmAydVjzEE7ZYaJuVJuEEo'; // Entry fees (0.02 SOL) go here
export const REVENUE_WALLET = import.meta.env.VITE_REVENUE_WALLET || '4u1UTyMBX8ghSQBagZHCzArt32XMFSw4CUXbdgo2Cv74'; // Transaction fees (0.0025 SOL) and lives purchases (0.03 SOL)

// Entry fee and lives pricing (from environment variables)
export const ENTRY_FEE_LAMPORTS = parseInt(import.meta.env.VITE_ENTRY_FEE_LAMPORTS || '20000000', 10); // 0.02 SOL entry fee
export const TXN_FEE_LAMPORTS = parseInt(import.meta.env.VITE_TXN_FEE_LAMPORTS || '2500000', 10); // 0.0025 SOL transaction fee
export const TOTAL_ENTRY_FEE_LAMPORTS = ENTRY_FEE_LAMPORTS + TXN_FEE_LAMPORTS; // 0.0225 SOL total
export const LIVES_PRICE_LAMPORTS = parseInt(import.meta.env.VITE_LIVES_PRICE_LAMPORTS || '30000000', 10); // 0.03 SOL for 3 lives (does NOT include entry fee)
export const LIVES_PER_PURCHASE = 3;

// Lives purchase tiers (all go to revenue wallet)
export const LIVES_TIERS = [
  { id: 'basic', lives: 3, lamports: 30_000_000, sol: 0.03, label: '3 Lives' },
  { id: 'value', lives: 15, lamports: 100_000_000, sol: 0.1, label: '15 Lives', badge: 'POPULAR' },
  { id: 'bulk', lives: 35, lamports: 250_000_000, sol: 0.25, label: '35 Lives', badge: 'BEST VALUE' },
] as const;

export type LivesTierId = typeof LIVES_TIERS[number]['id'];

export const APP_IDENTITY = {
  name: 'SOL Trivia',
  uri: 'https://soltrivia.app',
  icon: 'favicon.ico',
};

// Network configuration (default mainnet for production; set VITE_SOLANA_NETWORK=devnet for testing)
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

// Default avatar (inline SVG, no network) – use when no avatar_url or when external image fails
export const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'%3E%3Ccircle fill='%23374151' cx='100' cy='100' r='100'/%3E%3Ccircle fill='%236b7280' cx='100' cy='82' r='32'/%3E%3Cellipse fill='%236b7280' cx='100' cy='165' rx='48' ry='38'/%3E%3C/svg%3E";

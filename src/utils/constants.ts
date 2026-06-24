// Feature flag: disable paid trivia while smart contract upgrade is pending
export const PAID_TRIVIA_ENABLED = true;

// Wallet addresses (from environment variables)
// Legacy V1 PRIZE_POOL_WALLET (C9U6pL7F…) removed — V2 holds prizes in on-chain vault PDAs.
export const REVENUE_WALLET = import.meta.env.VITE_REVENUE_WALLET || '4u1UTyMBX8ghSQBagZHCzArt32XMFSw4CUXbdgo2Cv74'; // Platform fees + round entry sweep. NOT used for Lives or Game Pass purchases.

// Lives + Game Pass purchase revenue (separate from platform fees).
// 95% (Lives) / 90% (Game Pass) routes here. The remainder goes to the referrer's
// on-chain ReferralBalance PDA (SOL) or directly to the referrer's wallet ATA (SPL).
// Falls back to 100% here if the buyer has no referrer on file.
export const PURCHASE_REVENUE_WALLET = import.meta.env.VITE_PURCHASE_REVENUE_WALLET || 'ELUU9XSGicKXkv4rgrZjPubXDVeLGuzX6hn42rjk3bww';

// Entry fee and lives pricing (from environment variables)
export const ENTRY_FEE_LAMPORTS = parseInt(import.meta.env.VITE_ENTRY_FEE_LAMPORTS || '20000000', 10); // 0.02 SOL entry fee
export const TXN_FEE_LAMPORTS = parseInt(import.meta.env.VITE_TXN_FEE_LAMPORTS || '2500000', 10); // 0.0025 SOL transaction fee
export const TOTAL_ENTRY_FEE_LAMPORTS = ENTRY_FEE_LAMPORTS + TXN_FEE_LAMPORTS; // 0.0225 SOL total
export const LIVES_PRICE_LAMPORTS = parseInt(import.meta.env.VITE_LIVES_PRICE_LAMPORTS || '30000000', 10); // 0.03 SOL for 3 lives (does NOT include entry fee)
export const LIVES_PER_PURCHASE = 3;

// DEPRECATED: legacy SOL-only fallback. Lives counts updated to the locked 5/20/50.
// Lamport amounts are stale (Lives are USD-priced via LIVES_USD_PRICING now). Removed
// when BuyLivesModal switches to the new build-EF flow (file 9 in the refactor plan).
export const LIVES_TIERS = [
  { id: 'basic', lives: 5,  lamports: 30_000_000, sol: 0.03, label: '5 Lives' },
  { id: 'value', lives: 20, lamports: 100_000_000, sol: 0.1,  label: '20 Lives', badge: 'POPULAR' },
  { id: 'bulk',  lives: 50, lamports: 250_000_000, sol: 0.25, label: '50 Lives', badge: 'BEST VALUE' },
] as const;

// DEPRECATED with LIVES_TIERS above. Lives counts updated to 5/20/50.
export const SEEKER_LIVES_TIERS = [
  { id: 'basic', lives: 5,  lamports: 20_000_000, sol: 0.02, label: '5 Lives' },
  { id: 'value', lives: 20, lamports: 80_000_000, sol: 0.08, label: '20 Lives', badge: 'POPULAR' },
  { id: 'bulk',  lives: 50, lamports: 200_000_000, sol: 0.2,  label: '50 Lives', badge: 'BEST VALUE' },
] as const;

export type LivesTierId = typeof LIVES_TIERS[number]['id'];

// Game Pass pricing (one-time purchase, all goes to revenue wallet)
export const GAME_PASS_PRICE_LAMPORTS = 100_000_000; // 0.1 SOL regular
export const GAME_PASS_PRICE_SOL = 0.1;
export const SEEKER_GAME_PASS_PRICE_LAMPORTS = 50_000_000; // 0.05 SOL for SGT holders
export const SEEKER_GAME_PASS_PRICE_SOL = 0.05;

// ─── Multi-token payment support (SOL / USDC / SKR) ─────────────────────────
export type PaymentToken = 'SOL' | 'USDC' | 'SKR' | 'NERD';

// Token mint addresses (Solana mainnet)
export const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const SKR_MINT = 'SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3';
export const NERD_MINT = 'DEc6Gf57RfFJbjqGrzo4zeRBr5iQS8vTV8r11ZuyBAGS';
// Wrapped SOL mint (used for SOL token_mint assertion in purchase EFs + Jupiter quotes).
export const SOL_NATIVE_MINT = 'So11111111111111111111111111111111111111112';

export function getTokenMint(token: PaymentToken): string {
  if (token === 'SOL')  return SOL_NATIVE_MINT;
  if (token === 'USDC') return USDC_MINT;
  if (token === 'SKR')  return SKR_MINT;
  return NERD_MINT;
}

// Token decimals
export const TOKEN_DECIMALS: Record<PaymentToken, number> = {
  SOL: 9,
  USDC: 6,
  SKR: 6,
  NERD: 9,
};

// USD-based pricing for lives (used with all tokens). Standard $3/$10/$20.
// Seeker 35% off → $1.95/$6.50/$13. Lives counts locked at 5/20/50.
export const LIVES_USD_PRICING = {
  basic:  { lives: 5,  standard: 3,  seeker: 1.95 },
  value:  { lives: 20, standard: 10, seeker: 6.5  },
  bulk:   { lives: 50, standard: 20, seeker: 13   },
} as const;

// Monthly + annual Game Pass pricing (USD).
// Math (Kyle 2026-06-07): annual = 25% off the 12× monthly rate.
//   Regular: 12 × $10 = $120 full → 25% off = $90
//   Seeker:  12 × $6.50 = $78 full → 25% off = $58.50
// Earlier: $85 / $55 (29% off) — rebalanced to 25% per Kyle.
export const GAME_PASS_USD_PRICING = {
  monthly: { standard: 10, seeker: 6.5 },
  annual:  { standard: 90, seeker: 58.5 },
} as const;

export type GamePassPlan = 'monthly' | 'annual';
export const GAME_PASS_PLAN_DAYS: Record<GamePassPlan, number> = { monthly: 30, annual: 365 };

// $NERD token payment discount (10% off when paying with $NERD)
export const NERD_PAYMENT_DISCOUNT = 0.10;

// ─── Referral split (V2 contract: on-chain SOL via ReferralBalance PDA, off-PDA SPL direct) ───
// Seed for the ReferralBalance PDA under V2_PROGRAM_ID: ["referral_balance", referrer_pubkey].
export const REFERRAL_BALANCE_SEED = 'referral_balance';
// Basis points of the purchase that go to the referrer (0 if buyer has no referrer).
export const LIVES_REFERRAL_BPS = 500;     // 5% of Lives purchases
export const GAMEPASS_REFERRAL_BPS = 1000; // 10% of Game Pass purchases

// ─── Per-token slippage tolerance (basis points, one-sided underpay floor) ───
// EF verify check: buyer's tx must not net less than (expected * (1 - bps/10000)) on the revenue leg.
// Wider on volatile tokens so the Jupiter quote vs verify-time price drift does not reject buyers.
export const PAYMENT_SLIPPAGE_BPS: Record<PaymentToken, number> = {
  USDC: 50,  // 0.5% (stablecoin, tight, also catches depeg)
  SOL:  200, // 2%
  SKR:  300, // 3% (smaller-cap)
  NERD: 300, // 3% (memecoin volatility)
};

// Practice mode categories
export const FREE_CATEGORIES = ['general', 'crypto'] as const;
export const PREMIUM_CATEGORIES = ['sports', 'history', 'geography', 'entertainment', 'science'] as const;
export const ALL_CATEGORIES = [...FREE_CATEGORIES, ...PREMIUM_CATEGORIES] as const;
export type PracticeCategory = typeof ALL_CATEGORIES[number];

export const CATEGORY_LABELS: Record<PracticeCategory, string> = {
  general: 'General Knowledge',
  crypto: 'Crypto & Web3',
  sports: 'Sports',
  history: 'History',
  geography: 'Geography',
  entertainment: 'Entertainment',
  science: 'Science & Tech',
};

// ─── V2 Contract Constants ───────────────────────────────────────────────
export const V2_PROGRAM_ID = 'A3CSWY7bJukyKgR8RXXq1jbRAvqTY5jYtArF5Xt9dhjE';
export const OPERATOR_WALLET = 'GRjf5emRyuwsk4Hf19xTLEdjttqx7QSKsh6RzGMd9XTr';
// On-chain config.owner. NOT the Ledger A3pqx (memory was wrong) — verified
// 2026-05-29 via direct GameConfig PDA read. Kyle holds this in Phantom.
// Will be transferred to the Squads 2/3 vault via set_owner after the upgrade
// is deployed; this constant then updates to the Squads vault address.
export const OWNER_WALLET = '8qHMpkPLfj4neP7MYm74Xos26jPE55bMUUBTJBQRYuBF';

// Tier entry fees (lamports) — player pays this + 0.0025 platform fee
export const V2_TIER_FEES = [20_000_000, 100_000_000, 500_000_000, 1_000_000_000] as const;
export const V2_TIER_LABELS = ['0.02 SOL', '0.1 SOL', '0.5 SOL', '1 SOL'] as const;

// Duel fee presets (lamports) — each player pays this + 0.0025 platform fee
export const V2_DUEL_FEES = [10_000_000, 50_000_000, 100_000_000, 250_000_000, 500_000_000, 1_000_000_000] as const;
export const V2_DUEL_LABELS = ['0.01 SOL', '0.05 SOL', '0.1 SOL', '0.25 SOL', '0.5 SOL', '1 SOL'] as const;
export const DUEL_QUESTIONS_COUNT = 5;
export const DUEL_SECONDS_PER_QUESTION = 10;
export const DUEL_EXPIRY_MINUTES = 60;

// Prize distribution (basis points, top 5)
export const TRIVIA_PRIZE_BPS = [5000, 2000, 1500, 1000, 500] as const;
export const TRIVIA_PRIZE_LABELS = ['50%', '20%', '15%', '10%', '5%'] as const;

// ─── Custom Games ─────────────────────────────────────────────────────────
export const CUSTOM_GAME_CREATION_FEE_LAMPORTS = 5_000_000; // 0.005 SOL (non-pass holders only)
export const CUSTOM_GAME_PLATFORM_FEE_LAMPORTS = TXN_FEE_LAMPORTS;   // 0.0025 SOL (everyone)
export const CUSTOM_GAME_QUESTION_COUNTS = [5, 10, 15] as const;
export const CUSTOM_GAME_ROUND_COUNTS = [1, 3, 5] as const;
export const CUSTOM_GAME_TIME_LIMITS = [10, 15, 20, 30] as const;
export const CUSTOM_GAME_MAX_ATTEMPTS = 3;

/** Re-entry fee = 10% of entry fee, minimum 0.0025 SOL (platform fee) */
export function getReEntryFeeLamports(entryFeeLamports: number): number {
  if (entryFeeLamports <= 0) return TXN_FEE_LAMPORTS; // creator-funded fallback
  return Math.max(Math.floor(entryFeeLamports * 0.10), TXN_FEE_LAMPORTS);
}
export const CUSTOM_GAME_EXPIRY_DAYS = 7;
export const CUSTOM_GAME_NAME_MAX = 60;
export const CUSTOM_GAME_QUESTION_TEXT_MAX = 500;
export const CUSTOM_GAME_OPTION_TEXT_MAX = 200;
export const CUSTOM_GAME_SLUG_MIN = 3;
export const CUSTOM_GAME_SLUG_MAX = 40;

// Valid round counts per question count (must divide evenly)
export const VALID_ROUND_COUNTS: Record<number, number[]> = {
  5: [1, 5],
  10: [1, 2, 5, 10],
  15: [1, 3, 5, 15],
};

// ─── Custom Game Prize Pool ──────────────────────────────────────────────
export const CUSTOM_GAME_ENTRY_FEE_PRESETS = [
  50_000_000,     // 0.05 SOL
  100_000_000,    // 0.1 SOL
  500_000_000,    // 0.5 SOL
  1_000_000_000,  // 1 SOL
  5_000_000_000,  // 5 SOL
] as const;
export const CUSTOM_GAME_ENTRY_FEE_LABELS = ['0.05', '0.1', '0.5', '1', '5'] as const;
export const CUSTOM_GAME_MIN_ENTRY_FEE = 10_000_000;      // 0.01 SOL
export const CUSTOM_GAME_MAX_ENTRY_FEE = 10_000_000_000;   // 10 SOL
export const CUSTOM_GAME_MAX_PLAYER_PRESETS = [5, 25, 100, 1000, 10_000] as const;
export const CUSTOM_GAME_MIN_PLAYERS = 2;
export const CUSTOM_GAME_MAX_PLAYERS = 10_000;
// null sentinel for "No Max" (∞ players). Join EF already handles null/0 as no cap.
export type CustomGameMaxPlayers = number | null;
export const CUSTOM_GAME_MIN_DURATION_MINUTES = 15;
export const CUSTOM_GAME_MAX_DURATION_MINUTES = 30 * 24 * 60; // 30 days = 43,200 min
export const CUSTOM_GAME_DURATION_PRESETS = [
  { minutes: 15,    label: '15 Min'  },
  { minutes: 60,    label: '1 Hour'  },
  { minutes: 480,   label: '8 Hours' },
  { minutes: 1440,  label: '24 Hours'},
  { minutes: 2880,  label: '48 Hours'},
  { minutes: 10080, label: '7 Days'  },
] as const;
export const CUSTOM_GAME_WINNER_SPLITS: Record<number, number[]> = {
  1: [10000, 0, 0, 0, 0],
  3: [5000, 3000, 2000, 0, 0],
  5: [5000, 2000, 1500, 1000, 500],
};
export const CUSTOM_GAME_WINNER_SPLIT_LABELS: Record<number, string[]> = {
  1: ['100%'],
  3: ['50%', '30%', '20%'],
  5: ['50%', '20%', '15%', '10%', '5%'],
};
export const CUSTOM_GAME_PLATFORM_CUT_BPS = 1000; // 10% of pot

// ─── Creator-Funded Games ────────────────────────────────────────────────
export const CREATOR_FUNDED_MIN_PRIZE_LAMPORTS = 50_000_000;       // 0.05 SOL
export const CREATOR_FUNDED_MAX_PRIZE_LAMPORTS = 100_000_000_000;  // 100 SOL
export const CREATOR_FUNDED_PRIZE_PRESETS = [
  100_000_000,     // 0.1 SOL
  250_000_000,     // 0.25 SOL
  500_000_000,     // 0.5 SOL
  1_000_000_000,   // 1 SOL
  5_000_000_000,   // 5 SOL
] as const;
export const CREATOR_FUNDED_PRIZE_LABELS = ['0.1', '0.25', '0.5', '1', '5'] as const;

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

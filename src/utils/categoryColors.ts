/**
 * Category color map , single source of truth for the category pill / accent
 * color shown on QuizView (per-question category badge) and FreePlayViewV2
 * (per-category progress tile + colored START PRACTICE button by selection).
 *
 * LOCKED 2026-06-04 per Kyle:
 *  - bold solid pill with WHITE italic Saira text (no per-color text adjustments)
 *  - NO PURPLE anywhere , removed from the v1 proposal
 *  - crypto + solana share Solana brand green
 *  - defi moved off emerald (too close to brand green) to teal for visual separation
 *  - nfts replaced its v1 violet with rose
 *
 * Adding a new category: insert here + the QuizView + FreePlayViewV2 pick it
 * up automatically via the imported map. Unknown categories fall back to
 * DEFAULT_CATEGORY_COLOR (neutral zinc).
 */

export const CATEGORY_COLORS: Record<string, string> = {
  crypto: '#14F195',        // Solana green (brand)
  solana: '#14F195',        // Solana green (brand)
  general: '#A1A1AA',       // zinc neutral
  sports: '#FF9500',        // orange
  history: '#FBBF24',       // amber
  geography: '#3B82F6',     // blue (was cyan #38BDF8; clashed with science)
  entertainment: '#EC4899', // pink
  science: '#22D3EE',       // bright cyan (was sky #0EA5E9; clashed with geography)
  nfts: '#F43F5E',          // rose
  defi: '#14B8A6',          // teal
  memecoins: '#F97316',     // orange-red
  bitcoin: '#FFD700',       // gold
};

export const DEFAULT_CATEGORY_COLOR = '#A1A1AA';

/** Look up a category's pill / accent color. Case-insensitive. Falls back
 *  to neutral zinc for unknown / empty strings. */
export function getCategoryColor(category: string | null | undefined): string {
  if (!category) return DEFAULT_CATEGORY_COLOR;
  return CATEGORY_COLORS[category.toLowerCase()] ?? DEFAULT_CATEGORY_COLOR;
}

/** Title-case display label for a category slug. `crypto` → `CRYPTO`. */
export function categoryLabel(category: string | null | undefined): string {
  return (category ?? 'trivia').toUpperCase();
}

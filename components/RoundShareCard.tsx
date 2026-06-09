/**
 * RoundShareCard , the daily-round share card.
 *
 * 2026-06-09 REWRITE: ports the 16-card design handoff system. This wrapper
 * delegates rendering to `renderRoundCard()` from `share/ShareCardVariants`,
 * which picks one of 4 round-win cards (WAGMI / BAG SECURED / CRACKED /
 * ON FIRE) or 4 round-loss cards (NGMI / REKT / COOKED / SKILL ISSUE)
 * based on real result data: score, rank, time, prize, streak, place-drop.
 *
 * The wrapper keeps the `React.forwardRef<HTMLDivElement>` interface so the
 * existing html-to-image capture in `ResultsView.tsx` continues to work
 * unchanged. The captured image is now 1200x630 (X card spec) instead of
 * the old 480x600.
 *
 * Spec: /Users/solkunai/Downloads/sharecards-handoff/
 */

import * as React from 'react';
import {
  renderRoundCard,
  selectRoundVariant,
  type RoundCardData,
} from './share/ShareCardVariants';

// Legacy tier type kept for back-compat with any caller that still imports it.
export type RoundTier = 'wagmi' | 'almost' | 'ngmi' | 'rekt';

export interface RoundShareCardProps {
  /** Score out of 10 (e.g. 7). */
  score: number;
  /** Total points / XP earned this round. */
  points: number;
  /** Elapsed seconds. */
  timeSec: number;
  /** Final rank when known (round may not be finalized yet). */
  rank?: number | null;
  /** Total entries in this round (for "of N" stat). Optional. */
  totalPlayers?: number;
  /** SOL prize paid out (set for top-5 finishers after on-chain payout). */
  prizeSol?: number;
  /** Consecutive round-win streak count (drives ON FIRE variant). */
  winStreak?: number;
  /** Places dropped vs previous round's rank (drives COOKED variant). */
  rankDropPlaces?: number;
  /** Legacy tier prop , ignored now (selector picks card from data). */
  tier?: RoundTier;
}

const RoundShareCard = React.forwardRef<HTMLDivElement, RoundShareCardProps>(
  function RoundShareCard(
    { score, timeSec, rank, totalPlayers, prizeSol, winStreak, rankDropPlaces },
    ref,
  ) {
    const data: RoundCardData = {
      score,
      rank: rank ?? null,
      timeSeconds: timeSec,
      totalPlayers: totalPlayers ?? 0,
      prizeSol,
      winStreak,
      rankDropPlaces,
    };
    return (
      <div ref={ref}>
        {renderRoundCard(data)}
      </div>
    );
  },
);

export default RoundShareCard;

// ── Tweet moment selection ─────────────────────────────────────────────

export type RoundTweetMoment =
  | 'daily_round_wagmi'
  | 'daily_round_almost'
  | 'daily_round_ngmi'
  | 'daily_round_rekt';

/**
 * Pick the tier + tweet moment for a round result. Now powered by the
 * new 8-variant selector but normalized to the 4 legacy tweet banks.
 *
 * Win variants  → wagmi bank
 * Mid losses    → ngmi bank
 * Bad losses    → rekt bank
 *
 * 2026-06-09: Solo-entry fix. When rank=1 with score<5 (i.e. you were the
 * only entrant), do NOT treat as wagmi  cringe to humble-brag a placement
 * earned by walkover. Falls through to score-based tier.
 */
export function getRoundTier(
  score: number,
  rank: number | null | undefined,
): { tier: RoundTier; moment: RoundTweetMoment } {
  // Solo-entry guard: rank=1 with sub-5 score = no real competition.
  const isSoloDefault = rank === 1 && score < 5;

  if (rank != null && !isSoloDefault) {
    if (rank <= 5) return { tier: 'wagmi', moment: 'daily_round_wagmi' };
    if (rank <= 15) return { tier: 'almost', moment: 'daily_round_almost' };
    if (rank <= 30) return { tier: 'ngmi', moment: 'daily_round_ngmi' };
    return { tier: 'rekt', moment: 'daily_round_rekt' };
  }
  if (score >= 8) return { tier: 'wagmi', moment: 'daily_round_wagmi' };
  if (score >= 6) return { tier: 'almost', moment: 'daily_round_almost' };
  if (score >= 3) return { tier: 'ngmi', moment: 'daily_round_ngmi' };
  return { tier: 'rekt', moment: 'daily_round_rekt' };
}

// Re-export the selector + variant type for callers that want the precise
// variant (e.g. analytics, native parity port).
export { selectRoundVariant };
export type { RoundCardData };

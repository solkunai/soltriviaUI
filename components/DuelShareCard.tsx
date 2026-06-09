/**
 * DuelShareCard , the 1v1 duel result share card.
 *
 * 2026-06-09 REWRITE: ports the 16-card design handoff system. Delegates to
 * `renderDuelCard()` which picks one of 4 win cards (TRIVIA MASTER /
 * PROBLEM SOLVED / CLEAN SWEEP / KING) or 4 loss cards (WRECKED /
 * GOT COOKED / SWEPT / HUMBLED) based on duel result data.
 *
 * Wrapper keeps `React.forwardRef<HTMLDivElement>` so the html-to-image
 * capture in `DuelResultsView.tsx` continues to work unchanged. Captured
 * image is now 1200x630 (X card spec).
 *
 * Spec: /Users/solkunai/Downloads/sharecards-handoff/
 */

import * as React from 'react';
import {
  renderDuelCard,
  selectDuelVariant,
  type DuelCardData,
} from './share/ShareCardVariants';

export interface DuelShareCardProps {
  /** True = winner card, false = loss card. */
  won: boolean;
  /** Formatted prize line, e.g. "0.18 SOL" or "100 NERD". */
  prizeLabel: string;
  /** Formatted wager line, e.g. "0.1 SOL each". */
  wagerLabel: string;
  /** This player's score (tabular). */
  myScore: number;
  /** Opponent's score (tabular). */
  opponentScore: number;
  /** Opponent display name. */
  opponentName: string;
  /** This player's correct count out of 5. */
  myCorrect: number;
  /** Opponent's correct count out of 5. */
  opponentCorrect: number;
  /** Optional own handle to render under the avatar (defaults to "@YOU"). */
  myHandle?: string;
}

/**
 * Extract the numeric SOL amount from a formatted prize label like
 * "0.18 SOL" or "100 NERD". Returns the leading number as a string for
 * card display. NERD/SPL prizes fall back to a short label.
 */
function extractSolAmount(prizeLabel: string): string {
  // Match leading float
  const m = prizeLabel.match(/^(\d+(?:\.\d+)?)/);
  if (m) return m[1];
  return '0';
}

const DuelShareCard = React.forwardRef<HTMLDivElement, DuelShareCardProps>(
  function DuelShareCard(
    { won, prizeLabel, myCorrect, opponentCorrect, opponentName, myHandle },
    ref,
  ) {
    const data: DuelCardData = {
      won,
      myScore: myCorrect,
      oppScore: opponentCorrect,
      oppHandle: opponentName,
      myHandle: myHandle ?? '@YOU',
      amountSol: extractSolAmount(prizeLabel),
    };
    return (
      <div ref={ref}>
        {renderDuelCard(data)}
      </div>
    );
  },
);

export default DuelShareCard;

// Re-exports for callers that want the precise variant (analytics, native parity).
export { selectDuelVariant };
export type { DuelCardData };

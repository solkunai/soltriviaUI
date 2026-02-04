-- Leaderboard and round winners: accurate tracking without a new table
--
-- Approach: Keep using game_sessions as source of truth. This migration:
-- 1. Adds rank to game_sessions so each finished session has a rank (1, 2, 3...) per round.
-- 2. Adds winner_score to daily_rounds (winner_wallet already exists).
-- 3. Adds calculate_rankings_and_winner(round_id): recomputes rank for all finished
--    sessions in that round and sets daily_rounds.winner_wallet + winner_score to the #1.
--
-- complete-session calls this RPC after every game finish so leaderboard and round
-- winner stay in sync. Round Winners page reads winner from daily_rounds when set
-- (fast); otherwise falls back to deriving from game_sessions.

-- Add rank column to game_sessions (nullable until backfilled)
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS rank INTEGER;

-- Add winner_score to daily_rounds (so we store #1's score with the round)
ALTER TABLE public.daily_rounds
  ADD COLUMN IF NOT EXISTS winner_score BIGINT DEFAULT 0;

-- Index for "top of round" queries
CREATE INDEX IF NOT EXISTS idx_game_sessions_round_rank
  ON public.game_sessions(round_id, rank)
  WHERE finished_at IS NOT NULL;

-- Recalculate ranks for a round and set round winner. Call after every complete-session.
CREATE OR REPLACE FUNCTION public.calculate_rankings_and_winner(p_round_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner_wallet TEXT;
  v_winner_score BIGINT;
BEGIN
  -- Update rank: total_points DESC, then time_taken_seconds ASC (faster = better)
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(total_points, 0) DESC, COALESCE(time_taken_seconds, 999999) ASC
      ) AS rn
    FROM public.game_sessions
    WHERE round_id = p_round_id AND finished_at IS NOT NULL
  )
  UPDATE public.game_sessions gs
  SET rank = ranked.rn::INTEGER
  FROM ranked
  WHERE gs.id = ranked.id;

  -- Set round winner from #1
  SELECT wallet_address, COALESCE(total_points, 0)::BIGINT
  INTO v_winner_wallet, v_winner_score
  FROM public.game_sessions
  WHERE round_id = p_round_id AND finished_at IS NOT NULL
  ORDER BY COALESCE(total_points, 0) DESC, COALESCE(time_taken_seconds, 999999) ASC
  LIMIT 1;

  IF v_winner_wallet IS NOT NULL THEN
    UPDATE public.daily_rounds
    SET winner_wallet = v_winner_wallet, winner_score = v_winner_score
    WHERE id = p_round_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_rankings_and_winner(UUID) IS
  'Recalculates rank for all finished sessions in the round and sets daily_rounds.winner_wallet/winner_score to the current #1. Call after each complete-session.';

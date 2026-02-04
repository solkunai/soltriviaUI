-- Round winners: dedicated table with fixed schema so the app never touches game_sessions for this.
-- One row per round (the #1 finisher). Written by calculate_rankings_and_winner; read by Round Winners page.

CREATE TABLE IF NOT EXISTS public.round_winners (
  round_id UUID PRIMARY KEY REFERENCES public.daily_rounds(id) ON DELETE CASCADE,
  winner_wallet TEXT,
  winner_score BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_round_winners_updated ON public.round_winners(updated_at DESC);

COMMENT ON TABLE public.round_winners IS 'One row per round: winner wallet and score. Fixed schema; no dependency on game_sessions column names.';

-- Backfill from daily_rounds where winner was already set (e.g. by previous runs of calculate_rankings_and_winner)
INSERT INTO public.round_winners (round_id, winner_wallet, winner_score, updated_at)
SELECT id, winner_wallet, winner_score, timezone('utc'::text, now())
FROM public.daily_rounds
WHERE winner_wallet IS NOT NULL AND winner_wallet <> ''
ON CONFLICT (round_id) DO NOTHING;

ALTER TABLE public.round_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Round winners are viewable by everyone" ON public.round_winners;
CREATE POLICY "Round winners are viewable by everyone"
  ON public.round_winners FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage round winners" ON public.round_winners;
CREATE POLICY "Service role can manage round winners"
  ON public.round_winners FOR ALL USING (auth.role() = 'service_role');

-- Extend the existing function to also write to round_winners (keeps existing game_sessions/daily_rounds logic)
CREATE OR REPLACE FUNCTION public.calculate_rankings_and_winner(p_round_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner_wallet TEXT;
  v_winner_score BIGINT;
BEGIN
  -- Update rank: total_points DESC, then time_taken_seconds ASC (same as leaderboard migration)
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

    INSERT INTO public.round_winners (round_id, winner_wallet, winner_score, updated_at)
    VALUES (p_round_id, v_winner_wallet, v_winner_score, timezone('utc'::text, now()))
    ON CONFLICT (round_id) DO UPDATE SET
      winner_wallet = EXCLUDED.winner_wallet,
      winner_score = EXCLUDED.winner_score,
      updated_at = EXCLUDED.updated_at;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.calculate_rankings_and_winner(UUID) IS
  'Recalculates rank in game_sessions, updates daily_rounds and round_winners with current #1. Call after each complete-session.';

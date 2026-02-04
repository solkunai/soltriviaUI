-- Dedicated leaderboard table: one row per player per round, updated on every complete-session.
-- Everyone reads from this table for daily leaderboard, so all users see the same list in real time.

CREATE TABLE IF NOT EXISTS public.round_leaderboard (
  round_id UUID NOT NULL REFERENCES public.daily_rounds(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  time_taken_ms INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (round_id, wallet_address)
);

ALTER TABLE public.round_leaderboard ADD COLUMN IF NOT EXISTS time_taken_ms INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_round_leaderboard_round_rank
  ON public.round_leaderboard(round_id, rank);

-- RLS: anyone can read; only service role (or function) can write
ALTER TABLE public.round_leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Round leaderboard is viewable by everyone" ON public.round_leaderboard;
CREATE POLICY "Round leaderboard is viewable by everyone"
  ON public.round_leaderboard FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Service role can manage round leaderboard" ON public.round_leaderboard;
CREATE POLICY "Service role can manage round leaderboard"
  ON public.round_leaderboard FOR ALL
  USING (auth.role() = 'service_role');

-- Refresh round_leaderboard from game_sessions + player_profiles. Call after calculate_rankings_and_winner.
CREATE OR REPLACE FUNCTION public.refresh_round_leaderboard(p_round_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.round_leaderboard WHERE round_id = p_round_id;

  INSERT INTO public.round_leaderboard (round_id, wallet_address, rank, score, display_name, avatar_url, time_taken_ms, updated_at)
  SELECT
    gs.round_id,
    gs.wallet_address,
    gs.rank,
    COALESCE(gs.score, gs.total_points, 0)::INTEGER,
    pp.username,
    pp.avatar_url,
    COALESCE(gs.time_taken_ms, gs.time_taken_seconds * 1000, 0)::INTEGER,
    NOW()
  FROM public.game_sessions gs
  LEFT JOIN public.player_profiles pp ON pp.wallet_address = gs.wallet_address
  WHERE gs.round_id = p_round_id
    AND (gs.finished_at IS NOT NULL OR gs.completed_at IS NOT NULL)
    AND gs.rank IS NOT NULL
  ORDER BY gs.rank;
END;
$$;

COMMENT ON TABLE public.round_leaderboard IS 'Snapshot of round leaderboard; refreshed by complete-session so all users see the same list.';
COMMENT ON FUNCTION public.refresh_round_leaderboard(UUID) IS 'Rebuild round_leaderboard from game_sessions for a round. Call after calculate_rankings_and_winner.';

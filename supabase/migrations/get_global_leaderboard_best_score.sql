-- Global leaderboard: one row per player, ranked by their best (highest) single-game score across all rounds.
-- Updates as new rounds complete. Uses game_sessions + player_profiles (no players table).

CREATE OR REPLACE FUNCTION public.get_global_leaderboard_best_score(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  rank BIGINT,
  wallet_address TEXT,
  best_score BIGINT,
  display_name TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY t.best_score DESC)::BIGINT AS rank,
    t.wallet_address,
    t.best_score,
    pp.username AS display_name,
    pp.avatar_url
  FROM (
    SELECT
      gs.wallet_address,
      MAX(COALESCE(gs.score, gs.total_points, 0))::BIGINT AS best_score
    FROM public.game_sessions gs
    WHERE gs.finished_at IS NOT NULL OR gs.completed_at IS NOT NULL
    GROUP BY gs.wallet_address
  ) t
  LEFT JOIN public.player_profiles pp ON pp.wallet_address = t.wallet_address
  ORDER BY t.best_score DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION public.get_global_leaderboard_best_score(INTEGER) IS 'Leaderboard across all rounds: rank by highest single-game score per player.';

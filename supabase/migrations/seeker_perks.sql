-- ==========================================
-- SEEKER PERKS SCHEMA
-- Adds Seeker Genesis Token verification, .skr domain, and Seeker Champion quest
-- ==========================================

-- 1. Add Seeker columns to player_profiles
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS is_seeker_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS seeker_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS skr_domain TEXT,
  ADD COLUMN IF NOT EXISTS use_skr_as_display BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_player_profiles_seeker
  ON public.player_profiles(is_seeker_verified)
  WHERE is_seeker_verified = true;

-- 2. Add is_seeker_verified to round_leaderboard
ALTER TABLE public.round_leaderboard
  ADD COLUMN IF NOT EXISTS is_seeker_verified BOOLEAN DEFAULT false;

-- 3. Update refresh_round_leaderboard to include Seeker status
CREATE OR REPLACE FUNCTION public.refresh_round_leaderboard(p_round_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.round_leaderboard WHERE round_id = p_round_id;

  INSERT INTO public.round_leaderboard (round_id, wallet_address, rank, score, display_name, avatar_url, time_taken_ms, is_seeker_verified, updated_at)
  SELECT
    gs.round_id,
    gs.wallet_address,
    gs.rank,
    COALESCE(gs.score, gs.total_points, 0)::INTEGER,
    pp.username,
    pp.avatar_url,
    COALESCE(gs.time_taken_ms, gs.time_taken_seconds * 1000, 0)::INTEGER,
    COALESCE(pp.is_seeker_verified, false),
    NOW()
  FROM public.game_sessions gs
  LEFT JOIN public.player_profiles pp ON pp.wallet_address = gs.wallet_address
  WHERE gs.round_id = p_round_id
    AND (gs.finished_at IS NOT NULL OR gs.completed_at IS NOT NULL)
    AND gs.rank IS NOT NULL
  ORDER BY gs.rank;
END;
$$;

-- 4. Update global leaderboard to include Seeker status
CREATE OR REPLACE FUNCTION public.get_global_leaderboard_best_score(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
  rank BIGINT,
  wallet_address TEXT,
  best_score BIGINT,
  display_name TEXT,
  avatar_url TEXT,
  is_seeker_verified BOOLEAN
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
    pp.avatar_url,
    COALESCE(pp.is_seeker_verified, false) AS is_seeker_verified
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

-- 5. Seed Seeker Champion quest
INSERT INTO public.quests (id, slug, title, description, category, reward_tp, reward_label, requirement_type, requirement_config, sort_order, quest_type, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'seeker_champion',
  'SEEKER CHAMPION',
  'Win 5 rounds as a verified Seeker device owner',
  'Priority Mission',
  50000,
  '50,000 TP',
  'seeker_wins',
  '{"max": 5}',
  6,
  'ELITE',
  true,
  timezone('utc'::text, now()),
  timezone('utc'::text, now())
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  reward_tp = EXCLUDED.reward_tp,
  reward_label = EXCLUDED.reward_label,
  requirement_config = EXCLUDED.requirement_config,
  updated_at = timezone('utc'::text, now());

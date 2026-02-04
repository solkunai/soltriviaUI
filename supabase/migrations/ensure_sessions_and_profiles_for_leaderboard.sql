-- Ensure sessions and profiles support leaderboard and profile stats
-- Run this after game_sessions_ensure_score_columns.sql and SUPABASE_SETUP (player_profiles).

-- 1. game_sessions: ensure leaderboard columns exist (idempotent)
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER DEFAULT 0;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS time_taken_ms INTEGER DEFAULT 0;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS correct_count INTEGER DEFAULT 0;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS correct_answers INTEGER DEFAULT 0;

-- Backfill so leaderboard shows correct score (support both column names)
UPDATE public.game_sessions
SET total_points = COALESCE(NULLIF(total_points, 0), score, 0),
    time_taken_seconds = COALESCE(NULLIF(time_taken_seconds, 0), time_taken_ms / 1000, 0)
WHERE (total_points IS NULL OR total_points = 0) AND (score IS NOT NULL AND score > 0);
UPDATE public.game_sessions
SET score = COALESCE(NULLIF(score, 0), total_points, 0)
WHERE (score IS NULL OR score = 0) AND (total_points IS NOT NULL AND total_points > 0);
UPDATE public.game_sessions
SET finished_at = COALESCE(finished_at, completed_at)
WHERE finished_at IS NULL AND completed_at IS NOT NULL;
UPDATE public.game_sessions
SET completed_at = COALESCE(completed_at, finished_at)
WHERE completed_at IS NULL AND finished_at IS NOT NULL;
UPDATE public.game_sessions
SET correct_count = COALESCE(NULLIF(correct_count, 0), correct_answers, 0)
WHERE (correct_count IS NULL OR correct_count = 0) AND (correct_answers IS NOT NULL AND correct_answers > 0);
UPDATE public.game_sessions
SET correct_answers = COALESCE(NULLIF(correct_answers, 0), correct_count, 0)
WHERE (correct_answers IS NULL OR correct_answers = 0) AND (correct_count IS NOT NULL AND correct_count > 0);

-- Index for fast leaderboard query (finished sessions per round by score)
CREATE INDEX IF NOT EXISTS idx_game_sessions_round_finished_score
  ON public.game_sessions(round_id, finished_at)
  WHERE finished_at IS NOT NULL;

-- 2. player_profiles: ensure table and columns exist (profile stats per user; complete-session updates these)
CREATE TABLE IF NOT EXISTS public.player_profiles (
    wallet_address TEXT PRIMARY KEY,
    username TEXT,
    avatar_url TEXT,
    total_games_played INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    highest_score INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add columns if table existed from an older setup without them
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS total_games_played INTEGER DEFAULT 0;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS highest_score INTEGER DEFAULT 0;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS last_activity_date DATE;
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_player_profiles_points ON public.player_profiles(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_player_profiles_highest ON public.player_profiles(highest_score DESC);

COMMENT ON TABLE public.game_sessions IS 'One row per user per round. finished_at set by complete-session so leaderboard (get-leaderboard) can show score.';
COMMENT ON TABLE public.player_profiles IS 'Per-wallet profile and stats; complete-session updates total_games_played, total_points, highest_score.';

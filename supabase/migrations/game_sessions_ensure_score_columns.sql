-- Ensure game_sessions has columns needed for leaderboard and round winners (support both naming conventions)
-- So complete-session can always store score and time, and calculate_rankings_and_winner can read them.

ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS time_taken_seconds INTEGER DEFAULT 0;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS time_taken_ms INTEGER DEFAULT 0;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;
ALTER TABLE public.game_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Backfill: copy score -> total_points and time_taken_ms -> time_taken_seconds where null/zero so ranking works
UPDATE public.game_sessions
SET total_points = COALESCE(NULLIF(total_points, 0), score, 0),
    time_taken_seconds = COALESCE(NULLIF(time_taken_seconds, 0), time_taken_ms / 1000, 0)
WHERE (total_points IS NULL OR total_points = 0) AND (score IS NOT NULL AND score > 0);
UPDATE public.game_sessions
SET score = total_points
WHERE (score IS NULL OR score = 0) AND total_points > 0;
UPDATE public.game_sessions
SET finished_at = COALESCE(finished_at, completed_at)
WHERE finished_at IS NULL AND completed_at IS NOT NULL;
UPDATE public.game_sessions
SET completed_at = COALESCE(completed_at, finished_at)
WHERE completed_at IS NULL AND finished_at IS NOT NULL;

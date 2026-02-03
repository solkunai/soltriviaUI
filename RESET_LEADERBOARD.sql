-- RESET LEADERBOARD TO ZERO
-- Run this to clear all game data and start fresh
-- WARNING: This will delete ALL game history!

-- 1. Delete all answers
DELETE FROM public.answers;

-- 2. Delete all game sessions
DELETE FROM public.game_sessions;

-- 3. Delete all payouts
DELETE FROM public.payouts;

-- 4. Reset daily rounds
DELETE FROM public.daily_rounds;

-- 5. Reset player profiles stats
UPDATE public.player_profiles
SET 
  total_games_played = 0,
  total_wins = 0,
  total_points = 0,
  highest_score = 0,
  current_streak = 0,
  best_streak = 0;

-- 6. Verify everything is reset
SELECT 
  (SELECT COUNT(*) FROM answers) as total_answers,
  (SELECT COUNT(*) FROM game_sessions) as total_sessions,
  (SELECT COUNT(*) FROM payouts) as total_payouts,
  (SELECT COUNT(*) FROM daily_rounds) as total_rounds,
  (SELECT SUM(total_games_played) FROM player_profiles) as total_games_across_players;

-- All should be 0

-- Note: Leaderboard will auto-populate in real-time as players complete games
-- The get-leaderboard Edge Function queries game_sessions in real-time

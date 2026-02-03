-- SIMPLE SCHEMA CHECK - Works with any database
-- Run this to see your actual schema

-- 1. What columns exist in game_sessions?
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'game_sessions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. How many sessions exist?
SELECT COUNT(*) as total_sessions FROM game_sessions;

-- 3. Show all data from most recent session (safe - no column assumptions)
SELECT * FROM game_sessions ORDER BY started_at DESC LIMIT 1;

-- 4. Check if question_correct_answers table has data
SELECT COUNT(*) as total_correct_answers FROM question_correct_answers;

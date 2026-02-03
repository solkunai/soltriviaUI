-- DEBUG: Why can't submit-answer find the session?
-- Run this to diagnose the issue

-- 1. Check if ANY sessions exist
SELECT COUNT(*) as total_sessions FROM game_sessions;

-- 2. Show recent sessions (last 10)
SELECT 
    id,
    wallet_address,
    round_id,
    current_question_index,
    finished_at,
    started_at
FROM game_sessions
ORDER BY started_at DESC
LIMIT 10;

-- 3. Check what columns exist in game_sessions
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'game_sessions' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Show which columns submit-answer is trying to query
-- These columns MUST exist or the query fails:
-- id, current_question_index, current_question_token, current_question_issued_at
-- score OR total_points, correct_count OR correct_answers
-- finished_at, wallet_address, question_order

-- 5. Check for schema mismatch
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_sessions' AND column_name = 'score')
        THEN 'Has score column'
        ELSE 'Missing score column'
    END as score_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_sessions' AND column_name = 'total_points')
        THEN 'Has total_points column'
        ELSE 'Missing total_points column'
    END as total_points_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_sessions' AND column_name = 'correct_count')
        THEN 'Has correct_count column'
        ELSE 'Missing correct_count column'
    END as correct_count_check,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'game_sessions' AND column_name = 'correct_answers')
        THEN 'Has correct_answers column'
        ELSE 'Missing correct_answers column'
    END as correct_answers_check;

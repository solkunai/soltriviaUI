-- QUICK TEST - Run this to verify everything is ready
-- Should take 2 seconds

-- 1. Migration complete?
SELECT 
    (SELECT COUNT(*) FROM questions) as questions,
    (SELECT COUNT(*) FROM question_correct_answers) as answers,
    CASE 
        WHEN (SELECT COUNT(*) FROM questions) = (SELECT COUNT(*) FROM question_correct_answers)
        THEN '✅ Migration complete'
        ELSE '❌ Run FIX_ALL_NOW.sql'
    END as migration_status;

-- 2. Sample correct answer (verify letter format)
SELECT 
    LEFT(q.text, 50) as question,
    q.correct_index,
    qca.correct_answer as letter,
    CASE 
        WHEN (q.correct_index = 0 AND qca.correct_answer = 'A') OR
             (q.correct_index = 1 AND qca.correct_answer = 'B') OR
             (q.correct_index = 2 AND qca.correct_answer = 'C') OR
             (q.correct_index = 3 AND qca.correct_answer = 'D')
        THEN '✅'
        ELSE '❌'
    END as valid
FROM questions q
JOIN question_correct_answers qca ON q.id = qca.question_id
LIMIT 3;

-- 3. Check if game_sessions table exists and has correct columns
SELECT 
    CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'game_sessions' 
        AND column_name IN ('total_points', 'correct_answers')
    ) THEN '✅ Schema OK'
    ELSE '⚠️ Different schema (will work with SELECT *)'
    END as schema_status;

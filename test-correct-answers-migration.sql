-- VERIFY MIGRATION WORKED
-- Run after SIMPLE_MIGRATION.sql

-- Check 1: How many answers migrated?
SELECT COUNT(*) as total_answers FROM public.question_correct_answers;

-- Check 2: Any questions missing answers?
SELECT COUNT(*) as missing_answers
FROM public.questions q
LEFT JOIN public.question_correct_answers qca ON q.id = qca.question_id
WHERE qca.question_id IS NULL;
-- Should be 0

-- Check 3: Verify mapping is correct (sample)
SELECT 
    LEFT(q.text, 50) as question,
    q.correct_index,
    qca.correct_answer,
    CASE 
        WHEN (q.correct_index = 0 AND qca.correct_answer = 'A') OR
             (q.correct_index = 1 AND qca.correct_answer = 'B') OR
             (q.correct_index = 2 AND qca.correct_answer = 'C') OR
             (q.correct_index = 3 AND qca.correct_answer = 'D')
        THEN '✓'
        ELSE '✗ BAD'
    END as status
FROM public.questions q
JOIN public.question_correct_answers qca ON q.id = qca.question_id
LIMIT 10;
-- All should show ✓

-- Check 4: Answer distribution
SELECT 
    correct_answer,
    COUNT(*) as count
FROM public.question_correct_answers
GROUP BY correct_answer
ORDER BY correct_answer;

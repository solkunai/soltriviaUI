-- Run this BEFORE applying the migration to see what will be migrated

-- Check 1: How many questions exist
SELECT COUNT(*) as total_questions FROM public.questions;

-- Check 2: Current correct_index distribution
SELECT 
    correct_index,
    CASE correct_index
        WHEN 0 THEN 'A'
        WHEN 1 THEN 'B'
        WHEN 2 THEN 'C'
        WHEN 3 THEN 'D'
        ELSE 'Invalid'
    END as will_become,
    COUNT(*) as count
FROM public.questions
GROUP BY correct_index
ORDER BY correct_index;

-- Check 3: Sample questions that will be migrated
SELECT 
    text,
    correct_index,
    CASE correct_index
        WHEN 0 THEN 'A'
        WHEN 1 THEN 'B'
        WHEN 2 THEN 'C'
        WHEN 3 THEN 'D'
    END as will_become_letter
FROM public.questions
LIMIT 10;

-- Check 4: Verify no table exists yet
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'question_correct_answers'
) as already_migrated;
-- Should be FALSE if not migrated yet

-- FIX INCOMPLETE MIGRATION
-- Run this in Supabase SQL Editor

-- 1. Check current state
SELECT 
    (SELECT COUNT(*) FROM questions) as total_questions,
    (SELECT COUNT(*) FROM question_correct_answers) as total_correct_answers;

-- 2. Find questions missing correct answers
SELECT COUNT(*) as missing_answers
FROM questions q
LEFT JOIN question_correct_answers qca ON q.id = qca.question_id
WHERE qca.question_id IS NULL;

-- 3. Re-populate ALL correct answers (ON CONFLICT DO NOTHING means safe to re-run)
INSERT INTO public.question_correct_answers (question_id, correct_answer)
SELECT 
    id as question_id,
    CASE correct_index
        WHEN 0 THEN 'A'
        WHEN 1 THEN 'B'
        WHEN 2 THEN 'C'
        WHEN 3 THEN 'D'
        ELSE 'A'
    END as correct_answer
FROM public.questions
ON CONFLICT (question_id) DO NOTHING;

-- 4. Verify all questions now have answers
SELECT 
    (SELECT COUNT(*) FROM questions) as total_questions,
    (SELECT COUNT(*) FROM question_correct_answers) as total_correct_answers,
    (SELECT COUNT(*) FROM questions q 
     LEFT JOIN question_correct_answers qca ON q.id = qca.question_id 
     WHERE qca.question_id IS NULL) as still_missing;

-- 5. Show sample of migrated data
SELECT 
    q.id,
    LEFT(q.text, 50) as question,
    q.correct_index,
    qca.correct_answer,
    CASE 
        WHEN (q.correct_index = 0 AND qca.correct_answer = 'A') OR
             (q.correct_index = 1 AND qca.correct_answer = 'B') OR
             (q.correct_index = 2 AND qca.correct_answer = 'C') OR
             (q.correct_index = 3 AND qca.correct_answer = 'D')
        THEN '✓'
        ELSE '✗ MISMATCH'
    END as status
FROM questions q
JOIN question_correct_answers qca ON q.id = qca.question_id
LIMIT 10;

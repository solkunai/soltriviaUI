-- DIAGNOSE WHY ONLY 10 CORRECT ANSWERS
-- Run this to find the issue

-- 1. How many questions total?
SELECT COUNT(*) as total_questions FROM questions;

-- 2. How many have valid correct_index (0-3)?
SELECT 
    COUNT(*) as valid_correct_index
FROM questions
WHERE correct_index IN (0, 1, 2, 3);

-- 3. How many have NULL correct_index?
SELECT 
    COUNT(*) as null_correct_index
FROM questions
WHERE correct_index IS NULL;

-- 4. How many have invalid correct_index (not 0-3)?
SELECT 
    COUNT(*) as invalid_correct_index
FROM questions
WHERE correct_index NOT IN (0, 1, 2, 3);

-- 5. Show questions that DON'T have correct answers yet
SELECT 
    q.id,
    LEFT(q.text, 60) as question_text,
    q.correct_index,
    q.active,
    q.created_at
FROM questions q
LEFT JOIN question_correct_answers qca ON q.id = qca.question_id
WHERE qca.question_id IS NULL
LIMIT 20;

-- 6. What values does correct_index actually have?
SELECT 
    correct_index,
    COUNT(*) as count
FROM questions
GROUP BY correct_index
ORDER BY correct_index;

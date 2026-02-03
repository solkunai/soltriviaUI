-- DIAGNOSTIC: Check if migration is needed
-- Run this in Supabase SQL Editor to see current state

-- 1. Does question_correct_answers table exist?
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'question_correct_answers'
) as table_exists;

-- 2. How many questions exist?
SELECT COUNT(*) as total_questions FROM public.questions;

-- 3. How many correct answers exist?
SELECT COUNT(*) as total_correct_answers 
FROM information_schema.tables 
WHERE table_name = 'question_correct_answers'
AND EXISTS (
  SELECT FROM public.question_correct_answers
);

-- If table_exists = false, you need to run SIMPLE_MIGRATION.sql!

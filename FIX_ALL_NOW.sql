-- ONE-CLICK FIX FOR CORRECT ANSWERS
-- Copy/paste this entire thing into Supabase SQL Editor and click RUN

-- 1. Clean slate - drop and recreate table
DROP TABLE IF EXISTS public.question_correct_answers CASCADE;

CREATE TABLE public.question_correct_answers (
    question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Migrate ALL questions (handles NULL and invalid values)
INSERT INTO public.question_correct_answers (question_id, correct_answer)
SELECT 
    id as question_id,
    CASE 
        WHEN correct_index = 0 THEN 'A'
        WHEN correct_index = 1 THEN 'B'
        WHEN correct_index = 2 THEN 'C'
        WHEN correct_index = 3 THEN 'D'
        ELSE 'A'  -- Default to A for NULL or invalid values
    END as correct_answer
FROM public.questions;

-- 3. Enable RLS and policies
ALTER TABLE public.question_correct_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can read correct answers" ON public.question_correct_answers;
DROP POLICY IF EXISTS "Anon can read correct answers" ON public.question_correct_answers;
DROP POLICY IF EXISTS "Admin can manage correct answers" ON public.question_correct_answers;

CREATE POLICY "Service role can read correct answers"
ON public.question_correct_answers FOR SELECT
TO service_role USING (true);

CREATE POLICY "Anon can read correct answers"
ON public.question_correct_answers FOR SELECT
TO anon USING (true);

CREATE POLICY "Admin can manage correct answers"
ON public.question_correct_answers FOR ALL
TO authenticated USING (true) WITH CHECK (true);

-- 4. Create index
CREATE INDEX IF NOT EXISTS idx_question_correct_answers_question_id 
ON public.question_correct_answers(question_id);

-- 5. VERIFY IT WORKED
SELECT 
    (SELECT COUNT(*) FROM questions) as total_questions,
    (SELECT COUNT(*) FROM question_correct_answers) as total_migrated,
    CASE 
        WHEN (SELECT COUNT(*) FROM questions) = (SELECT COUNT(*) FROM question_correct_answers)
        THEN '✅ SUCCESS - All questions migrated!'
        ELSE '❌ ISSUE - Counts do not match'
    END as status;

-- 6. Show answer distribution
SELECT 
    correct_answer,
    COUNT(*) as count
FROM question_correct_answers
GROUP BY correct_answer
ORDER BY correct_answer;

-- SIMPLE CORRECT ANSWERS MIGRATION (NO TRIGGERS)
-- Run this in Supabase SQL Editor

-- 1. Create table for correct answers
CREATE TABLE IF NOT EXISTS public.question_correct_answers (
    question_id UUID PRIMARY KEY REFERENCES public.questions(id) ON DELETE CASCADE,
    correct_answer TEXT NOT NULL CHECK (correct_answer IN ('A', 'B', 'C', 'D')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Migrate existing data
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

-- 3. Enable RLS
ALTER TABLE public.question_correct_answers ENABLE ROW LEVEL SECURITY;

-- 4. Create policies
CREATE POLICY "Service role can read correct answers"
ON public.question_correct_answers FOR SELECT
TO service_role USING (true);

CREATE POLICY "Anon can read correct answers"
ON public.question_correct_answers FOR SELECT
TO anon USING (true);

CREATE POLICY "Admin can manage correct answers"
ON public.question_correct_answers FOR ALL
TO authenticated USING (true) WITH CHECK (true);

-- 5. Create index
CREATE INDEX IF NOT EXISTS idx_question_correct_answers_question_id 
ON public.question_correct_answers(question_id);

-- Done! No triggers = no infinite loops

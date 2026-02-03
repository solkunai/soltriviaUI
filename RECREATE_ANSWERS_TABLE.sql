-- NUCLEAR OPTION: Recreate answers table from scratch
-- This will delete all existing answers and create a clean table
-- Run this if FIX_ANSWERS_TABLE.sql didn't work

-- 1. Drop the broken table
DROP TABLE IF EXISTS public.answers CASCADE;

-- 2. Create fresh table with ALL required columns
CREATE TABLE public.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
    question_id UUID REFERENCES public.questions(id),
    question_index INTEGER NOT NULL,
    selected_index INTEGER,
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    time_taken_ms INTEGER,
    token TEXT,
    issued_at TIMESTAMP WITH TIME ZONE,
    answered_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Create index
CREATE INDEX idx_answers_session ON public.answers(session_id);

-- 4. Enable RLS
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- 5. Create policies
CREATE POLICY "Service role can manage answers"
ON public.answers FOR ALL
TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Anon can insert answers"
ON public.answers FOR INSERT
TO anon WITH CHECK (true);

CREATE POLICY "Authenticated can view own answers"
ON public.answers FOR SELECT
TO authenticated USING (true);

-- 6. Verify
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'answers'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Should show:
-- id, session_id, question_id, question_index, selected_index, 
-- is_correct, points_earned, time_taken_ms, token, issued_at, answered_at

-- FIX ANSWERS TABLE - ONE CLICK FIX
-- Run this to fix the is_correct column issue

-- Option 1: If table doesn't exist, create it
CREATE TABLE IF NOT EXISTS public.answers (
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

-- Option 2: If table exists but is_correct column is missing, add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'answers' 
        AND column_name = 'is_correct'
    ) THEN
        ALTER TABLE public.answers ADD COLUMN is_correct BOOLEAN;
    END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_answers_session ON public.answers(session_id);

-- Enable RLS
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;

-- Create policies (drop first if they exist)
DROP POLICY IF EXISTS "Service role can manage answers" ON public.answers;
DROP POLICY IF EXISTS "Users can view own answers" ON public.answers;

CREATE POLICY "Service role can manage answers"
ON public.answers FOR ALL
TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own answers"
ON public.answers FOR SELECT
TO authenticated
USING (true);

-- Verify it worked
SELECT 
    'answers' as table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'answers') as total_columns,
    (SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'answers' AND column_name = 'is_correct')) as has_is_correct,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'answers' AND column_name = 'is_correct')
        THEN '✅ FIXED - is_correct column exists'
        ELSE '❌ STILL BROKEN - run again'
    END as status;

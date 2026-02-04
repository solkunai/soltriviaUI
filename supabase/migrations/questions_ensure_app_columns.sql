-- Ensure questions table has columns the app and admin expect (text, options, is_active, difficulty as smallint).
-- If your table uses question/answers/active, this adds text/options/is_active and backfills so both work.

-- Add columns if missing (no-op if they already exist)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS options JSONB;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Backfill from legacy column names only if those columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'question') THEN
    UPDATE public.questions SET text = question WHERE text IS NULL AND question IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'answers') THEN
    UPDATE public.questions SET options = answers WHERE options IS NULL AND answers IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'active') THEN
    UPDATE public.questions SET is_active = COALESCE(active, true) WHERE is_active IS NULL;
  END IF;
END $$;

-- If difficulty is TEXT and we need smallint for some clients: add a numeric column and backfill (optional)
-- Many setups use difficulty as SMALLINT (0,1,2). If your column is TEXT, leave it; if missing, add smallint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'difficulty'
  ) THEN
    ALTER TABLE public.questions ADD COLUMN difficulty SMALLINT DEFAULT 1;
  END IF;
END $$;

-- Index for common filters
CREATE INDEX IF NOT EXISTS idx_questions_is_active ON public.questions(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_text ON public.questions(text);

COMMENT ON TABLE public.questions IS 'Trivia questions. Use text, options, correct_index, difficulty (0=easy,1=medium,2=hard), is_active for app/admin.';

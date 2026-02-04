-- question_correct_answers: add updated_at if missing (trigger or Supabase may expect it)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'question_correct_answers') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'question_correct_answers' AND column_name = 'updated_at'
    ) THEN
      ALTER TABLE public.question_correct_answers
        ADD COLUMN updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL;
    END IF;
  END IF;
END $$;

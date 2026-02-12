-- Create practice_questions table for free practice mode
-- No prizes, no validation, unlimited plays

CREATE TABLE IF NOT EXISTS practice_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  text TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of 4 options [A, B, C, D]
  correct_index INTEGER NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster random selection
CREATE INDEX IF NOT EXISTS idx_practice_questions_category ON practice_questions(category);
CREATE INDEX IF NOT EXISTS idx_practice_questions_difficulty ON practice_questions(difficulty);

-- Add comment
COMMENT ON TABLE practice_questions IS 'Practice questions for free play mode - separate from paid game questions';

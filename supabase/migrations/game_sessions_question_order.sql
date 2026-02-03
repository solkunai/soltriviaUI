-- Per-session question order so each player gets a randomized order
-- When set, fetch-next-question and submit-answer use this instead of round.question_ids
ALTER TABLE game_sessions
ADD COLUMN IF NOT EXISTS question_order JSONB;

COMMENT ON COLUMN game_sessions.question_order IS 'Shuffled question IDs for this session; when null, round.question_ids is used (legacy).';

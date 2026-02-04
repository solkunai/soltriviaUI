-- Track when the round's question pool was last refreshed (for 2-minute rotation)
ALTER TABLE public.daily_rounds
ADD COLUMN IF NOT EXISTS question_ids_updated_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN public.daily_rounds.question_ids_updated_at IS 'When question_ids was last refreshed; round pool is re-randomized every 2 minutes.';

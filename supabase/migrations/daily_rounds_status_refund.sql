-- Add status to daily_rounds so we can mark rounds as 'refund' when < 5 players finish.
-- start-game already expects status (active); we use 'refund' for failed rounds.
ALTER TABLE public.daily_rounds
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Backfill existing rows that might have NULL
UPDATE public.daily_rounds SET status = 'active' WHERE status IS NULL;

ALTER TABLE public.daily_rounds
  ALTER COLUMN status SET DEFAULT 'active';

COMMENT ON COLUMN public.daily_rounds.status IS 'active = in progress; refund = <5 players, entries refunded.';

-- Add created_at to game_sessions so clients/edge functions that filter by it don't 400.
-- game_sessions has started_at; created_at is an alias for the same semantics.
ALTER TABLE public.game_sessions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- Backfill from started_at
UPDATE public.game_sessions
  SET created_at = COALESCE(started_at, timezone('utc'::text, now()))
  WHERE created_at IS NULL;

-- Default for new rows
ALTER TABLE public.game_sessions
  ALTER COLUMN created_at SET DEFAULT timezone('utc'::text, now());

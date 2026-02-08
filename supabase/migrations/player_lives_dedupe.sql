-- Merge duplicate player_lives rows (same wallet_address): keep one row per wallet with best lives_count.
-- Run if get-lives returned a stale value because multiple rows existed for the same wallet.

-- Keep one row per wallet (highest lives_count, then latest updated_at); remove duplicates.
DELETE FROM public.player_lives
WHERE ctid NOT IN (
  SELECT (array_agg(ctid ORDER BY lives_count DESC NULLS LAST, updated_at DESC NULLS LAST))[1]
  FROM public.player_lives
  GROUP BY wallet_address
);

-- Ensure unique on wallet_address (idempotent)
DO $$
BEGIN
  ALTER TABLE public.player_lives ADD CONSTRAINT player_lives_wallet_address_key UNIQUE (wallet_address);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

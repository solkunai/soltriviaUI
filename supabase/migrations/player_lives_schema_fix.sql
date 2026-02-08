-- Ensure player_lives has correct schema for lives deduction (start-game) and purchase credit (purchase-lives).
-- Use wallet_address as primary key; lives_count = current balance; total_purchased/total_used for stats.

-- 1. Create player_lives if missing (canonical schema)
CREATE TABLE IF NOT EXISTS public.player_lives (
    wallet_address TEXT PRIMARY KEY,
    lives_count INTEGER NOT NULL DEFAULT 0,
    total_purchased INTEGER NOT NULL DEFAULT 0,
    total_used INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add total_purchased if table existed from an older migration that didn't have it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_lives' AND column_name = 'total_purchased'
  ) THEN
    ALTER TABLE public.player_lives ADD COLUMN total_purchased INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 3. If table had id as PK (e.g. SETUP_LIVES_SYSTEM), ensure wallet_address is unique for upsert.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'player_lives' AND column_name = 'id'
  ) THEN
    BEGIN
      ALTER TABLE public.player_lives ADD CONSTRAINT player_lives_wallet_address_key UNIQUE (wallet_address);
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- constraint already exists
    END;
  END IF;
END $$;

-- 4. Ensure lives_purchases exists for purchase-lives recording
CREATE TABLE IF NOT EXISTS public.lives_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    tx_signature TEXT NOT NULL,
    lives_purchased INTEGER NOT NULL,
    amount_lamports BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_lives_purchases_tx ON public.lives_purchases(tx_signature);
CREATE INDEX IF NOT EXISTS idx_lives_purchases_wallet ON public.lives_purchases(wallet_address);

-- 5. RLS: service role must be able to do everything (edge functions use service role)
ALTER TABLE public.player_lives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage lives" ON public.player_lives;
CREATE POLICY "Service role can manage lives"
  ON public.player_lives FOR ALL
  TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their own lives" ON public.player_lives;
CREATE POLICY "Users can view their own lives"
  ON public.player_lives FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Anyone can insert lives" ON public.player_lives;
CREATE POLICY "Anyone can insert lives"
  ON public.player_lives FOR INSERT TO public WITH CHECK (true);

ALTER TABLE public.lives_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role can manage purchases" ON public.lives_purchases;
CREATE POLICY "Service role can manage purchases"
  ON public.lives_purchases FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.lives_purchases;
CREATE POLICY "Users can view their own purchases"
  ON public.lives_purchases FOR SELECT TO public USING (true);

COMMENT ON TABLE public.player_lives IS 'Current lives balance (lives_count) and stats. Deduct on paid entry in start-game; add on purchase in purchase-lives.';

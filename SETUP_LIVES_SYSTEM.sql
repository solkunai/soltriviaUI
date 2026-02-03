-- SETUP LIVES SYSTEM
-- Creates player_lives table and gives initial lives to players

-- 1. Create player_lives table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.player_lives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL,
    lives_count INTEGER DEFAULT 3,
    total_used INTEGER DEFAULT 0,
    last_purchase_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_lives_wallet ON public.player_lives(wallet_address);

-- 3. Enable RLS
ALTER TABLE public.player_lives ENABLE ROW LEVEL SECURITY;

-- 4. Create policies
DROP POLICY IF EXISTS "Service role can manage lives" ON public.player_lives;
DROP POLICY IF EXISTS "Players can view own lives" ON public.player_lives;

CREATE POLICY "Service role can manage lives"
ON public.player_lives FOR ALL
TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Players can view own lives"
ON public.player_lives FOR SELECT
TO anon USING (true);

-- 5. Create function to auto-create player lives record on first game
CREATE OR REPLACE FUNCTION public.ensure_player_lives(p_wallet_address TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.player_lives (wallet_address, lives_count, total_used)
  VALUES (p_wallet_address, 3, 0)
  ON CONFLICT (wallet_address) DO NOTHING;
END;
$$;

-- 6. Give 3 free lives to ALL existing players who have played
-- (This is a one-time migration for existing players)
INSERT INTO public.player_lives (wallet_address, lives_count, total_used)
SELECT DISTINCT 
    wallet_address,
    3 as lives_count,
    0 as total_used
FROM game_sessions
WHERE wallet_address NOT IN (SELECT wallet_address FROM player_lives)
ON CONFLICT (wallet_address) DO NOTHING;

-- 7. Verify setup
SELECT 
    'player_lives' as table_name,
    (SELECT COUNT(*) FROM player_lives) as total_records,
    (SELECT COUNT(*) FROM player_lives WHERE lives_count > 0) as players_with_lives,
    (SELECT SUM(lives_count) FROM player_lives) as total_lives_remaining,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_lives')
        THEN '✅ Lives system ready'
        ELSE '❌ Table missing'
    END as status;

-- 8. Show your lives (replace with your wallet)
SELECT *
FROM player_lives
WHERE wallet_address = '8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV';

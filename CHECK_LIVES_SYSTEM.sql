-- CHECK LIVES SYSTEM DIAGNOSTIC
-- Run this to see why lives aren't being deducted

-- 1. Does player_lives table exist?
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'player_lives'
) as table_exists;

-- 2. What columns exist in player_lives?
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'player_lives'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. How many players have lives records?
SELECT COUNT(*) as total_players_with_lives FROM player_lives;

-- 4. Show sample lives data (using * to show all columns)
SELECT *
FROM player_lives
ORDER BY created_at DESC
LIMIT 5;

-- 5. Check if YOUR wallet has lives
-- Replace with your actual wallet address
SELECT 
    *,
    CASE 
        WHEN lives_count > 0 THEN '✅ Has lives'
        ELSE '❌ No lives'
    END as status
FROM player_lives
WHERE wallet_address = '8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV'
LIMIT 1;

-- 6. Check game_sessions to see if life_used flag is set
SELECT 
    wallet_address,
    life_used,
    entry_tx_signature,
    started_at,
    finished_at
FROM game_sessions
WHERE wallet_address = '8fvPxVrPp1p3QGwjiFQVYg5xpBTVrWrarrUxQryftUZV'
ORDER BY started_at DESC
LIMIT 5;

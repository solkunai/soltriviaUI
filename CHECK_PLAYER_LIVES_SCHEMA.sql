-- CHECK PLAYER_LIVES TABLE SCHEMA
-- Run this first to see what columns exist

-- 1. Does table exist?
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'player_lives'
) as table_exists;

-- 2. What columns exist?
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'player_lives'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. How many records?
SELECT COUNT(*) as total_records FROM player_lives;

-- 4. Show sample data (first 3 records)
SELECT * FROM player_lives LIMIT 3;

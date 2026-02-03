-- CHECK ACTUAL ANSWERS TABLE SCHEMA
-- Run this to see what columns actually exist

-- 1. Does answers table exist?
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'answers'
) as table_exists;

-- 2. What columns exist in answers table?
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'answers'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check if is_correct column exists specifically
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'answers' 
  AND column_name = 'is_correct'
) as has_is_correct;

-- 4. Check for alternative column names (in case it's named differently)
SELECT column_name 
FROM information_schema.columns
WHERE table_name = 'answers'
AND column_name LIKE '%correct%';

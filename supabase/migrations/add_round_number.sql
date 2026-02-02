-- Migration: Add round_number to daily_rounds to support 4 rounds per day
-- Run this in your Supabase SQL Editor

-- Step 1: Add round_number column (default to 0 for existing rows)
ALTER TABLE daily_rounds 
ADD COLUMN IF NOT EXISTS round_number INTEGER DEFAULT 0 CHECK (round_number >= 0 AND round_number <= 3);

-- Step 2: Remove the old unique constraint on date
ALTER TABLE daily_rounds 
DROP CONSTRAINT IF EXISTS daily_rounds_date_key;

-- Step 3: Add new unique constraint on (date, round_number) to allow 4 rounds per day
ALTER TABLE daily_rounds 
ADD CONSTRAINT daily_rounds_date_round_unique UNIQUE (date, round_number);

-- Step 4: Update comment to reflect 4 rounds per day
COMMENT ON TABLE daily_rounds IS 'Rounds table - 4 rounds per day (every 6 hours: 00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-00:00 UTC)';

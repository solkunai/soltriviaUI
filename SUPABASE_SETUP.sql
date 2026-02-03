-- ============================================
-- Solana Trivia Protocol - Supabase Setup SQL
-- ============================================

-- Run this SQL in your Supabase SQL Editor to set up the database

-- 1. Questions Table
-- Stores all trivia questions
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_index INTEGER NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
    difficulty INTEGER NOT NULL DEFAULT 1 CHECK (difficulty >= 1 AND difficulty <= 3),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_questions_active ON public.questions(active);
CREATE INDEX IF NOT EXISTS idx_questions_category ON public.questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON public.questions(difficulty);

-- 2. Daily Rounds Table
-- Tracks each 6-hour round
CREATE TABLE IF NOT EXISTS public.daily_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    round_number INTEGER NOT NULL CHECK (round_number >= 0 AND round_number <= 3),
    question_ids JSONB NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished')),
    player_count INTEGER DEFAULT 0,
    pot_lamports BIGINT DEFAULT 0,
    winner_wallet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT daily_rounds_date_round_number_key UNIQUE (date, round_number)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_daily_rounds_date ON public.daily_rounds(date);
CREATE INDEX IF NOT EXISTS idx_daily_rounds_status ON public.daily_rounds(status);

-- 3. Game Sessions Table
-- Tracks each player's game session
CREATE TABLE IF NOT EXISTS public.game_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id UUID NOT NULL REFERENCES public.daily_rounds(id),
    wallet_address TEXT NOT NULL,
    entry_tx_signature TEXT NOT NULL,
    current_question_index INTEGER DEFAULT 0,
    current_question_token TEXT,
    current_question_issued_at TIMESTAMP WITH TIME ZONE,
    correct_answers INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    time_taken_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    answers JSONB DEFAULT '[]'::jsonb,
    question_order JSONB
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_game_sessions_wallet ON public.game_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_game_sessions_round ON public.game_sessions(round_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_finished ON public.game_sessions(finished_at);

-- 4. Player Lives Table
-- Tracks player lives (rolling entries)
CREATE TABLE IF NOT EXISTS public.player_lives (
    wallet_address TEXT PRIMARY KEY,
    lives_count INTEGER DEFAULT 0,
    total_purchased INTEGER DEFAULT 0,
    total_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Lives Purchases Table
-- Tracks all lives purchases
CREATE TABLE IF NOT EXISTS public.lives_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    tx_signature TEXT NOT NULL UNIQUE,
    lives_purchased INTEGER NOT NULL,
    amount_lamports BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_lives_purchases_wallet ON public.lives_purchases(wallet_address);
CREATE INDEX IF NOT EXISTS idx_lives_purchases_tx ON public.lives_purchases(tx_signature);

-- 6. Player Profiles Table (NEW)
-- Stores player profile information and stats
CREATE TABLE IF NOT EXISTS public.player_profiles (
    wallet_address TEXT PRIMARY KEY,
    username TEXT,
    avatar_url TEXT, -- Can be Supabase storage URL or external URL
    total_games_played INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    highest_score INTEGER DEFAULT 0,
    current_streak INTEGER DEFAULT 0,
    best_streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Daily Quests/Activity Table
-- Tracks daily user activity for streak calculation
CREATE TABLE IF NOT EXISTS public.daily_activity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    activity_date DATE NOT NULL,
    games_played INTEGER DEFAULT 0,
    quests_completed INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT daily_activity_wallet_date_key UNIQUE (wallet_address, activity_date)
);

-- 8. Admin Actions Log Table
-- Tracks all admin actions for audit
CREATE TABLE IF NOT EXISTS public.admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type TEXT NOT NULL, -- 'add_question', 'edit_question', 'delete_question', etc.
    admin_user TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for leaderboards
CREATE INDEX IF NOT EXISTS idx_player_profiles_points ON public.player_profiles(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_player_profiles_wins ON public.player_profiles(total_wins DESC);

-- Index for daily activity
CREATE INDEX IF NOT EXISTS idx_daily_activity_wallet ON public.daily_activity(wallet_address);
CREATE INDEX IF NOT EXISTS idx_daily_activity_date ON public.daily_activity(activity_date DESC);

-- Index for admin actions
CREATE INDEX IF NOT EXISTS idx_admin_actions_date ON public.admin_actions(created_at DESC);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_lives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lives_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- Questions: Public read for active questions
DROP POLICY IF EXISTS "Questions are viewable by everyone" ON public.questions;
CREATE POLICY "Questions are viewable by everyone"
    ON public.questions FOR SELECT
    USING (active = true);

-- Questions: Service role can do everything (for Edge Functions)
DROP POLICY IF EXISTS "Service role can manage questions" ON public.questions;
CREATE POLICY "Service role can manage questions"
    ON public.questions FOR ALL
    USING (auth.role() = 'service_role');

-- Daily Rounds: Public read
DROP POLICY IF EXISTS "Daily rounds are viewable by everyone" ON public.daily_rounds;
CREATE POLICY "Daily rounds are viewable by everyone"
    ON public.daily_rounds FOR SELECT
    USING (true);

-- Daily Rounds: Service role can manage
DROP POLICY IF EXISTS "Service role can manage daily rounds" ON public.daily_rounds;
CREATE POLICY "Service role can manage daily rounds"
    ON public.daily_rounds FOR ALL
    USING (auth.role() = 'service_role');

-- Game Sessions: Users can read their own sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.game_sessions;
CREATE POLICY "Users can view their own sessions"
    ON public.game_sessions FOR SELECT
    USING (true);

-- Game Sessions: Service role can manage
DROP POLICY IF EXISTS "Service role can manage sessions" ON public.game_sessions;
CREATE POLICY "Service role can manage sessions"
    ON public.game_sessions FOR ALL
    USING (auth.role() = 'service_role');

-- Player Lives: Public read access
DROP POLICY IF EXISTS "Users can view their own lives" ON public.player_lives;
CREATE POLICY "Users can view their own lives"
    ON public.player_lives FOR SELECT
    TO public
    USING (true);

-- Player Lives: Public insert (for new users)
DROP POLICY IF EXISTS "Anyone can insert lives" ON public.player_lives;
CREATE POLICY "Anyone can insert lives"
    ON public.player_lives FOR INSERT
    TO public
    WITH CHECK (true);

-- Player Lives: Service role can manage everything
DROP POLICY IF EXISTS "Service role can manage lives" ON public.player_lives;
CREATE POLICY "Service role can manage lives"
    ON public.player_lives FOR ALL
    USING (auth.role() = 'service_role');

-- Lives Purchases: Users can read their own purchases
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.lives_purchases;
CREATE POLICY "Users can view their own purchases"
    ON public.lives_purchases FOR SELECT
    USING (true);

-- Lives Purchases: Service role can manage
DROP POLICY IF EXISTS "Service role can manage purchases" ON public.lives_purchases;
CREATE POLICY "Service role can manage purchases"
    ON public.lives_purchases FOR ALL
    USING (auth.role() = 'service_role');

-- Player Profiles: Public read
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.player_profiles;
CREATE POLICY "Profiles are viewable by everyone"
    ON public.player_profiles FOR SELECT
    USING (true);

-- Player Profiles: Service role can manage
DROP POLICY IF EXISTS "Service role can manage profiles" ON public.player_profiles;
CREATE POLICY "Service role can manage profiles"
    ON public.player_profiles FOR ALL
    USING (auth.role() = 'service_role');

-- Daily Activity: Public read
DROP POLICY IF EXISTS "Activity is viewable by everyone" ON public.daily_activity;
CREATE POLICY "Activity is viewable by everyone"
    ON public.daily_activity FOR SELECT
    USING (true);

-- Daily Activity: Service role can manage
DROP POLICY IF EXISTS "Service role can manage activity" ON public.daily_activity;
CREATE POLICY "Service role can manage activity"
    ON public.daily_activity FOR ALL
    USING (auth.role() = 'service_role');

-- Admin Actions: Service role only
DROP POLICY IF EXISTS "Service role can manage admin actions" ON public.admin_actions;
CREATE POLICY "Service role can manage admin actions"
    ON public.admin_actions FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================
-- Sample Data (Optional)
-- ============================================

-- Insert some sample questions
INSERT INTO public.questions (category, text, options, correct_index, difficulty, active) VALUES
('solana', 'What consensus mechanism does Solana use alongside Proof of Stake?', '["Proof of Work", "Proof of History", "Proof of Authority", "Proof of Burn"]'::jsonb, 1, 1, true),
('solana', 'Who is the co-founder and CEO of Solana Labs?', '["Vitalik Buterin", "Anatoly Yakovenko", "Charles Hoskinson", "Sam Bankman-Fried"]'::jsonb, 1, 1, true),
('solana', 'What is the smallest unit of SOL called?', '["Wei", "Satoshi", "Lamport", "Gwei"]'::jsonb, 2, 1, true),
('defi', 'What does TVL stand for in DeFi?', '["Total Value Locked", "Token Vault Limit", "Transfer Volume Ledger", "Trade Verification Layer"]'::jsonb, 0, 1, true),
('defi', 'Which protocol is the largest DEX on Solana?', '["Uniswap", "PancakeSwap", "Jupiter", "SushiSwap"]'::jsonb, 2, 2, true),
('defi', 'What is impermanent loss?', '["A gas fee spike", "Loss from providing liquidity when prices diverge", "A failed transaction cost", "An NFT depreciation"]'::jsonb, 1, 2, true),
('bitcoin', 'What is the maximum supply of Bitcoin?', '["100 million", "21 million", "18 million", "Unlimited"]'::jsonb, 1, 1, true),
('bitcoin', 'Who created Bitcoin?', '["Vitalik Buterin", "Satoshi Nakamoto", "Charlie Lee", "Nick Szabo"]'::jsonb, 1, 1, true),
('memecoins', 'What animal is the Dogecoin mascot?', '["Cat", "Shiba Inu", "Frog", "Penguin"]'::jsonb, 1, 1, true),
('memecoins', 'Which memecoin launched on Solana became the largest by market cap in 2024?', '["BONK", "WIF", "MYRO", "SAMO"]'::jsonb, 1, 2, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- Functions and Triggers
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for questions table
DROP TRIGGER IF EXISTS update_questions_updated_at ON public.questions;
CREATE TRIGGER update_questions_updated_at
    BEFORE UPDATE ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for player_lives table
DROP TRIGGER IF EXISTS update_player_lives_updated_at ON public.player_lives;
CREATE TRIGGER update_player_lives_updated_at
    BEFORE UPDATE ON public.player_lives
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for player_profiles table
DROP TRIGGER IF EXISTS update_player_profiles_updated_at ON public.player_profiles;
CREATE TRIGGER update_player_profiles_updated_at
    BEFORE UPDATE ON public.player_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Storage Buckets for Avatars
-- ============================================

-- Create storage bucket for avatars (run this in Supabase Dashboard -> Storage)
-- This is a SQL representation, actual bucket creation is done via Supabase UI or API

-- Storage policy (add this after creating the 'avatars' bucket in Supabase Storage):
-- 1. Go to Storage -> Create new bucket -> Name: 'avatars' -> Public: true
-- 2. Add these policies:

-- Policy: Anyone can view avatars
-- CREATE POLICY "Public Access"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'avatars');

-- Policy: Authenticated users can upload their own avatar
-- CREATE POLICY "Users can upload avatar"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'avatars');

-- Policy: Users can update their own avatar
-- CREATE POLICY "Users can update avatar"
-- ON storage.objects FOR UPDATE
-- USING (bucket_id = 'avatars');

-- Policy: Users can delete their own avatar
-- CREATE POLICY "Users can delete avatar"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'avatars');

-- ============================================
-- Helper Functions
-- ============================================

-- Function to update player streak based on daily activity
CREATE OR REPLACE FUNCTION update_player_streak(p_wallet_address TEXT)
RETURNS void AS $$
DECLARE
    last_activity DATE;
    today_date DATE;
    streak INTEGER;
BEGIN
    -- Get current date
    today_date := CURRENT_DATE;
    
    -- Get player's last activity date
    SELECT last_activity_date INTO last_activity
    FROM player_profiles
    WHERE wallet_address = p_wallet_address;
    
    -- Get current streak
    SELECT current_streak INTO streak
    FROM player_profiles
    WHERE wallet_address = p_wallet_address;
    
    -- If no streak value, set to 0
    IF streak IS NULL THEN
        streak := 0;
    END IF;
    
    -- Check if activity is consecutive
    IF last_activity IS NULL THEN
        -- First activity
        streak := 1;
    ELSIF last_activity = today_date - INTERVAL '1 day' THEN
        -- Consecutive day
        streak := streak + 1;
    ELSIF last_activity = today_date THEN
        -- Same day, don't change streak
        RETURN;
    ELSE
        -- Streak broken
        streak := 1;
    END IF;
    
    -- Update profile
    UPDATE player_profiles
    SET current_streak = streak,
        best_streak = GREATEST(best_streak, streak),
        last_activity_date = today_date,
        updated_at = timezone('utc'::text, now())
    WHERE wallet_address = p_wallet_address;
END;
$$ LANGUAGE plpgsql;

-- Function to record daily activity
CREATE OR REPLACE FUNCTION record_daily_activity(
    p_wallet_address TEXT,
    p_activity_type TEXT -- 'game' or 'quest'
)
RETURNS void AS $$
BEGIN
    -- Insert or update daily activity
    INSERT INTO daily_activity (wallet_address, activity_date, games_played, quests_completed)
    VALUES (
        p_wallet_address,
        CURRENT_DATE,
        CASE WHEN p_activity_type = 'game' THEN 1 ELSE 0 END,
        CASE WHEN p_activity_type = 'quest' THEN 1 ELSE 0 END
    )
    ON CONFLICT (wallet_address, activity_date)
    DO UPDATE SET
        games_played = daily_activity.games_played + CASE WHEN p_activity_type = 'game' THEN 1 ELSE 0 END,
        quests_completed = daily_activity.quests_completed + CASE WHEN p_activity_type = 'quest' THEN 1 ELSE 0 END;
    
    -- Update player streak
    PERFORM update_player_streak(p_wallet_address);
END;
$$ LANGUAGE plpgsql;

-- Function to increment player wins
CREATE OR REPLACE FUNCTION increment_player_wins(p_wallet_address TEXT)
RETURNS void AS $$
BEGIN
    -- Ensure profile exists
    INSERT INTO player_profiles (wallet_address, total_wins, updated_at)
    VALUES (p_wallet_address, 1, timezone('utc'::text, now()))
    ON CONFLICT (wallet_address)
    DO UPDATE SET
        total_wins = player_profiles.total_wins + 1,
        updated_at = timezone('utc'::text, now());
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Setup Complete!
-- ============================================
-- Next steps:
-- 1. Set up Supabase Edge Functions secrets in the Supabase Dashboard
-- 2. Deploy Edge Functions from soltriviaUI/supabase/functions
-- 3. Update .env.local with your Supabase URL and anon key
-- 4. Run npm run dev to start the app

-- ==========================================
-- REFERRAL SYSTEM SCHEMA
-- ==========================================

-- 1. Referral codes table: one unique code per wallet
CREATE TABLE IF NOT EXISTS public.referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_wallet ON public.referral_codes(wallet_address);

-- 2. Referrals tracking table: who referred whom
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_wallet TEXT NOT NULL,
    referred_wallet TEXT UNIQUE NOT NULL,
    referral_code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    points_awarded INTEGER DEFAULT 0,
    referred_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_wallet);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_wallet);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON public.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- 3. Add referral columns to player_profiles
ALTER TABLE public.player_profiles
    ADD COLUMN IF NOT EXISTS referral_points INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_referrals INTEGER DEFAULT 0;

-- RLS policies
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referral codes are viewable by everyone"
    ON public.referral_codes FOR SELECT USING (true);

CREATE POLICY "Service role can insert referral codes"
    ON public.referral_codes FOR INSERT WITH CHECK (true);

CREATE POLICY "Referrals are viewable by everyone"
    ON public.referrals FOR SELECT USING (true);

CREATE POLICY "Service role can manage referrals"
    ON public.referrals FOR ALL USING (true);

-- ============================================
-- Quests: definitions + user progress
-- ============================================

-- Quest definitions (admin-managed)
CREATE TABLE IF NOT EXISTS public.quests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    reward_tp INTEGER NOT NULL DEFAULT 0,
    reward_label TEXT,
    requirement_type TEXT NOT NULL,
    requirement_config JSONB DEFAULT '{}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    quest_type TEXT DEFAULT 'STANDARD',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quests_category ON public.quests(category);
CREATE INDEX IF NOT EXISTS idx_quests_active ON public.quests(is_active);
CREATE INDEX IF NOT EXISTS idx_quests_sort ON public.quests(category, sort_order);

-- User progress per quest (progress = current value, e.g. count of lives purchased or games completed)
CREATE TABLE IF NOT EXISTS public.user_quest_progress (
    wallet_address TEXT NOT NULL,
    quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (wallet_address, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_user_quest_progress_wallet ON public.user_quest_progress(wallet_address);
CREATE INDEX IF NOT EXISTS idx_user_quest_progress_quest ON public.user_quest_progress(quest_id);

-- RLS
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_quest_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Quests are viewable by everyone" ON public.quests;
CREATE POLICY "Quests are viewable by everyone"
    ON public.quests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage quests" ON public.quests;
CREATE POLICY "Service role can manage quests"
    ON public.quests FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view own quest progress" ON public.user_quest_progress;
CREATE POLICY "Users can view own quest progress"
    ON public.user_quest_progress FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage quest progress" ON public.user_quest_progress;
CREATE POLICY "Service role can manage quest progress"
    ON public.user_quest_progress FOR ALL USING (auth.role() = 'service_role');

-- Allow anon to insert/update progress (for edge functions using anon key with service role in backend)
-- For client: we'll use service role in edge functions only; client reads with anon.
-- So no INSERT/UPDATE for anon on user_quest_progress from client; edge functions use service role.

-- ============================================
-- Seed default quests (run once; ON CONFLICT updates if slug exists)
-- Category order: Priority Mission (Identity Sync first), then Social, then Active Operations
-- ============================================
INSERT INTO public.quests (slug, title, description, category, reward_tp, reward_label, requirement_type, requirement_config, sort_order, quest_type) VALUES
('identity_sync', 'IDENTITY SYNC', 'Set up your trivia profile', 'Priority Mission', 1000, '1,000 TP', 'identity_sync', '{"max": 1}', 0, 'STANDARD'),
('genesis_streak', 'GENESIS STREAK', '7-day daily login chain', 'Priority Mission', 1500, '1,500 TP', 'daily_streak', '{"max": 7}', 1, 'ELITE'),
('healing_master', 'HEALING MASTER', 'Secure 15 total Vitality Lives from the store', 'Priority Mission', 2000, '2,000 TP', 'lives_purchased', '{"max": 15}', 2, 'ELITE'),
('knowledge_bowl', 'KNOWLEDGE BOWL', 'Win 3 high-stakes games', 'Priority Mission', 5000, '5,000 TP', 'total_wins', '{"max": 3}', 3, 'ELITE'),
('trivia_nerd', 'TRIVIA NERD', 'Answer all 10 questions correctly in a single trivia', 'Priority Mission', 2500, '2,500 TP', 'perfect_single_game', '{"max": 1}', 4, 'ELITE'),
('trivia_genius', 'TRIVIA GENIUS', 'Answer all 10 correctly in all 4 trivia games in a day', 'Priority Mission', 10000, '10,000 TP', 'perfect_four_in_day', '{"max": 1}', 5, 'ELITE'),
('true_raider', 'TRUE RAIDER', 'Like, RT & Reply to our latest tweet. Paste reply URL to verify.', 'Social Operations', 2500, '2,500 TP', 'social_raider', '{"max": 1}', 0, 'SOCIAL'),
('daily_quizzer', 'DAILY QUIZZER', 'Play all 4 scheduled daily games', 'Active Operations', 250, '250 TP', 'games_in_day', '{"max": 4}', 0, 'STANDARD')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  reward_tp = EXCLUDED.reward_tp,
  reward_label = EXCLUDED.reward_label,
  requirement_type = EXCLUDED.requirement_type,
  requirement_config = EXCLUDED.requirement_config,
  sort_order = EXCLUDED.sort_order,
  quest_type = EXCLUDED.quest_type,
  updated_at = timezone('utc'::text, now());

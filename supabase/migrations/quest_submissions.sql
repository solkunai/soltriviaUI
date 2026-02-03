-- Quest submissions for manual/technical verification (e.g. TRUE RAIDER - paste reply URL)
CREATE TABLE IF NOT EXISTS public.quest_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT NOT NULL,
    quest_id UUID NOT NULL REFERENCES public.quests(id) ON DELETE CASCADE,
    proof_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    UNIQUE(wallet_address, quest_id)
);

CREATE INDEX IF NOT EXISTS idx_quest_submissions_status ON public.quest_submissions(status);
CREATE INDEX IF NOT EXISTS idx_quest_submissions_quest ON public.quest_submissions(quest_id);
CREATE INDEX IF NOT EXISTS idx_quest_submissions_wallet ON public.quest_submissions(wallet_address);

ALTER TABLE public.quest_submissions ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can read/write; clients use edge functions only
DROP POLICY IF EXISTS "Service role can manage submissions" ON public.quest_submissions;
CREATE POLICY "Service role can manage submissions"
    ON public.quest_submissions FOR ALL USING (auth.role() = 'service_role');

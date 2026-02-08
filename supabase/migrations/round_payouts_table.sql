-- Round payouts: top 5 per round sharing 100% of pot. Admin can mark paid and set paid amount.
-- Prize share: 1st 50%, 2nd 20%, 3rd 15%, 4th 10%, 5th 5%.

CREATE TABLE IF NOT EXISTS public.round_payouts (
  round_id UUID NOT NULL REFERENCES public.daily_rounds(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank >= 1 AND rank <= 5),
  wallet_address TEXT NOT NULL,
  score BIGINT DEFAULT 0,
  prize_lamports BIGINT DEFAULT 0,
  paid_at TIMESTAMPTZ,
  paid_lamports BIGINT,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (round_id, rank)
);

CREATE INDEX IF NOT EXISTS idx_round_payouts_round ON public.round_payouts(round_id);
CREATE INDEX IF NOT EXISTS idx_round_payouts_wallet ON public.round_payouts(wallet_address);
CREATE INDEX IF NOT EXISTS idx_round_payouts_paid ON public.round_payouts(paid_at) WHERE paid_at IS NOT NULL;

COMMENT ON TABLE public.round_payouts IS 'Top 5 finishers per round with prize share (100% of pot) and admin-paid tracking.';

ALTER TABLE public.round_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Round payouts are viewable by everyone" ON public.round_payouts;
CREATE POLICY "Round payouts are viewable by everyone"
  ON public.round_payouts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage round payouts" ON public.round_payouts;
CREATE POLICY "Service role can manage round payouts"
  ON public.round_payouts FOR ALL USING (auth.role() = 'service_role');

-- RPC: populate top 5 and their prize_lamports (100% of pot: 50%, 20%, 15%, 10%, 5%)
CREATE OR REPLACE FUNCTION public.calculate_rankings_and_winner(p_round_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pot_lamports BIGINT;
  v_winner_wallet TEXT;
  v_winner_score BIGINT;
  v_share NUMERIC[] := ARRAY[0.50, 0.20, 0.15, 0.10, 0.05];
  v_row RECORD;
  v_rank INT := 0;
BEGIN
  SELECT COALESCE(pot_lamports, 0)::BIGINT INTO v_pot_lamports FROM public.daily_rounds WHERE id = p_round_id;

  -- Update rank in game_sessions
  WITH ranked AS (
    SELECT
      id,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(total_points, 0) DESC, COALESCE(time_taken_seconds, 999999) ASC
      ) AS rn
    FROM public.game_sessions
    WHERE round_id = p_round_id AND finished_at IS NOT NULL
  )
  UPDATE public.game_sessions gs
  SET rank = ranked.rn::INTEGER
  FROM ranked
  WHERE gs.id = ranked.id;

  -- Get #1 for round_winners and daily_rounds
  SELECT wallet_address, COALESCE(total_points, 0)::BIGINT
  INTO v_winner_wallet, v_winner_score
  FROM public.game_sessions
  WHERE round_id = p_round_id AND finished_at IS NOT NULL
  ORDER BY COALESCE(total_points, 0) DESC, COALESCE(time_taken_seconds, 999999) ASC
  LIMIT 1;

  IF v_winner_wallet IS NOT NULL THEN
    UPDATE public.daily_rounds
    SET winner_wallet = v_winner_wallet, winner_score = v_winner_score
    WHERE id = p_round_id;

    INSERT INTO public.round_winners (round_id, winner_wallet, winner_score, updated_at)
    VALUES (p_round_id, v_winner_wallet, v_winner_score, timezone('utc'::text, now()))
    ON CONFLICT (round_id) DO UPDATE SET
      winner_wallet = EXCLUDED.winner_wallet,
      winner_score = EXCLUDED.winner_score,
      updated_at = EXCLUDED.updated_at;
  END IF;

  -- Upsert top 5 into round_payouts (100% of pot split by rank)
  FOR v_row IN
    SELECT wallet_address, COALESCE(total_points, 0)::BIGINT AS scr
    FROM public.game_sessions
    WHERE round_id = p_round_id AND finished_at IS NOT NULL
    ORDER BY COALESCE(total_points, 0) DESC, COALESCE(time_taken_seconds, 999999) ASC
    LIMIT 5
  LOOP
    v_rank := v_rank + 1;
    INSERT INTO public.round_payouts (round_id, rank, wallet_address, score, prize_lamports, updated_at)
    VALUES (
      p_round_id,
      v_rank,
      v_row.wallet_address,
      v_row.scr,
      (v_pot_lamports * v_share[v_rank])::BIGINT,
      timezone('utc'::text, now())
    )
    ON CONFLICT (round_id, rank) DO UPDATE SET
      wallet_address = EXCLUDED.wallet_address,
      score = EXCLUDED.score,
      prize_lamports = EXCLUDED.prize_lamports,
      updated_at = EXCLUDED.updated_at;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.calculate_rankings_and_winner(UUID) IS
  'Recalculates ranks, updates daily_rounds + round_winners + round_payouts (top 5, 100% pot split). Call after each complete-session.';

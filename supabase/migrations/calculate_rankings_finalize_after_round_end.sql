-- Winners and payouts only after round ends. p_finalize = false: only update game_sessions.rank (live rank by points). p_finalize = true: set round_winners + round_payouts and post-winners can run.

CREATE OR REPLACE FUNCTION public.calculate_rankings_and_winner(p_round_id UUID, p_pot_lamports BIGINT DEFAULT NULL, p_finalize BOOLEAN DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pot_lamports BIGINT;
  v_winner_wallet TEXT;
  v_winner_score BIGINT;
  v_share NUMERIC[] := ARRAY[0.50, 0.20, 0.15, 0.10, 0.05];
  v_prizes BIGINT[] := ARRAY[0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT, 0::BIGINT];
  v_sum_rest BIGINT := 0;
  v_row RECORD;
  v_rank INT := 0;
  i INT;
BEGIN
  -- Always: update rank in game_sessions (ranked by points in round, then time as tiebreaker)
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

  IF NOT p_finalize THEN
    RETURN;
  END IF;

  -- Finalize: use passed pot when provided; otherwise read from daily_rounds
  IF p_pot_lamports IS NOT NULL AND p_pot_lamports >= 0 THEN
    v_pot_lamports := p_pot_lamports;
  ELSE
    SELECT COALESCE(pot_lamports, 0)::BIGINT INTO v_pot_lamports FROM public.daily_rounds WHERE id = p_round_id;
  END IF;

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

  -- Upsert top 5 into round_payouts (100% of pot split by rank; ranked by points in round)
  FOR i IN 2..5 LOOP
    v_prizes[i] := (v_pot_lamports * v_share[i])::BIGINT;
    v_sum_rest := v_sum_rest + v_prizes[i];
  END LOOP;
  v_prizes[1] := v_pot_lamports - v_sum_rest;

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
      v_prizes[v_rank],
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

COMMENT ON FUNCTION public.calculate_rankings_and_winner(UUID, BIGINT, BOOLEAN) IS
  'Ranks by points in round (then time). If p_finalize=true, writes round_winners + round_payouts (call only after round ends). If false, only updates game_sessions.rank.';

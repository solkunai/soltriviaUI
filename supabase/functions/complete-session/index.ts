// Complete Session Edge Function
// Called when a player finishes all 10 questions.
// 1. Updates game_sessions with final score, correct_count, time_taken_ms, completed_at, finished_at (so leaderboard shows the session).
// 2. Updates players.games_played if session has player_id.
// 3. Upserts player_profiles (total_games_played, total_points, highest_score, last_activity_date) for profile/leaderboard stats.
// 4. Calls calculate_rankings_and_winner for the round; returns rank to client.
// 5. Updates quest progress (trivia_nerd, daily_quizzer, trivia_genius, genesis_streak) and auto-claims rewards.

// @ts-ignore - Deno URL imports are valid at runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================
// CORS CONFIGURATION (inlined)
// =====================
// @ts-ignore - Deno is available at runtime
const ALLOWED_ORIGINS_STRING = Deno.env.get('ALLOWED_ORIGINS') || 
  'https://soltrivia.app,https://soltrivia.fun,https://soltriviaui.onrender.com,http://localhost:3000,http://localhost:19006';

const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING.split(',').map((origin: string) => origin.trim()).filter(Boolean);

// @ts-ignore - Deno is available at runtime
const isMobileMode = Deno.env.get('CORS_MODE') === 'mobile';

function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  if (isMobileMode) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };
  }

  let originToUse: string;
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    originToUse = requestOrigin;
  } else if (ALLOWED_ORIGINS.length > 0) {
    originToUse = ALLOWED_ORIGINS[0];
  } else {
    originToUse = 'null';
  }

  return {
    'Access-Control-Allow-Origin': originToUse,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function getCorsHeadersFromRequest(req: { headers: { get: (key: string) => string | null } }): Record<string, string> {
  const requestOrigin = req.headers.get('origin') || undefined;
  return getCorsHeaders(requestOrigin);
}

// =====================
// SUPABASE CLIENT (inlined)
// =====================
function getSupabaseClient() {
  // @ts-ignore - Deno is available at runtime
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // @ts-ignore - Deno is available at runtime
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required Supabase environment variables for service role client.');
    throw new Error('Missing required Supabase environment variables for service role client.');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================
// VALIDATION (inlined)
// =====================
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

interface CompleteSessionRequest {
  session_id: string;
  total_score: number;
  correct_count: number;
  time_taken_ms: number;
}

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    let { session_id, total_score, correct_count, time_taken_ms }: CompleteSessionRequest = await req.json();

    // Validate and coerce input
    if (!session_id || typeof session_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    session_id = String(session_id).trim();
    if (!isValidUUID(session_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid session_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    total_score = Number(total_score);
    correct_count = Number(correct_count);
    time_taken_ms = Number(time_taken_ms);
    if (!Number.isFinite(total_score) || total_score < 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid total_score' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!Number.isFinite(correct_count) || correct_count < 0 || correct_count > 10) {
      return new Response(
        JSON.stringify({ error: 'Invalid correct_count (must be 0–10)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!Number.isFinite(time_taken_ms) || time_taken_ms < 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid time_taken_ms' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the session (select * to support both schemas: score/total_points, correct_count/correct_answers, time_taken_ms/time_taken_seconds)
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionAny = session as Record<string, unknown>;
    if (sessionAny.completed_at) {
      return new Response(
        JSON.stringify({ error: 'Session already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const completedAt = new Date().toISOString();
    const timeTakenSeconds = Math.round(time_taken_ms / 1000);
    const sessionUpdate: Record<string, unknown> = {
      completed_at: completedAt,
      finished_at: completedAt,
      total_points: total_score,
      score: total_score,
      time_taken_seconds: timeTakenSeconds,
      time_taken_ms: time_taken_ms,
      correct_count: correct_count,
      correct_answers: correct_count,
    };
    // Always keep completed_at and finished_at so session appears on leaderboard (get-leaderboard filters by finished_at IS NOT NULL)
    if (!('total_points' in sessionAny)) delete sessionUpdate.total_points;
    if (!('score' in sessionAny)) delete sessionUpdate.score;
    if (!('time_taken_seconds' in sessionAny)) delete sessionUpdate.time_taken_seconds;
    if (!('time_taken_ms' in sessionAny)) delete sessionUpdate.time_taken_ms;
    if (!('correct_count' in sessionAny)) delete sessionUpdate.correct_count;
    if (!('correct_answers' in sessionAny)) delete sessionUpdate.correct_answers;

    const { error: updateError } = await supabase
      .from('game_sessions')
      .update(sessionUpdate)
      .eq('id', session_id);

    if (updateError) {
      console.error('Failed to update session:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to complete session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wallet = (session as Record<string, unknown>).wallet_address as string;

    // Update players table if it exists and session has player_id
    const playerId = (session as Record<string, unknown>).player_id;
    if (playerId) {
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('games_played')
        .eq('id', playerId)
        .single();

      if (!playerError && player) {
        await supabase
          .from('players')
          .update({
            games_played: (player as { games_played: number }).games_played + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', playerId);
      }
    }

    // Sync player_profiles (total_games_played, total_points, highest_score) so profile/leaderboard show correct stats
    try {
      const { data: profile } = await supabase
        .from('player_profiles')
        .select('wallet_address, total_games_played, total_points, highest_score, last_activity_date')
        .eq('wallet_address', wallet)
        .maybeSingle();

      const today = new Date().toISOString().split('T')[0];
      if (profile) {
        await supabase
          .from('player_profiles')
          .update({
            total_games_played: ((profile as any).total_games_played ?? 0) + 1,
            total_points: ((profile as any).total_points ?? 0) + total_score,
            highest_score: Math.max((profile as any).highest_score ?? 0, total_score),
            last_activity_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('wallet_address', wallet);
      } else {
        await supabase
          .from('player_profiles')
          .insert({
            wallet_address: wallet,
            total_games_played: 1,
            total_points: total_score,
            highest_score: total_score,
            last_activity_date: today,
            updated_at: new Date().toISOString(),
          });
      }
    } catch (profileErr) {
      console.error('Player profile sync failed (non-fatal):', profileErr);
    }

    // Recalculate ranks for the round and set daily_rounds.winner_wallet/winner_score to current #1
    const roundId = (session as Record<string, unknown>).round_id as string;
    const MIN_PLAYERS_FOR_PAYOUT = 5;

    const { count: finishedCount, error: countErr } = await supabase
      .from('game_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('round_id', roundId)
      .not('finished_at', 'is', null);

    const finishedInRound = countErr ? 0 : (finishedCount ?? 0);

    if (finishedInRound < MIN_PLAYERS_FOR_PAYOUT) {
      // Round failed: fewer than 5 players. Mark round for refund; do not populate payouts.
      const { error: statusErr } = await supabase
        .from('daily_rounds')
        .update({ status: 'refund', updated_at: new Date().toISOString() })
        .eq('id', roundId);
      if (statusErr) {
        console.warn('Could not set daily_rounds.status=refund (run migration daily_rounds_status_refund.sql):', statusErr.message);
      }
      // Skip calculate_rankings_and_winner so no prize payouts are created; players will be refunded.
    } else {
      // Use current pot so payouts match the actual prize pool (run migration round_payouts_use_pot_override.sql)
      const { data: roundRow } = await supabase
        .from('daily_rounds')
        .select('pot_lamports')
        .eq('id', roundId)
        .single();
      const potLamports = roundRow?.pot_lamports != null ? Number(roundRow.pot_lamports) : null;
      try {
        await supabase.rpc('calculate_rankings_and_winner', {
          p_round_id: roundId,
          p_pot_lamports: potLamports,
        });
      } catch (_) {
        // RPC might not exist yet (run migration leaderboard_and_round_winners.sql); rank/winner computed on read
      }

      // Refresh dedicated round_leaderboard table so all users see the same list in real time
      try {
        await supabase.rpc('refresh_round_leaderboard', { p_round_id: roundId });
      } catch (_) {
        // Migration round_leaderboard_table.sql adds this; non-fatal if not yet run
      }

      // Post winners on-chain (Sol Trivia contract) so winners can claim from the vault. Retry automatically on failure.
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const base = supabaseUrl.replace(/\/$/, '') + '/functions/v1';
      const maxAttempts = 4;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const res = await fetch(base + '/post-winners-on-chain', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
            body: JSON.stringify({ round_id: roundId }),
          });
          const text = await res.text();
          if (res.ok) {
            if (attempt > 1) console.log('post-winners-on-chain succeeded on attempt', attempt);
            break;
          }
          if (attempt < maxAttempts) {
            console.warn(`post-winners-on-chain attempt ${attempt} failed (${res.status}), retrying in 2s...`, text.slice(0, 200));
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            console.warn('post-winners-on-chain failed after', maxAttempts, 'attempts (non-fatal):', res.status, text.slice(0, 200));
          }
        } catch (e) {
          if (attempt < maxAttempts) {
            console.warn('post-winners-on-chain attempt', attempt, 'request failed, retrying in 2s...', e);
            await new Promise((r) => setTimeout(r, 2000));
          } else {
            console.warn('post-winners-on-chain request failed after', maxAttempts, 'attempts (non-fatal):', e);
          }
        }
      }
    }

    // Get the player's rank after calculation
    const { data: updatedSession, error: rankError } = await supabase
      .from('game_sessions')
      .select('rank')
      .eq('id', session_id)
      .single();

    const rank = rankError ? null : updatedSession?.rank;

    // Quest progress: trivia_nerd, daily_quizzer, trivia_genius, genesis_streak (7-day daily chain)
    try {
      const wallet = session.wallet_address;
      const { data: round } = await supabase.from('daily_rounds').select('date').eq('id', session.round_id).single();
      const roundDate = round?.date;
      if (wallet && roundDate) {
        const { data: questRows } = await supabase.from('quests').select('id, slug, reward_tp, requirement_config').in('slug', ['trivia_nerd', 'daily_quizzer', 'trivia_genius', 'genesis_streak']);
        const bySlug: Record<string, { id: string; reward_tp?: number; max?: number }> = {};
        (questRows || []).forEach((q: any) => {
          bySlug[q.slug] = { id: q.id, reward_tp: q.reward_tp, max: (q.requirement_config?.max ?? 1) };
        });

        if (correct_count >= 10 && bySlug.trivia_nerd) {
          await supabase.from('user_quest_progress').upsert({ wallet_address: wallet, quest_id: bySlug.trivia_nerd.id, progress: 1, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'wallet_address,quest_id' });
        }

        const { data: roundsToday } = await supabase.from('daily_rounds').select('id').eq('date', roundDate);
        const roundIdsToday = (roundsToday || []).map((r: { id: string }) => r.id);
        const { data: sessionsToday } = await supabase.from('game_sessions').select('round_id, correct_count, correct_answers').eq('wallet_address', wallet).not('finished_at', 'is', null).in('round_id', roundIdsToday);
        const countToday = (sessionsToday || []).length;
        const correctPerSession = (s: any) => s.correct_count ?? s.correct_answers ?? 0;
        const perfectToday = (sessionsToday || []).filter((s: any) => correctPerSession(s) >= 10).length;

        if (bySlug.daily_quizzer) {
          const dailyProgress = Math.min(countToday, 4);
          const completedAt = dailyProgress >= 4 ? new Date().toISOString() : undefined;
          await supabase.from('user_quest_progress').upsert(
            { wallet_address: wallet, quest_id: bySlug.daily_quizzer.id, progress: dailyProgress, ...(completedAt && { completed_at: completedAt }), updated_at: new Date().toISOString() },
            { onConflict: 'wallet_address,quest_id' }
          );
        }
        if (perfectToday >= 4 && bySlug.trivia_genius) {
          await supabase.from('user_quest_progress').upsert({ wallet_address: wallet, quest_id: bySlug.trivia_genius.id, progress: 1, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'wallet_address,quest_id' });
        }

        // Genesis streak: from player_profiles.current_streak (updated by submit-answer)
        const { data: profileForStreak } = await supabase.from('player_profiles').select('current_streak').eq('wallet_address', wallet).single();
        const currentStreak = Math.min((profileForStreak as any)?.current_streak ?? 0, 7);
        if (bySlug.genesis_streak && currentStreak > 0) {
          const completedAt = currentStreak >= 7 ? new Date().toISOString() : undefined;
          await supabase.from('user_quest_progress').upsert(
            { wallet_address: wallet, quest_id: bySlug.genesis_streak.id, progress: currentStreak, ...(completedAt && { completed_at: completedAt }), updated_at: new Date().toISOString() },
            { onConflict: 'wallet_address,quest_id' }
          );
        }

        // Auto-claim: for any completed quest (progress >= max), set claimed_at and add TP if not already claimed
        const now = new Date().toISOString();
        for (const slug of ['trivia_nerd', 'daily_quizzer', 'trivia_genius', 'genesis_streak']) {
          const q = bySlug[slug];
          if (!q?.id || q.reward_tp == null || q.reward_tp <= 0) continue;
          const max = q.max ?? 1;
          const { data: prog } = await supabase.from('user_quest_progress').select('progress, claimed_at').eq('wallet_address', wallet).eq('quest_id', q.id).single();
          if (prog && (prog as any).progress >= max && !(prog as any).claimed_at) {
            await supabase.from('user_quest_progress').update({ claimed_at: now, updated_at: now }).eq('wallet_address', wallet).eq('quest_id', q.id);
            const { data: pf } = await supabase.from('player_profiles').select('total_points').eq('wallet_address', wallet).single();
            const tp = (pf as any)?.total_points ?? 0;
            await supabase.from('player_profiles').update({ total_points: tp + q.reward_tp, updated_at: now }).eq('wallet_address', wallet);
          }
        }
      }
    } catch (questErr) {
      console.error('Quest progress update failed:', questErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        rank,
        score: total_score,
        correct_count,
        time_taken_ms,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

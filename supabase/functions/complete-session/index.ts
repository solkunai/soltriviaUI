// Complete Session Edge Function
// Called when a player finishes all 10 questions
// Updates session with final results and calculates time taken

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

    const { session_id, total_score, correct_count, time_taken_ms }: CompleteSessionRequest = await req.json();

    // Validate input
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id' }),
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
    const sessionUpdate: Record<string, unknown> = {
      completed_at: completedAt,
      finished_at: completedAt,
    };
    if ('score' in sessionAny) sessionUpdate.score = total_score;
    if ('total_points' in sessionAny) sessionUpdate.total_points = total_score;
    if ('correct_count' in sessionAny) sessionUpdate.correct_count = correct_count;
    if ('correct_answers' in sessionAny) sessionUpdate.correct_answers = correct_count;
    if ('time_taken_ms' in sessionAny) sessionUpdate.time_taken_ms = time_taken_ms;
    if ('time_taken_seconds' in sessionAny) sessionUpdate.time_taken_seconds = Math.round(time_taken_ms / 1000);

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
        .single();

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

    // Calculate rankings for the round (only count completed sessions); RPC may not exist in all schemas
    try {
      await supabase.rpc('calculate_rankings', { p_round_id: (session as Record<string, unknown>).round_id });
    } catch (_) {
      // RPC might not exist; rank will be computed on read
    }

    // Get the player's rank after calculation
    const { data: updatedSession, error: rankError } = await supabase
      .from('game_sessions')
      .select('rank')
      .eq('id', session_id)
      .single();

    const rank = rankError ? null : updatedSession?.rank;

    // Quest progress: trivia_nerd (10/10 in one game), daily_quizzer (games today), trivia_genius (4 perfect in a day)
    try {
      const wallet = session.wallet_address;
      const { data: round } = await supabase.from('daily_rounds').select('date').eq('id', session.round_id).single();
      const roundDate = round?.date;
      if (wallet && roundDate) {
        const { data: questRows } = await supabase.from('quests').select('id, slug').in('slug', ['trivia_nerd', 'daily_quizzer', 'trivia_genius']);
        const bySlug: Record<string, string> = {};
        (questRows || []).forEach((q: { id: string; slug: string }) => { bySlug[q.slug] = q.id; });

        if (correct_count >= 10 && bySlug.trivia_nerd) {
          await supabase.from('user_quest_progress').upsert({ wallet_address: wallet, quest_id: bySlug.trivia_nerd, progress: 1, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'wallet_address,quest_id' });
        }

        const { data: roundsToday } = await supabase.from('daily_rounds').select('id').eq('date', roundDate);
        const roundIdsToday = (roundsToday || []).map((r: { id: string }) => r.id);
        const { data: sessionsToday } = await supabase.from('game_sessions').select('round_id, correct_count').eq('wallet_address', wallet).not('finished_at', 'is', null).in('round_id', roundIdsToday);
        const countToday = (sessionsToday || []).length;
        const perfectToday = (sessionsToday || []).filter((s: any) => s.correct_count >= 10).length;

        if (bySlug.daily_quizzer) {
          await supabase.from('user_quest_progress').upsert({ wallet_address: wallet, quest_id: bySlug.daily_quizzer, progress: Math.min(countToday, 4), updated_at: new Date().toISOString() }, { onConflict: 'wallet_address,quest_id' });
        }
        if (perfectToday >= 4 && bySlug.trivia_genius) {
          await supabase.from('user_quest_progress').upsert({ wallet_address: wallet, quest_id: bySlug.trivia_genius, progress: 1, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'wallet_address,quest_id' });
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

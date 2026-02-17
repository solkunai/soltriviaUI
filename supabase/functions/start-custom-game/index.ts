// Start Custom Game Edge Function
// Creates a session for a player (free to join, no payment required)

// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ===================== CORS (inlined) =====================
// @ts-ignore
const ALLOWED_ORIGINS_STRING = Deno.env.get('ALLOWED_ORIGINS') ||
  'https://soltrivia.app,https://soltrivia.fun,https://soltriviaui.onrender.com,http://localhost:3000,http://localhost:19006';
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING.split(',').map((o: string) => o.trim()).filter(Boolean);
// @ts-ignore
const isMobileMode = Deno.env.get('CORS_MODE') === 'mobile';
function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  if (isMobileMode) return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Max-Age': '86400' };
  let o = (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) ? requestOrigin : (ALLOWED_ORIGINS[0] || 'null');
  return { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Max-Age': '86400', 'Access-Control-Allow-Credentials': 'true' };
}
function getCorsHeadersFromRequest(req: { headers: { get: (k: string) => string | null } }) { return getCorsHeaders(req.headers.get('origin') || undefined); }

// ===================== SUPABASE (inlined) =====================
function getSupabaseClient() {
  // @ts-ignore
  const url = Deno.env.get('SUPABASE_URL');
  // @ts-ignore
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

const MAX_ATTEMPTS = 3;

serve(async (req: Request) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { game_id, wallet_address } = await req.json();

    if (!game_id || !wallet_address) {
      return new Response(JSON.stringify({ error: 'Missing game_id or wallet_address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    const { data: game, error: gameError } = await supabase
      .from('custom_games')
      .select('id, question_count, round_count, time_limit_seconds, status, expires_at, total_plays')
      .eq('id', game_id)
      .maybeSingle();

    if (gameError || !game) {
      return new Response(JSON.stringify({ error: 'Game not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (game.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Game is no longer active' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (new Date(game.expires_at) < new Date()) {
      await supabase.from('custom_games').update({ status: 'expired' }).eq('id', game.id);
      return new Response(JSON.stringify({ error: 'Game has expired' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for existing in-progress session (resume it)
    const { data: existingSession } = await supabase
      .from('custom_game_sessions')
      .select('id, current_round, current_question_index, score, correct_count, time_taken_ms, attempt_number')
      .eq('game_id', game_id)
      .eq('wallet_address', wallet_address)
      .eq('status', 'in_progress')
      .maybeSingle();

    if (existingSession) {
      return new Response(JSON.stringify({
        session_id: existingSession.id,
        game_id: game.id,
        total_questions: game.question_count,
        round_count: game.round_count,
        time_limit_seconds: game.time_limit_seconds,
        resumed: true,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Count completed + abandoned attempts
    const { count: attemptCount } = await supabase
      .from('custom_game_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', game_id)
      .eq('wallet_address', wallet_address);

    if ((attemptCount ?? 0) >= MAX_ATTEMPTS) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_ATTEMPTS} attempts reached` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create new session
    const { data: session, error: sessionError } = await supabase
      .from('custom_game_sessions')
      .insert({
        game_id,
        wallet_address,
        attempt_number: (attemptCount ?? 0) + 1,
        current_round: 0,
        current_question_index: 0,
        score: 0,
        correct_count: 0,
        time_taken_ms: 0,
        status: 'in_progress',
      })
      .select('id')
      .single();

    if (sessionError || !session) {
      console.error('Failed to create session:', sessionError);
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Increment total_plays (read current + 1; acceptable race for a display counter)
    const { data: currentGame } = await supabase
      .from('custom_games')
      .select('total_plays')
      .eq('id', game_id)
      .single();
    await supabase
      .from('custom_games')
      .update({ total_plays: (currentGame?.total_plays ?? 0) + 1 })
      .eq('id', game_id);

    return new Response(JSON.stringify({
      session_id: session.id,
      game_id: game.id,
      total_questions: game.question_count,
      round_count: game.round_count,
      time_limit_seconds: game.time_limit_seconds,
      resumed: false,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('start-custom-game error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

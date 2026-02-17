// Complete Custom Session Edge Function
// Finalizes session and returns rank on per-game leaderboard

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

serve(async (req: Request) => {
  const corsHeaders = getCorsHeadersFromRequest(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session_id, total_score, correct_count, time_taken_ms } = await req.json();

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'Missing session_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('custom_game_sessions')
      .select('id, game_id, wallet_address, score, correct_count, time_taken_ms, status')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If already completed, just return current rank
    if (session.status === 'completed') {
      const { data: leaderboard } = await supabase.rpc('get_custom_game_leaderboard', {
        p_game_id: session.game_id,
        p_limit: 100,
      });

      const rank = leaderboard?.find((e: any) => e.wallet_address === session.wallet_address)?.rank ?? null;

      return new Response(JSON.stringify({
        success: true,
        score: session.score,
        correct_count: session.correct_count,
        time_taken_ms: session.time_taken_ms,
        rank,
        already_completed: true,
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.status !== 'in_progress') {
      return new Response(JSON.stringify({ error: 'Session cannot be completed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use server state (authoritative from submit-custom-answer calls)
    const finalScore = session.score;
    const finalCorrect = session.correct_count;
    const finalTime = session.time_taken_ms;

    // Mark session as completed
    const { error: updateError } = await supabase
      .from('custom_game_sessions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', session_id)
      .eq('status', 'in_progress');

    if (updateError) {
      console.error('Failed to complete session:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to complete session' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get rank from leaderboard
    const { data: leaderboard } = await supabase.rpc('get_custom_game_leaderboard', {
      p_game_id: session.game_id,
      p_limit: 100,
    });

    const rank = leaderboard?.find((e: any) => e.wallet_address === session.wallet_address)?.rank ?? null;

    return new Response(JSON.stringify({
      success: true,
      score: finalScore,
      correct_count: finalCorrect,
      time_taken_ms: finalTime,
      rank,
      already_completed: false,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('complete-custom-session error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

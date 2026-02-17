// Get Custom Questions Edge Function
// Returns questions for the current round WITHOUT correct_index (anti-cheat)

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
    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'Missing session_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    // Get session to know which game + current round
    const { data: session, error: sessionError } = await supabase
      .from('custom_game_sessions')
      .select('id, game_id, current_round, status')
      .eq('id', session_id)
      .maybeSingle();

    if (sessionError || !session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (session.status !== 'in_progress') {
      return new Response(JSON.stringify({ error: 'Session is not in progress' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get game info for round_count
    const { data: game } = await supabase
      .from('custom_games')
      .select('round_count, question_count')
      .eq('id', session.game_id)
      .single();

    if (!game) {
      return new Response(JSON.stringify({ error: 'Game not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch questions for current round (WITHOUT correct_index)
    const { data: questions, error: qError } = await supabase
      .from('custom_questions')
      .select('id, question_index, question_text, options')
      .eq('game_id', session.game_id)
      .eq('round_number', session.current_round)
      .order('question_index', { ascending: true });

    if (qError) {
      console.error('Failed to fetch questions:', qError);
      return new Response(JSON.stringify({ error: 'Failed to fetch questions' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      session_id: session.id,
      current_round: session.current_round,
      total_rounds: game.round_count,
      questions: (questions || []).map((q: any) => ({
        index: q.question_index,
        id: q.id,
        question: q.question_text,
        options: q.options,
      })),
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('get-custom-questions error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

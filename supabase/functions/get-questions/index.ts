// get-questions Edge Function
// Returns 10 random questions for a quiz session
// Does NOT include correct_index - that's validated on answer submission

// @ts-ignore - Deno URL imports are valid at runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const QUESTIONS_PER_ROUND = 10;

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

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify session exists, get question order (must match submit-answer order)
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select(`
        id,
        round_id,
        finished_at,
        question_order,
        round:daily_rounds(id, question_ids)
      `)
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      console.error('Session lookup error:', sessionError);
      return new Response(
        JSON.stringify({
          error: 'Session not found',
          details: sessionError?.message || 'Session does not exist',
          sessionId: session_id,
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.finished_at) {
      return new Response(
        JSON.stringify({ error: 'Session already finished' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const round = session.round;
    const questionIds = (Array.isArray(session.question_order) && session.question_order.length > 0)
      ? session.question_order
      : (round?.question_ids ?? []);

    if (!questionIds.length) {
      return new Response(
        JSON.stringify({ error: 'No questions assigned to this session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch questions in session order (same order submit-answer uses)
    const { data: questionsRows, error: questionsError } = await supabase
      .from('questions')
      .select('id, category, text, options, difficulty')
      .in('id', questionIds);

    if (questionsError || !questionsRows?.length) {
      console.error('Failed to fetch questions:', questionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to load questions for this round' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const byId = new Map(questionsRows.map((q) => [q.id, q]));
    const questions = questionIds.map((id) => byId.get(id)).filter(Boolean);

    const questionsWithTokens = questions.map((q, index) => ({
      index,
      id: q.id,
      category: q.category,
      text: q.text,
      options: q.options ?? [],
      difficulty: q.difficulty ?? '',
    }));

    return new Response(
      JSON.stringify({
        session_id,
        questions: questionsWithTokens,
        total_questions: questionsWithTokens.length,
        time_per_question: 15,
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

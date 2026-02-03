// Fetch Next Question Edge Function
// Returns one question at a time with a unique token
// NEVER exposes the correct answer - that's revealed only after submission

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
// TYPES & HELPERS
// =====================
interface FetchQuestionRequest {
  sessionId: string;
}

function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { sessionId }: FetchQuestionRequest = await req.json();

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'sessionId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session with round data; session.question_order (when set) overrides round order per user
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select(`
        id,
        current_question_index,
        finished_at,
        question_order,
        round:daily_rounds(id, question_ids, status)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.finished_at) {
      return new Response(
        JSON.stringify({ error: 'Game already finished', code: 'GAME_FINISHED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const round = session.round;
    if (!round || round.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Round is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const questionIndex = session.current_question_index;
    const questionIds = (Array.isArray(session.question_order) && session.question_order.length > 0)
      ? session.question_order
      : round.question_ids;

    if (questionIndex >= questionIds.length) {
      return new Response(
        JSON.stringify({ error: 'No more questions', code: 'GAME_COMPLETE' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const questionId = questionIds[questionIndex];

    // Get the question (but NOT the correct_index!)
    const { data: question, error: qError } = await supabase
      .from('questions')
      .select('id, category, text, options')
      .eq('id', questionId)
      .single();

    if (qError || !question) {
      return new Response(
        JSON.stringify({ error: 'Question not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a unique token for this question
    const token = generateToken();
    const issuedAt = new Date().toISOString();

    // Update session with token and timestamp for validation on submit
    const { error: updateError } = await supabase
      .from('game_sessions')
      .update({
        current_question_token: token,
        current_question_issued_at: issuedAt,
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('Failed to update session:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to issue question' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return question WITHOUT the correct answer
    return new Response(
      JSON.stringify({
        questionIndex,
        totalQuestions: questionIds.length,
        question: {
          id: question.id,
          category: question.category,
          text: question.text,
          options: question.options,
          token, // Client must include this when submitting answer
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

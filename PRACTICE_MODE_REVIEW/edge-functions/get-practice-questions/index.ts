// get-practice-questions Edge Function
// Returns 10 practice questions for a practice session
// INCLUDES correct_index since practice mode scoring is client-side

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

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const { question_ids } = await req.json();

    if (!question_ids || !Array.isArray(question_ids) || question_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid question_ids array' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch practice questions in the order provided
    const { data: questionsRows, error: questionsError } = await supabase
      .from('practice_questions')
      .select('id, category, difficulty, text, options, correct_index')
      .in('id', question_ids);

    if (questionsError || !questionsRows?.length) {
      console.error('Failed to fetch practice questions:', questionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to load practice questions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Order questions by the question_ids array order
    const byId = new Map(questionsRows.map((q) => [q.id, q]));
    const orderedQuestions = question_ids.map((id) => byId.get(id)).filter(Boolean);

    // Normalize options to ensure array format
    const normalizeOptions = (op: unknown): string[] => {
      if (Array.isArray(op)) return op.map((o) => String(o ?? ''));
      if (typeof op === 'string') {
        try {
          const parsed = JSON.parse(op);
          return Array.isArray(parsed) ? parsed.map((o: unknown) => String(o ?? '')) : [];
        } catch {
          return [];
        }
      }
      return [];
    };

    const questionsWithAnswers = orderedQuestions.map((q, index) => ({
      index,
      id: q.id,
      category: q.category ?? '',
      difficulty: q.difficulty ?? '',
      text: q.text ?? '',
      options: normalizeOptions(q.options),
      correct_index: q.correct_index ?? 0, // Include correct answer for client-side scoring
    }));

    return new Response(
      JSON.stringify({
        questions: questionsWithAnswers,
        total_questions: questionsWithAnswers.length,
        time_per_question: 7,
        mode: 'practice',
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

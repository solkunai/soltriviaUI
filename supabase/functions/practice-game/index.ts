// Supabase Edge Function: practice-game
// Creates a practice session (no payment required, no wallet needed)

// @ts-ignore - Deno URL imports are valid at runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================
// CORS CONFIGURATION (inlined)
// =====================
// @ts-ignore - Deno is available at runtime
const ALLOWED_ORIGINS_STRING = Deno.env.get('ALLOWED_ORIGINS') ||
  'https://soltrivia.app,https://soltrivia.fun,https://soltriviaui.onrender.com,http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:3003,http://localhost:3004,http://localhost:3005,http://localhost:19006';

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

    // Parse optional params (backwards compatible — old clients send empty body)
    const body = await req.json().catch(() => ({}));
    const category = typeof body.category === 'string' ? body.category.trim().toLowerCase() : null;
    const walletAddress = typeof body.wallet_address === 'string' ? body.wallet_address.trim() : null;

    // Free categories available to everyone; premium categories require game pass
    const FREE_CATEGORIES = ['general', 'crypto'];

    // Check game pass if requesting a premium category
    let hasGamePass = false;
    if (walletAddress) {
      const { data: pass } = await supabase
        .from('game_passes')
        .select('is_active')
        .eq('wallet_address', walletAddress)
        .maybeSingle();
      hasGamePass = pass?.is_active === true;
    }

    if (category && !FREE_CATEGORIES.includes(category) && !hasGamePass) {
      return new Response(
        JSON.stringify({ error: 'Game pass required for this category', requires_pass: true, category }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const practiceSessionId = `practice_${crypto.randomUUID()}`;

    // Build query — filter by category if specified, otherwise get all
    let query = supabase.from('practice_questions').select('id');
    if (category) {
      query = query.eq('category', category);
    }
    const { data: questions, error: questionsError } = await query.limit(500);

    if (questionsError || !questions || questions.length < 10) {
      console.error('Failed to fetch practice questions:', questionsError);
      return new Response(
        JSON.stringify({
          error: category
            ? `Not enough questions for category "${category}" (found ${questions?.length ?? 0}, need 10)`
            : 'Not enough practice questions available',
          details: questionsError?.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Shuffle and pick 10 random questions
    const shuffled = questions.sort(() => Math.random() - 0.5);
    const selectedQuestionIds = shuffled.slice(0, 10).map(q => q.id);

    return new Response(
      JSON.stringify({
        practice_session_id: practiceSessionId,
        question_ids: selectedQuestionIds,
        total_questions: 10,
        mode: 'practice',
        category: category || 'all',
        has_game_pass: hasGamePass,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in practice-game:', error);
    return new Response(
      JSON.stringify({ error: 'Internal error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

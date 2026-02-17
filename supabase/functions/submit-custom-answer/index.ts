// Submit Custom Answer Edge Function
// Validates answer server-side, calculates points, advances session state

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

const BASE_POINTS = 100;
const MAX_SPEED_BONUS = 900;

serve(async (req: Request) => {
  const corsHeaders = getCorsHeadersFromRequest(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { session_id, question_id, question_index, selected_index, time_taken_ms } = await req.json();

    if (!session_id || !question_id || typeof question_index !== 'number' ||
        typeof selected_index !== 'number' || typeof time_taken_ms !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (selected_index < 0 || selected_index > 3) {
      return new Response(JSON.stringify({ error: 'Invalid selected_index (0-3)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from('custom_game_sessions')
      .select('id, game_id, current_round, current_question_index, score, correct_count, time_taken_ms, status')
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

    // Validate question_index matches session state
    if (question_index !== session.current_question_index) {
      return new Response(JSON.stringify({ error: `Expected question index ${session.current_question_index}, got ${question_index}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the question to check correct answer
    const { data: question, error: qError } = await supabase
      .from('custom_questions')
      .select('id, correct_index, question_index')
      .eq('id', question_id)
      .eq('game_id', session.game_id)
      .maybeSingle();

    if (qError || !question) {
      return new Response(JSON.stringify({ error: 'Question not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get game for time limit
    const { data: game } = await supabase
      .from('custom_games')
      .select('time_limit_seconds, question_count, round_count')
      .eq('id', session.game_id)
      .single();

    if (!game) {
      return new Response(JSON.stringify({ error: 'Game not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate correctness + points
    const isCorrect = selected_index === question.correct_index;
    let pointsEarned = 0;
    if (isCorrect) {
      const timeLimitMs = game.time_limit_seconds * 1000;
      const clampedTime = Math.max(0, Math.min(time_taken_ms, timeLimitMs));
      const speedBonus = Math.max(0, Math.floor(MAX_SPEED_BONUS * (1 - clampedTime / timeLimitMs)));
      pointsEarned = BASE_POINTS + speedBonus;
    }

    // Check for duplicate answer
    const { data: existingAnswer } = await supabase
      .from('custom_game_answers')
      .select('id')
      .eq('session_id', session_id)
      .eq('question_id', question_id)
      .maybeSingle();

    if (existingAnswer) {
      return new Response(JSON.stringify({ error: 'Answer already submitted for this question' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert answer
    const { error: answerError } = await supabase
      .from('custom_game_answers')
      .insert({
        session_id,
        question_id,
        question_index,
        selected_index,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        time_taken_ms: Math.max(0, time_taken_ms),
      });

    if (answerError) {
      console.error('Failed to insert answer:', answerError);
      return new Response(JSON.stringify({ error: 'Failed to record answer' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Advance session state
    const newQuestionIndex = session.current_question_index + 1;
    const questionsPerRound = game.question_count / game.round_count;
    const currentRoundQuestionIndex = newQuestionIndex % questionsPerRound;
    const isLastQuestionInRound = currentRoundQuestionIndex === 0 && newQuestionIndex > 0;
    const isLastQuestion = newQuestionIndex >= game.question_count;

    const updatePayload: any = {
      current_question_index: newQuestionIndex,
      score: session.score + pointsEarned,
      correct_count: session.correct_count + (isCorrect ? 1 : 0),
      time_taken_ms: session.time_taken_ms + Math.max(0, time_taken_ms),
      updated_at: new Date().toISOString(),
    };

    if (isLastQuestion) {
      updatePayload.status = 'completed';
      updatePayload.completed_at = new Date().toISOString();
    } else if (isLastQuestionInRound) {
      updatePayload.current_round = session.current_round + 1;
    }

    const { error: updateError } = await supabase
      .from('custom_game_sessions')
      .update(updatePayload)
      .eq('id', session_id);

    if (updateError) {
      console.error('Failed to update session:', updateError);
    }

    return new Response(JSON.stringify({
      correct: isCorrect,
      correctIndex: question.correct_index,
      pointsEarned,
      newScore: session.score + pointsEarned,
      isLastQuestionInRound,
      isLastQuestion,
      nextRound: isLastQuestionInRound && !isLastQuestion ? session.current_round + 1 : session.current_round,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('submit-custom-answer error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Fetch Next Question Edge Function
// Returns one question at a time with a unique token
// NEVER exposes the correct answer - that's revealed only after submission

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

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

    // Get session with round data
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select(`
        id,
        current_question_index,
        finished_at,
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
    const questionIds = round.question_ids;

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

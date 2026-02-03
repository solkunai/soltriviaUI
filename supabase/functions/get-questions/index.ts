// get-questions Edge Function
// Returns 10 random questions for a quiz session
// Does NOT include correct_index - that's validated on answer submission

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';
import { isValidUUID } from '../_shared/validation.ts';

const QUESTIONS_PER_ROUND = 10;

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { session_id } = await req.json();

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify session exists and hasn't started
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('id, round_id, completed_at')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.completed_at) {
      return new Response(
        JSON.stringify({ error: 'Session already completed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get random questions from different categories
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('id, category, text, options, difficulty')
      .eq('active', true)
      .order('random()')
      .limit(QUESTIONS_PER_ROUND);

    if (questionsError) throw questionsError;

    // Generate a token for each question (used to validate answers)
    const questionsWithTokens = questions?.map((q, index) => ({
      index,
      id: q.id,
      category: q.category,
      text: q.text,
      options: q.options,
      difficulty: q.difficulty,
      // Don't include correct_index!
    })) || [];

    // Store the question order in a session-questions mapping (or just use question_id in answers table)

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

// Submit Answer Edge Function
// Validates the answer token and timing, then records the result
// This is where anti-cheat validation happens

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

interface SubmitAnswerRequest {
  sessionId: string;
  token: string;
  selectedIndex: number;
}

// Maximum allowed time to answer (16 seconds to allow for network latency)
const MAX_ANSWER_TIME_MS = 16000;

// Points calculation: base 100 + time bonus (up to 900 for instant answers)
function calculatePoints(correct: boolean, timeMs: number): number {
  if (!correct) return 0;
  const basePoints = 100;
  const maxTimeBonus = 900;
  const maxTimeMs = 15000; // 15 seconds

  // Linear decay: instant = 1000 points, 15s = 100 points
  const timeBonus = Math.max(0, maxTimeBonus * (1 - timeMs / maxTimeMs));
  return Math.round(basePoints + timeBonus);
}

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { sessionId, token, selectedIndex }: SubmitAnswerRequest = await req.json();

    // Validate input
    if (!sessionId || !token || selectedIndex === undefined) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (selectedIndex < 0 || selectedIndex > 3) {
      return new Response(
        JSON.stringify({ error: 'Invalid selectedIndex' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session with round data
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select(`
        id,
        current_question_index,
        current_question_token,
        current_question_issued_at,
        score,
        correct_count,
        finished_at,
        wallet_address,
        round:daily_rounds(id, question_ids)
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

    // ANTI-CHEAT: Validate token
    if (session.current_question_token !== token) {
      return new Response(
        JSON.stringify({ error: 'Invalid token', code: 'INVALID_TOKEN' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ANTI-CHEAT: Validate timing
    const issuedAt = new Date(session.current_question_issued_at).getTime();
    const now = Date.now();
    const timeMs = now - issuedAt;

    if (timeMs > MAX_ANSWER_TIME_MS) {
      // Time expired - record as wrong answer
      const round = session.round;
      const questionId = round.question_ids[session.current_question_index];

      // Record the answer as timed out (wrong)
      await supabase.from('answers').insert({
        session_id: sessionId,
        question_index: session.current_question_index,
        question_id: questionId,
        selected_index: selectedIndex,
        correct: false,
        points_earned: 0,
        time_ms: timeMs,
        token,
        issued_at: session.current_question_issued_at,
      });

      // Move to next question
      const nextIndex = session.current_question_index + 1;
      const isLastQuestion = nextIndex >= 10;

      await supabase
        .from('game_sessions')
        .update({
          current_question_index: nextIndex,
          current_question_token: null,
          current_question_issued_at: null,
          ...(isLastQuestion && { finished_at: new Date().toISOString() }),
        })
        .eq('id', sessionId);

      return new Response(
        JSON.stringify({
          correct: false,
          correctIndex: -1, // Don't reveal on timeout
          pointsEarned: 0,
          timeMs,
          timedOut: true,
          isLastQuestion,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the question to check the correct answer
    const round = session.round;
    const questionId = round.question_ids[session.current_question_index];

    const { data: question, error: qError } = await supabase
      .from('questions')
      .select('id, correct_index')
      .eq('id', questionId)
      .single();

    if (qError || !question) {
      return new Response(
        JSON.stringify({ error: 'Question not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if answer is correct
    const correct = selectedIndex === question.correct_index;
    const pointsEarned = calculatePoints(correct, timeMs);

    // Record the answer
    const { error: answerError } = await supabase.from('answers').insert({
      session_id: sessionId,
      question_index: session.current_question_index,
      question_id: questionId,
      selected_index: selectedIndex,
      correct,
      points_earned: pointsEarned,
      time_ms: timeMs,
      token,
      issued_at: session.current_question_issued_at,
    });

    if (answerError) {
      console.error('Failed to record answer:', answerError);
      return new Response(
        JSON.stringify({ error: 'Failed to record answer' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session
    const nextIndex = session.current_question_index + 1;
    const isLastQuestion = nextIndex >= 10;
    const newScore = session.score + pointsEarned;
    const newCorrectCount = session.correct_count + (correct ? 1 : 0);

    await supabase
      .from('game_sessions')
      .update({
        current_question_index: nextIndex,
        current_question_token: null,
        current_question_issued_at: null,
        score: newScore,
        correct_count: newCorrectCount,
        ...(isLastQuestion && { finished_at: new Date().toISOString() }),
      })
      .eq('id', sessionId);

    // If game is finished, update player stats
    if (isLastQuestion) {
      const { data: existingStats } = await supabase
        .from('player_stats')
        .select('*')
        .eq('wallet_address', session.wallet_address)
        .single();

      const today = new Date().toISOString().split('T')[0];

      if (existingStats) {
        // Update existing stats
        const lastPlayedDate = existingStats.last_played_date;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Check if streak continues
        let newStreak = 1;
        if (lastPlayedDate === yesterday) {
          newStreak = existingStats.current_streak + 1;
        }

        await supabase
          .from('player_stats')
          .update({
            games_played: existingStats.games_played + 1,
            total_score: existingStats.total_score + newScore,
            best_score: Math.max(existingStats.best_score, newScore),
            current_streak: newStreak,
            longest_streak: Math.max(existingStats.longest_streak, newStreak),
            last_played_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('wallet_address', session.wallet_address);
      } else {
        // Create new stats
        await supabase.from('player_stats').insert({
          wallet_address: session.wallet_address,
          games_played: 1,
          total_score: newScore,
          best_score: newScore,
          current_streak: 1,
          longest_streak: 1,
          last_played_date: today,
        });
      }
    }

    return new Response(
      JSON.stringify({
        correct,
        correctIndex: question.correct_index,
        pointsEarned,
        timeMs,
        timedOut: false,
        isLastQuestion,
        totalScore: newScore,
        correctCount: newCorrectCount,
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

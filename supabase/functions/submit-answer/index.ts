// Submit Answer Edge Function
// Validates the answer token and timing, then records the result
// This is where anti-cheat validation happens

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

// Client can send camelCase (fetch-next-question flow) or snake_case (get-questions flow); token optional when question_index is sent
interface SubmitAnswerBody {
  sessionId?: string;
  session_id?: string;
  token?: string;
  selectedIndex?: number;
  selected_index?: number;
  question_index?: number;
  time_taken_ms?: number;
  time_expired?: boolean; // When true, no selection was made; record as wrong and advance
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
    const body: SubmitAnswerBody = await req.json();
    const sessionId = body.sessionId ?? body.session_id;
    const token = body.token;
    const selectedIndex = body.selectedIndex ?? body.selected_index;
    const questionIndexFromClient = body.question_index;

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: 'Missing session id (sessionId or session_id)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const timeExpired = body.time_expired === true;
    if (!timeExpired && (selectedIndex === undefined || selectedIndex === null)) {
      return new Response(
        JSON.stringify({ error: 'Missing selected index (selectedIndex or selected_index)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!timeExpired && (selectedIndex < 0 || selectedIndex > 3)) {
      return new Response(
        JSON.stringify({ error: 'Invalid selectedIndex (must be 0–3)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get session with round data; session.question_order (when set) overrides round order per user
    // Query ALL columns from game_sessions (let Supabase return what exists)
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select(`
        *,
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

    const useTokenFlow = token != null && token !== '';
    if (useTokenFlow) {
      if (session.current_question_token !== token) {
        return new Response(
          JSON.stringify({ error: 'Invalid token', code: 'INVALID_TOKEN' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // get-questions flow: require question_index to match current_question_index
      if (questionIndexFromClient === undefined || questionIndexFromClient === null) {
        return new Response(
          JSON.stringify({ error: 'Missing question_index (required when not using token)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (questionIndexFromClient !== session.current_question_index) {
        return new Response(
          JSON.stringify({ error: 'Question index mismatch; answer questions in order', code: 'QUESTION_INDEX_MISMATCH' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const round = session.round;
    const questionIds = (Array.isArray(session.question_order) && session.question_order.length > 0)
      ? session.question_order
      : (round && Array.isArray(round.question_ids) ? round.question_ids : null);
    if (!questionIds || questionIds.length === 0) {
      console.error('submit-answer: no question_order or round.question_ids for session', sessionId);
      return new Response(
        JSON.stringify({ error: 'Session has no questions configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Frontend time-expired (e.g. 7s per question): record wrong and advance without a selected answer
    if (timeExpired) {
      const questionId = questionIds[session.current_question_index];
      const timeTakenMs = Math.round(Number(body.time_taken_ms ?? 7000));
      const timeoutAnswerRow: Record<string, unknown> = {
        session_id: String(sessionId),
        question_index: Number(session.current_question_index),
        question_id: questionId == null ? null : String(questionId),
        selected_index: 0,
        is_correct: false,
        points_earned: 0,
        time_taken_ms: timeTakenMs,
        token: session.current_question_token ?? null,
        issued_at: session.current_question_issued_at,
      };
      const { error: insertErr } = await supabase.from('answers').insert(timeoutAnswerRow);
      if (insertErr) {
        console.error('Failed to record time-expired answer:', insertErr);
        return new Response(
          JSON.stringify({ error: 'Failed to record answer', details: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const nextIndex = session.current_question_index + 1;
      const isLastQuestion = nextIndex >= 10;
      const sessionUpdate: Record<string, unknown> = {
        current_question_index: nextIndex,
        current_question_token: null,
        current_question_issued_at: null,
        ...(isLastQuestion && { finished_at: new Date().toISOString() }),
      };
      await supabase.from('game_sessions').update(sessionUpdate).eq('id', sessionId);
      return new Response(
        JSON.stringify({
          correct: false,
          correctIndex: -1,
          pointsEarned: 0,
          timeMs: timeTakenMs,
          timedOut: true,
          isLastQuestion,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const issuedAt = session.current_question_issued_at ? new Date(session.current_question_issued_at).getTime() : null;
    const now = Date.now();
    const timeMs = issuedAt != null ? now - issuedAt : (body.time_taken_ms ?? 0);

    // Timeout only when token was issued (fetch-next-question flow)
    if (useTokenFlow && issuedAt != null && timeMs > MAX_ANSWER_TIME_MS) {
      // Time expired - record as wrong answer
      const questionId = questionIds[session.current_question_index];

      const timeoutAnswerRow: Record<string, unknown> = {
        session_id: String(sessionId),
        question_index: Number(session.current_question_index),
        question_id: questionId == null ? null : String(questionId),
        selected_index: Number(selectedIndex),
        is_correct: false,
        points_earned: 0,
        time_taken_ms: Math.round(Number(timeMs)) || 0,
        token: String(token),
        issued_at: session.current_question_issued_at,
      };
      const { error: timeoutInsertErr } = await supabase.from('answers').insert(timeoutAnswerRow);
      if (timeoutInsertErr) {
        console.error('Failed to record timeout answer:', timeoutInsertErr);
        return new Response(
          JSON.stringify({ error: 'Failed to record answer', details: timeoutInsertErr.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Move to next question
      const nextIndex = session.current_question_index + 1;
      const isLastQuestion = nextIndex >= 10;
      const timeoutSessionUpdate: Record<string, unknown> = {
        current_question_index: nextIndex,
        current_question_token: null,
        current_question_issued_at: null,
        ...(isLastQuestion && { finished_at: new Date().toISOString() }),
      };
      await supabase
        .from('game_sessions')
        .update(timeoutSessionUpdate)
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

    // Get the question to check the correct answer (use string id for consistent lookup)
    const questionId = questionIds[session.current_question_index];
    const questionIdStr = questionId == null ? null : String(questionId);
    if (!questionIdStr) {
      return new Response(
        JSON.stringify({ error: 'No question for this index' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the correct answer from the separate correct_answers table
    const { data: correctAnswerData, error: qError } = await supabase
      .from('question_correct_answers')
      .select('correct_answer')
      .eq('question_id', questionIdStr)
      .single();

    if (qError || !correctAnswerData) {
      return new Response(
        JSON.stringify({ error: 'Question answer not found' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert letter (A-D) to index (0-3)
    const letterToIndex: Record<string, number> = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
    const correctIndexNum = letterToIndex[correctAnswerData.correct_answer] ?? 0;
    const selectedNum = Math.max(0, Math.min(3, Number(selectedIndex)));
    const correct = selectedNum === correctIndexNum;
    const pointsEarned = calculatePoints(correct, timeMs);

    // Debug: set DEBUG_ANSWERS=true in Edge Function secrets to log one line per submission (Supabase Dashboard → Logs)
    if (Deno.env.get('DEBUG_ANSWERS') === 'true') {
      console.log(JSON.stringify({
        debug: 'submit-answer',
        questionId,
        question_index: session.current_question_index,
        selectedIndex,
        selectedNum,
        correct_answer_letter: correctAnswerData.correct_answer,
        correctIndexNum,
        correct,
      }));
    }

    // Record the answer (token/issued_at only set in fetch-next-question flow)
    // Coerce types for DB; omit null/undefined optional columns
    const answerRow: Record<string, unknown> = {
      session_id: String(sessionId),
      question_index: Number(session.current_question_index),
      question_id: questionIdStr,
      selected_index: Number(selectedIndex),
      is_correct: Boolean(correct),
      points_earned: Math.round(Number(pointsEarned)) || 0,
      time_taken_ms: Math.round(Number(timeMs)) || 0,
    };
    if (token != null && token !== '') answerRow.token = String(token);
    if (session.current_question_issued_at != null) answerRow.issued_at = session.current_question_issued_at;
    const { error: answerError } = await supabase.from('answers').insert(answerRow);

    if (answerError) {
      const errMsg = answerError.message || 'Unknown error';
      const errCode = (answerError as { code?: string }).code;
      console.error('Failed to record answer:', answerError);
      return new Response(
        JSON.stringify({
          error: 'Failed to record answer',
          details: errMsg,
          code: errCode,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update session (support both schemas: score/correct_count vs total_points/correct_answers)
    const nextIndex = session.current_question_index + 1;
    const isLastQuestion = nextIndex >= 10;
    
    // Determine which columns exist and calculate new values
    const hasScoreColumn = 'score' in session;
    const hasTotalPointsColumn = 'total_points' in session;
    const hasCorrectCountColumn = 'correct_count' in session;
    const hasCorrectAnswersColumn = 'correct_answers' in session;
    
    const currentScore = Number(session.score ?? session.total_points ?? 0);
    const currentCorrect = Number(session.correct_count ?? session.correct_answers ?? 0);
    const newScore = currentScore + pointsEarned;
    const newCorrectCount = currentCorrect + (correct ? 1 : 0);

    const sessionUpdate: Record<string, unknown> = {
      current_question_index: nextIndex,
      current_question_token: null,
      current_question_issued_at: null,
      ...(isLastQuestion && { finished_at: new Date().toISOString() }),
    };
    
    // Update whichever columns exist
    if (hasScoreColumn) sessionUpdate.score = newScore;
    if (hasTotalPointsColumn) sessionUpdate.total_points = newScore;
    if (hasCorrectCountColumn) sessionUpdate.correct_count = newCorrectCount;
    if (hasCorrectAnswersColumn) sessionUpdate.correct_answers = newCorrectCount;

    await supabase
      .from('game_sessions')
      .update(sessionUpdate)
      .eq('id', sessionId);

    // If game is finished, update player stats (player_stats) and sync streak to player_profiles for profile page
    if (isLastQuestion) {
      const { data: existingStats } = await supabase
        .from('player_stats')
        .select('*')
        .eq('wallet_address', session.wallet_address)
        .single();

      const today = new Date().toISOString().split('T')[0];
      let currentStreak = 1;
      let bestStreak = 1;

      if (existingStats) {
        const lastPlayedDate = existingStats.last_played_date;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (lastPlayedDate === yesterday) {
          currentStreak = existingStats.current_streak + 1;
        }
        bestStreak = Math.max(existingStats.longest_streak ?? 0, currentStreak);

        await supabase
          .from('player_stats')
          .update({
            games_played: existingStats.games_played + 1,
            total_score: existingStats.total_score + newScore,
            best_score: Math.max(existingStats.best_score, newScore),
            current_streak: currentStreak,
            longest_streak: bestStreak,
            last_played_date: today,
            updated_at: new Date().toISOString(),
          })
          .eq('wallet_address', session.wallet_address);
      } else {
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

      // Sync streak to player_profiles so Profile page STREAK shows correct values
      const { error: profileErr } = await supabase
        .from('player_profiles')
        .upsert(
          {
            wallet_address: session.wallet_address,
            current_streak: currentStreak,
            best_streak: bestStreak,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'wallet_address' }
        );
      if (profileErr) {
        // player_profiles may not exist in some setups; non-fatal
      }
    }

    return new Response(
      JSON.stringify({
        correct,
        correctIndex: correctIndexNum,
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

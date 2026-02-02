// Complete Session Edge Function
// Called when a player finishes all 10 questions
// Updates session with final results and calculates time taken

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { isValidUUID } from '../_shared/validation.ts';

interface CompleteSessionRequest {
  session_id: string;
  total_score: number;
  correct_count: number;
  time_taken_ms: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { session_id, total_score, correct_count, time_taken_ms }: CompleteSessionRequest = await req.json();

    // Validate input
    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the session
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('id, round_id, wallet_address, player_id, completed_at, score, correct_count')
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

    // Update session with final results
    const { error: updateError } = await supabase
      .from('game_sessions')
      .update({
        score: total_score,
        correct_count: correct_count,
        time_taken_ms: time_taken_ms,
        completed_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
      })
      .eq('id', session_id);

    if (updateError) {
      console.error('Failed to update session:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to complete session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update player stats
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('games_played')
      .eq('id', session.player_id)
      .single();

    if (!playerError && player) {
      await supabase
        .from('players')
        .update({
          games_played: player.games_played + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.player_id);
    }

    // Calculate rankings for the round (only count completed sessions)
    await supabase.rpc('calculate_rankings', { p_round_id: session.round_id });

    // Get the player's rank after calculation
    const { data: updatedSession, error: rankError } = await supabase
      .from('game_sessions')
      .select('rank')
      .eq('id', session_id)
      .single();

    const rank = rankError ? null : updatedSession?.rank;

    return new Response(
      JSON.stringify({
        success: true,
        rank,
        score: total_score,
        correct_count,
        time_taken_ms,
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

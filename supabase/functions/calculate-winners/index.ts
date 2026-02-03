// calculate-winners Edge Function
// Calculates winners for a completed round based on score and speed

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';

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

    const { round_id } = await req.json();

    if (!round_id) {
      return new Response(
        JSON.stringify({ error: 'Missing round_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all completed sessions for this round
    const { data: sessions, error: sessionsError } = await supabase
      .from('game_sessions')
      .select('wallet_address, correct_answers, total_points, time_taken_seconds')
      .eq('round_id', round_id)
      .not('finished_at', 'is', null)
      .order('total_points', { ascending: false })
      .order('time_taken_seconds', { ascending: true });

    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No completed sessions found for this round',
          leaderboard: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate rankings
    // Primary sort: total_points (descending)
    // Secondary sort: time_taken_seconds (ascending) - faster is better
    const leaderboard = sessions.map((session, index) => ({
      rank: index + 1,
      wallet_address: session.wallet_address,
      correct_answers: session.correct_answers,
      total_points: session.total_points,
      time_taken_seconds: session.time_taken_seconds,
    }));

    // Get round info for prize pool
    const { data: round } = await supabase
      .from('daily_rounds')
      .select('pot_lamports')
      .eq('id', round_id)
      .single();

    const totalPot = round?.pot_lamports || 0;

    // Calculate prize distribution
    // 80% to 1st place
    // 20% split among 2nd-5th (5% each)
    const prizes = [];
    if (leaderboard.length > 0) {
      prizes.push({
        rank: 1,
        wallet_address: leaderboard[0].wallet_address,
        prize_lamports: Math.floor(totalPot * 0.8),
        prize_sol: (totalPot * 0.8) / 1_000_000_000,
      });
    }
    if (leaderboard.length > 1) {
      for (let i = 1; i < Math.min(5, leaderboard.length); i++) {
        prizes.push({
          rank: i + 1,
          wallet_address: leaderboard[i].wallet_address,
          prize_lamports: Math.floor(totalPot * 0.05),
          prize_sol: (totalPot * 0.05) / 1_000_000_000,
        });
      }
    }

    // Update player profiles with wins/stats
    if (leaderboard.length > 0) {
      // Winner gets win count increment
      await supabase.rpc('increment_player_wins', {
        p_wallet_address: leaderboard[0].wallet_address
      });

      // Update all players' total_games_played and total_points
      for (const entry of leaderboard) {
        await supabase
          .from('player_profiles')
          .update({
            total_games_played: supabase.raw('total_games_played + 1'),
            total_points: supabase.raw(`total_points + ${entry.total_points}`),
            updated_at: new Date().toISOString(),
          })
          .eq('wallet_address', entry.wallet_address);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        round_id,
        total_pot_lamports: totalPot,
        total_pot_sol: totalPot / 1_000_000_000,
        total_players: leaderboard.length,
        leaderboard: leaderboard.slice(0, 10), // Top 10
        prize_distribution: prizes,
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

// Helper SQL function to increment wins (add this to SUPABASE_SETUP.sql)
/*
CREATE OR REPLACE FUNCTION increment_player_wins(p_wallet_address TEXT)
RETURNS void AS $$
BEGIN
    UPDATE player_profiles
    SET total_wins = total_wins + 1,
        updated_at = timezone('utc'::text, now())
    WHERE wallet_address = p_wallet_address;
END;
$$ LANGUAGE plpgsql;
*/

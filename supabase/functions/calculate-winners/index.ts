// calculate-winners Edge Function
// Calculates winners for a completed round based on score and speed

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
    // 100% of pot to top 5: 1st 50%, 2nd 20%, 3rd 15%, 4th 10%, 5th 5%
    const PRIZE_SPLITS = [0.50, 0.20, 0.15, 0.10, 0.05];
    const prizes = [];
    for (let i = 0; i < Math.min(5, leaderboard.length); i++) {
      prizes.push({
        rank: i + 1,
        wallet_address: leaderboard[i].wallet_address,
        prize_lamports: Math.floor(totalPot * PRIZE_SPLITS[i]),
        prize_sol: (totalPot * PRIZE_SPLITS[i]) / 1_000_000_000,
      });
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

      // Quest: Knowledge Bowl (win 3 games) — update winner's progress and auto-claim if >= 3
      const winnerWallet = leaderboard[0].wallet_address;
      try {
        const { data: winnerProfile } = await supabase.from('player_profiles').select('total_wins').eq('wallet_address', winnerWallet).single();
        const totalWins = (winnerProfile as any)?.total_wins ?? 0;
        const { data: quest } = await supabase.from('quests').select('id, reward_tp, requirement_config').eq('slug', 'knowledge_bowl').single();
        if (quest?.id) {
          const maxProgress = (quest.requirement_config as { max?: number })?.max ?? 3;
          const rewardTP = quest.reward_tp ?? 0;
          await supabase.from('user_quest_progress').upsert({
            wallet_address: winnerWallet,
            quest_id: quest.id,
            progress: totalWins,
            ...(totalWins >= maxProgress && { completed_at: new Date().toISOString() }),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'wallet_address,quest_id' });
          if (totalWins >= maxProgress && rewardTP > 0) {
            const { data: row } = await supabase.from('user_quest_progress').select('claimed_at').eq('wallet_address', winnerWallet).eq('quest_id', quest.id).single();
            if (row && !row.claimed_at) {
              const now = new Date().toISOString();
              await supabase.from('user_quest_progress').update({ claimed_at: now, updated_at: now }).eq('wallet_address', winnerWallet).eq('quest_id', quest.id);
              const { data: pf } = await supabase.from('player_profiles').select('total_points').eq('wallet_address', winnerWallet).single();
              const tp = (pf as any)?.total_points ?? 0;
              await supabase.from('player_profiles').update({ total_points: tp + rewardTP, updated_at: now }).eq('wallet_address', winnerWallet);
            }
          }
        }
      } catch (questErr) {
        console.error('Knowledge Bowl quest update failed:', questErr);
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

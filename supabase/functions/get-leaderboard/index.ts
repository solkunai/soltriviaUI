// Supabase Edge Function: get-leaderboard
// Returns leaderboard data for daily, weekly, or all-time views

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

    const url = new URL(req.url);
    const period = url.searchParams.get('period') || 'daily'; // daily, weekly, all-time
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const wallet = url.searchParams.get('wallet'); // optional: get user's rank

    const today = new Date().toISOString().split('T')[0];

    let leaderboard: Array<{
      rank: number;
      wallet_address: string;
      score: number;
      correct_count?: number;
    }> = [];

    let userRank: number | null = null;
    let userScore: number | null = null;
    let potLamports = 0;
    let playerCount = 0;

    if (period === 'daily') {
      // Get current active round or most recent completed round
      const { data: round } = await supabase
        .from('rounds')
        .select('id, pot_lamports, entry_count')
        .or(`status.eq.active,status.eq.ended,status.eq.paid_out`)
        .order('ends_at', { ascending: false })
        .limit(1)
        .single();

      if (round) {
        potLamports = round.pot_lamports;
        playerCount = round.entry_count;

        // Get top scores for today
        const { data: sessions } = await supabase
          .from('game_sessions')
          .select('wallet_address, score, correct_count')
          .eq('round_id', round.id)
          .not('finished_at', 'is', null)
          .order('score', { ascending: false })
          .limit(limit);

        if (sessions) {
          leaderboard = sessions.map((s, i) => ({
            rank: i + 1,
            wallet_address: s.wallet_address,
            score: s.score,
            correct_count: s.correct_count,
          }));
        }

        // Get user's rank if wallet provided
        if (wallet) {
          const { data: userSession } = await supabase
            .from('game_sessions')
            .select('score')
            .eq('round_id', round.id)
            .eq('wallet_address', wallet)
            .not('finished_at', 'is', null)
            .single();

          if (userSession) {
            userScore = userSession.score;
            // Count how many scores are higher
            const { count } = await supabase
              .from('game_sessions')
              .select('*', { count: 'exact', head: true })
              .eq('round_id', round.id)
              .not('finished_at', 'is', null)
              .gt('score', userSession.score);

            userRank = (count || 0) + 1;
          }
        }
      }
    } else if (period === 'weekly') {
      // Use the RPC function for weekly leaderboard
      const { data: weeklyStats } = await supabase
        .rpc('get_weekly_leaderboard', { p_limit: limit });

      if (weeklyStats) {
        leaderboard = weeklyStats.map((s: {
          rank: number;
          wallet_address: string;
          total_score: number;
          display_name: string | null;
          avatar: string;
        }) => ({
          rank: Number(s.rank),
          wallet_address: s.wallet_address,
          score: Number(s.total_score),
          display_name: s.display_name,
          avatar: s.avatar,
        }));
      }

      // Get weekly pot total from rounds in last 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: weekRounds } = await supabase
        .from('rounds')
        .select('pot_lamports, entry_count')
        .gte('ends_at', weekAgo);

      if (weekRounds) {
        potLamports = weekRounds.reduce((sum, r) => sum + (r.pot_lamports || 0), 0);
        playerCount = weekRounds.reduce((sum, r) => sum + (r.entry_count || 0), 0);
      }
    } else {
      // All-time: use get_alltime_leaderboard RPC
      const { data: allTimeStats } = await supabase
        .rpc('get_alltime_leaderboard', { p_limit: limit });

      if (allTimeStats) {
        leaderboard = allTimeStats.map((s: {
          rank: number;
          wallet_address: string;
          total_score: number;
          display_name: string | null;
          avatar: string;
          games_played: number;
          total_winnings: number;
        }) => ({
          rank: Number(s.rank),
          wallet_address: s.wallet_address,
          score: Number(s.total_score),
          display_name: s.display_name,
          avatar: s.avatar,
          games_played: Number(s.games_played),
          total_winnings: Number(s.total_winnings),
        }));
      }

      // Get user's all-time stats if wallet provided
      if (wallet) {
        const { data: userAllTime } = await supabase
          .from('players')
          .select('total_winnings_lamports, games_played')
          .eq('wallet_address', wallet)
          .single();

        if (userAllTime) {
          // Find user's rank in the leaderboard
          const userEntry = leaderboard.find((e) => e.wallet_address === wallet);
          if (userEntry) {
            userRank = userEntry.rank;
            userScore = userEntry.score;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        period,
        leaderboard,
        pot_lamports: potLamports,
        player_count: playerCount,
        user_rank: userRank,
        user_score: userScore,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

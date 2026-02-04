// Supabase Edge Function: get-leaderboard
// Returns leaderboard data for daily, weekly, or all-time views

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

    const url = new URL(req.url);
    let period = url.searchParams.get('period') || 'daily';
    let limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    let wallet = url.searchParams.get('wallet') || undefined;
    if (req.method === 'POST') {
      try {
        const body = await req.json().catch(() => ({}));
        if (body.period) period = body.period;
        if (body.limit != null) limit = Math.min(Number(body.limit), 100);
        if (body.wallet) wallet = body.wallet;
      } catch (_) {}
    }

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
      // Use daily_rounds (same as start-game): current 6-hour window by date + round_number.
      // IMPORTANT: Leaderboard list is never filtered by wallet – all connected users see the same full list.
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentHour = now.getUTCHours();
      const roundNumber = Math.floor(currentHour / 6);

      let round: { id: string; pot_lamports?: number; player_count?: number } | null = null;
      const { data: roundData } = await supabase
        .from('daily_rounds')
        .select('id, pot_lamports, player_count')
        .eq('date', today)
        .eq('round_number', roundNumber)
        .maybeSingle();
      round = roundData;

      // Fallback: if no round for current window, use the most recent round that has finished sessions (so everyone sees the same leaderboard)
      if (!round) {
        const { data: recentRounds } = await supabase
          .from('daily_rounds')
          .select('id, pot_lamports, player_count')
          .order('date', { ascending: false })
          .order('round_number', { ascending: false })
          .limit(10);
        for (const r of recentRounds || []) {
          const { count } = await supabase
            .from('game_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('round_id', r.id)
            .not('finished_at', 'is', null);
          if (count && count > 0) {
            round = r;
            break;
          }
        }
      }

      if (round) {
        potLamports = round.pot_lamports ?? 0;
        playerCount = round.player_count ?? 0;

        // Read from dedicated round_leaderboard table so all users see the same list in real time
        const { data: snapshot } = await supabase
          .from('round_leaderboard')
          .select('wallet_address, rank, score, display_name, avatar_url, time_taken_ms')
          .eq('round_id', round.id)
          .order('rank', { ascending: true })
          .limit(limit);

        if (snapshot && snapshot.length > 0) {
          leaderboard = snapshot.map((s: any) => ({
            rank: Number(s.rank),
            wallet_address: s.wallet_address,
            score: Number(s.score),
            display_name: s.display_name ?? null,
            avatar: s.avatar_url ?? '',
            time_taken_ms: Number(s.time_taken_ms ?? 0),
          }));
        } else {
          // Fallback: build from game_sessions if round_leaderboard not yet populated
          const { data: sessions } = await supabase
            .from('game_sessions')
            .select('wallet_address, score, total_points, time_taken_ms, time_taken_seconds')
            .eq('round_id', round.id)
            .not('finished_at', 'is', null)
            .limit(limit * 2);

          if (sessions && sessions.length > 0) {
            const byScore = (s: any) => Number(s.score ?? s.total_points ?? 0);
            const sorted = [...sessions].sort((a, b) => byScore(b) - byScore(a)).slice(0, limit);
            leaderboard = sorted.map((s: any, i: number) => ({
              rank: i + 1,
              wallet_address: s.wallet_address,
              score: byScore(s),
              display_name: null,
              avatar: '',
            }));
          }
        }

        // Wallet is only used to compute user_rank / user_score for the requesting user
        if (wallet) {
          const userEntry = leaderboard.find((e: any) => e.wallet_address === wallet);
          if (userEntry) {
            userRank = userEntry.rank;
            userScore = userEntry.score;
          } else {
            const { data: userSession } = await supabase
              .from('game_sessions')
              .select('score, total_points')
              .eq('round_id', round.id)
              .eq('wallet_address', wallet)
              .not('finished_at', 'is', null)
              .maybeSingle();
            if (userSession) {
              const uScore = Number((userSession as any).score ?? (userSession as any).total_points ?? 0);
              userScore = uScore;
              const { data: allSessions } = await supabase
                .from('game_sessions')
                .select('score, total_points')
                .eq('round_id', round.id)
                .not('finished_at', 'is', null);
              const higher = (allSessions || []).filter((s: any) => (Number(s.score ?? s.total_points ?? 0)) > uScore).length;
              userRank = higher + 1;
            }
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

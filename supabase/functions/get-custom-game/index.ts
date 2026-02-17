// Get Custom Game Edge Function
// Fetches game metadata + leaderboard for the lobby page

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

serve(async (req: Request) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { slug, wallet_address } = await req.json();

    if (!slug || typeof slug !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing slug' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    const { data: game, error: gameError } = await supabase
      .from('custom_games')
      .select('id, slug, creator_wallet, name, question_count, round_count, time_limit_seconds, status, total_plays, expires_at, created_at')
      .eq('slug', slug)
      .maybeSingle();

    if (gameError || !game) {
      return new Response(JSON.stringify({ error: 'Game not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auto-expire check
    const isExpired = new Date(game.expires_at) < new Date();
    if (isExpired && game.status === 'active') {
      await supabase.from('custom_games').update({ status: 'expired' }).eq('id', game.id);
      game.status = 'expired';
    }

    // Get creator username
    const { data: creatorProfile } = await supabase
      .from('player_profiles')
      .select('username')
      .eq('wallet_address', game.creator_wallet)
      .maybeSingle();

    // Get leaderboard via SQL function
    const { data: leaderboard } = await supabase.rpc('get_custom_game_leaderboard', {
      p_game_id: game.id,
      p_limit: 50,
    });

    // Get player's attempts if wallet provided
    let playerAttempts = 0;
    let playerBestScore: number | null = null;
    if (wallet_address) {
      const { data: sessions } = await supabase
        .from('custom_game_sessions')
        .select('score, status')
        .eq('game_id', game.id)
        .eq('wallet_address', wallet_address)
        .eq('status', 'completed');

      if (sessions && sessions.length > 0) {
        playerAttempts = sessions.length;
        playerBestScore = Math.max(...sessions.map((s: any) => s.score));
      }

      const { count: inProgressCount } = await supabase
        .from('custom_game_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .eq('wallet_address', wallet_address)
        .eq('status', 'in_progress');

      if (inProgressCount && inProgressCount > 0) {
        playerAttempts += inProgressCount;
      }
    }

    return new Response(JSON.stringify({
      game_id: game.id,
      name: game.name,
      slug: game.slug,
      creator_wallet: game.creator_wallet,
      creator_username: creatorProfile?.username || null,
      question_count: game.question_count,
      round_count: game.round_count,
      time_limit_seconds: game.time_limit_seconds,
      total_plays: game.total_plays,
      status: game.status,
      expires_at: game.expires_at,
      created_at: game.created_at,
      is_expired: isExpired || game.status === 'expired',
      player_best_score: playerBestScore,
      player_attempts: playerAttempts,
      leaderboard: leaderboard || [],
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('get-custom-game error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

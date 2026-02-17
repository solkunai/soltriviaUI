// Get My Custom Games Edge Function
// Lists games created by a wallet address

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

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { wallet_address } = await req.json();

    if (!wallet_address || typeof wallet_address !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing wallet_address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabaseClient();

    const { data: games, error } = await supabase
      .from('custom_games')
      .select('id, slug, name, question_count, round_count, time_limit_seconds, status, total_plays, expires_at, created_at')
      .eq('creator_wallet', wallet_address)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch custom games:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch games' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auto-expire any that are past their expiry
    const now = new Date();
    const results = (games || []).map((g: any) => {
      const isExpired = new Date(g.expires_at) < now;
      return {
        ...g,
        is_expired: isExpired || g.status === 'expired',
      };
    });

    return new Response(JSON.stringify({ games: results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('get-my-custom-games error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

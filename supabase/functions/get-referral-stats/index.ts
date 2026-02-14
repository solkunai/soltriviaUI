// Get Referral Stats Edge Function
// Returns detailed referral stats for a wallet (for the Profile page).

// @ts-ignore - Deno URL imports are valid at runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

function getSupabaseClient() {
  // @ts-ignore - Deno is available at runtime
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // @ts-ignore - Deno is available at runtime
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing required Supabase environment variables for service role client.');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

const APP_URL = 'https://soltrivia.app';

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { wallet_address } = await req.json();

    if (!wallet_address || typeof wallet_address !== 'string' || wallet_address.length < 32) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet_address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the referral code
    const { data: codeRow } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('wallet_address', wallet_address)
      .single();

    const code = codeRow?.code ?? null;

    // Get all referrals by this wallet
    const { data: referrals } = await supabase
      .from('referrals')
      .select('referred_wallet, status, points_awarded, referred_at, completed_at')
      .eq('referrer_wallet', wallet_address)
      .order('referred_at', { ascending: false })
      .limit(20);

    const allReferrals = referrals || [];
    const completedReferrals = allReferrals.filter((r: any) => r.status === 'completed');
    const pendingReferrals = allReferrals.filter((r: any) => r.status === 'pending');

    // Get profile referral points
    const { data: profile } = await supabase
      .from('player_profiles')
      .select('referral_points, total_referrals')
      .eq('wallet_address', wallet_address)
      .single();

    // Truncate wallet addresses for privacy in the response
    const recentReferrals = allReferrals.slice(0, 10).map((r: any) => ({
      referred_wallet: r.referred_wallet
        ? r.referred_wallet.slice(0, 4) + '...' + r.referred_wallet.slice(-4)
        : 'Unknown',
      status: r.status,
      points_awarded: r.points_awarded,
      referred_at: r.referred_at,
      completed_at: r.completed_at,
    }));

    return new Response(
      JSON.stringify({
        code,
        referral_url: code ? `${APP_URL}?ref=${code}` : null,
        total_referrals: allReferrals.length,
        completed_referrals: completedReferrals.length,
        pending_referrals: pendingReferrals.length,
        referral_points: (profile as any)?.referral_points ?? 0,
        recent_referrals: recentReferrals,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-referral-stats:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

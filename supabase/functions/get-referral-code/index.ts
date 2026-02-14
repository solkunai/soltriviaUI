// Get Referral Code Edge Function
// Gets or creates a unique referral code for a wallet address.
// Returns the code, shareable URL, and basic referral stats.

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

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
  let code = '';
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
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

    // Check for existing code
    const { data: existing } = await supabase
      .from('referral_codes')
      .select('code')
      .eq('wallet_address', wallet_address)
      .single();

    let code: string;

    if (existing) {
      code = existing.code;
    } else {
      // Generate a new unique code with retry on collision
      let inserted = false;
      let attempts = 0;
      code = generateCode();

      while (!inserted && attempts < 5) {
        const { error: insertError } = await supabase
          .from('referral_codes')
          .insert({ wallet_address, code });

        if (!insertError) {
          inserted = true;
        } else if (insertError.code === '23505') {
          // Unique constraint violation - regenerate
          code = generateCode();
          attempts++;
        } else {
          throw new Error(`Failed to create referral code: ${insertError.message}`);
        }
      }

      if (!inserted) {
        throw new Error('Failed to generate unique referral code after 5 attempts');
      }
    }

    // Get referral stats
    const { count: totalReferrals } = await supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_wallet', wallet_address)
      .eq('status', 'completed');

    const { data: profile } = await supabase
      .from('player_profiles')
      .select('referral_points')
      .eq('wallet_address', wallet_address)
      .single();

    return new Response(
      JSON.stringify({
        code,
        referral_url: `${APP_URL}?ref=${code}`,
        total_referrals: totalReferrals ?? 0,
        referral_points: (profile as any)?.referral_points ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in get-referral-code:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

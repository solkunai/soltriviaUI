// Register Referral Edge Function
// Called when a new wallet connects with a stored referral code.
// Creates a pending referral entry linking referrer to referred user.

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

// Validate Solana public key: must be base58 alphabet, 32-44 chars (32-byte key encoded)
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  for (const char of address) {
    if (!BASE58_CHARS.includes(char)) return false;
  }
  return true;
}

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { wallet_address, referral_code } = await req.json();

    if (!isValidSolanaAddress(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address — must be a valid Solana public key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!referral_code || typeof referral_code !== 'string' || referral_code.length < 4) {
      return new Response(
        JSON.stringify({ error: 'Invalid referral_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const referred_wallet = wallet_address;

    // Look up the referral code to find the referrer
    const { data: codeRow, error: codeError } = await supabase
      .from('referral_codes')
      .select('wallet_address')
      .eq('code', referral_code.toUpperCase())
      .single();

    if (codeError || !codeRow) {
      return new Response(
        JSON.stringify({ error: 'Invalid referral code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const referrer_wallet = codeRow.wallet_address;

    // Prevent self-referral
    if (referrer_wallet === referred_wallet) {
      return new Response(
        JSON.stringify({ error: 'self-referral: cannot refer yourself' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this wallet was already referred
    const { data: existingReferral } = await supabase
      .from('referrals')
      .select('id')
      .eq('referred_wallet', referred_wallet)
      .single();

    if (existingReferral) {
      return new Response(
        JSON.stringify({ success: true, message: 'already been referred' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the pending referral
    const { error: insertError } = await supabase
      .from('referrals')
      .insert({
        referrer_wallet,
        referred_wallet,
        referral_code: referral_code.toUpperCase(),
        status: 'pending',
        points_awarded: 0,
      });

    if (insertError) {
      // Unique constraint violation means already referred
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ success: true, message: 'already been referred' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`Failed to register referral: ${insertError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in register-referral:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

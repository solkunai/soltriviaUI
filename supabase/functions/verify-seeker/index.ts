// Verify Seeker Edge Function
// Verifies Seeker Genesis Token (SGT) ownership via Helius RPC and resolves .skr domain.
// Stores results in player_profiles for use by other functions (XP boost, lives discount, badge).

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

// Seeker Genesis Token constants
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const SGT_MINT_AUTHORITY = 'GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4';

// @ts-ignore - Deno is available at runtime
const HELIUS_RPC_URL = Deno.env.get('HELIUS_RPC_URL');

// Validate Solana public key
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function isValidSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  if (address.length < 32 || address.length > 44) return false;
  for (const char of address) {
    if (!BASE58_CHARS.includes(char)) return false;
  }
  return true;
}

/**
 * Verify SGT ownership via Helius RPC.
 * 1. getTokenAccountsByOwner for Token-2022 program
 * 2. getMultipleAccounts for mint data, check mintAuthority
 */
async function verifySGT(walletAddress: string): Promise<boolean> {
  if (!HELIUS_RPC_URL) {
    console.error('HELIUS_RPC_URL not configured');
    return false;
  }

  // Step 1: Get all Token-2022 token accounts for this wallet
  const tokenAccountsRes = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { programId: TOKEN_2022_PROGRAM },
        { encoding: 'jsonParsed' },
      ],
    }),
  });

  const tokenAccountsData = await tokenAccountsRes.json();
  const accounts = tokenAccountsData?.result?.value || [];

  // Extract mints with balance > 0
  const mints: string[] = [];
  for (const acc of accounts) {
    const info = acc.account?.data?.parsed?.info;
    const amount = Number(info?.tokenAmount?.amount ?? 0);
    if (amount > 0 && info?.mint) {
      mints.push(info.mint);
    }
  }

  if (mints.length === 0) return false;

  // Step 2: Fetch mint accounts and check mintAuthority
  const mintAccountsRes = await fetch(HELIUS_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'getMultipleAccounts',
      params: [mints, { encoding: 'jsonParsed' }],
    }),
  });

  const mintAccountsData = await mintAccountsRes.json();
  const mintAccounts = mintAccountsData?.result?.value || [];

  for (const mintAccount of mintAccounts) {
    if (!mintAccount) continue;
    const mintAuthority = mintAccount?.data?.parsed?.info?.mintAuthority;
    if (mintAuthority === SGT_MINT_AUTHORITY) {
      return true;
    }
  }

  return false;
}

/**
 * Resolve .skr domain for a wallet via AllDomains API.
 * Returns the domain name (without .skr suffix) or null.
 */
async function resolveSkrDomain(walletAddress: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.alldomains.id/domains/${walletAddress}?tld=skr`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.domains && data.domains.length > 0) {
      return data.domains[0].domain;
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { wallet_address } = await req.json();

    if (!isValidSolanaAddress(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if already verified in last 24 hours (rate limit)
    const { data: existingProfile } = await supabase
      .from('player_profiles')
      .select('is_seeker_verified, seeker_verified_at, skr_domain')
      .eq('wallet_address', wallet_address)
      .maybeSingle();

    if (existingProfile?.is_seeker_verified && existingProfile?.seeker_verified_at) {
      const verifiedAt = new Date(existingProfile.seeker_verified_at);
      const hoursSince = (Date.now() - verifiedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) {
        return new Response(
          JSON.stringify({
            is_seeker_verified: true,
            skr_domain: existingProfile.skr_domain,
            seeker_verified_at: existingProfile.seeker_verified_at,
            already_verified: true,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    // Verify SGT ownership and resolve .skr domain in parallel
    const [hasSGT, skrName] = await Promise.all([
      verifySGT(wallet_address),
      resolveSkrDomain(wallet_address),
    ]);

    const now = new Date().toISOString();
    const skrDomain = skrName ? `${skrName}.skr` : null;

    // Build profile update
    const profileUpdate: Record<string, any> = {
      is_seeker_verified: hasSGT,
      seeker_verified_at: now,
      updated_at: now,
    };

    if (skrDomain) {
      profileUpdate.skr_domain = skrDomain;
    }

    // If user has .skr domain, no existing username, and is verified: auto-set username
    if (hasSGT && skrDomain) {
      const { data: currentProfile } = await supabase
        .from('player_profiles')
        .select('username')
        .eq('wallet_address', wallet_address)
        .maybeSingle();

      if (!currentProfile?.username) {
        profileUpdate.username = skrDomain;
        profileUpdate.use_skr_as_display = true;
      }
    }

    // Upsert profile with Seeker data
    await supabase
      .from('player_profiles')
      .upsert(
        { wallet_address, ...profileUpdate },
        { onConflict: 'wallet_address' },
      );

    return new Response(
      JSON.stringify({
        is_seeker_verified: hasSGT,
        skr_domain: skrDomain,
        seeker_verified_at: now,
        already_verified: false,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in verify-seeker:', error);
    return new Response(
      JSON.stringify({ error: 'Verification failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});

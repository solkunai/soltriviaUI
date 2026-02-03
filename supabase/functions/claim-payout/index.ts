// claim-payout Edge Function
// Called when a winner claims their prize
// Returns the amount to pay - actual payment handled by client-side transaction

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

// =====================
// VALIDATION (inlined)
// =====================
function isValidWalletAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

function isValidTxSignature(signature: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature);
}

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();

    const { wallet_address, payout_id, tx_signature } = await req.json();

    // Validate required fields
    if (!wallet_address || !payout_id) {
      return new Response(
        JSON.stringify({ error: 'Missing wallet_address or payout_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate wallet address format
    if (!isValidWalletAddress(wallet_address)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate payout_id format
    if (!isValidUUID(payout_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid payout_id format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate tx_signature if provided
    if (tx_signature && !isValidTxSignature(tx_signature)) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction signature format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the payout
    const { data: payout, error: payoutError } = await supabase
      .from('payouts')
      .select('*, rounds(*)')
      .eq('id', payout_id)
      .eq('wallet_address', wallet_address)
      .single();

    if (payoutError || !payout) {
      return new Response(
        JSON.stringify({ error: 'Payout not found or not yours' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (payout.status === 'claimed') {
      return new Response(
        JSON.stringify({ error: 'Payout already claimed', claimed_at: payout.claimed_at }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If tx_signature provided, mark as claimed
    if (tx_signature) {
      const { error: updateError } = await supabase
        .from('payouts')
        .update({
          status: 'claimed',
          claim_tx_signature: tx_signature,
          claimed_at: new Date().toISOString(),
        })
        .eq('id', payout_id);

      if (updateError) throw updateError;

      // Update player's total winnings using RPC function
      const { error: rpcError } = await supabase.rpc('add_player_winnings', {
        p_wallet_address: wallet_address,
        p_amount: payout.amount_lamports,
      });

      // If RPC fails, try direct update as fallback
      if (rpcError) {
        console.error('RPC add_player_winnings failed, trying direct update:', rpcError);

        // Get current winnings first
        const { data: player } = await supabase
          .from('players')
          .select('total_winnings_lamports, games_won')
          .eq('wallet_address', wallet_address)
          .single();

        if (player) {
          await supabase
            .from('players')
            .update({
              total_winnings_lamports: (player.total_winnings_lamports || 0) + payout.amount_lamports,
              games_won: (player.games_won || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('wallet_address', wallet_address);
        }
      }

      // Record treasury transaction
      await supabase.from('treasury_transactions').insert({
        round_id: payout.round_id,
        type: 'payout',
        amount_lamports: -payout.amount_lamports,
        wallet_address,
        tx_signature,
      });

      return new Response(
        JSON.stringify({
          success: true,
          status: 'claimed',
          amount_lamports: payout.amount_lamports,
          amount_sol: (payout.amount_lamports / 1_000_000_000).toFixed(4),
          tx_signature,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return payout info for claiming
    return new Response(
      JSON.stringify({
        payout_id: payout.id,
        round_id: payout.round_id,
        round_number: payout.rounds.round_number,
        rank: payout.rank,
        amount_lamports: payout.amount_lamports,
        amount_sol: (payout.amount_lamports / 1_000_000_000).toFixed(4),
        percentage: payout.percentage,
        status: payout.status,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

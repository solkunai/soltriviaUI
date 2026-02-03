// claim-payout Edge Function
// Called when a winner claims their prize
// Returns the amount to pay - actual payment handled by client-side transaction

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';
import { isValidWalletAddress, isValidUUID, isValidTxSignature } from '../_shared/validation.ts';

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

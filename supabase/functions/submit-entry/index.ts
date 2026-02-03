// submit-entry Edge Function
// Called when a player pays entry fee and joins a round

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';
import { isValidWalletAddress, isValidTxSignature, sanitizeString } from '../_shared/validation.ts';

const ENTRY_FEE_LAMPORTS = 10_000_000; // 0.01 SOL

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

    const { wallet_address, tx_signature, display_name, avatar } = await req.json();

    // Validate required fields
    if (!wallet_address || !tx_signature) {
      return new Response(
        JSON.stringify({ error: 'Missing wallet_address or tx_signature' }),
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

    // Validate tx signature format
    if (!isValidTxSignature(tx_signature)) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction signature format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize optional fields
    const sanitizedDisplayName = display_name ? sanitizeString(display_name, 50) : null;
    const sanitizedAvatar = avatar ? sanitizeString(avatar, 10) : '🎮';

    // Get or create player
    let { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('wallet_address', wallet_address)
      .single();

    if (!player) {
      const { data: newPlayer, error: createError } = await supabase
        .from('players')
        .insert({
          wallet_address,
          display_name: sanitizedDisplayName,
          avatar: sanitizedAvatar,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      player = newPlayer;
    }

    // Get current active round
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('status', 'active')
      .lte('starts_at', new Date().toISOString())
      .gte('ends_at', new Date().toISOString())
      .limit(1);

    let round = rounds?.[0];

    // If no active round, create one
    if (!round) {
      const now = new Date();
      const roundHour = Math.floor(now.getUTCHours() / 6) * 6;
      const startsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), roundHour, 0, 0));
      const endsAt = new Date(startsAt.getTime() + 6 * 60 * 60 * 1000);

      // Calculate round number (rounds since epoch, 6 hours each)
      const roundNumber = Math.floor(startsAt.getTime() / (6 * 60 * 60 * 1000));

      const { data: newRound, error: roundError } = await supabase
        .from('rounds')
        .insert({
          round_number: roundNumber,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          pot_lamports: 0,
          entry_count: 0,
        })
        .select()
        .single();

      if (roundError) throw roundError;
      round = newRound;
    }

    // Check if player already entered this round
    const { data: existingSession } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('round_id', round.id)
      .eq('wallet_address', wallet_address)
      .single();

    if (existingSession) {
      return new Response(
        JSON.stringify({ error: 'Already entered this round', session_id: existingSession.id }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create game session
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        round_id: round.id,
        player_id: player.id,
        wallet_address,
        entry_tx_signature: tx_signature,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Update round pot and entry count
    await supabase
      .from('rounds')
      .update({
        pot_lamports: round.pot_lamports + ENTRY_FEE_LAMPORTS,
        entry_count: round.entry_count + 1,
      })
      .eq('id', round.id);

    // Record treasury transaction
    await supabase
      .from('treasury_transactions')
      .insert({
        round_id: round.id,
        type: 'entry_fee',
        amount_lamports: ENTRY_FEE_LAMPORTS,
        wallet_address,
        tx_signature,
      });

    return new Response(
      JSON.stringify({
        success: true,
        session_id: session.id,
        round_id: round.id,
        round_ends_at: round.ends_at,
        pot_lamports: round.pot_lamports + ENTRY_FEE_LAMPORTS,
        entry_count: round.entry_count + 1,
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

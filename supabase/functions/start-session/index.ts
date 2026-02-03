// Supabase Edge Function: start-session
// Creates a new game session after verifying entry fee payment

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';
import { isValidWalletAddress, isValidTxSignature } from '../_shared/validation.ts';

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

    const { wallet_address, entry_tx_signature } = await req.json();

    if (!wallet_address || !entry_tx_signature) {
      return new Response(
        JSON.stringify({ error: 'wallet_address and entry_tx_signature required' }),
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

    // Validate tx signature format (base58, 87-88 chars for Solana signatures)
    const txSigRegex = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;
    if (!txSigRegex.test(entry_tx_signature)) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction signature format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get current round (4 rounds per day, every 6 hours)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getUTCHours();
    const roundNumber = Math.floor(currentHour / 6); // 0-3

    // Get or create current round
    let { data: round, error: roundError } = await supabase
      .from('daily_rounds')
      .select('*')
      .eq('date', today)
      .eq('round_number', roundNumber)
      .single();

    if (roundError && roundError.code === 'PGRST116') {
      // Round doesn't exist, create it with random questions
      const { data: questions } = await supabase
        .from('questions')
        .select('id')
        .eq('active', true)
        .limit(100);

      if (!questions || questions.length < 10) {
        return new Response(
          JSON.stringify({ error: 'Not enough questions in database' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Shuffle and pick 10
      const shuffled = questions.sort(() => Math.random() - 0.5);
      const questionIds = shuffled.slice(0, 10).map(q => q.id);

      const { data: newRound, error: createError } = await supabase
        .from('daily_rounds')
        .insert({ 
          date: today, 
          round_number: roundNumber,
          question_ids: questionIds 
        })
        .select()
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create round', details: createError }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      round = newRound;
    } else if (roundError) {
      return new Response(
        JSON.stringify({ error: 'Database error', details: roundError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if player already played today
    const { data: existingSession } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('round_id', round.id)
      .eq('wallet_address', wallet_address)
      .single();

    if (existingSession) {
      return new Response(
        JSON.stringify({ error: 'Already played today', session_id: existingSession.id }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new session
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        round_id: round.id,
        wallet_address,
        entry_tx_signature,
      })
      .select()
      .single();

    if (sessionError) {
      return new Response(
        JSON.stringify({ error: 'Failed to create session', details: sessionError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Increment pot and player count
    await supabase
      .from('daily_rounds')
      .update({
        pot_lamports: round.pot_lamports + 10_000_000, // 0.01 SOL
        player_count: round.player_count + 1,
      })
      .eq('id', round.id);

    return new Response(
      JSON.stringify({
        session_id: session.id,
        round_id: round.id,
        pot_lamports: round.pot_lamports + 10_000_000,
        player_count: round.player_count + 1,
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

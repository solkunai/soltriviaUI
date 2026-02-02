// end-round Edge Function
// Called automatically when a round ends (via cron or manually)
// Calculates rankings and creates payout records for top 5

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Payout percentages (must sum to 0.95 for players, 0.05 for treasury)
const PAYOUT_SPLITS = [0.75, 0.05, 0.05, 0.05, 0.05]; // 1st: 75%, 2nd-5th: 5% each
const PLATFORM_FEE = 0.05; // 5% goes to treasury
const MIN_PLAYERS = 5;
const TREASURY_WALLET = '4u1UTyMBX8ghSQBagZHCzArt32XMFSw4CUXbdgo2Cv74';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { round_id } = await req.json().catch(() => ({}));

    // Get the round to process (either specific or most recent ended)
    let roundQuery = supabase
      .from('rounds')
      .select('*')
      .eq('status', 'active');

    if (round_id) {
      roundQuery = roundQuery.eq('id', round_id);
    } else {
      roundQuery = roundQuery.lt('ends_at', new Date().toISOString());
    }

    const { data: rounds, error: roundError } = await roundQuery.limit(1);

    if (roundError) throw roundError;
    if (!rounds || rounds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No rounds to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const round = rounds[0];

    // Get all completed game sessions for this round, ordered by score
    const { data: sessions, error: sessionsError } = await supabase
      .from('game_sessions')
      .select('*, players(wallet_address, display_name)')
      .eq('round_id', round.id)
      .not('completed_at', 'is', null)
      .order('score', { ascending: false })
      .order('time_taken_ms', { ascending: true });

    if (sessionsError) throw sessionsError;

    const playerCount = sessions?.length || 0;

    // Check if minimum players requirement is met
    if (playerCount < MIN_PLAYERS) {
      // Mark round as refunded - entries will need to be refunded manually or via claim
      await supabase
        .from('rounds')
        .update({ status: 'refunded' })
        .eq('id', round.id);

      // Create refund payouts for all participants
      const refundPayouts = sessions?.map((session, index) => ({
        round_id: round.id,
        player_id: session.player_id,
        wallet_address: session.wallet_address,
        rank: index + 1,
        amount_lamports: 10_000_000, // Refund entry fee
        percentage: 0,
        status: 'pending',
      })) || [];

      if (refundPayouts.length > 0) {
        await supabase.from('payouts').insert(refundPayouts);
      }

      return new Response(
        JSON.stringify({
          success: true,
          status: 'refunded',
          message: `Round refunded: only ${playerCount} players (minimum ${MIN_PLAYERS} required)`,
          player_count: playerCount,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate rankings
    const rankedSessions = sessions?.map((session, index) => ({
      ...session,
      rank: index + 1,
    })) || [];

    // Update rankings in database
    for (const session of rankedSessions) {
      await supabase
        .from('game_sessions')
        .update({ rank: session.rank })
        .eq('id', session.id);
    }

    // Calculate payouts for top 5
    const pot = round.pot_lamports;
    const platformFee = Math.floor(pot * PLATFORM_FEE);
    const prizePool = pot - platformFee;

    const payouts = [];
    const top5 = rankedSessions.slice(0, 5);

    for (let i = 0; i < top5.length; i++) {
      const session = top5[i];
      const percentage = PAYOUT_SPLITS[i];
      const amount = Math.floor(prizePool * percentage);

      payouts.push({
        round_id: round.id,
        player_id: session.player_id,
        wallet_address: session.wallet_address,
        rank: i + 1,
        amount_lamports: amount,
        percentage: percentage * 100,
        status: 'pending',
      });
    }

    // Insert payouts
    if (payouts.length > 0) {
      const { error: payoutError } = await supabase
        .from('payouts')
        .insert(payouts);

      if (payoutError) throw payoutError;
    }

    // Record platform fee
    await supabase.from('treasury_transactions').insert({
      round_id: round.id,
      type: 'platform_fee',
      amount_lamports: platformFee,
      wallet_address: TREASURY_WALLET,
    });

    // Update round status
    await supabase
      .from('rounds')
      .update({ status: 'ended' })
      .eq('id', round.id);

    // Update player stats for all participants
    for (const session of rankedSessions) {
      const isWinner = session.rank <= 5;
      await supabase.rpc('increment_player_stats', {
        p_player_id: session.player_id,
        p_is_winner: isWinner,
      }).catch(() => {
        // Fallback if RPC doesn't exist
        console.log('RPC increment_player_stats not found, skipping stats update');
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: 'ended',
        round_id: round.id,
        player_count: playerCount,
        pot_lamports: pot,
        platform_fee_lamports: platformFee,
        prize_pool_lamports: prizePool,
        payouts: payouts.map((p) => ({
          rank: p.rank,
          wallet: p.wallet_address.slice(0, 4) + '...' + p.wallet_address.slice(-4),
          amount_sol: (p.amount_lamports / 1_000_000_000).toFixed(4),
          percentage: p.percentage + '%',
        })),
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

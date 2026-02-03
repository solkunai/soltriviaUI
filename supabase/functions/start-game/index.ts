// Start Game Edge Function
// Creates a new game session for a wallet address
// Validates entry fee transaction before allowing play

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
import { Connection, PublicKey } from 'https://esm.sh/@solana/web3.js@1.95.2';
import { decode as decodeBase64 } from 'https://deno.land/std@0.177.0/encoding/base64.ts';
import * as base58 from 'https://esm.sh/bs58@5.0.0';

// Get values from environment variables (set in Supabase dashboard)
const ENTRY_FEE_LAMPORTS = parseInt(Deno.env.get('ENTRY_FEE_LAMPORTS') || '20000000', 10); // 0.02 SOL entry fee
const TXN_FEE_LAMPORTS = parseInt(Deno.env.get('TXN_FEE_LAMPORTS') || '2500000', 10); // 0.0025 SOL transaction fee
const PRIZE_POOL_WALLET = Deno.env.get('PRIZE_POOL_WALLET') || 'C9U6pL7FcroUBcSGQR2iCEGmAydVjzEE7ZYaJuVJuEEo'; // Entry fees (0.02 SOL) go here
const REVENUE_WALLET = Deno.env.get('REVENUE_WALLET') || '4u1UTyMBX8ghSQBagZHCzArt32XMFSw4CUXbdgo2Cv74'; // Transaction fees (0.0025 SOL) and lives purchases (0.03 SOL)
const EXPECTED_PRIZE_POOL_AMOUNT = ENTRY_FEE_LAMPORTS; // 0.02 SOL
const EXPECTED_REVENUE_AMOUNT = TXN_FEE_LAMPORTS; // 0.0025 SOL
const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';

// ──────────────────────────────────────────────────────────────────────────────
// TESTING MODE: Set to true to allow unlimited plays per wallet per round
// Set to false before deploying to production!
// ──────────────────────────────────────────────────────────────────────────────
const TESTING_MODE = false;

interface StartGameRequest {
  walletAddress: string;
  entryTxSignature: string;
}

// Validate Solana address format
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Convert base64 signature to base58 (MWA returns base64, Solana RPC expects base58)
function convertSignatureToBase58(signature: string): string {
  try {
    // Try to decode as base64 first
    const decoded = decodeBase64(signature);
    return base58.encode(decoded);
  } catch {
    // If it fails, assume it's already base58
    return signature;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { walletAddress, entryTxSignature }: StartGameRequest = await req.json();

    // Input validation
    if (!walletAddress || !entryTxSignature) {
      return new Response(
        JSON.stringify({ error: 'walletAddress and entryTxSignature are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate address format
    if (!isValidSolanaAddress(walletAddress)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert signature to base58 (MWA sends base64, Solana expects base58)
    const base58Signature = convertSignatureToBase58(entryTxSignature);

    // 🔒 CRITICAL SECURITY: Verify entry fee transaction on-chain
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    let transaction;
    try {
      transaction = await connection.getTransaction(base58Signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Failed to verify transaction on-chain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify transaction exists and succeeded
    if (!transaction || transaction.meta?.err) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found or failed on-chain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the payment details - must have TWO transfers:
    // 1. 0.02 SOL to PRIZE_POOL_WALLET (entry fee)
    // 2. 0.0025 SOL to REVENUE_WALLET (transaction fee)
    const instructions = transaction.transaction.message.instructions;
    if (!instructions || instructions.length < 2) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction: expected 2 transfers (entry fee + transaction fee)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountKeys = transaction.transaction.message.staticAccountKeys ||
                       transaction.transaction.message.accountKeys;

    let prizePoolVerified = false;
    let revenueVerified = false;
    let senderVerified = false;

    for (const instruction of instructions) {
      // SystemProgram.transfer has programIdIndex 0
      if (instruction.programIdIndex === 0) {
        const accounts = instruction.accounts;
        if (accounts && accounts.length >= 2) {
          const fromIndex = accounts[0];
          const toIndex = accounts[1];

          const fromPubkey = accountKeys[fromIndex];
          const toPubkey = accountKeys[toIndex];

          // Verify sender matches claimed wallet address
          if (fromPubkey.toString() === walletAddress) {
            senderVerified = true;

            // Get the amount from instruction data
            const data = instruction.data;
            if (data && data.length >= 12) {
              const view = new DataView(new Uint8Array(data).buffer);
              const lamports = Number(view.getBigUint64(4, true));

              // Check if this is the prize pool transfer (0.02 SOL entry fee)
              if (toPubkey.toString() === PRIZE_POOL_WALLET && lamports === EXPECTED_PRIZE_POOL_AMOUNT) {
                prizePoolVerified = true;
              }

              // Check if this is the revenue transfer (0.0025 SOL transaction fee)
              if (toPubkey.toString() === REVENUE_WALLET && lamports === EXPECTED_REVENUE_AMOUNT) {
                revenueVerified = true;
              }
            }
          }
        }
      }
    }

    if (!prizePoolVerified || !revenueVerified || !senderVerified) {
      return new Response(
        JSON.stringify({
          error: 'Transaction verification failed: invalid amount, sender, or recipients'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get or create current round (4 rounds per day, every 6 hours)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getUTCHours();
    const roundNumber = Math.floor(currentHour / 6); // 0-3 (00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-00:00)

    // Query for round with date and round_number
    let { data: round, error: roundError } = await supabase
      .from('daily_rounds')
      .select('id, question_ids, status, player_count, pot_lamports, round_number')
      .eq('date', today)
      .eq('round_number', roundNumber)
      .single();

    if (roundError || !round) {
      // Create today's round with random questions
      const { data: questions, error: qError } = await supabase
        .from('questions')
        .select('id')
        .eq('active', true);

      if (qError || !questions || questions.length < 10) {
        return new Response(
          JSON.stringify({ error: 'Not enough questions available' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Shuffle and pick 10 random questions
      const shuffled = questions.sort(() => Math.random() - 0.5);
      const questionIds = shuffled.slice(0, 10).map((q) => q.id);

      const { data: newRound, error: createError } = await supabase
        .from('daily_rounds')
        .insert({ 
          date: today, 
          round_number: roundNumber,
          question_ids: questionIds 
        })
        .select('id, question_ids, status, player_count, pot_lamports, round_number')
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create round' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      round = newRound;
    }

    if (round.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Round is not active' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if player already played this round (check for ANY finished session in this specific round)
    const { data: existingSessions } = await supabase
      .from('game_sessions')
      .select('id, finished_at')
      .eq('round_id', round.id)
      .eq('wallet_address', walletAddress);

    // Check if there's an unfinished session to resume
    const unfinishedSession = existingSessions?.find(s => !s.finished_at);
    if (unfinishedSession) {
      // Resume existing unfinished session
      return new Response(
        JSON.stringify({
          sessionId: unfinishedSession.id,
          roundId: round.id,
          totalQuestions: 10,
          resumed: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if player has any finished session today
    const hasFinishedSession = existingSessions?.some(s => s.finished_at);

    if (hasFinishedSession) {
      // TESTING MODE: Allow unlimited plays
      if (TESTING_MODE) {
        // Continue to create new session below
      } else {
        // PRODUCTION MODE: Check for extra lives
        const { data: playerLives } = await supabase
          .from('player_lives')
          .select('lives_count, total_used')
          .eq('wallet_address', walletAddress)
          .single();

        const livesCount = playerLives?.lives_count || 0;

        if (livesCount <= 0) {
          // No lives available - return error with info
          return new Response(
            JSON.stringify({
              error: 'Already played today',
              code: 'ALREADY_PLAYED',
              canBuyLives: true,
              livesCount: 0,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Deduct one life
        const { error: deductError } = await supabase
          .from('player_lives')
          .update({
            lives_count: livesCount - 1,
            total_used: (playerLives?.total_used || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('wallet_address', walletAddress);

        if (deductError) {
          return new Response(
            JSON.stringify({ error: 'Failed to use extra life' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Create session with life_used flag
        const { data: session, error: sessionError } = await supabase
          .from('game_sessions')
          .insert({
            round_id: round.id,
            wallet_address: walletAddress,
            entry_tx_signature: entryTxSignature,
            current_question_index: 0,
            life_used: true,
          })
          .select('id')
          .single();

        if (sessionError) {
          return new Response(
            JSON.stringify({ error: 'Failed to create session' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update round player count and pot (only prize pool portion)
        await supabase
          .from('daily_rounds')
          .update({
            player_count: round.player_count + 1,
            pot_lamports: (round.pot_lamports || 0) + EXPECTED_PRIZE_POOL_AMOUNT,
          })
          .eq('id', round.id);

        return new Response(
          JSON.stringify({
            sessionId: session.id,
            roundId: round.id,
            totalQuestions: 10,
            resumed: false,
            lifeUsed: true,
            livesRemaining: livesCount - 1,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Deduct 1 life from player (check if they have lives)
    const { data: playerLives, error: livesError } = await supabase
      .from('player_lives')
      .select('lives_count, total_used')
      .eq('wallet_address', walletAddress)
      .single();

    if (livesError && livesError.code !== 'PGRST116') {
      console.error('Error checking player lives:', livesError);
      return new Response(
        JSON.stringify({ error: 'Failed to check lives' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify player has at least 1 life
    const currentLivesCount = playerLives?.lives_count || 0;
    if (currentLivesCount < 1) {
      return new Response(
        JSON.stringify({ error: 'Insufficient lives. Please purchase lives to continue.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct 1 life
    const { error: deductError } = await supabase
      .from('player_lives')
      .update({
        lives_count: currentLivesCount - 1,
        total_used: (playerLives?.total_used || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', walletAddress);

    if (deductError) {
      console.error('Error deducting life:', deductError);
      return new Response(
        JSON.stringify({ error: 'Failed to deduct life' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new game session
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        round_id: round.id,
        wallet_address: walletAddress,
        entry_tx_signature: entryTxSignature,
        current_question_index: 0,
      })
      .select('id')
      .single();

    if (sessionError) {
      // If session creation fails, refund the life
      await supabase
        .from('player_lives')
        .update({
          lives_count: currentLivesCount,
          total_used: playerLives?.total_used || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('wallet_address', walletAddress);

      return new Response(
        JSON.stringify({ error: 'Failed to create session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record daily activity for streak tracking
    await supabase.rpc('record_daily_activity', {
      p_wallet_address: walletAddress,
      p_activity_type: 'game'
    });

    // Update round player count and pot (only prize pool portion)
    await supabase
      .from('daily_rounds')
      .update({
        player_count: round.player_count + 1,
        pot_lamports: (round.pot_lamports || 0) + EXPECTED_PRIZE_POOL_AMOUNT,
      })
      .eq('id', round.id);

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        roundId: round.id,
        totalQuestions: 10,
        resumed: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

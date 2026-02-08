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

// Entry caps to prevent leaderboard manipulation
const MAX_ENTRIES_PER_ROUND = 5;
const MAX_ENTRIES_PER_24H = 20;

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

// Shuffle array (Fisher–Yates); returns new array so each session gets random question order
function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Select random questions from pool (prevents same questions on replay)
// If pool has more than count questions, randomly select count questions
// Otherwise, shuffle all available questions
function selectRandomQuestions<T>(pool: T[], count: number = 10): T[] {
  if (!Array.isArray(pool) || pool.length === 0) {
    return [];
  }
  
  // If pool is small, just shuffle everything
  if (pool.length <= count) {
    return shuffle(pool);
  }
  
  // Pool is large - randomly select 'count' unique questions
  const shuffled = shuffle(pool);
  return shuffled.slice(0, count);
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

    // Verify the payment details using BALANCE CHANGES (more reliable)
    // Must have TWO transfers:
    // 1. 0.02 SOL to PRIZE_POOL_WALLET (entry fee)
    // 2. 0.0025 SOL to REVENUE_WALLET (transaction fee)
    
    console.log('Verifying transaction using balance changes...');
    
    const accountKeys = transaction.transaction.message.staticAccountKeys ||
                       transaction.transaction.message.accountKeys;
                       
    if (!accountKeys || accountKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction: no account keys found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const meta = transaction.meta;
    if (!meta || !meta.postBalances || !meta.preBalances) {
      return new Response(
        JSON.stringify({ error: 'Transaction missing balance information' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transaction meta:', {
      preBalances: meta.preBalances,
      postBalances: meta.postBalances,
      accountKeys: accountKeys.map((k: any) => k.toString()),
    });

    // Find indices of sender, prize pool, and revenue wallets
    let senderIndex = -1;
    let prizePoolIndex = -1;
    let revenueIndex = -1;
    
    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys[i].toString();
      if (key === walletAddress) senderIndex = i;
      if (key === PRIZE_POOL_WALLET) prizePoolIndex = i;
      if (key === REVENUE_WALLET) revenueIndex = i;
    }

    console.log('Account indices:', { senderIndex, prizePoolIndex, revenueIndex });

    if (senderIndex === -1) {
      return new Response(
        JSON.stringify({ 
          error: 'Sender wallet not found in transaction',
          details: { expectedSender: walletAddress }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prizePoolIndex === -1 || revenueIndex === -1) {
      return new Response(
        JSON.stringify({ 
          error: 'Prize pool or revenue wallet not found in transaction',
          details: { 
            expectedPrizePool: PRIZE_POOL_WALLET,
            expectedRevenue: REVENUE_WALLET,
            foundPrizePool: prizePoolIndex !== -1,
            foundRevenue: revenueIndex !== -1,
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate actual transfer amounts from balance changes
    const prizePoolChange = meta.postBalances[prizePoolIndex] - meta.preBalances[prizePoolIndex];
    const revenueChange = meta.postBalances[revenueIndex] - meta.preBalances[revenueIndex];
    
    console.log('Balance changes:', {
      prizePool: {
        pre: meta.preBalances[prizePoolIndex],
        post: meta.postBalances[prizePoolIndex],
        change: prizePoolChange,
        expected: EXPECTED_PRIZE_POOL_AMOUNT,
      },
      revenue: {
        pre: meta.preBalances[revenueIndex],
        post: meta.postBalances[revenueIndex],
        change: revenueChange,
        expected: EXPECTED_REVENUE_AMOUNT,
      },
    });

    // Verify both amounts match exactly
    const prizePoolVerified = prizePoolChange === EXPECTED_PRIZE_POOL_AMOUNT;
    const revenueVerified = revenueChange === EXPECTED_REVENUE_AMOUNT;

    if (!prizePoolVerified || !revenueVerified) {
      console.error('❌ Payment verification failed');
      return new Response(
        JSON.stringify({
          error: 'Payment verification failed: Invalid amounts or recipients',
          details: {
            prizePool: {
              expected: EXPECTED_PRIZE_POOL_AMOUNT,
              actual: prizePoolChange,
              verified: prizePoolVerified,
            },
            revenue: {
              expected: EXPECTED_REVENUE_AMOUNT,
              actual: revenueChange,
              verified: revenueVerified,
            },
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Payment verification passed');

    // Get or create current round (4 rounds per day, every 6 hours)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentHour = now.getUTCHours();
    const roundNumber = Math.floor(currentHour / 6); // 0-3 (00:00-06:00, 06:00-12:00, 12:00-18:00, 18:00-00:00)

    // Query for round with date and round_number
    let { data: round, error: roundError } = await supabase
      .from('daily_rounds')
      .select('id, question_ids, status, player_count, pot_lamports, round_number, question_ids_updated_at')
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

      const questionIds = selectRandomQuestions(questions.map((q) => q.id), 10);
      const nowIso = new Date().toISOString();

      const { data: newRound, error: createError } = await supabase
        .from('daily_rounds')
        .insert({
          date: today,
          round_number: roundNumber,
          question_ids: questionIds,
          question_ids_updated_at: nowIso,
        })
        .select('id, question_ids, status, player_count, pot_lamports, round_number, question_ids_updated_at')
        .single();

      if (createError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create round' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      round = newRound;
    }

    // Full pool of active question ids: used for 2-min rotation and per-session random 10
    let fullPoolIds: string[] = [];
    const { data: activeQuestions, error: activeQError } = await supabase
      .from('questions')
      .select('id')
      .eq('active', true);

    if (activeQError || !activeQuestions || activeQuestions.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Not enough questions available' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    fullPoolIds = activeQuestions.map((q) => q.id);

    // 24-hour question dedup: fetch question IDs this wallet has seen in the last 24 hours
    // so they get fresh questions on replay. Falls back to full pool if not enough unseen.
    let unseenPoolIds = fullPoolIds;
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentSessions } = await supabase
        .from('game_sessions')
        .select('question_order')
        .eq('wallet_address', walletAddress)
        .gte('created_at', twentyFourHoursAgo);

      if (recentSessions && recentSessions.length > 0) {
        const seenIds = new Set<string>();
        for (const s of recentSessions) {
          if (Array.isArray(s.question_order)) {
            for (const qid of s.question_order) {
              seenIds.add(qid);
            }
          }
        }
        if (seenIds.size > 0) {
          const filtered = fullPoolIds.filter((id) => !seenIds.has(id));
          // Only use filtered pool if it has enough questions (at least 10)
          if (filtered.length >= 10) {
            unseenPoolIds = filtered;
            console.log(`24h dedup: ${seenIds.size} seen, ${filtered.length} unseen available for ${walletAddress}`);
          } else {
            console.log(`24h dedup: only ${filtered.length} unseen (need 10), using full pool for ${walletAddress}`);
          }
        }
      }
    } catch (dedupErr) {
      console.error('24h dedup query failed, using full pool:', dedupErr);
    }

    // Rotate round question pool every 2 minutes (so the round's default pool stays fresh)
    const TWO_MINS_MS = 2 * 60 * 1000;
    const updatedAt = round.question_ids_updated_at ? new Date(round.question_ids_updated_at).getTime() : 0;
    if (Date.now() - updatedAt > TWO_MINS_MS) {
      const newRoundQuestionIds = selectRandomQuestions([...fullPoolIds], 10);
      await supabase
        .from('daily_rounds')
        .update({
          question_ids: newRoundQuestionIds,
          question_ids_updated_at: new Date().toISOString(),
        })
        .eq('id', round.id);
      round = { ...round, question_ids: newRoundQuestionIds, question_ids_updated_at: new Date().toISOString() };
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

    // --- ENTRY CAP CHECKS (anti-manipulation) ---
    if (!TESTING_MODE) {
      // Per-round cap: count finished sessions in this round
      const entriesThisRound = existingSessions?.filter(s => s.finished_at).length || 0;
      console.log('Entry cap check:', { walletAddress, entriesThisRound, maxPerRound: MAX_ENTRIES_PER_ROUND });

      if (entriesThisRound >= MAX_ENTRIES_PER_ROUND) {
        return new Response(
          JSON.stringify({
            error: `Maximum ${MAX_ENTRIES_PER_ROUND} entries per round reached. Try again next round!`,
            code: 'ROUND_CAP_REACHED',
            entriesThisRound,
            maxPerRound: MAX_ENTRIES_PER_ROUND,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Per-24h cap: count all finished sessions in last 24 hours
      const twentyFourHoursAgoForCap = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: dailyCount, error: dailyCapError } = await supabase
        .from('game_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('wallet_address', walletAddress)
        .gte('created_at', twentyFourHoursAgoForCap)
        .not('finished_at', 'is', null);

      if (dailyCapError) {
        console.error('Error checking daily entry cap:', dailyCapError);
      }

      const entriesLast24h = dailyCount || 0;
      console.log('Daily cap check:', { walletAddress, entriesLast24h, maxPer24h: MAX_ENTRIES_PER_24H });

      if (entriesLast24h >= MAX_ENTRIES_PER_24H) {
        return new Response(
          JSON.stringify({
            error: `Maximum ${MAX_ENTRIES_PER_24H} entries per 24 hours reached. Please try again later!`,
            code: 'DAILY_CAP_REACHED',
            entriesLast24h,
            maxPer24h: MAX_ENTRIES_PER_24H,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // --- FREE ENTRIES + PURCHASED LIVES ---
    // Every wallet gets 2 free entries per round. Beyond that, purchased lives are required.
    const FREE_ENTRIES_PER_ROUND = 2;
    const entriesThisRound = existingSessions?.filter(s => s.finished_at).length || 0;
    const isFreeEntry = TESTING_MODE || entriesThisRound < FREE_ENTRIES_PER_ROUND;

    console.log('Entry type:', {
      walletAddress,
      entriesThisRound,
      freeEntriesPerRound: FREE_ENTRIES_PER_ROUND,
      isFreeEntry,
      testingMode: TESTING_MODE,
    });

    // Ensure player_lives record exists
    let { data: playerLives, error: livesError } = await supabase
      .from('player_lives')
      .select('lives_count, total_used')
      .eq('wallet_address', walletAddress)
      .single();

    if (livesError && livesError.code === 'PGRST116') {
      // New player — create lives record with 0 purchased lives
      console.log('New player, creating lives record:', walletAddress);
      const { data: newLives, error: createError } = await supabase
        .from('player_lives')
        .insert({ wallet_address: walletAddress, lives_count: 0, total_used: 0 })
        .select('lives_count, total_used')
        .single();

      if (createError) {
        console.error('Error creating player lives:', createError);
        return new Response(
          JSON.stringify({ error: 'Failed to initialize lives' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      playerLives = newLives;
    } else if (livesError) {
      console.error('Error checking player lives:', livesError);
      return new Response(
        JSON.stringify({ error: 'Failed to check lives' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const livesCount = playerLives?.lives_count || 0;

    // If not a free entry, require and deduct a purchased life
    if (!isFreeEntry) {
      if (livesCount <= 0) {
        return new Response(
          JSON.stringify({
            error: 'Free entries used! Purchase lives for more plays this round.',
            code: 'NO_LIVES',
            canBuyLives: true,
            livesCount: 0,
            freeEntriesUsed: entriesThisRound,
            freeEntriesPerRound: FREE_ENTRIES_PER_ROUND,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Deduct one purchased life
      console.log('Deducting 1 purchased life:', { before: livesCount, after: livesCount - 1 });
      const { error: deductError } = await supabase
        .from('player_lives')
        .update({
          lives_count: livesCount - 1,
          total_used: (playerLives?.total_used || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('wallet_address', walletAddress);

      if (deductError) {
        console.error('Error deducting life:', deductError);
        return new Response(
          JSON.stringify({ error: 'Failed to use extra life' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log(isFreeEntry
      ? `✅ Free entry ${entriesThisRound + 1}/${FREE_ENTRIES_PER_ROUND} for ${walletAddress}`
      : `✅ Purchased life used. Remaining: ${livesCount - 1}`
    );

    // Create game session
    const questionOrder = selectRandomQuestions(unseenPoolIds, 10);
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .insert({
        round_id: round.id,
        wallet_address: walletAddress,
        entry_tx_signature: entryTxSignature,
        current_question_index: 0,
        life_used: !isFreeEntry,
        question_order: questionOrder.length ? questionOrder : null,
      })
      .select('id')
      .single();

    if (sessionError) {
      // Refund purchased life if session creation fails
      if (!isFreeEntry) {
        await supabase
          .from('player_lives')
          .update({
            lives_count: livesCount,
            total_used: playerLives?.total_used || 0,
            updated_at: new Date().toISOString(),
          })
          .eq('wallet_address', walletAddress);
      }

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
        freeEntry: isFreeEntry,
        freeEntriesRemaining: isFreeEntry ? FREE_ENTRIES_PER_ROUND - entriesThisRound - 1 : 0,
        ...(isFreeEntry ? {} : { lifeUsed: true, livesRemaining: livesCount - 1 }),
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

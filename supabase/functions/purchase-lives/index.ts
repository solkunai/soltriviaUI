// Purchase Lives Edge Function
// Validates payment and adds extra lives to player account

// @ts-ignore - Deno URL imports are valid at runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import { Connection, PublicKey } from 'https://esm.sh/@solana/web3.js@1.95.2';
// @ts-ignore - Deno URL imports are valid at runtime
import { decode as decodeBase64 } from 'https://deno.land/std@0.177.0/encoding/base64.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import * as base58 from 'https://esm.sh/bs58@5.0.0';

// =====================
// CONFIG (from environment variables)
// =====================
// Lives purchase tiers: all payments go to revenue wallet
const LIVES_TIERS: Record<string, { lives: number; lamports: number }> = {
  basic: { lives: 3, lamports: 30_000_000 },   // 0.03 SOL
  value: { lives: 15, lamports: 100_000_000 },  // 0.1 SOL
  bulk:  { lives: 35, lamports: 250_000_000 },  // 0.25 SOL
};
const SEEKER_LIVES_TIERS: Record<string, { lives: number; lamports: number }> = {
  basic: { lives: 3, lamports: 20_000_000 },   // 0.02 SOL
  value: { lives: 15, lamports: 80_000_000 },   // 0.08 SOL
  bulk:  { lives: 35, lamports: 200_000_000 },  // 0.2 SOL
};
const DEFAULT_TIER = 'basic';
const REVENUE_WALLET = Deno.env.get('REVENUE_WALLET') || '4u1UTyMBX8ghSQBagZHCzArt32XMFSw4CUXbdgo2Cv74';
const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';

// =====================
// TYPES
// =====================
interface PurchaseLivesRequest {
  walletAddress: string;
  txSignature: string;
  tier?: string; // 'basic' | 'value' | 'bulk' — defaults to 'basic'
}

// =====================
// HELPERS
// =====================
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Convert base64 → base58 (MWA compatibility)
function convertSignatureToBase58(signature: string): string {
  try {
    const decoded = decodeBase64(signature);
    return base58.encode(decoded);
  } catch {
    return signature; // Already base58
  }
}

// =====================
// MAIN
// =====================
serve(async (req) => {
  const cors = getCorsHeadersFromRequest(req);

  // --- CORS preflight ---
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    console.log('🔍 purchase-lives called');

    // Initialize Supabase client with error handling
    let supabase;
    try {
      supabase = getSupabaseClient();
      console.log('✅ Supabase client initialized');
    } catch (supabaseError) {
      console.error('❌ Failed to initialize Supabase client:', supabaseError);
      return new Response(
        JSON.stringify({
          error: 'Failed to initialize database connection',
          details: supabaseError instanceof Error ? supabaseError.message : String(supabaseError),
        }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body with error handling
    let body: PurchaseLivesRequest;
    try {
      body = await req.json();
      console.log('✅ Request body parsed');
    } catch (jsonError) {
      console.error('❌ Failed to parse request body:', jsonError);
      return new Response(
        JSON.stringify({
          error: 'Invalid request body',
          details: jsonError instanceof Error ? jsonError.message : String(jsonError),
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const { walletAddress: rawWallet, txSignature, tier: requestedTier } = body;
    const walletAddress = typeof rawWallet === 'string' ? rawWallet.trim() : '';

    if (!walletAddress || !txSignature) {
      return new Response(
        JSON.stringify({ error: 'walletAddress and txSignature are required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (!isValidSolanaAddress(walletAddress)) {
      return new Response(
        JSON.stringify({ error: 'Invalid wallet address' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Check if wallet is Seeker-verified for discounted pricing
    let isSeekerVerified = false;
    try {
      const { data: seekerProfile } = await supabase
        .from('player_profiles')
        .select('is_seeker_verified')
        .eq('wallet_address', walletAddress)
        .maybeSingle();
      isSeekerVerified = (seekerProfile as any)?.is_seeker_verified === true;
    } catch (_) { /* non-fatal */ }

    // Resolve tier (default to basic for backwards compatibility)
    // Use hasOwnProperty to prevent prototype pollution attacks (e.g. tier: "__proto__")
    const activeTiers = isSeekerVerified ? SEEKER_LIVES_TIERS : LIVES_TIERS;
    const tierKey = requestedTier && Object.prototype.hasOwnProperty.call(activeTiers, requestedTier)
      ? requestedTier
      : DEFAULT_TIER;
    const selectedTier = activeTiers[tierKey];
    const EXPECTED_AMOUNT_LAMPORTS = selectedTier.lamports;
    const LIVES_PER_PURCHASE = selectedTier.lives;
    console.log('Tier selected:', { tierKey, lives: LIVES_PER_PURCHASE, lamports: EXPECTED_AMOUNT_LAMPORTS, seekerDiscount: isSeekerVerified });

    const base58Signature = convertSignatureToBase58(txSignature);

    // --- Replay protection ---
    const { data: existingTx, error: replayError } = await supabase
      .from('lives_purchases')
      .select('id')
      .eq('tx_signature', base58Signature)
      .single();

    if (existingTx) {
      return new Response(
        JSON.stringify({ error: 'Transaction already used' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (replayError && replayError.code !== 'PGRST116') {
      console.error('Database error checking replay:', replayError);
      return new Response(
        JSON.stringify({ error: 'Database error', details: replayError.message }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // --- Fetch transaction with retries ---
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    let transaction = null;

    for (let i = 0; i < 5; i++) {
      try {
        transaction = await connection.getTransaction(base58Signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });
        if (transaction) break;
      } catch (err) {
        console.error(`Transaction fetch attempt ${i + 1} failed:`, err);
      }
      if (i < 4) {
        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
      }
    }

    if (!transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found on-chain' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (transaction.meta?.err) {
      return new Response(
        JSON.stringify({ error: 'Transaction failed on-chain' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // --- Verify transaction details using BALANCE CHANGES (more reliable) ---
    console.log('Verifying transaction using balance changes...');
    
    // Get account keys
    const accountKeys =
      transaction.transaction.message.staticAccountKeys ??
      transaction.transaction.message.accountKeys;
    
    if (!accountKeys || accountKeys.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction: no account keys found' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Use postBalances and preBalances to verify the transfer amount
    const meta = transaction.meta;
    if (!meta || !meta.postBalances || !meta.preBalances) {
      return new Response(
        JSON.stringify({ error: 'Transaction missing balance information' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Transaction meta:', {
      preBalances: meta.preBalances,
      postBalances: meta.postBalances,
      accountKeys: accountKeys.map((k: any) => k.toString()),
    });

    // Find indices of sender and recipient
    let senderIndex = -1;
    let recipientIndex = -1;
    
    for (let i = 0; i < accountKeys.length; i++) {
      const key = accountKeys[i].toString();
      if (key === walletAddress) senderIndex = i;
      if (key === REVENUE_WALLET) recipientIndex = i;
    }

    console.log('Account indices:', { senderIndex, recipientIndex });

    if (senderIndex === -1) {
      return new Response(
        JSON.stringify({ 
          error: 'Sender wallet not found in transaction',
          details: { expectedSender: walletAddress }
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (recipientIndex === -1) {
      return new Response(
        JSON.stringify({ 
          error: 'Revenue wallet not found in transaction',
          details: { expectedRecipient: REVENUE_WALLET }
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate the actual transfer amount from balance changes
    const senderBalanceChange = meta.postBalances[senderIndex] - meta.preBalances[senderIndex];
    const recipientBalanceChange = meta.postBalances[recipientIndex] - meta.preBalances[recipientIndex];
    
    console.log('Balance changes:', {
      sender: {
        pre: meta.preBalances[senderIndex],
        post: meta.postBalances[senderIndex],
        change: senderBalanceChange,
      },
      recipient: {
        pre: meta.preBalances[recipientIndex],
        post: meta.postBalances[recipientIndex],
        change: recipientBalanceChange,
      },
    });

    // Sender should have decreased by amount + fee
    // Recipient should have increased by exactly the amount
    const transferredAmount = recipientBalanceChange;

    console.log('Transfer verification:', {
      transferredAmount,
      expectedAmount: EXPECTED_AMOUNT_LAMPORTS,
      match: transferredAmount === EXPECTED_AMOUNT_LAMPORTS,
    });

    // Verify the recipient received the correct amount
    if (transferredAmount !== EXPECTED_AMOUNT_LAMPORTS) {
      console.error('❌ Amount mismatch');
      return new Response(
        JSON.stringify({
          error: 'Transaction amount mismatch',
          details: {
            expectedAmount: EXPECTED_AMOUNT_LAMPORTS,
            actualAmount: transferredAmount,
            difference: transferredAmount - EXPECTED_AMOUNT_LAMPORTS,
          }
        }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Transaction verification passed');

    // --- Record purchase ---
    const { error: purchaseError } = await supabase.from('lives_purchases').insert({
      wallet_address: walletAddress,
      lives_purchased: LIVES_PER_PURCHASE,
      amount_lamports: EXPECTED_AMOUNT_LAMPORTS,
      tx_signature: base58Signature,
    });

    if (purchaseError) {
      console.error('❌ Failed to record purchase:', purchaseError);
      return new Response(
        JSON.stringify({
          error: 'Failed to record purchase',
          details: purchaseError.message,
        }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    // --- Update lives (add LIVES_PER_PURCHASE to current balance; ensure row exists first) ---
    const { data: livesRow, error: livesError } = await supabase
      .from('player_lives')
      .select('lives_count, total_purchased, total_used')
      .eq('wallet_address', walletAddress)
      .maybeSingle();

    if (livesError) {
      console.error('Failed to fetch lives:', livesError);
      return new Response(
        JSON.stringify({
          error: 'Database error fetching lives',
          details: livesError.message,
        }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const livesCount = livesRow?.lives_count ?? 0;
    const totalPurchased = livesRow?.total_purchased ?? 0;
    const totalUsed = livesRow?.total_used ?? 0;
    const newLivesCount = livesCount + LIVES_PER_PURCHASE;
    const newTotalPurchased = totalPurchased + LIVES_PER_PURCHASE;

    const upsertPayload = {
      wallet_address: walletAddress,
      lives_count: newLivesCount,
      total_purchased: newTotalPurchased,
      total_used: totalUsed,
      updated_at: new Date().toISOString(),
    };
    console.log('Upserting player_lives:', { before: { livesCount, totalPurchased }, add: LIVES_PER_PURCHASE, after: { newLivesCount, newTotalPurchased } });

    const { data: updatedLives, error: updateError } = await supabase
      .from('player_lives')
      .upsert(upsertPayload, { onConflict: 'wallet_address' })
      .select('lives_count, total_purchased, total_used')
      .single();

    if (updateError) {
      console.error('❌ Failed to update lives:', updateError);
      return new Response(
        JSON.stringify({
          error: 'Failed to update lives',
          details: updateError.message,
        }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    let finalLivesCount = updatedLives?.lives_count ?? newLivesCount;
    let finalTotalPurchased = updatedLives?.total_purchased ?? newTotalPurchased;
    let finalTotalUsed = updatedLives?.total_used ?? totalUsed;
    if (!updatedLives) {
      console.warn('Upsert succeeded but .select() returned no row; using computed values:', { finalLivesCount, finalTotalPurchased });
    } else {
      console.log('✅ Lives updated successfully:', updatedLives);
    }

    // Verified read: ensure we return what's actually in the DB (catches duplicate rows / wrong row)
    const { data: verifyRow } = await supabase
      .from('player_lives')
      .select('lives_count, total_purchased, total_used')
      .eq('wallet_address', walletAddress)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (verifyRow) {
      finalLivesCount = verifyRow.lives_count ?? finalLivesCount;
      finalTotalPurchased = verifyRow.total_purchased ?? finalTotalPurchased;
      finalTotalUsed = verifyRow.total_used ?? finalTotalUsed;
      console.log('purchase-lives verified read:', { wallet: walletAddress.slice(0, 8) + '...', lives_count: finalLivesCount });
    }

    // Quest: Healing Master (total lives purchased); auto-claim when progress >= 15
    try {
      const { data: quest } = await supabase.from('quests').select('id, reward_tp, requirement_config').eq('slug', 'healing_master').single();
      if (quest?.id) {
        const progress = finalTotalPurchased || 0;
        const maxProgress = (quest.requirement_config as { max?: number })?.max ?? 15;
        const rewardTP = quest.reward_tp ?? 0;
        await supabase.from('user_quest_progress').upsert({
          wallet_address: walletAddress,
          quest_id: quest.id,
          progress,
          ...(progress >= maxProgress && { completed_at: new Date().toISOString() }),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'wallet_address,quest_id' });
        if (progress >= maxProgress && rewardTP > 0) {
          const { data: row } = await supabase.from('user_quest_progress').select('claimed_at').eq('wallet_address', walletAddress).eq('quest_id', quest.id).single();
          if (row && !row.claimed_at) {
            const now = new Date().toISOString();
            await supabase.from('user_quest_progress').update({ claimed_at: now, updated_at: now }).eq('wallet_address', walletAddress).eq('quest_id', quest.id);
            const { data: profile } = await supabase.from('player_profiles').select('total_points').eq('wallet_address', walletAddress).single();
            const currentTP = profile?.total_points ?? 0;
            await supabase.from('player_profiles').update({ total_points: currentTP + rewardTP, updated_at: now }).eq('wallet_address', walletAddress);
          }
        }
      }
    } catch (questErr) {
      console.error('Quest progress (healing_master) update failed:', questErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        livesCount: finalLivesCount,
        livesPurchased: LIVES_PER_PURCHASE,
        totalPurchased: finalTotalPurchased,
        totalUsed: finalTotalUsed,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('🔥 Uncaught error:', err);
    console.error('Error type:', err instanceof Error ? err.constructor.name : typeof err);
    console.error('Error message:', err instanceof Error ? err.message : String(err));
    console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace');
    
    // Ensure we have CORS headers even in error case
    let errorCors = cors;
    try {
      errorCors = getCorsHeadersFromRequest(req);
    } catch {
      // Fallback if we can't get CORS headers
      errorCors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      };
    }
    
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: err instanceof Error ? err.message : String(err),
        type: err instanceof Error ? err.constructor.name : typeof err,
      }),
      { status: 500, headers: { ...errorCors, 'Content-Type': 'application/json' } }
    );
  }
});

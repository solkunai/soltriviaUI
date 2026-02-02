// Purchase Lives Edge Function
// Validates payment and adds extra lives to player account

// @ts-ignore - Deno URL imports are valid at runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import { Connection, PublicKey } from 'https://esm.sh/@solana/web3.js@1.95.2';
// @ts-ignore - Deno URL imports are valid at runtime
import { decode as decodeBase64 } from 'https://deno.land/std@0.177.0/encoding/base64.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import * as base58 from 'https://esm.sh/bs58@5.0.0';

// Get values from environment variables (set in Supabase dashboard)
const LIVES_PER_PURCHASE = 3;
const EXPECTED_AMOUNT_LAMPORTS = parseInt(Deno.env.get('LIVES_PRICE_LAMPORTS') || '30000000', 10); // 0.03 SOL
const REVENUE_WALLET = Deno.env.get('REVENUE_WALLET') || '4u1UTyMBX8ghSQBagZHCzArt32XMFSw4CUXbdgo2Cv74'; // Ledger/Phantom wallet
const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';

interface PurchaseLivesRequest {
  walletAddress: string;
  txSignature: string;
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔍 purchase-lives function called');

    const supabase = getSupabaseClient();
    console.log('✅ Supabase client created');

    const { walletAddress, txSignature }: PurchaseLivesRequest = await req.json();
    console.log('📝 Request data:', { walletAddress, txSignature: txSignature?.substring(0, 20) + '...' });

    // Input validation
    if (!walletAddress || !txSignature) {
      return new Response(
        JSON.stringify({ error: 'walletAddress and txSignature are required' }),
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
    const base58Signature = convertSignatureToBase58(txSignature);

    // Check if this transaction was already used (prevent replay attacks)
    const { data: existingPurchase, error: checkError } = await supabase
      .from('lives_purchases')
      .select('id')
      .eq('tx_signature', base58Signature)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 = "not found" which is OK, any other error is a problem
      console.error('Database check error:', checkError);
      return new Response(
        JSON.stringify({
          error: 'Database error',
          details: checkError.message,
          code: checkError.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existingPurchase) {
      return new Response(
        JSON.stringify({ error: 'Transaction already used', code: 'TX_ALREADY_USED' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 🔒 CRITICAL SECURITY: Verify transaction on-chain
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

    // Retry logic: Transaction might not be confirmed immediately
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let transaction: any = null;
    const maxRetries = 5;
    const retryDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        transaction = await connection.getTransaction(base58Signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0,
        });

        if (transaction) break; // Found it!

        // Wait before next retry
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      } catch (err) {
        // Wait before retry on error
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    // Verify transaction exists and succeeded
    if (!transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found on-chain after retries' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transaction.meta?.err) {
      return new Response(
        JSON.stringify({ error: 'Transaction failed on-chain' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the payment details from the transaction
    const instructions = transaction.transaction.message.instructions;
    if (!instructions || instructions.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid transaction: no instructions found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the transfer instruction
    const accountKeys = transaction.transaction.message.staticAccountKeys ||
                       transaction.transaction.message.accountKeys;

    let foundValidTransfer = false;
    let senderPubkey: PublicKey | null = null;

    for (const instruction of instructions) {
      // SystemProgram.transfer has programIdIndex 0 and 3 accounts
      if (instruction.programIdIndex === 0) {
        const accounts = instruction.accounts;
        if (accounts && accounts.length >= 2) {
          const fromIndex = accounts[0];
          const toIndex = accounts[1];

          const fromPubkey = accountKeys[fromIndex];
          const toPubkey = accountKeys[toIndex];

          // Verify recipient is the revenue wallet
          if (toPubkey.toString() === REVENUE_WALLET) {
            // Verify sender matches claimed wallet address
            if (fromPubkey.toString() === walletAddress) {
              senderPubkey = fromPubkey;

              // Get the amount from instruction data
              // For SystemProgram.transfer, data is: [2, 0, 0, 0, lamports (8 bytes)]
              const data = instruction.data;
              if (data && data.length >= 12) {
                // Read lamports as little-endian 64-bit integer
                const view = new DataView(new Uint8Array(data).buffer);
                const lamports = Number(view.getBigUint64(4, true));

                // Verify exact amount
                if (lamports === EXPECTED_AMOUNT_LAMPORTS) {
                  foundValidTransfer = true;
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (!foundValidTransfer) {
      // DEBUG: Log what we actually found
      console.error('Verification failed. Instructions:', JSON.stringify(instructions.map(i => ({
        programIdIndex: i.programIdIndex,
        accounts: i.accounts,
        data: i.data ? Array.from(i.data) : null
      }))));
      console.error('Account keys:', accountKeys.map(k => k.toString()));
      console.error('Expected wallet:', walletAddress);
      console.error('Expected recipient:', REVENUE_WALLET);
      console.error('Expected amount:', EXPECTED_AMOUNT_LAMPORTS);

      return new Response(
        JSON.stringify({
          error: 'Transaction verification failed: invalid amount, sender, or recipient'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Record the purchase
    console.log('💾 Recording purchase in database...');
    const { error: purchaseError } = await supabase
      .from('lives_purchases')
      .insert({
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
          code: purchaseError.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('✅ Purchase recorded successfully');

    // Upsert player_lives - add lives to existing count
    const { data: existingLives, error: fetchError } = await supabase
      .from('player_lives')
      .select('lives_count, total_purchased, total_used')
      .eq('wallet_address', walletAddress)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Failed to fetch existing lives:', fetchError);
      return new Response(
        JSON.stringify({
          error: 'Database error fetching lives',
          details: fetchError.message,
          code: fetchError.code
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const currentCount = existingLives?.lives_count || 0;
    const totalPurchased = existingLives?.total_purchased || 0;
    const totalUsed = existingLives?.total_used || 0;

    console.log('💾 Updating player lives...', { currentCount, totalPurchased, totalUsed, adding: LIVES_PER_PURCHASE });
    
    const newLivesCount = currentCount + LIVES_PER_PURCHASE;
    const newTotalPurchased = totalPurchased + LIVES_PER_PURCHASE;
    
    let updatedLives;
    
    if (existingLives) {
      // Row exists - update it
      console.log('📝 Updating existing player_lives row');
      const { data, error: updateError } = await supabase
        .from('player_lives')
        .update({
          lives_count: newLivesCount,
          total_purchased: newTotalPurchased,
          total_used: totalUsed,
          updated_at: new Date().toISOString(),
        })
        .eq('wallet_address', walletAddress)
        .select('lives_count, total_purchased, total_used')
        .single();

      if (updateError) {
        console.error('❌ Failed to update lives:', updateError);
        console.error('Update error details:', JSON.stringify(updateError, null, 2));
        return new Response(
          JSON.stringify({
            error: 'Failed to update lives count',
            details: updateError.message,
            code: updateError.code
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updatedLives = data;
    } else {
      // Row doesn't exist - insert it
      console.log('📝 Inserting new player_lives row');
      const { data, error: insertError } = await supabase
        .from('player_lives')
        .insert({
          wallet_address: walletAddress,
          lives_count: newLivesCount,
          total_purchased: newTotalPurchased,
          total_used: 0,
          updated_at: new Date().toISOString(),
        })
        .select('lives_count, total_purchased, total_used')
        .single();

      if (insertError) {
        console.error('❌ Failed to insert lives:', insertError);
        console.error('Insert error details:', JSON.stringify(insertError, null, 2));
        return new Response(
          JSON.stringify({
            error: 'Failed to insert lives count',
            details: insertError.message,
            code: insertError.code
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      updatedLives = data;
    }

    if (!updatedLives) {
      console.error('❌ No data returned after update/insert');
      return new Response(
        JSON.stringify({
          error: 'Failed to update lives: no data returned'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Lives updated successfully:', updatedLives);
    console.log('📊 Final lives count:', updatedLives.lives_count);

    return new Response(
      JSON.stringify({
        success: true,
        livesCount: updatedLives.lives_count,
        livesPurchased: LIVES_PER_PURCHASE,
        totalPurchased: updatedLives.total_purchased,
        totalUsed: updatedLives.total_used || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Uncaught error in purchase-lives:', error);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

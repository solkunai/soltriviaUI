// Refund entry fees when a round has < 5 players (status = refund).
// Sends 0.02 SOL from the refund wallet to each entrant (no contract upgrade needed).
// Requires REFUND_WALLET_KEYPAIR_JSON (or AUTHORITY_KEYPAIR_JSON). Fund this wallet with enough SOL.
// Max ~15 transfers per tx to stay under size limit; sends multiple txs if needed.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  Connection,
  SystemProgram,
} from 'https://esm.sh/@solana/web3.js@1.95.8';

const ENTRY_FEE_LAMPORTS = 20_000_000; // 0.02 SOL per refund
function getRpcUrl(useDevnet?: boolean): string {
  if (useDevnet) return Deno.env.get('SOLANA_DEVNET_RPC_URL') || 'https://api.devnet.solana.com';
  return Deno.env.get('SOLANA_RPC_URL') || Deno.env.get('RPC_URL') || 'https://api.mainnet-beta.solana.com';
}
const MAX_TRANSFERS_PER_TX = 15;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { round_id?: string; useDevnet?: boolean };
    const round_id = body.round_id;
    const useDevnet = body.useDevnet === true;
    if (!round_id || typeof round_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing round_id (daily_rounds UUID)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keypairJson = Deno.env.get('REFUND_WALLET_KEYPAIR_JSON') || Deno.env.get('AUTHORITY_KEYPAIR_JSON');
    if (!keypairJson) {
      return new Response(
        JSON.stringify({ error: 'REFUND_WALLET_KEYPAIR_JSON or AUTHORITY_KEYPAIR_JSON not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: roundRow, error: roundErr } = await supabase
      .from('daily_rounds')
      .select('id, date, round_number, status')
      .eq('id', round_id)
      .single();

    if (roundErr || !roundRow) {
      return new Response(JSON.stringify({ error: 'Round not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (roundRow.status !== 'refund') {
      return new Response(
        JSON.stringify({
          error: `Round status is '${roundRow.status}'. Refunds only for rounds with status 'refund' (< 5 players).`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: sessions, error: sessErr } = await supabase
      .from('game_sessions')
      .select('wallet_address')
      .eq('round_id', round_id);

    if (sessErr) {
      return new Response(JSON.stringify({ error: 'Failed to load game sessions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const uniqueWallets = [...new Set((sessions || []).map((s: { wallet_address: string }) => s.wallet_address))];
    if (uniqueWallets.length === 0) {
      return new Response(JSON.stringify({ error: 'No entrants found for this round' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairJson)));
    const connection = new Connection(getRpcUrl(useDevnet));

    const signatures: string[] = [];
    for (let i = 0; i < uniqueWallets.length; i += MAX_TRANSFERS_PER_TX) {
      const batch = uniqueWallets.slice(i, i + MAX_TRANSFERS_PER_TX);
      const instructions = batch.map((wallet) =>
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(wallet),
          lamports: ENTRY_FEE_LAMPORTS,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash();
      const msg = new TransactionMessage({
        payerKey: keypair.publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();
      const tx = new VersionedTransaction(msg);
      tx.sign([keypair]);

      const sig = await connection.sendTransaction(tx, { skipPreflight: false });
      await connection.confirmTransaction(sig, 'confirmed');
      signatures.push(sig);
    }

    return new Response(
      JSON.stringify({
        success: true,
        round_id,
        recipients_count: uniqueWallets.length,
        signatures,
        note: 'Refunded from refund/authority wallet (0.02 SOL each). No contract upgrade used.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('refund-round-on-chain error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

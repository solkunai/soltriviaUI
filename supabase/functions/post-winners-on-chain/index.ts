// Post round winners on-chain (Sol Trivia contract). Call after calculate_rankings_and_winner when round has 5+ finishers.
// Requires AUTHORITY_KEYPAIR_JSON (JSON array of keypair bytes) and SOLTRIVIA_PROGRAM_ID in secrets.
// Entry fees must have been sent via contract enter_round for claim_prize to have SOL to send.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  Connection,
} from 'https://esm.sh/@solana/web3.js@1.95.8';

const PROGRAM_ID = new PublicKey(
  Deno.env.get('SOLTRIVIA_PROGRAM_ID') || '4XCpxbDvwtbtY3S3WZjkWdcFweMVAazzMbVDKBudFSwo'
);
const RPC_URL = Deno.env.get('SOLANA_RPC_URL') || Deno.env.get('RPC_URL') || 'https://api.mainnet-beta.solana.com';
const POST_WINNERS_DISCRIMINATOR = new Uint8Array([74, 54, 188, 218, 230, 234, 215, 49]);
const CONFIG_SEED = new TextEncoder().encode('config');
const ROUND_SEED = new TextEncoder().encode('round');

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function contractRoundId(dateStr: string, roundNumber: number): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const epoch = new Date(Date.UTC(1970, 0, 1)).getTime();
  const day = new Date(Date.UTC(y, m - 1, d)).getTime();
  const daysSinceEpoch = Math.floor((day - epoch) / 86400_000);
  return daysSinceEpoch * 4 + (roundNumber & 3);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { round_id?: string };
    const round_id = body.round_id;
    if (!round_id || typeof round_id !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing round_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keypairJson = Deno.env.get('AUTHORITY_KEYPAIR_JSON');
    if (!keypairJson) {
      return new Response(JSON.stringify({ error: 'AUTHORITY_KEYPAIR_JSON not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: roundRow, error: roundErr } = await supabase
      .from('daily_rounds')
      .select('date, round_number')
      .eq('id', round_id)
      .single();
    if (roundErr || roundRow?.date == null) {
      return new Response(JSON.stringify({ error: 'Round not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: payouts, error: payErr } = await supabase
      .from('round_payouts')
      .select('wallet_address, rank')
      .eq('round_id', round_id)
      .order('rank', { ascending: true })
      .limit(5);
    if (payErr || !payouts || payouts.length < 5) {
      return new Response(JSON.stringify({ error: 'Need 5 round payouts' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const roundIdU64 = contractRoundId(roundRow.date, roundRow.round_number ?? 0);
    const roundIdLe = new Uint8Array(8);
    new DataView(roundIdLe.buffer).setBigUint64(0, BigInt(roundIdU64), true);

    const winnerPubkeys = payouts
      .slice(0, 5)
      .map((p: { wallet_address: string }) => new PublicKey(p.wallet_address));

    const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
    const [roundPda] = PublicKey.findProgramAddressSync(
      [ROUND_SEED, roundIdLe],
      PROGRAM_ID
    );

    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairJson)));

    const data = new Uint8Array(8 + 8 + 5 * 32);
    data.set(POST_WINNERS_DISCRIMINATOR, 0);
    data.set(roundIdLe, 8);
    winnerPubkeys.forEach((pk, i) => data.set(pk.toBytes(), 16 + i * 32));

    const ix = {
      programId: PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: roundPda, isSigner: false, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    };

    const connection = new Connection(RPC_URL);
    const { blockhash } = await connection.getLatestBlockhash();
    const msg = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([keypair]);

    const sig = await connection.sendTransaction(tx, { skipPreflight: false });
    await connection.confirmTransaction(sig, 'confirmed');

    return new Response(JSON.stringify({ success: true, signature: sig }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('post-winners-on-chain error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('RoundAlreadyFinalized') || msg.includes('0x1771')) {
      return new Response(
        JSON.stringify({ success: true, already_finalized: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    return new Response(
      JSON.stringify({ error: msg || 'Server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

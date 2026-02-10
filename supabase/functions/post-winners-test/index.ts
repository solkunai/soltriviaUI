// Test-only: Post 5 winners for a round without DB. Use for contract test page so one player can claim.
// Body: { round_id_u64: number, winners: string[] } (5 pubkey strings). Optional: useDevnet.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
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
function getRpcUrl(useDevnet: boolean): string {
  if (useDevnet) return Deno.env.get('SOLANA_DEVNET_RPC_URL') || 'https://api.devnet.solana.com';
  return Deno.env.get('SOLANA_RPC_URL') || Deno.env.get('RPC_URL') || 'https://api.mainnet-beta.solana.com';
}
const POST_WINNERS_DISCRIMINATOR = new Uint8Array([74, 54, 188, 218, 230, 234, 215, 49]);
const CONFIG_SEED = new TextEncoder().encode('config');
const ROUND_SEED = new TextEncoder().encode('round');

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
    const body = (await req.json().catch(() => ({}))) as { round_id_u64?: number; winners?: string[]; useDevnet?: boolean };
    const roundIdU64 = body.round_id_u64;
    const winners = body.winners;
    if (roundIdU64 == null || !Array.isArray(winners) || winners.length !== 5) {
      return new Response(
        JSON.stringify({ error: 'Body must include round_id_u64 (number) and winners (array of 5 pubkey strings)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const keypairJson = Deno.env.get('AUTHORITY_KEYPAIR_JSON');
    if (!keypairJson) {
      return new Response(JSON.stringify({ error: 'AUTHORITY_KEYPAIR_JSON not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const useDevnet = !!body.useDevnet;
    const rpcUrl = getRpcUrl(useDevnet);
    const conn = new Connection(rpcUrl);

    const roundIdLe = new Uint8Array(8);
    new DataView(roundIdLe.buffer).setBigUint64(0, BigInt(roundIdU64), true);
    const winnerPubkeys = winners.map((w) => new PublicKey(w));

    const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
    const [roundPda] = PublicKey.findProgramAddressSync([ROUND_SEED, roundIdLe], PROGRAM_ID);
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

    const { blockhash } = await conn.getLatestBlockhash();
    const msg = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    tx.sign([keypair]);

    const sig = await conn.sendTransaction(tx, { skipPreflight: false });
    await conn.confirmTransaction(sig, 'confirmed');

    return new Response(
      JSON.stringify({ success: true, signature: sig }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('post-winners-test error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Ensure the current (or given) round exists on-chain. If the round PDA does not exist, create it via create_round.
// Uses same authority as post-winners-on-chain. Call before client sends enter_round.

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

const PROGRAM_ID = new PublicKey(
  Deno.env.get('SOLTRIVIA_PROGRAM_ID') || '4XCpxbDvwtbtY3S3WZjkWdcFweMVAazzMbVDKBudFSwo'
);
function getRpcUrl(useDevnet: boolean): string {
  if (useDevnet) return Deno.env.get('SOLANA_DEVNET_RPC_URL') || 'https://api.devnet.solana.com';
  return Deno.env.get('SOLANA_RPC_URL') || Deno.env.get('RPC_URL') || 'https://api.mainnet-beta.solana.com';
}

const CREATE_ROUND_DISCRIMINATOR = new Uint8Array([229, 218, 236, 169, 231, 80, 134, 112]);
const CONFIG_SEED = new TextEncoder().encode('config');
const ROUND_SEED = new TextEncoder().encode('round');
const VAULT_SEED = new TextEncoder().encode('vault');

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
    const body = (await req.json().catch(() => ({}))) as { date?: string; round_number?: number; useDevnet?: boolean };
    const useDevnet = !!body.useDevnet;
    const rpcUrl = getRpcUrl(useDevnet);
    let dateStr: string;
    let roundNumber: number;

    if (body.date != null && body.round_number != null) {
      dateStr = String(body.date);
      roundNumber = Number(body.round_number) & 3;
    } else {
      const now = new Date();
      dateStr = now.toISOString().split('T')[0];
      roundNumber = Math.floor(now.getUTCHours() / 6);
    }

    const roundIdU64 = contractRoundId(dateStr, roundNumber);

    const keypairJson = Deno.env.get('AUTHORITY_KEYPAIR_JSON');
    if (!keypairJson) {
      return new Response(JSON.stringify({ error: 'AUTHORITY_KEYPAIR_JSON not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const conn = new Connection(rpcUrl);
    const roundIdLe = new Uint8Array(8);
    new DataView(roundIdLe.buffer).setBigUint64(0, BigInt(roundIdU64), true);
    const [roundPda] = PublicKey.findProgramAddressSync([ROUND_SEED, roundIdLe], PROGRAM_ID);

    const roundAccountInfo = await conn.getAccountInfo(roundPda).catch(() => null);
    if (roundAccountInfo) {
      return new Response(
        JSON.stringify({ ok: true, round_id_u64: roundIdU64, created: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
    const [vaultPda] = PublicKey.findProgramAddressSync([VAULT_SEED, roundIdLe], PROGRAM_ID);
    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairJson)));

    const data = new Uint8Array(8 + 8);
    data.set(CREATE_ROUND_DISCRIMINATOR, 0);
    data.set(roundIdLe, 8);

    const ix = {
      programId: PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: roundPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: false },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data,
    };

    const { blockhash } = await conn.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: keypair.publicKey,
      recentBlockhash: blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([keypair]);

    const sig = await conn.sendTransaction(tx, { skipPreflight: false });
    await conn.confirmTransaction(sig, 'confirmed');

    return new Response(
      JSON.stringify({ ok: true, round_id_u64: roundIdU64, created: true, signature: sig }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('ensure-round-on-chain error:', e);
    return new Response(
      JSON.stringify({ error: String(e instanceof Error ? e.message : e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

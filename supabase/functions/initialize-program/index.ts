// One-time program setup: initialize the GameConfig PDA (authority + revenue wallet).
// Uses AUTHORITY_KEYPAIR_JSON. Call once per program (e.g. after first deploy). Idempotent: if config exists, returns ok.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
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
const DEFAULT_REVENUE_WALLET = Deno.env.get('REVENUE_WALLET') || '4u1UTyMBX8ghSQBagZHCzArt32XMFSw4CUXbdgo2Cv74';

const INITIALIZE_DISCRIMINATOR = new Uint8Array([175, 175, 109, 31, 13, 152, 155, 237]);
const CONFIG_SEED = new TextEncoder().encode('config');

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
    const body = (await req.json().catch(() => ({}))) as { revenue_wallet?: string; useDevnet?: boolean };
    const useDevnet = !!body.useDevnet;
    const rpcUrl = getRpcUrl(useDevnet);
    const revenueWalletStr = body.revenue_wallet ?? DEFAULT_REVENUE_WALLET;
    const revenueWallet = new PublicKey(revenueWalletStr);

    const keypairJson = Deno.env.get('AUTHORITY_KEYPAIR_JSON');
    if (!keypairJson) {
      return new Response(JSON.stringify({ error: 'AUTHORITY_KEYPAIR_JSON not set' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const conn = new Connection(rpcUrl);
    const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);
    const configAccount = await conn.getAccountInfo(configPda).catch(() => null);
    if (configAccount) {
      return new Response(
        JSON.stringify({ ok: true, message: 'Program already initialized', initialized: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairJson)));

    const balance = await conn.getBalance(keypair.publicKey).catch(() => 0n);
    const minRequired = 500_000n; // ~0.0005 SOL for init tx
    if (balance < minRequired) {
      const network = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet';
      return new Response(
        JSON.stringify({
          error: `Authority wallet has insufficient SOL. Balance: ${Number(balance) / 1e9} SOL. Fund the authority (${keypair.publicKey.toBase58()}) on ${network}, e.g. \`solana airdrop 2 ${keypair.publicKey.toBase58()}\` if on devnet. Set SOLANA_RPC_URL to the same network (e.g. https://api.devnet.solana.com).`,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = new Uint8Array(8 + 32);
    data.set(INITIALIZE_DISCRIMINATOR, 0);
    data.set(revenueWallet.toBytes(), 8);

    const ix = {
      programId: PROGRAM_ID,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: true },
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

    let sig: string;
    try {
      sig = await conn.sendTransaction(tx, { skipPreflight: false });
      await conn.confirmTransaction(sig, 'confirmed');
    } catch (sendErr: any) {
      const errMsg = sendErr?.message || String(sendErr);
      if (errMsg.includes('debit') || errMsg.includes('prior credit') || errMsg.includes('Simulation failed')) {
        const network = rpcUrl.includes('devnet') ? 'devnet' : 'mainnet';
        throw new Error(
          `Authority wallet (${keypair.publicKey.toBase58()}) has no SOL on ${network}. ` +
          `Fund it: \`solana config set --url ${network} && solana airdrop 2 ${keypair.publicKey.toBase58()}\`. ` +
          `Or call /get-authority-pubkey to get the address.`
        );
      }
      throw sendErr;
    }

    return new Response(
      JSON.stringify({ ok: true, message: 'Program initialized', signature: sig, initialized: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('initialize-program error:', e);
    const msg = e instanceof Error ? e.message : String(e);
    const hint = msg.includes('debit') || msg.includes('prior credit') || msg.includes('Simulation failed')
      ? ' Authority wallet likely has no SOL on this network. Set SOLANA_RPC_URL to devnet and airdrop to the authority pubkey (see Supabase logs or the error above).'
      : '';
    return new Response(
      JSON.stringify({ error: msg + hint }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

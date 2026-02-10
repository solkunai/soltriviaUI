// Helper: Get the authority pubkey from AUTHORITY_KEYPAIR_JSON (so you know which address to fund).
// Read-only, no security risk - just returns the public key.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { Keypair } from 'https://esm.sh/@solana/web3.js@1.95.8';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const keypairJson = Deno.env.get('AUTHORITY_KEYPAIR_JSON');
    if (!keypairJson) {
      return new Response(
        JSON.stringify({ error: 'AUTHORITY_KEYPAIR_JSON not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const keypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(keypairJson)));
    const pubkey = keypair.publicKey.toBase58();

    return new Response(
      JSON.stringify({
        authority_pubkey: pubkey,
        message: `Fund this address on devnet: solana airdrop 2 ${pubkey}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

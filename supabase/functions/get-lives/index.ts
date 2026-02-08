// Get current lives for a wallet (authoritative read via service role)
// @ts-ignore
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { getCorsHeadersFromRequest } from '../_shared/cors.ts';
import { getSupabaseClient } from '../_shared/supabase.ts';

serve(async (req) => {
  const cors = getCorsHeadersFromRequest(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }

  try {
    let walletAddress: string | null = null;
    if (req.method === 'GET') {
      const url = new URL(req.url);
      walletAddress = url.searchParams.get('wallet') || url.searchParams.get('walletAddress') || null;
    } else {
      const body = await req.json().catch(() => ({}));
      walletAddress = body.walletAddress ?? body.wallet ?? null;
    }

    const wallet = (typeof walletAddress === 'string' ? walletAddress : '').trim();
    if (!wallet) {
      return new Response(
        JSON.stringify({ error: 'wallet or walletAddress required' }),
        { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabaseClient();
    // Order by updated_at desc so we get the latest row if there are duplicates for same wallet
    const { data: rows, error } = await supabase
      .from('player_lives')
      .select('lives_count, total_purchased, total_used, updated_at')
      .eq('wallet_address', wallet)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('get-lives fetch error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch lives', details: error.message }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    const lives_count = data?.lives_count ?? 0;
    const total_purchased = data?.total_purchased ?? 0;
    const total_used = data?.total_used ?? 0;
    console.log('get-lives:', { wallet: wallet.slice(0, 8) + '...', lives_count, total_purchased, total_used });

    return new Response(
      JSON.stringify({ lives_count, total_purchased, total_used }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('get-lives error:', e);
    return new Response(
      JSON.stringify({ error: 'Internal error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});

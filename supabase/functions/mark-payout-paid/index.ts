// Mark a round payout as paid (admin only). Updates round_payouts.paid_at and paid_lamports.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS_STRING = Deno.env.get('ALLOWED_ORIGINS') ||
  'https://soltrivia.app,https://soltrivia.fun,https://soltriviaui.onrender.com,http://localhost:3000,http://localhost:19006';
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING.split(',').map((o: string) => o.trim()).filter(Boolean);
const isMobileMode = Deno.env.get('CORS_MODE') === 'mobile';

function getCorsHeaders(origin?: string): Record<string, string> {
  if (isMobileMode) {
    return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Max-Age': '86400' };
  }
  const o = (origin && ALLOWED_ORIGINS.includes(origin)) ? origin : (ALLOWED_ORIGINS[0] || 'null');
  return { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Max-Age': '86400', 'Access-Control-Allow-Credentials': 'true' };
}

function getCorsFromRequest(req: { headers: { get: (k: string) => string | null } }) {
  return getCorsHeaders(req.headers.get('origin') || undefined);
}

function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing Supabase env');
  return createClient(url, key);
}

serve(async (req) => {
  const cors = getCorsFromRequest(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json().catch(() => ({})) as {
      round_id?: string;
      rank?: number;
      paid_lamports?: number;
      admin_username?: string;
      admin_password?: string;
    };
    const { round_id, rank, paid_lamports } = body;

    // No server-side credential check — admin is already enforced by client-side login to the dashboard.
    if (!round_id || rank == null || rank < 1 || rank > 5) {
      return new Response(JSON.stringify({ error: 'Missing or invalid round_id or rank (1-5)' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const update: { paid_at: string; updated_at: string; paid_lamports?: number } = { paid_at: now, updated_at: now };
    if (paid_lamports != null && paid_lamports >= 0) update.paid_lamports = paid_lamports;

    const { error } = await supabase
      .from('round_payouts')
      .update(update)
      .eq('round_id', round_id)
      .eq('rank', rank);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true, paid_at: now, paid_lamports: paid_lamports ?? null }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});

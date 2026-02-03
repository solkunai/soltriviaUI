// User submits proof URL for verification quests (e.g. TRUE RAIDER). Inserts/updates quest_submissions as pending.
// CORS and Supabase inlined so deploy works without _shared
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERIFICATION_QUEST_SLUGS = ['true_raider'];

const ALLOWED_ORIGINS_STRING = Deno.env.get('ALLOWED_ORIGINS') ||
  'https://soltrivia.app,https://soltrivia.fun,https://soltriviaui.onrender.com,http://localhost:3000,http://localhost:19006';
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING.split(',').map((o: string) => o.trim()).filter(Boolean);
const isMobileMode = Deno.env.get('CORS_MODE') === 'mobile';

function getCorsHeaders(origin?: string): Record<string, string> {
  if (isMobileMode) {
    return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Max-Age': '86400' };
  }
  const originToUse = (origin && ALLOWED_ORIGINS.includes(origin)) ? origin : (ALLOWED_ORIGINS[0] || 'null');
  return { 'Access-Control-Allow-Origin': originToUse, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Max-Age': '86400', 'Access-Control-Allow-Credentials': 'true' };
}

function getCorsFromRequest(req: { headers: { get: (k: string) => string | null } }): Record<string, string> {
  return getCorsHeaders(req.headers.get('origin') || undefined);
}

function getSupabaseClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key);
}

serve(async (req) => {
  const cors = getCorsFromRequest(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const { wallet_address, quest_slug, proof_url } = body as { wallet_address?: string; quest_slug?: string; proof_url?: string };
    if (!wallet_address || !quest_slug || !proof_url || typeof proof_url !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing wallet_address, quest_slug, or proof_url' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const urlTrimmed = proof_url.trim();
    if (urlTrimmed.length < 10 || !urlTrimmed.startsWith('http')) {
      return new Response(JSON.stringify({ error: 'Invalid proof URL' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (!VERIFICATION_QUEST_SLUGS.includes(quest_slug)) {
      return new Response(JSON.stringify({ error: 'Quest does not accept proof submission' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const supabase = getSupabaseClient();
    const { data: quest, error: qErr } = await supabase.from('quests').select('id').eq('slug', quest_slug).eq('is_active', true).single();
    if (qErr || !quest?.id) {
      return new Response(JSON.stringify({ error: 'Quest not found or inactive' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const { data: existing } = await supabase.from('quest_submissions').select('id, status').eq('wallet_address', wallet_address).eq('quest_id', quest.id).maybeSingle();
    if (existing?.status === 'approved') {
      return new Response(JSON.stringify({ error: 'Already approved', ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (existing?.status === 'rejected') {
      return new Response(JSON.stringify({ error: 'Submission was rejected. You may submit a new proof.' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const payload = { wallet_address, quest_id: quest.id, proof_url: urlTrimmed, status: 'pending' as const };
    if (existing?.id) {
      const { error: upErr } = await supabase.from('quest_submissions').update({ proof_url: urlTrimmed }).eq('id', existing.id);
      if (upErr) throw upErr;
    } else {
      const { error: inErr } = await supabase.from('quest_submissions').insert(payload);
      if (inErr) throw inErr;
    }

    return new Response(JSON.stringify({ ok: true, message: 'Submitted for review' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});

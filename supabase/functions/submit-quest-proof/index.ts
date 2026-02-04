// User submits proof URL for verification quests (e.g. TRUE RAIDER).
// TRUE RAIDER: auto-approve and grant TP as soon as proof is pasted (no admin review).
// CORS and Supabase inlined so deploy works without _shared
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VERIFICATION_QUEST_SLUGS = ['true_raider'];
/** Quests that are auto-approved and auto-claimed when user submits proof (no admin review). */
const AUTO_APPROVE_QUEST_SLUGS = ['true_raider'];

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
    const { data: quest, error: qErr } = await supabase.from('quests').select('id, reward_tp, requirement_config').eq('slug', quest_slug).eq('is_active', true).single();
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

    const now = new Date().toISOString();
    const isAutoApprove = AUTO_APPROVE_QUEST_SLUGS.includes(quest_slug);
    const status = isAutoApprove ? 'approved' : 'pending';
    const payload = { wallet_address, quest_id: quest.id, proof_url: urlTrimmed, status };
    if (isAutoApprove) {
      (payload as Record<string, unknown>).reviewed_at = now;
      (payload as Record<string, unknown>).reviewed_by = 'auto';
    }

    if (existing?.id) {
      const { error: upErr } = await supabase.from('quest_submissions').update({
        proof_url: urlTrimmed,
        status,
        ...(isAutoApprove && { reviewed_at: now, reviewed_by: 'auto' }),
      }).eq('id', existing.id);
      if (upErr) throw upErr;
    } else {
      const { error: inErr } = await supabase.from('quest_submissions').insert(payload);
      if (inErr) throw inErr;
    }

    if (isAutoApprove) {
      const max = (quest as { requirement_config?: { max?: number } }).requirement_config?.max ?? 1;
      const rewardTp = (quest as { reward_tp?: number }).reward_tp ?? 0;
      await supabase.from('user_quest_progress').upsert({
        wallet_address,
        quest_id: quest.id,
        progress: max,
        completed_at: now,
        claimed_at: now,
        updated_at: now,
      }, { onConflict: 'wallet_address,quest_id' });
      // Add TP to profile (upsert so TP is added even if user has no profile row yet)
      const { data: profile } = await supabase.from('player_profiles').select('total_points').eq('wallet_address', wallet_address).single();
      const currentTP = (profile as { total_points?: number } | null)?.total_points ?? 0;
      const newTP = currentTP + rewardTp;
      await supabase.from('player_profiles').upsert(
        { wallet_address, total_points: newTP, updated_at: now },
        { onConflict: 'wallet_address' }
      );
      return new Response(JSON.stringify({
        ok: true,
        message: 'Quest completed! Your reward has been added.',
        auto_claimed: true,
        reward_tp: rewardTp,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, message: 'Submitted for review' }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});

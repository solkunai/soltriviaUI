// Upsert user quest progress (e.g. identity_sync when profile is set). Service role only.
// CORS and Supabase inlined so deploy works without _shared
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_SLUGS = ['identity_sync'];

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
    const { wallet_address, quest_slug, progress } = body as { wallet_address?: string; quest_slug?: string; progress?: number };
    if (!wallet_address || !quest_slug || progress === undefined) {
      return new Response(JSON.stringify({ error: 'Missing wallet_address, quest_slug, or progress' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (!ALLOWED_SLUGS.includes(quest_slug)) {
      return new Response(JSON.stringify({ error: 'Invalid quest_slug' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const supabase = getSupabaseClient();
    const { data: quest } = await supabase.from('quests').select('id, reward_tp, requirement_config').eq('slug', quest_slug).eq('is_active', true).single();
    if (!quest?.id) {
      return new Response(JSON.stringify({ error: 'Quest not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    const progressNum = Number(progress) || 0;
    const maxProgress = (quest.requirement_config as { max?: number })?.max ?? 1;
    const rewardTP = quest.reward_tp ?? 0;

    const payload: Record<string, unknown> = {
      wallet_address,
      quest_id: quest.id,
      progress: progressNum,
      updated_at: new Date().toISOString(),
    };
    if (progressNum >= maxProgress) payload.completed_at = new Date().toISOString();

    const { error } = await supabase.from('user_quest_progress').upsert(payload, { onConflict: 'wallet_address,quest_id' });
    if (error) throw error;

    // Auto-claim: if just completed and not yet claimed, set claimed_at and add TP
    if (progressNum >= maxProgress && rewardTP > 0) {
      const { data: row } = await supabase.from('user_quest_progress').select('claimed_at').eq('wallet_address', wallet_address).eq('quest_id', quest.id).single();
      if (row && !row.claimed_at) {
        const now = new Date().toISOString();
        await supabase.from('user_quest_progress').update({ claimed_at: now, updated_at: now }).eq('wallet_address', wallet_address).eq('quest_id', quest.id);
        const { data: profile } = await supabase.from('player_profiles').select('total_points').eq('wallet_address', wallet_address).single();
        const currentTP = profile?.total_points ?? 0;
        await supabase.from('player_profiles').update({ total_points: currentTP + rewardTP, updated_at: now }).eq('wallet_address', wallet_address);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});

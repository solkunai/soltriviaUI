// Admin-only: list, create, update, delete quests (uses service role after auth)
// CORS and Supabase inlined so deploy works without _shared
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

const ADMIN_USERNAME = Deno.env.get('ADMIN_USERNAME') || Deno.env.get('VITE_ADMIN_USERNAME') || '';
const ADMIN_PASSWORD = Deno.env.get('ADMIN_PASSWORD') || Deno.env.get('VITE_ADMIN_PASSWORD') || '';

serve(async (req) => {
  const cors = getCorsFromRequest(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const body = await req.json().catch(() => ({}));
    const { adminUsername, adminPassword, action, payload } = body as {
      adminUsername?: string;
      adminPassword?: string;
      action?: string;
      payload?: Record<string, unknown>;
    };

    if (ADMIN_USERNAME && ADMIN_PASSWORD) {
      const usernameMatch = adminUsername === ADMIN_USERNAME;
      const passwordMatch = adminPassword === ADMIN_PASSWORD;
      if (!usernameMatch || !passwordMatch) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            hint: 'Set ADMIN_USERNAME and ADMIN_PASSWORD in Supabase Dashboard → Project Settings → Edge Function secrets to match VITE_ADMIN_USERNAME and VITE_ADMIN_PASSWORD in your app .env',
          }),
          { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabase = getSupabaseClient();

    switch (action) {
      case 'list': {
        const { data, error } = await supabase.from('quests').select('*').order('category').order('sort_order');
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      case 'create': {
        const { data, error } = await supabase.from('quests').insert(payload as Record<string, unknown>).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      case 'update': {
        const { id, ...rest } = payload as { id: string; [k: string]: unknown };
        if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        const { data, error } = await supabase.from('quests').update(rest).eq('id', id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      case 'delete': {
        const id = (payload as { id?: string })?.id;
        if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        const { error } = await supabase.from('quests').delete().eq('id', id);
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      case 'list_submissions': {
        const status = (payload as { status?: string })?.status;
        let q = supabase.from('quest_submissions').select('*, quest:quests(id, slug, title)').order('created_at', { ascending: false });
        if (status) q = q.eq('status', status);
        const { data, error } = await q;
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      case 'review_submission': {
        const { submissionId, decision, reviewedBy } = payload as { submissionId?: string; decision?: 'approve' | 'reject'; reviewedBy?: string };
        if (!submissionId || !decision) return new Response(JSON.stringify({ error: 'Missing submissionId or decision' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        const { data: sub, error: subErr } = await supabase.from('quest_submissions').select('*, quest:quests(id, requirement_config, reward_tp)').eq('id', submissionId).single();
        if (subErr || !sub) return new Response(JSON.stringify({ error: 'Submission not found' }), { status: 404, headers: { ...cors, 'Content-Type': 'application/json' } });
        if (sub.status !== 'pending') return new Response(JSON.stringify({ error: 'Already reviewed' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        const now = new Date().toISOString();
        if (decision === 'approve') {
          const quest = sub.quest as { id: string; requirement_config?: { max?: number } } | null;
          const max = quest?.requirement_config?.max ?? 1;
          await supabase.from('user_quest_progress').upsert({
            wallet_address: sub.wallet_address,
            quest_id: sub.quest_id,
            progress: max,
            completed_at: now,
            updated_at: now,
          }, { onConflict: 'wallet_address,quest_id' });
        }
        const { error: upErr } = await supabase.from('quest_submissions').update({
          status: decision === 'approve' ? 'approved' : 'rejected',
          reviewed_at: now,
          reviewed_by: reviewedBy || null,
        }).eq('id', submissionId);
        if (upErr) throw upErr;
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});

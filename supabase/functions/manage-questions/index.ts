// Questions CRUD for admin dashboard (no extra auth; dashboard is already protected by login).
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
    const { action, payload } = body as { action?: string; payload?: Record<string, unknown> };

    const supabase = getSupabaseClient();

    switch (action) {
      case 'list': {
        const limit = typeof (payload as { limit?: number })?.limit === 'number' ? (payload as { limit: number }).limit : 100;
        const search = typeof (payload as { search?: string })?.search === 'string' ? (payload as { search: string }).search.trim() : '';
        let query = supabase
          .from('questions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        if (search.length > 0) {
          const esc = (s: string) => s.replace(/%/g, '\\%').replace(/_/g, '\\_').replace(/,/g, '\\,');
          const pattern = `%${esc(search)}%`;
          query = query.or(`text.ilike.${pattern},category.ilike.${pattern}`);
        }
        const { data, error } = await query;
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      case 'create': {
        const row = payload as Record<string, unknown>;
        const { data, error } = await supabase.from('questions').insert(row).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      case 'update': {
        const { id, ...rest } = payload as { id: string; [k: string]: unknown };
        if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        const { data, error } = await supabase.from('questions').update(rest).eq('id', id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      case 'delete': {
        const id = (payload as { id?: string })?.id;
        if (!id) return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        const { error } = await supabase.from('questions').delete().eq('id', id);
        if (error) throw error;
        return new Response(JSON.stringify({ ok: true }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      case 'set_active': {
        const { id, active } = payload as { id?: string; active?: boolean };
        if (!id || active === undefined) return new Response(JSON.stringify({ error: 'Missing id or active' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
        const { data, error } = await supabase.from('questions').update({ active }).eq('id', id).select().single();
        if (error) throw error;
        return new Response(JSON.stringify({ data }), { headers: { ...cors, 'Content-Type': 'application/json' } });
      }
      default:
        return new Response(JSON.stringify({ error: 'Invalid action. Use list, create, update, delete, or set_active' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});

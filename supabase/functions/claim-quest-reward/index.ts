// claim-quest-reward Edge Function
// Allows users to claim completed quest rewards

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// CORS Configuration
const ALLOWED_ORIGINS_STRING = Deno.env.get('ALLOWED_ORIGINS') || 
  'https://soltrivia.app,https://soltrivia.fun,https://soltriviaui.onrender.com,http://localhost:3000,http://localhost:19006';

const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING.split(',').map((origin: string) => origin.trim()).filter(Boolean);
const isMobileMode = Deno.env.get('CORS_MODE') === 'mobile';

function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  if (isMobileMode) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    };
  }

  let originToUse: string;
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    originToUse = requestOrigin;
  } else if (ALLOWED_ORIGINS.length > 0) {
    originToUse = ALLOWED_ORIGINS[0];
  } else {
    originToUse = 'null';
  }

  return {
    'Access-Control-Allow-Origin': originToUse,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function getCorsHeadersFromRequest(req: { headers: { get: (key: string) => string | null } }): Record<string, string> {
  const requestOrigin = req.headers.get('origin') || undefined;
  return getCorsHeaders(requestOrigin);
}

// Supabase Client
function getSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing required Supabase environment variables');
    throw new Error('Missing required Supabase environment variables');
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

serve(async (req) => {
  const corsHeaders = getCorsHeadersFromRequest(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getSupabaseClient();
    const { wallet_address, quest_id } = await req.json();

    if (!wallet_address || !quest_id) {
      return new Response(
        JSON.stringify({ error: 'Missing wallet_address or quest_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get quest details (column is is_active per quests_schema)
    const { data: quest, error: questError } = await supabase
      .from('quests')
      .select('*')
      .eq('id', quest_id)
      .eq('is_active', true)
      .single();

    if (questError || !quest) {
      return new Response(
        JSON.stringify({ error: 'Quest not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user progress
    const { data: progress, error: progressError } = await supabase
      .from('user_quest_progress')
      .select('*')
      .eq('wallet_address', wallet_address)
      .eq('quest_id', quest_id)
      .single();

    if (progressError || !progress) {
      return new Response(
        JSON.stringify({ error: 'Quest progress not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already claimed
    if (progress.claimed_at) {
      return new Response(
        JSON.stringify({ error: 'Reward already claimed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if quest is completed
    const maxProgress = quest.requirement_config?.max || 1;
    if (progress.progress < maxProgress) {
      return new Response(
        JSON.stringify({ 
          error: 'Quest not completed yet',
          progress: progress.progress,
          required: maxProgress
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as completed and claimed
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('user_quest_progress')
      .update({
        completed_at: progress.completed_at || now,
        claimed_at: now,
        updated_at: now,
      })
      .eq('wallet_address', wallet_address)
      .eq('quest_id', quest_id);

    if (updateError) {
      console.error('Error updating quest progress:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to claim reward' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update player profile to add TP
    const { data: profile } = await supabase
      .from('player_profiles')
      .select('total_points')
      .eq('wallet_address', wallet_address)
      .single();

    const currentTP = profile?.total_points || 0;
    const rewardTP = quest.reward_tp || 0;
    const newTP = currentTP + rewardTP;

    const { error: profileError } = await supabase
      .from('player_profiles')
      .update({
        total_points: newTP,
        updated_at: now,
      })
      .eq('wallet_address', wallet_address);

    if (profileError) {
      console.error('Error updating player profile:', profileError);
      // Don't fail the claim - quest is already marked as claimed
    }

    return new Response(
      JSON.stringify({
        success: true,
        quest_id: quest_id,
        reward_tp: rewardTP,
        total_tp: newTP,
        claimed_at: now,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error claiming quest reward:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

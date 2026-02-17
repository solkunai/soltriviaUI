// Create Custom Game Edge Function
// Verifies payment tx, creates game + questions in DB

// @ts-ignore - Deno URL imports are valid at runtime
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore - Deno URL imports are valid at runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore - Deno URL imports are valid at runtime
import { Connection } from 'https://esm.sh/@solana/web3.js@1.95.2';

// =====================
// CORS CONFIGURATION (inlined)
// =====================
// @ts-ignore - Deno is available at runtime
const ALLOWED_ORIGINS_STRING = Deno.env.get('ALLOWED_ORIGINS') ||
  'https://soltrivia.app,https://soltrivia.fun,https://soltriviaui.onrender.com,http://localhost:3000,http://localhost:19006';

const ALLOWED_ORIGINS = ALLOWED_ORIGINS_STRING.split(',').map((origin: string) => origin.trim()).filter(Boolean);

// @ts-ignore - Deno is available at runtime
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

// =====================
// SUPABASE CLIENT (inlined)
// =====================
function getSupabaseClient() {
  // @ts-ignore - Deno is available at runtime
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  // @ts-ignore - Deno is available at runtime
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing required Supabase environment variables');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// =====================
// CONFIG
// =====================
// @ts-ignore
const REVENUE_WALLET = Deno.env.get('REVENUE_WALLET') || '4u1UTyMBX8ghSQBagZHCzArt32XMFSw4CUXbdgo2Cv74';
const CREATION_FEE_LAMPORTS = 20_000_000;
const PLATFORM_FEE_LAMPORTS = 2_500_000;
// @ts-ignore
const SOLANA_RPC_URL = Deno.env.get('SOLANA_RPC_URL') || 'https://api.mainnet-beta.solana.com';
const EXPIRY_DAYS = 7;

const VALID_QUESTION_COUNTS = [5, 10, 15];
const VALID_TIME_LIMITS = [10, 15, 20, 30];
const VALID_ROUND_COUNTS: Record<number, number[]> = {
  5: [1, 5],
  10: [1, 2, 5, 10],
  15: [1, 3, 5, 15],
};

function generateSlug(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let slug = '';
  for (let i = 0; i < 8; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeadersFromRequest(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      wallet_address,
      name,
      slug: requestedSlug,
      question_count,
      round_count,
      time_limit_seconds,
      questions,
      tx_signature,
      has_game_pass,
      content_disclaimer_accepted,
    } = await req.json();

    // ── Validate inputs ──────────────────────────────────────────────────
    if (!wallet_address || typeof wallet_address !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing wallet_address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0 || name.length > 60) {
      return new Response(JSON.stringify({ error: 'Game name is required (max 60 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!VALID_QUESTION_COUNTS.includes(question_count)) {
      return new Response(JSON.stringify({ error: 'Invalid question count' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validRounds = VALID_ROUND_COUNTS[question_count] || [];
    if (!validRounds.includes(round_count)) {
      return new Response(JSON.stringify({ error: `Invalid round count for ${question_count} questions` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!VALID_TIME_LIMITS.includes(time_limit_seconds)) {
      return new Response(JSON.stringify({ error: 'Invalid time limit' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!content_disclaimer_accepted) {
      return new Response(JSON.stringify({ error: 'Content disclaimer must be accepted' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(questions) || questions.length !== question_count) {
      return new Response(JSON.stringify({ error: `Expected ${question_count} questions` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate each question
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.length > 500) {
        return new Response(JSON.stringify({ error: `Question ${i + 1}: text is required (max 500 chars)` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        return new Response(JSON.stringify({ error: `Question ${i + 1}: exactly 4 options required` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      for (let j = 0; j < 4; j++) {
        if (!q.options[j] || typeof q.options[j] !== 'string' || q.options[j].length > 200) {
          return new Response(JSON.stringify({ error: `Question ${i + 1}, Option ${j + 1}: required (max 200 chars)` }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex > 3) {
        return new Response(JSON.stringify({ error: `Question ${i + 1}: correct answer must be 0-3` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!tx_signature || typeof tx_signature !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing tx_signature' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Verify game pass status from DB ──────────────────────────────────
    const supabase = getSupabaseClient();

    let isPassHolder = false;
    if (has_game_pass) {
      const { data: passData } = await supabase
        .from('game_passes')
        .select('id')
        .eq('wallet_address', wallet_address)
        .eq('is_active', true)
        .maybeSingle();
      isPassHolder = !!passData;
    }

    const expectedLamports = isPassHolder ? PLATFORM_FEE_LAMPORTS : (CREATION_FEE_LAMPORTS + PLATFORM_FEE_LAMPORTS);

    // ── Verify transaction on-chain ──────────────────────────────────────
    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    let txInfo;
    try {
      txInfo = await connection.getTransaction(tx_signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Failed to verify transaction on-chain' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!txInfo || !txInfo.meta || txInfo.meta.err) {
      return new Response(JSON.stringify({ error: 'Transaction not found or failed' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check that the tx sent the expected amount to REVENUE_WALLET
    const accountKeys = txInfo.transaction.message.staticAccountKeys?.map((k: any) => k.toBase58()) ??
      txInfo.transaction.message.accountKeys?.map((k: any) => k.toBase58()) ?? [];
    const revenueIdx = accountKeys.indexOf(REVENUE_WALLET);
    if (revenueIdx === -1) {
      return new Response(JSON.stringify({ error: 'Revenue wallet not found in transaction' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const preBalance = txInfo.meta.preBalances[revenueIdx];
    const postBalance = txInfo.meta.postBalances[revenueIdx];
    const received = postBalance - preBalance;
    if (received < expectedLamports) {
      return new Response(JSON.stringify({ error: `Insufficient payment: expected ${expectedLamports} lamports, got ${received}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Replay protection: tx_signature must be unique ───────────────────
    const { data: existingTx } = await supabase
      .from('custom_games')
      .select('id')
      .eq('tx_signature', tx_signature)
      .maybeSingle();

    if (existingTx) {
      return new Response(JSON.stringify({ error: 'Transaction already used' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Generate / validate slug ─────────────────────────────────────────
    let slug = requestedSlug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (slug && (slug.length < 3 || slug.length > 40)) {
      return new Response(JSON.stringify({ error: 'Slug must be 3-40 chars (a-z, 0-9, hyphens)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!slug) {
      for (let attempt = 0; attempt < 5; attempt++) {
        slug = generateSlug();
        const { data: existing } = await supabase.from('custom_games').select('id').eq('slug', slug).maybeSingle();
        if (!existing) break;
        if (attempt === 4) slug = generateSlug() + generateSlug();
      }
    } else {
      const { data: existing } = await supabase.from('custom_games').select('id').eq('slug', slug).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ error: 'Slug already taken' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Insert game ──────────────────────────────────────────────────────
    const expiresAt = new Date(Date.now() + EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: game, error: gameError } = await supabase
      .from('custom_games')
      .insert({
        slug,
        creator_wallet: wallet_address,
        name: name.trim(),
        question_count,
        round_count,
        time_limit_seconds,
        creation_fee_lamports: isPassHolder ? 0 : CREATION_FEE_LAMPORTS,
        platform_fee_lamports: PLATFORM_FEE_LAMPORTS,
        tx_signature,
        content_disclaimer_accepted: true,
        expires_at: expiresAt,
      })
      .select('id, slug')
      .single();

    if (gameError || !game) {
      console.error('Failed to insert custom game:', gameError);
      return new Response(JSON.stringify({ error: 'Failed to create game' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Insert questions ─────────────────────────────────────────────────
    const questionsPerRound = question_count / round_count;
    const questionRows = questions.map((q: any, i: number) => ({
      game_id: game.id,
      question_index: i,
      round_number: Math.floor(i / questionsPerRound),
      question_text: q.questionText.trim(),
      options: q.options,
      correct_index: q.correctIndex,
    }));

    const { error: qError } = await supabase.from('custom_questions').insert(questionRows);

    if (qError) {
      console.error('Failed to insert questions:', qError);
      await supabase.from('custom_games').delete().eq('id', game.id);
      return new Response(JSON.stringify({ error: 'Failed to save questions' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      game_id: game.id,
      slug: game.slug,
      share_url: `https://soltrivia.app/game/${game.slug}`,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('create-custom-game error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// API utility functions for Supabase Edge Functions
import { supabase, isSupabaseConfigured } from './supabase';
import { SUPABASE_FUNCTIONS_URL, SOLANA_NETWORK } from './constants';

const FUNCTIONS_URL = SUPABASE_FUNCTIONS_URL;

// Get Supabase anon key for Edge Function authentication
const getSupabaseAnonKey = (): string => {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
};

// Helper to create authenticated fetch headers (required for Supabase Edge Functions; export for admin dashboard)
export const getAuthHeaders = (): Record<string, string> => {
  const anonKey = getSupabaseAnonKey();
  return {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
  };
};

// Admin-authenticated headers: includes x-admin-secret for protected EFs (manage-questions, manage-quests, etc.)
export const getAdminHeaders = (): Record<string, string> => {
  let adminSecret = '';
  try { adminSecret = sessionStorage.getItem('admin_secret') || ''; } catch (_) {}
  return {
    ...getAuthHeaders(),
    'x-admin-secret': adminSecret,
  };
};

/**
 * Thrown when an Edge Function returns a non-2xx response. The error message
 * is the parsed body's `error` field (or generic fallback). The full HTTP
 * status + raw body are attached as properties for callers that want to
 * branch on specific failure modes (e.g. 409 = duel already exists).
 */
export class EdgeFunctionError extends Error {
  status: number;
  body: any;
  constructor(slug: string, status: number, body: any) {
    const msg = body?.error || body?.message || `${slug} HTTP ${status}`;
    super(msg);
    this.name = 'EdgeFunctionError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Shared POST-to-Edge-Function helper. Mirrors the native repo's `efPost<T>`
 * convention so error handling is consistent across both apps. PREFER this
 * over `supabase.functions.invoke()` — the supabase-js wrapper hides the
 * response body inside an opaque `FunctionsHttpError`, which makes 500
 * debugging painful (we hit this with create-custom-game v37/v38 tonight).
 *
 * Throws EdgeFunctionError on non-2xx so callers can `try {} catch (err)` and
 * read `err.message` to get the EF's actual error string. Pass `{admin: true}`
 * for EFs that need x-admin-secret.
 */
export async function efPost<T = any>(
  slug: string,
  body: Record<string, any>,
  options?: { admin?: boolean; signal?: AbortSignal },
): Promise<T> {
  const headers = options?.admin ? getAdminHeaders() : getAuthHeaders();
  const res = await fetch(`${FUNCTIONS_URL}/${slug}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: options?.signal,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new EdgeFunctionError(slug, res.status, errBody);
  }
  return res.json() as Promise<T>;
}

// Authenticate admin via server-side edge function (returns admin_secret on success)
export const adminLogin = async (username: string, password: string): Promise<{ admin_secret: string }> => {
  const res = await fetch(`${FUNCTIONS_URL}/admin-login`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Login failed');
  }
  return res.json();
};

// Types
export interface SubmitEntryParams {
  wallet_address: string;
  tx_signature: string;
  display_name?: string;
  avatar?: string;
}

export interface SubmitEntryResponse {
  success: boolean;
  session_id: string;
  round_id: string;
  round_ends_at: string;
  pot_lamports: number;
  entry_count: number;
}

export interface SubmitAnswerParams {
  session_id: string;
  question_id: string;
  question_index: number;
  selected_index?: number;
  time_taken_ms: number;
  time_expired?: boolean; // When true, no selection; backend records wrong and advances
  /** v2.1 LIVES retry mechanic. 0 / omitted = first attempt (original flow).
   *  1 or 2 = re-answer via lives (server validates against question_attempts_used
   *  cap on game_sessions and player_lives.lives_count). Backend EF v52+ required. */
  attempt_idx?: number;
}

export interface SubmitAnswerResponse {
  correct: boolean; // Backend returns 'correct', not 'is_correct'
  correctIndex: number; // Backend returns camelCase
  pointsEarned: number; // Backend returns camelCase
  totalScore: number;
  correctCount: number;
  timeMs?: number;
  timedOut?: boolean;
  isLastQuestion?: boolean;
  /** v52 retry response fields , present only when the request sent attempt_idx > 0. */
  retryUsed?: boolean;
  livesRemaining?: number;
  questionAttemptsUsed?: number;
}

export interface Question {
  index: number;
  id: string;
  category: string;
  question: string;
  answers: string[];
  difficulty: string;
}

export interface GetQuestionsResponse {
  session_id: string;
  questions: Question[];
  total_questions: number;
  time_per_question: number;
}

export interface LeaderboardEntry {
  rank: number;
  wallet_address: string;
  display_name: string | null;
  avatar: string;
  avatar_bg_color: string;
  score: number;
  correct_count: number;
  time_taken_ms: number;
  games_played?: number;
  is_seeker_verified?: boolean;
}

export interface PlayerLivesResponse {
  lives_count: number;
  total_purchased: number;
  total_used: number;
}

export interface PurchaseLivesResponse {
  success: boolean;
  livesCount: number;
  livesPurchased: number;
  totalPurchased: number;
  totalUsed: number;
}

export interface Quest {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  reward_tp: number;
  reward_label: string | null;
  requirement_type: string;
  requirement_config: { max?: number; link?: string };
  sort_order: number;
  quest_type: string;
  is_active?: boolean;
}

export interface UserQuestProgress {
  wallet_address: string;
  quest_id: string;
  progress: number;
  completed_at: string | null;
  claimed_at: string | null;
  quest?: Quest;
}

// One-time: initialize the program's GameConfig (authority + revenue wallet). Idempotent.
export async function initializeProgram(options?: { revenueWallet?: string; useDevnet?: boolean }): Promise<{ ok: boolean; message: string; signature?: string; initialized?: boolean }> {
  const body: { revenue_wallet?: string; useDevnet?: boolean } = {};
  if (options?.revenueWallet) body.revenue_wallet = options.revenueWallet;
  if (options?.useDevnet) body.useDevnet = true;
  const response = await fetch(`${FUNCTIONS_URL}/initialize-program`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to initialize program');
  }
  return response.json();
}

// Ensure current round exists on-chain (create_round if needed). Call before sending enter_round.
export async function ensureRoundOnChain(options?: { date?: string; round_number?: number; tier_index?: number; useDevnet?: boolean }): Promise<{ ok: boolean; round_id_u64: number; created?: boolean; signature?: string }> {
  const body: { date?: string; round_number?: number; tier_index?: number; useDevnet?: boolean } = { ...options };
  if (options?.useDevnet) body.useDevnet = true;
  const response = await fetch(`${FUNCTIONS_URL}/ensure-round-on-chain`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to ensure round on-chain');
  }
  return response.json();
}

/** Build an atomic round-entry tx. Returns a partial-signed VersionedTransaction (base64).
 *  Operator slot is pre-signed if create_tier_round is needed; player slot stays empty for the wallet.
 *  Operator only pays PDA rent if the user actually signs and the tx confirms. */
export async function buildRoundEntryTx(
  wallet: string,
  options?: { date?: string; round_number?: number; tier_index?: number; useDevnet?: boolean }
): Promise<{
  ok: boolean;
  tx_base64: string;
  blockhash: string;
  last_valid_block_height: number;
  round_id: number;
  tier_index: number;
  pda_existed: boolean;
  includes_create: boolean;
}> {
  const body = { wallet, ...options };
  const response = await fetch(`${FUNCTIONS_URL}/build-round-entry-tx`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to build round entry tx');
  }
  return response.json();
}

/** Refund entry fees for a round with < 5 players. Round must have status 'refund' in daily_rounds. */
export async function refundRoundOnChain(
  roundId: string,
  options?: { useDevnet?: boolean }
): Promise<{
  success: boolean;
  round_id: string;
  contract_round_id: number;
  recipients_count: number;
  signatures: string[];
}> {
  const response = await fetch(`${FUNCTIONS_URL}/refund-round-on-chain`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ round_id: roundId, useDevnet: options?.useDevnet }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Refund failed');
  }
  return response.json();
}

// Start game (after payment)
export async function startGame(
  walletAddress: string,
  entryTxSignature: string,
  tierIndex?: number,
): Promise<{ sessionId: string; roundId: string; totalQuestions: number; resumed: boolean; freeEntry?: boolean; freeEntriesRemaining?: number; freeEntryReason?: 'new_user' | 'welcome_bonus' }> {
  const response = await fetch(`${FUNCTIONS_URL}/start-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ walletAddress, entryTxSignature, tier_index: tierIndex ?? 0 }),
  });

  if (!response.ok) {
    const error = await response.json();
    const err = new Error(error.error || 'Failed to start game');
    (err as any).code = error.code;
    throw err;
  }

  return response.json();
}

// Get questions for a session
export async function getQuestions(session_id: string): Promise<GetQuestionsResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/get-questions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ session_id }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get questions');
  }

  return response.json();
}

// Submit an answer
export async function submitAnswer(params: SubmitAnswerParams): Promise<SubmitAnswerResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/submit-answer`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const msg = error?.details ? `${error.error || 'Failed to submit answer'}: ${error.details}` : (error?.error || 'Failed to submit answer');
    throw new Error(msg);
  }

  return response.json();
}

// Complete session (store final score when quiz ends)
export interface CompleteSessionParams {
  session_id: string;
  total_score: number;
  correct_count: number;
  time_taken_ms: number;
}

export interface CompleteSessionResponse {
  success: boolean;
  rank: number | null;
  score: number;
  correct_count: number;
  time_taken_ms: number;
}

export async function completeSession(params: CompleteSessionParams): Promise<CompleteSessionResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/complete-session`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to complete session');
  }

  return response.json();
}

// Get leaderboard
export interface LeaderboardResponse {
  period: string;
  leaderboard: LeaderboardEntry[];
  pot_lamports: number;
  player_count: number;
  user_rank: number | null;
  user_score: number | null;
  total_count?: number;
}

export async function getLeaderboard(round_id?: string, wallet?: string, period?: 'daily' | 'weekly' | 'monthly' | 'all', offset?: number): Promise<LeaderboardResponse> {
  const body: { round_id?: string; wallet?: string; period?: string; offset?: number } = { round_id, wallet };
  if (period) body.period = period;
  if (offset != null && offset > 0) body.offset = offset;
  const response = await fetch(`${FUNCTIONS_URL}/get-leaderboard`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get leaderboard');
  }

  return response.json();
}

// Get player's current lives count — direct Supabase read from player_lives
export async function getPlayerLives(wallet_address: string): Promise<PlayerLivesResponse> {
  const empty = { lives_count: 0, total_purchased: 0, total_used: 0 };
  const wallet = (wallet_address || '').trim();
  console.log('[SOL_TRIVIA_LIVES] getPlayerLives called', { wallet: wallet.slice(0, 12) + '..', supabaseOk: !!isSupabaseConfigured });
  if (!isSupabaseConfigured) return empty;
  if (!wallet) return empty;

  const { data: rows, error } = await supabase
    .from('player_lives')
    .select('wallet_address, lives_count, total_purchased, total_used, updated_at')
    .eq('wallet_address', wallet)
    .order('updated_at', { ascending: false })
    .limit(1);

  const livesFromDb = Array.isArray(rows) && rows[0] ? rows[0].lives_count : 'none';
  console.log('[SOL_TRIVIA_LIVES] getPlayerLives result', { wallet: wallet.slice(0, 8) + '..', err: error?.message ?? null, rowCount: Array.isArray(rows) ? rows.length : 0, lives_count: livesFromDb });

  if (error) {
    console.error('[SOL_TRIVIA_LIVES] getPlayerLives Supabase error', error);
    return empty;
  }
  const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!data) return empty;

  const lives_count = Math.max(0, Number(data.lives_count) || 0);
  return {
    lives_count,
    total_purchased: Math.max(0, Number(data.total_purchased) || 0),
    total_used: Math.max(0, Number(data.total_used) || 0),
  };
}

// Get how many round entries this wallet has used in the current 6-hour round.
// Counts sessions where the wallet ENTERED (timestamp in window), not just finished.
// game_sessions has started_at only (no created_at); use it to avoid 400.
export async function getRoundEntriesUsed(wallet_address: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;

  const now = new Date();
  const roundStartHour = Math.floor(now.getUTCHours() / 6) * 6;
  const windowStart = new Date(now);
  windowStart.setUTCHours(roundStartHour, 0, 0, 0);
  const windowStartStr = windowStart.toISOString();

  const { data, error } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('wallet_address', wallet_address)
    .gte('started_at', windowStartStr)
    .limit(10);

  if (error) {
    console.error('Error fetching round entries:', error);
    return 0;
  }
  return (data?.length ?? 0);
}

// Purchase extra lives (with tier support + multi-token payment)
export async function purchaseLives(
  walletAddress: string,
  txSignature: string,
  tier?: string,
  paymentToken?: string,
  amountUsd?: number,
  opts?: { usd_price_cents?: number; token_mint?: string },
): Promise<PurchaseLivesResponse> {
  const url = `${FUNCTIONS_URL}/purchase-lives`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      walletAddress, txSignature, tier, paymentToken, amountUsd,
      ...(opts?.usd_price_cents != null && { usd_price_cents: opts.usd_price_cents }),
      ...(opts?.token_mint && { token_mint: opts.token_mint }),
    }),
  });

  const body = await response.json().catch(() => ({}));
  console.log('purchase-lives response:', { status: response.status, ok: response.ok, body });

  if (!response.ok) {
    const msg = body.details ? `${body.error || 'Failed to purchase lives'}: ${body.details}` : (body.error || 'Failed to purchase lives');
    throw new Error(msg);
  }
  return body as PurchaseLivesResponse;
}

// NEW (2026-05-30): build the multi-token, multi-recipient Lives purchase tx server-side.
// Returns base64 v0 tx for the client to sign + submit. Then the client calls purchaseLives
// with the new opts (usd_price_cents + token_mint) to trigger the new 2-leg verify path.
export interface BuildLivesPurchaseTxRequest {
  walletAddress: string;
  tier: 'basic' | 'value' | 'bulk';
  paymentToken: 'SOL' | 'USDC' | 'SKR' | 'NERD';
  token_mint?: string;
  usd_price_cents?: number;
}

export interface BuildLivesPurchaseTxResponse {
  ok: boolean;
  tx_base64: string;
  blockhash: string;
  last_valid_block_height: number;
  tier: string;
  lives: number;
  paymentToken: string;
  token_mint: string;
  usd_price_cents: number;
  total_token_amount: string;
  revenue_amount: string;
  referrer_amount: string;
  referrer_wallet: string | null;
  is_seeker: boolean;
  jupiter_price_usd: number;
  platform_fee_lamports: number;
}

export async function buildLivesPurchaseTx(
  params: BuildLivesPurchaseTxRequest,
): Promise<BuildLivesPurchaseTxResponse> {
  const url = `${FUNCTIONS_URL}/build-lives-purchase-tx`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = body.details ? `${body.error || 'Failed to build lives purchase tx'}: ${body.details}` : (body.error || 'Failed to build lives purchase tx');
    throw new Error(msg);
  }
  return body as BuildLivesPurchaseTxResponse;
}

// Register or update player profile when wallet connects
export async function registerPlayerProfile(
  walletAddress: string,
  username?: string,
  avatarUrl?: string
): Promise<{ success: boolean }> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured, skipping player registration');
    return { success: false };
  }

  try {
    // Check if player profile already exists
    const { data: existingProfile, error: fetchError } = await supabase
      .from('player_profiles')
      .select('wallet_address, username, avatar_url')
      .eq('wallet_address', walletAddress)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (which is fine for new users)
      console.error('Error checking player profile:', fetchError);
      throw fetchError;
    }

    if (existingProfile) {
      // Profile exists, update last_activity_date
      const { error: updateError } = await supabase
        .from('player_profiles')
        .update({ 
          last_activity_date: new Date().toISOString().split('T')[0],
          ...(username && { username }),
          ...(avatarUrl && { avatar_url: avatarUrl })
        })
        .eq('wallet_address', walletAddress);

      if (updateError) {
        console.error('Error updating player profile:', updateError);
        throw updateError;
      }

      console.log('✅ Player profile updated:', walletAddress);
    } else {
      // Create new profile
      const { error: insertError } = await supabase
        .from('player_profiles')
        .insert({
          wallet_address: walletAddress,
          username: username || null,
          avatar_url: avatarUrl || null,
          total_games_played: 0,
          total_wins: 0,
          total_points: 0,
          highest_score: 0,
          current_streak: 0,
          best_streak: 0,
          last_activity_date: new Date().toISOString().split('T')[0],
        });

      if (insertError) {
        console.error('Error creating player profile:', insertError);
        throw insertError;
      }

      console.log('✅ New player profile created:', walletAddress);

      // Also create a player_lives row with 0 purchased lives (free entries are per-round)
      const { error: livesError } = await supabase
        .from('player_lives')
        .insert({
          wallet_address: walletAddress,
          lives_count: 0,
          total_purchased: 0,
          total_used: 0,
        });

      if (livesError && livesError.code !== '23505') {
        // 23505 = unique violation (row already exists, which is fine)
        console.error('Error creating player lives:', livesError);
      } else {
        console.log('✅ Lives record created:', walletAddress);
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to register player profile:', error);
    return { success: false };
  }
}

/** Update player profile via Edge Function (bypasses RLS). */
export async function updateProfile(
  walletAddress: string,
  fields: {
    username?: string;
    avatarUrl?: string;
    useSkrAsDisplay?: boolean;
    skrDomain?: string;
  }
): Promise<{ success: boolean; username?: string; avatar_url?: string; use_skr_as_display?: boolean }> {
  const response = await fetch(`${FUNCTIONS_URL}/update-profile`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ walletAddress, ...fields }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update profile');
  }
  return response.json();
}

/** Live username availability check. Case-insensitive. Returns true if the
 *  name is free (no other wallet currently holds it). Empty / too short / too
 *  long usernames are treated as "not available" so callers don't have to
 *  duplicate the format check. Optionally excludes a wallet from the search
 *  so the user can keep their own current name without it being flagged. */
export async function checkUsernameAvailable(
  username: string,
  excludeWallet?: string,
): Promise<boolean> {
  if (!isSupabaseConfigured) return true; // fail-open in dev so UI isn't gated
  const trimmed = (username || '').trim();
  if (trimmed.length < 2 || trimmed.length > 24) return false;
  let query = supabase
    .from('player_profiles')
    .select('wallet_address', { count: 'exact', head: true })
    .ilike('username', trimmed);
  if (excludeWallet) {
    query = query.neq('wallet_address', excludeWallet);
  }
  const { count, error } = await query;
  if (error) return true; // fail-open on RPC blip; EF will reject if actually taken
  return (count ?? 0) === 0;
}

// ─── Onboarding flow (v2.1, 2026-06-05) ─────────────────────────────────────
// First-connect modal stamps three timestamps on player_profiles:
//   age_verified_at, tos_accepted_at, onboarded_at.
// Pre-existing players are auto-grandfathered via the migration so they
// don't see the modal on next visit. Defensive: also auto-grandfather if
// the row exists but row.created_at is older than 24h (joined long ago).

export interface OnboardingStatus {
  needsOnboarding: boolean;
  seekerDomain: string | null;
}

export async function getOnboardingStatus(walletAddress: string): Promise<OnboardingStatus> {
  if (!isSupabaseConfigured || !walletAddress?.trim()) {
    return { needsOnboarding: false, seekerDomain: null };
  }
  const { data, error } = await supabase
    .from('player_profiles')
    .select('onboarded_at, created_at, skr_domain')
    .eq('wallet_address', walletAddress)
    .maybeSingle();
  if (error) {
    // Defensive: pre-migration or RLS hiccup. Skip the modal rather than
    // gate the whole app behind it.
    return { needsOnboarding: false, seekerDomain: null };
  }
  // No row = first-ever connection for this wallet. Show onboarding.
  if (!data) return { needsOnboarding: true, seekerDomain: null };
  const row = data as { onboarded_at?: string | null; created_at?: string | null; skr_domain?: string | null };
  return {
    needsOnboarding: !row.onboarded_at,
    seekerDomain: row.skr_domain ?? null,
  };
}

export interface CompleteOnboardingPayload {
  username: string;
  referralCode?: string | null;
  useSkrAsDisplay?: boolean;
  skrDomain?: string | null;
}

export interface CompleteOnboardingResult {
  success: boolean;
  username?: string;
  referralRegistered?: boolean;
  referralError?: string;
  error?: string;
}

/** Final submit of the onboarding modal. Creates/updates player_profiles
 *  with the username + onboarding timestamps, then (optionally) registers a
 *  referral. Referral failure does NOT roll back onboarding — the user is
 *  still onboarded, we just surface the error so they can retry the link. */
export async function completeOnboarding(
  walletAddress: string,
  payload: CompleteOnboardingPayload,
): Promise<CompleteOnboardingResult> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };
  const wallet = walletAddress.trim();
  const username = payload.username.trim();
  if (!wallet) return { success: false, error: 'Missing wallet' };
  if (!username) return { success: false, error: 'Username required' };

  // Calls the `complete-onboarding` Edge Function (v1, Kyle 2026-06-07)
  // instead of upserting directly — `player_profiles` RLS only allows
  // service-role writes, so a client upsert returns "new row violates
  // row-level security policy". The EF performs the upsert + optional
  // referral registration server-side.
  try {
    const res = await fetch(`${FUNCTIONS_URL}/complete-onboarding`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        wallet_address: wallet,
        username,
        referral_code: payload.referralCode ?? null,
        use_skr_as_display: payload.useSkrAsDisplay,
        skr_domain: payload.skrDomain ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || `complete-onboarding failed (${res.status})` };
    }
    return {
      success: true,
      username: data.username || username,
      referralRegistered: data.referralRegistered === true,
      referralError: data.referralError,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Network error',
    };
  }
}

// Legacy fallback path kept for reference — not executed (the function
// returns above). The old client-upsert flow was blocked by RLS.
async function _completeOnboarding_legacy_disabled(
  _walletAddress: string,
  _payload: CompleteOnboardingPayload,
): Promise<CompleteOnboardingResult> {
  const wallet = _walletAddress.trim();
  const username = _payload.username.trim();
  const now = new Date().toISOString();
  // Upsert: existing rows get the timestamps; new rows get full profile.
  const { error: upsertError } = await supabase
    .from('player_profiles')
    .upsert(
      {
        wallet_address: wallet,
        username,
        age_verified_at: now,
        tos_accepted_at: now,
        onboarded_at: now,
        last_activity_date: now.split('T')[0],
        ...(_payload.useSkrAsDisplay !== undefined && { use_skr_as_display: _payload.useSkrAsDisplay }),
        ...(_payload.skrDomain !== undefined && _payload.skrDomain !== null && { skr_domain: _payload.skrDomain }),
      },
      { onConflict: 'wallet_address' },
    );

  if (upsertError) {
    const msg = (upsertError.message || '').toLowerCase();
    // Friendly translation for the case-insensitive username unique index.
    if (msg.includes('unique') && msg.includes('username')) {
      return { success: false, error: 'That username is taken. Try another one.' };
    }
    return { success: false, error: upsertError.message || 'Failed to save profile' };
  }

  // Referral is optional. If provided, register it via the existing EF.
  let referralRegistered = false;
  let referralError: string | undefined;
  const refCode = _payload.referralCode?.trim();
  if (refCode) {
    try {
      await registerReferral(wallet, refCode);
      referralRegistered = true;
    } catch (err) {
      // Self-referral / already-referred / invalid code: surface but don't
      // block onboarding completion.
      referralError = err instanceof Error ? err.message : String(err);
    }
  }

  return { success: true, username, referralRegistered, referralError };
}

// Quests: fetch definitions and user progress
export async function fetchQuests(): Promise<Quest[]> {
  const { data, error } = await supabase
    .from('quests')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []) as Quest[];
}

export async function fetchUserQuestProgress(walletAddress: string): Promise<UserQuestProgress[]> {
  const { data, error } = await supabase
    .from('user_quest_progress')
    .select(`
      wallet_address,
      quest_id,
      progress,
      completed_at,
      claimed_at,
      quest:quests(*)
    `)
    .eq('wallet_address', walletAddress);
  if (error) throw new Error(error.message);
  return (data || []) as unknown as UserQuestProgress[];
}

export async function updateQuestProgress(walletAddress: string, questSlug: string, progress: number): Promise<void> {
  const url = `${FUNCTIONS_URL}/update-quest-progress`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address: walletAddress, quest_slug: questSlug, progress }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Failed to update quest progress');
  }
}

/** Use Realtime only when explicitly enabled; otherwise polling only (avoids WebSocket errors when proxy/network blocks wss). */
const REALTIME_ON = import.meta.env.VITE_ENABLE_SUPABASE_REALTIME === 'true';

export function subscribeUserQuestProgress(
  walletAddress: string,
  onData: (rows: UserQuestProgress[]) => void
): { unsubscribe: () => void } {
  if (!REALTIME_ON) return { unsubscribe: () => {} };
  const channelName = `quest-progress-${walletAddress}`;
  const ch = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_quest_progress',
        filter: `wallet_address=eq.${walletAddress}`,
      },
      () => {
        fetchUserQuestProgress(walletAddress).then(onData).catch(() => {});
      }
    );
  ch.subscribe();
  return {
    unsubscribe: () => supabase.removeChannel(ch),
  };
}

/** Subscribe to quests table changes (add/delete/update/pause). Refreshes active quest list. */
export function subscribeQuests(onQuests: (quests: Quest[]) => void): { unsubscribe: () => void } {
  if (!REALTIME_ON) return { unsubscribe: () => {} };
  const channelName = 'quests-realtime';
  const ch = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'quests' },
      () => {
        fetchQuests().then(onQuests).catch(() => {});
      }
    );
  ch.subscribe();
  return {
    unsubscribe: () => supabase.removeChannel(ch),
  };
}

export type QuestSubmissionStatus = 'pending' | 'approved' | 'rejected';
export interface QuestSubmission {
  id: string;
  quest_id: string;
  wallet_address: string;
  status: QuestSubmissionStatus;
  proof_url: string;
  created_at: string;
}

/** Fetch this wallet's proof submissions, keyed by quest_id with the latest row per quest. */
export async function fetchUserQuestSubmissions(walletAddress: string): Promise<QuestSubmission[]> {
  const { data, error } = await supabase
    .from('quest_submissions')
    .select('id, quest_id, wallet_address, status, proof_url, created_at')
    .eq('wallet_address', walletAddress)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []) as QuestSubmission[];
}

/** Submit proof URL for any active quest. Admin approves later; user clicks Claim to receive TP. true_raider auto-approves+claims. */
export async function submitQuestProof(
  walletAddress: string,
  questSlug: string,
  proofUrl: string
): Promise<{ ok: boolean; error?: string; message?: string; auto_claimed?: boolean; reward_tp?: number }> {
  const url = `${FUNCTIONS_URL}/submit-quest-proof`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address: walletAddress, quest_slug: questSlug, proof_url: proofUrl }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json.error || 'Submit failed' };
  return { ok: true, message: json.message, auto_claimed: json.auto_claimed, reward_tp: json.reward_tp };
}

/** Claim completed quest reward. Returns reward_tp on success. */
export async function claimQuestReward(walletAddress: string, questId: string): Promise<{ success: boolean; reward_tp?: number; error?: string }> {
  const url = `${FUNCTIONS_URL}/claim-quest-reward`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address: walletAddress, quest_id: questId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: json.error || 'Claim failed' };
  return { success: true, reward_tp: json.reward_tp };
}

// ─── Round labels and current round stats ─────────────────────────────────
/** Human-readable title for a 6-hour round (e.g. "Feb 4, 2025 · 00:00–06:00 UTC"). */
export function getRoundLabel(dateStr: string, roundNumber: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const startHour = roundNumber * 6;
  const endHour = startHour + 6;
  const start = `${String(startHour).padStart(2, '0')}:00`;
  const end = endHour === 24 ? '00:00' : `${String(endHour).padStart(2, '0')}:00`;
  return `${dateFormatted} · ${start}–${end} UTC`;
}

export function getCurrentRoundKey(): { date: string; roundNumber: number } {
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const roundNumber = Math.floor(now.getUTCHours() / 6);
  return { date, roundNumber };
}

export interface CurrentRoundStats {
  prizePoolSol: number;
  playersEntered: number;
}

/** Fetch current round pot and player count from Supabase (fast, single row). daily_rounds has pot_lamports + player_count only (no entry_count). */
export async function fetchCurrentRoundStats(): Promise<CurrentRoundStats> {
  const { date, roundNumber } = getCurrentRoundKey();
  const { data, error } = await supabase
    .from('daily_rounds')
    .select('pot_lamports, player_count')
    .eq('date', date)
    .eq('round_number', roundNumber)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const pot = (data?.pot_lamports ?? 0) as number;
  const players = (data?.player_count ?? 0) as number;
  return {
    prizePoolSol: pot / 1_000_000_000,
    playersEntered: players,
  };
}

/** Single payout row (top 5 per round, 100% pot share). */
export interface RoundPayout {
  round_id: string;
  rank: number;
  wallet_address: string;
  score: number;
  prize_lamports: number;
  paid_at: string | null;
  paid_lamports: number | null;
  winner_display_name?: string | null;
  winner_avatar?: string | null;
}

/** Round with winner info for the Round Winners page. */
export interface RoundWithWinner {
  round_id: string;
  date: string;
  round_number: number;
  round_title: string;
  pot_lamports: number;
  player_count: number;
  /** When 'refund', round had <5 players and entries will be refunded. */
  status?: string | null;
  winner_wallet: string | null;
  winner_display_name: string | null;
  winner_avatar: string | null;
  winner_score: number;
  /** Top 5 payouts (100% of pot: 1st 50%, 2nd 20%, 3rd 15%, 4th 10%, 5th 5%). */
  payouts?: RoundPayout[];
}

/** Fetch past rounds with winner from dedicated round_winners table (fixed schema; no game_sessions query). */
export async function fetchRoundsWithWinners(limit = 40): Promise<RoundWithWinner[]> {
  const { data: rounds, error: roundsError } = await supabase
    .from('daily_rounds')
    .select('id, date, round_number, pot_lamports, player_count, status')
    .order('date', { ascending: false })
    .order('round_number', { ascending: false })
    .limit(limit);

  if (roundsError || !rounds?.length) return [];

  const roundIds = rounds.map((r) => r.id);
  const { data: winners, error: winnersError } = await supabase
    .from('round_winners')
    .select('round_id, winner_wallet, winner_score')
    .in('round_id', roundIds);

  // One winner per round: keep the row with the highest score (no duplicate wallets/scores per round)
  const winnerByRoundId = new Map<string, { winner_wallet: string | null; winner_score: number }>();
  if (!winnersError && winners?.length) {
    winners.forEach((w: { round_id: string; winner_wallet: string | null; winner_score: number }) => {
      const score = Number(w.winner_score ?? 0);
      const cur = winnerByRoundId.get(w.round_id);
      if (!cur || score > cur.winner_score) {
        winnerByRoundId.set(w.round_id, { winner_wallet: w.winner_wallet ?? null, winner_score: score });
      }
    });
  }

  const winnerWallets = [...new Set([...winnerByRoundId.values()].map((v) => v.winner_wallet).filter(Boolean) as string[])];
  let profiles: { wallet_address: string; username: string | null; avatar_url: string | null }[] = [];
  if (winnerWallets.length > 0) {
    const { data: prof } = await supabase
      .from('player_profiles')
      .select('wallet_address, username, avatar_url')
      .in('wallet_address', winnerWallets);
    profiles = prof ?? [];
  }
  const profileByWallet = Object.fromEntries(profiles.map((p) => [p.wallet_address, p]));

  const payoutsByRound = await fetchRoundPayouts(roundIds);
  const allPayoutWallets = new Set<string>();
  payoutsByRound.forEach((p) => allPayoutWallets.add(p.wallet_address));
  let payoutProfiles: { wallet_address: string; username: string | null; avatar_url: string | null }[] = [];
  if (allPayoutWallets.size > 0) {
    const { data: pp } = await supabase.from('player_profiles').select('wallet_address, username, avatar_url').in('wallet_address', [...allPayoutWallets]);
    payoutProfiles = pp ?? [];
  }
  const payoutProfileByWallet = Object.fromEntries(payoutProfiles.map((p) => [p.wallet_address, p]));

  /** Per round: keep only the highest-score entry per wallet (dedupe so each wallet appears once). */
  const dedupePayoutsByWallet = (list: RoundPayout[]): RoundPayout[] => {
    const byWallet = new Map<string, RoundPayout>();
    for (const p of list) {
      const cur = byWallet.get(p.wallet_address);
      if (!cur || Number(p.score) > Number(cur.score)) byWallet.set(p.wallet_address, p);
    }
    return [...byWallet.values()].sort((a, b) => Number(b.score) - Number(a.score));
  };

  return rounds.map((r) => {
    const w = winnerByRoundId.get(r.id);
    const winnerWallet = w?.winner_wallet ?? null;
    const winnerScore = w?.winner_score ?? 0;
    const profile = winnerWallet ? profileByWallet[winnerWallet] : null;
    const rawPayouts = (payoutsByRound.filter((p) => p.round_id === r.id) as RoundPayout[]).map((p) => ({
      ...p,
      winner_display_name: payoutProfileByWallet[p.wallet_address]?.username ?? null,
      winner_avatar: payoutProfileByWallet[p.wallet_address]?.avatar_url ?? null,
    }));
    const payouts: RoundPayout[] = dedupePayoutsByWallet(rawPayouts).map((p, i) => ({ ...p, rank: i + 1 }));
    return {
      round_id: r.id,
      date: r.date,
      round_number: r.round_number,
      round_title: getRoundLabel(r.date, r.round_number),
      pot_lamports: r.pot_lamports ?? 0,
      player_count: r.player_count ?? 0,
      status: (r as { status?: string }).status ?? null,
      winner_wallet: winnerWallet,
      winner_display_name: profile?.username ?? null,
      winner_avatar: profile?.avatar_url ?? null,
      winner_score: winnerScore,
      payouts,
    };
  });
}

/** Paginated version of fetchRoundsWithWinners for the public leaderboard. */
export async function fetchRoundsWithWinnersPaginated(
  page: number,
  pageSize: number,
  filterDate?: string,
): Promise<{ rounds: RoundWithWinner[]; totalCount: number }> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('daily_rounds')
    .select('id, date, round_number, pot_lamports, player_count, status', { count: 'exact' })
    .order('date', { ascending: false })
    .order('round_number', { ascending: false });

  if (filterDate) {
    query = query.eq('date', filterDate);
  }

  const { data: rounds, count, error: roundsError } = await query.range(from, to);

  if (roundsError || !rounds?.length) return { rounds: [], totalCount: count ?? 0 };

  const roundIds = rounds.map((r) => r.id);
  const { data: winners, error: winnersError } = await supabase
    .from('round_winners')
    .select('round_id, winner_wallet, winner_score')
    .in('round_id', roundIds);

  const winnerByRoundId = new Map<string, { winner_wallet: string | null; winner_score: number }>();
  if (!winnersError && winners?.length) {
    winners.forEach((w: { round_id: string; winner_wallet: string | null; winner_score: number }) => {
      const score = Number(w.winner_score ?? 0);
      const cur = winnerByRoundId.get(w.round_id);
      if (!cur || score > cur.winner_score) {
        winnerByRoundId.set(w.round_id, { winner_wallet: w.winner_wallet ?? null, winner_score: score });
      }
    });
  }

  const winnerWallets = [...new Set([...winnerByRoundId.values()].map((v) => v.winner_wallet).filter(Boolean) as string[])];
  let profiles: { wallet_address: string; username: string | null; avatar_url: string | null }[] = [];
  if (winnerWallets.length > 0) {
    const { data: prof } = await supabase.from('player_profiles').select('wallet_address, username, avatar_url').in('wallet_address', winnerWallets);
    profiles = prof ?? [];
  }
  const profileByWallet = Object.fromEntries(profiles.map((p) => [p.wallet_address, p]));

  const payoutsByRound = await fetchRoundPayouts(roundIds);
  const allPayoutWallets = new Set<string>();
  payoutsByRound.forEach((p) => allPayoutWallets.add(p.wallet_address));
  let payoutProfiles: { wallet_address: string; username: string | null; avatar_url: string | null }[] = [];
  if (allPayoutWallets.size > 0) {
    const { data: pp } = await supabase.from('player_profiles').select('wallet_address, username, avatar_url').in('wallet_address', [...allPayoutWallets]);
    payoutProfiles = pp ?? [];
  }
  const payoutProfileByWallet = Object.fromEntries(payoutProfiles.map((p) => [p.wallet_address, p]));

  const dedupePayoutsByWallet = (list: RoundPayout[]): RoundPayout[] => {
    const byWallet = new Map<string, RoundPayout>();
    for (const p of list) {
      const cur = byWallet.get(p.wallet_address);
      if (!cur || Number(p.score) > Number(cur.score)) byWallet.set(p.wallet_address, p);
    }
    return [...byWallet.values()].sort((a, b) => Number(b.score) - Number(a.score));
  };

  const result = rounds.map((r) => {
    const w = winnerByRoundId.get(r.id);
    const winnerWallet = w?.winner_wallet ?? null;
    const winnerScore = w?.winner_score ?? 0;
    const profile = winnerWallet ? profileByWallet[winnerWallet] : null;
    const rawPayouts = (payoutsByRound.filter((p) => p.round_id === r.id) as RoundPayout[]).map((p) => ({
      ...p,
      winner_display_name: payoutProfileByWallet[p.wallet_address]?.username ?? null,
      winner_avatar: payoutProfileByWallet[p.wallet_address]?.avatar_url ?? null,
    }));
    const payouts: RoundPayout[] = dedupePayoutsByWallet(rawPayouts).map((p, i) => ({ ...p, rank: i + 1 }));
    return {
      round_id: r.id,
      date: r.date,
      round_number: r.round_number,
      round_title: getRoundLabel(r.date, r.round_number),
      pot_lamports: r.pot_lamports ?? 0,
      player_count: r.player_count ?? 0,
      status: (r as { status?: string }).status ?? null,
      winner_wallet: winnerWallet,
      winner_display_name: profile?.username ?? null,
      winner_avatar: profile?.avatar_url ?? null,
      winner_score: winnerScore,
      payouts,
    };
  });

  return { rounds: result, totalCount: count ?? 0 };
}

/** Fetch top 5 payouts for given round ids (from round_payouts). */
export async function fetchRoundPayouts(roundIds: string[]): Promise<RoundPayout[]> {
  if (roundIds.length === 0) return [];
  const { data, error } = await supabase
    .from('round_payouts')
    .select('round_id, rank, wallet_address, score, prize_lamports, paid_at, paid_lamports')
    .in('round_id', roundIds)
    .order('rank', { ascending: true });
  if (error) return [];
  return (data ?? []) as RoundPayout[];
}

/** Total SOL won (lamports) per wallet from round_payouts + duel winnings. For leaderboard SOL won column. */
export async function getTotalSolWonByWallets(walletAddresses: string[]): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || walletAddresses.length === 0) return {};
  const uniq = [...new Set(walletAddresses)].slice(0, 200);
  const out: Record<string, number> = {};

  // Round payouts
  const { data: roundData, error: roundErr } = await supabase
    .from('round_payouts')
    .select('wallet_address, prize_lamports, paid_lamports')
    .in('wallet_address', uniq);
  if (!roundErr) {
    for (const row of roundData ?? []) {
      const w = row.wallet_address as string;
      const lamports = Number(row.paid_lamports ?? row.prize_lamports ?? 0) || 0;
      out[w] = (out[w] ?? 0) + lamports;
    }
  }

  // Duel winnings (winner gets 2x entry fee)
  const { data: duelData, error: duelErr } = await supabase
    .from('duels')
    .select('winner_wallet, entry_fee_lamports')
    .in('winner_wallet', uniq)
    .in('status', ['completed', 'resolved']);
  if (!duelErr) {
    for (const row of duelData ?? []) {
      const w = row.winner_wallet as string;
      const lamports = Number(row.entry_fee_lamports ?? 0) * 2;
      out[w] = (out[w] ?? 0) + lamports;
    }
  }

  return out;
}

/** A single row in a mode-specific (rounds/duels/custom) SOL-won leaderboard. */
export interface ModeLeaderboardRow {
  wallet_address: string;
  display_name: string | null;
  avatar_url: string | null;
  sol_lamports: number;
  wins: number;
}

/**
 * Real SOL-won leaderboard for the ROUNDS / DUELS / CUSTOM tabs, aggregated
 * client-side from the source tables and joined to player_profiles. No EF —
 * these mode leaderboards don't exist server-side yet.
 */
export async function getModeLeaderboard(
  mode: 'rounds' | 'duels' | 'custom',
  limit = 25,
): Promise<ModeLeaderboardRow[]> {
  if (!isSupabaseConfigured) return [];
  const tally = new Map<string, { lamports: number; wins: number }>();
  const add = (w: string | null | undefined, lamports: number) => {
    if (!w) return;
    const cur = tally.get(w) ?? { lamports: 0, wins: 0 };
    cur.lamports += lamports;
    cur.wins += 1;
    tally.set(w, cur);
  };

  if (mode === 'rounds') {
    const { data } = await supabase
      .from('round_payouts')
      .select('wallet_address, prize_lamports, paid_lamports')
      .limit(5000);
    for (const r of (data ?? []) as any[]) {
      add(r.wallet_address, Number(r.paid_lamports ?? r.prize_lamports ?? 0) || 0);
    }
  } else if (mode === 'duels') {
    const { data } = await supabase
      .from('duels')
      .select('winner_wallet, total_pot_lamports, entry_fee_lamports')
      .in('status', ['completed', 'resolved'])
      .not('winner_wallet', 'is', null)
      .limit(5000);
    for (const d of (data ?? []) as any[]) {
      const pot = Number(d.total_pot_lamports ?? 0) || Number(d.entry_fee_lamports ?? 0) * 2;
      add(d.winner_wallet, pot);
    }
  } else {
    const { data } = await supabase
      .from('custom_games')
      .select('winner_wallets, winner_amounts')
      .eq('status', 'finalized')
      .limit(5000);
    for (const g of (data ?? []) as any[]) {
      const wallets: string[] = g.winner_wallets ?? [];
      const amounts: number[] = g.winner_amounts ?? [];
      wallets.forEach((w, i) => add(w, Number(amounts[i] ?? 0) || 0));
    }
  }

  const sorted = [...tally.entries()]
    .map(([wallet_address, v]) => ({ wallet_address, sol_lamports: v.lamports, wins: v.wins }))
    .sort((a, b) => b.sol_lamports - a.sol_lamports)
    .slice(0, limit);
  if (sorted.length === 0) return [];

  const wallets = sorted.map((s) => s.wallet_address);
  const { data: profs } = await supabase
    .from('player_profiles')
    .select('wallet_address, username, avatar_url')
    .in('wallet_address', wallets);
  const byWallet = Object.fromEntries((profs ?? []).map((p: any) => [p.wallet_address, p]));

  return sorted.map((s) => ({
    wallet_address: s.wallet_address,
    display_name: byWallet[s.wallet_address]?.username ?? null,
    avatar_url: byWallet[s.wallet_address]?.avatar_url ?? null,
    sol_lamports: s.sol_lamports,
    wins: s.wins,
  }));
}

// ─── Global Live Feed ─────────────────────────────────────────────────────

export type LiveFeedKind = 'win' | 'place' | 'xp' | 'duel_win' | 'duel_new' | 'streak';

export interface LiveFeedItem {
  id: string;
  text: string;
  kind: LiveFeedKind;
  highlight: boolean;
  at: number;
}

const STREAK_MILESTONES = [5, 10, 25, 50, 100];

/**
 * Aggregate recent global activity for the Home live feed: round XP + SOL
 * payouts, duel wins, freshly opened duels, and active streaks. Reads public
 * tables and joins player_profiles for display names. Poll it for "real-time".
 */
export async function getLiveFeed(limit = 14): Promise<LiveFeedItem[]> {
  if (!isSupabaseConfigured) return [];

  const [gsRes, duelWonRes, duelNewRes, customRes, streakRes] = await Promise.all([
    supabase
      .from('game_sessions')
      .select('wallet_address, score, rank, payout_lamports, finished_at, daily_rounds(round_number)')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(20),
    supabase
      .from('duels')
      .select('duel_id, winner_wallet, total_pot_lamports, resolved_at')
      .in('status', ['completed', 'resolved'])
      .not('winner_wallet', 'is', null)
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(10),
    supabase
      .from('duels')
      .select('duel_id, player1_wallet, entry_fee_lamports, created_at')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('custom_game_sessions')
      .select('wallet_address, score, finished_at, custom_games(name)')
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(10),
    supabase
      .from('player_profiles')
      .select('wallet_address, current_streak, last_activity_date')
      .gte('current_streak', 5)
      .order('last_activity_date', { ascending: false })
      .limit(10),
  ]);

  // Collect every wallet that appears, fetch display names in one query.
  const wallets = new Set<string>();
  for (const g of (gsRes.data ?? []) as any[]) if (g.wallet_address) wallets.add(g.wallet_address);
  for (const d of (duelWonRes.data ?? []) as any[]) if (d.winner_wallet) wallets.add(d.winner_wallet);
  for (const d of (duelNewRes.data ?? []) as any[]) if (d.player1_wallet) wallets.add(d.player1_wallet);
  for (const c of (customRes.data ?? []) as any[]) if (c.wallet_address) wallets.add(c.wallet_address);
  for (const p of (streakRes.data ?? []) as any[]) if (p.wallet_address) wallets.add(p.wallet_address);

  let nameByWallet: Record<string, string> = {};
  if (wallets.size > 0) {
    const { data: profs } = await supabase
      .from('player_profiles')
      .select('wallet_address, username')
      .in('wallet_address', [...wallets]);
    nameByWallet = Object.fromEntries(
      (profs ?? []).map((p: any) => [p.wallet_address, p.username || null]),
    );
  }
  const name = (w: string) =>
    nameByWallet[w] ? `@${String(nameByWallet[w]).replace(/^@/, '')}` : `${w.slice(0, 4)}…${w.slice(-4)}`;

  const items: LiveFeedItem[] = [];

  for (const g of (gsRes.data ?? []) as any[]) {
    if (!g.finished_at) continue;
    const at = new Date(g.finished_at).getTime();
    const roundNum = g.daily_rounds ? (g.daily_rounds.round_number ?? 0) + 1 : null;
    const roundTag = roundNum ? ` · Round #${roundNum}` : '';
    const sol = (g.payout_lamports ?? 0) / 1_000_000_000;
    if (sol > 0) {
      items.push({ id: `gs-win-${g.wallet_address}-${at}`, text: `${name(g.wallet_address)} won ${sol.toFixed(3)} SOL${roundTag}`, kind: 'win', highlight: true, at });
    } else if (g.rank != null && g.rank <= 5) {
      items.push({ id: `gs-place-${g.wallet_address}-${at}`, text: `${name(g.wallet_address)} placed #${g.rank}${roundTag}`, kind: 'place', highlight: false, at });
    } else if (g.score != null) {
      items.push({ id: `gs-xp-${g.wallet_address}-${at}`, text: `${name(g.wallet_address)} earned ${Number(g.score).toLocaleString()} XP${roundTag}`, kind: 'xp', highlight: false, at });
    }
  }

  for (const d of (duelWonRes.data ?? []) as any[]) {
    if (!d.resolved_at) continue;
    const at = new Date(d.resolved_at).getTime();
    const sol = (d.total_pot_lamports ?? 0) / 1_000_000_000;
    items.push({ id: `duel-win-${d.duel_id}`, text: `${name(d.winner_wallet)} won a duel · +${sol.toFixed(3)} SOL`, kind: 'duel_win', highlight: true, at });
  }

  for (const d of (duelNewRes.data ?? []) as any[]) {
    if (!d.created_at) continue;
    const at = new Date(d.created_at).getTime();
    const sol = (d.entry_fee_lamports ?? 0) / 1_000_000_000;
    items.push({ id: `duel-new-${d.duel_id}`, text: `${name(d.player1_wallet)} opened a ${sol.toFixed(2)} SOL duel`, kind: 'duel_new', highlight: false, at });
  }

  for (const c of (customRes.data ?? []) as any[]) {
    if (!c.finished_at) continue;
    const at = new Date(c.finished_at).getTime();
    const game = c.custom_games?.name ?? 'a custom game';
    if (c.score != null) {
      items.push({ id: `custom-${c.wallet_address}-${at}`, text: `${name(c.wallet_address)} scored ${Number(c.score).toLocaleString()} in ${game}`, kind: 'xp', highlight: false, at });
    }
  }

  for (const p of (streakRes.data ?? []) as any[]) {
    const streak = Number(p.current_streak) || 0;
    if (streak < 5) continue;
    const isMilestone = STREAK_MILESTONES.includes(streak);
    const at = p.last_activity_date ? new Date(p.last_activity_date).getTime() : 0;
    items.push({ id: `streak-${p.wallet_address}`, text: `${name(p.wallet_address)} on a ${streak}-day streak`, kind: 'streak', highlight: isMilestone, at });
  }

  items.sort((a, b) => b.at - a.at);
  return items.slice(0, limit);
}

/** Round payout for a wallet with date/round_number for on-chain claim (contract round_id). */
export interface ClaimablePayout {
  round_id: string;
  date: string;
  round_number: number;
  rank: number;
  prize_lamports: number;
  contract_round_id: number;
  round_title: string;
  tier_index: number;
}

/** Fetch round payouts for a wallet with daily_rounds date/round_number (for claim button). */
export async function fetchClaimableRoundPayouts(walletAddress: string): Promise<ClaimablePayout[]> {
  if (!isSupabaseConfigured || !walletAddress?.trim()) return [];
  const { data: payouts, error: payErr } = await supabase
    .from('round_payouts')
    .select('round_id, rank, prize_lamports, tier_index')
    .eq('wallet_address', walletAddress.trim())
    .is('paid_at', null);
  if (payErr || !payouts?.length) return [];
  const roundIds = [...new Set((payouts as { round_id: string }[]).map((p) => p.round_id))];
  const { data: rounds, error: roundErr } = await supabase
    .from('daily_rounds')
    .select('id, date, round_number')
    .in('id', roundIds)
    .gte('date', '2026-02-22'); // V2 contract only — exclude V1 rounds
  if (roundErr || !rounds?.length) return [];
  const byId = Object.fromEntries((rounds as { id: string; date: string; round_number: number }[]).map((r) => [r.id, r]));
  function contractRoundId(dateStr: string, roundNumber: number): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    const epoch = new Date(Date.UTC(1970, 0, 1)).getTime();
    const day = new Date(Date.UTC(y, m - 1, d)).getTime();
    const daysSinceEpoch = Math.floor((day - epoch) / 86400_000);
    return daysSinceEpoch * 4 + (roundNumber & 3);
  }
  return (payouts as { round_id: string; rank: number; prize_lamports: number; tier_index?: number }[])
    .map((p) => {
      const r = byId[p.round_id];
      if (!r) return null;
      const contract_round_id = contractRoundId(r.date, r.round_number);
      return {
        round_id: p.round_id,
        date: r.date,
        round_number: r.round_number,
        rank: p.rank,
        prize_lamports: p.prize_lamports ?? 0,
        contract_round_id,
        round_title: `${r.date} Round ${r.round_number + 1}`,
        tier_index: p.tier_index ?? 0,
      };
    })
    .filter((x): x is ClaimablePayout => x != null)
    .sort((a, b) => (b.date + b.round_number).localeCompare(a.date + a.round_number));
}

/** Mark a round payout as paid (admin). Calls Edge Function. */
export async function markPayoutPaid(
  roundId: string,
  rank: number,
  paidLamports: number,
  adminUsername?: string,
  adminPassword?: string
): Promise<{ success: boolean; error?: string }> {
  const url = `${FUNCTIONS_URL}/mark-payout-paid`;
  const res = await fetch(url, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({
      round_id: roundId,
      rank,
      paid_lamports: paidLamports,
      ...(adminUsername != null && { admin_username: adminUsername }),
      ...(adminPassword != null && { admin_password: adminPassword }),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: (json as { error?: string }).error || 'Failed to mark paid' };
  return { success: true };
}

/** Mark payout as claimed (self-service after user claims on-chain). So profile shows "Claimed" and does not show Claim again. */
export async function markPayoutClaimed(roundId: string, walletAddress: string, tierIndex?: number): Promise<{ success: boolean; error?: string }> {
  const url = `${FUNCTIONS_URL}/mark-payout-claimed`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ round_id: roundId, wallet_address: walletAddress, ...(tierIndex != null && { tier_index: tierIndex }) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: (json as { error?: string }).error || 'Failed to mark claimed' };
  return { success: true };
}

/** Same shape as ClaimablePayout but for already-claimed (paid_at set). */
export interface ClaimedPayout {
  round_id: string;
  date: string;
  round_number: number;
  rank: number;
  prize_lamports: number;
  round_title: string;
  paid_at: string | null;
}

/** Fetch round payouts for a wallet that are already claimed (paid_at set). */
export async function fetchClaimedRoundPayouts(walletAddress: string): Promise<ClaimedPayout[]> {
  if (!isSupabaseConfigured || !walletAddress?.trim()) return [];
  const { data: payouts, error: payErr } = await supabase
    .from('round_payouts')
    .select('round_id, rank, prize_lamports, paid_at')
    .eq('wallet_address', walletAddress.trim())
    .not('paid_at', 'is', null);
  if (payErr || !payouts?.length) return [];
  const roundIds = [...new Set((payouts as { round_id: string }[]).map((p) => p.round_id))];
  const { data: rounds, error: roundErr } = await supabase
    .from('daily_rounds')
    .select('id, date, round_number')
    .in('id', roundIds)
    .gte('date', '2026-02-22'); // V2 contract only — exclude V1 rounds
  if (roundErr || !rounds?.length) return [];
  const byId = Object.fromEntries((rounds as { id: string; date: string; round_number: number }[]).map((r) => [r.id, r]));
  return (payouts as { round_id: string; rank: number; prize_lamports: number; paid_at: string | null }[])
    .map((p) => {
      const r = byId[p.round_id];
      if (!r) return null;
      return {
        round_id: p.round_id,
        date: r.date,
        round_number: r.round_number,
        rank: p.rank,
        prize_lamports: p.prize_lamports ?? 0,
        round_title: `${r.date} Round ${r.round_number + 1}`,
        paid_at: p.paid_at,
      };
    })
    .filter((x): x is ClaimedPayout => x != null)
    .sort((a, b) => (b.date + b.round_number).localeCompare(a.date + a.round_number));
}

/** Request posting round winners on-chain (Solana contract). Optional path when claim fails with RoundNotFinalized (first claimer can trigger it alongside complete-session). */
export async function postWinnersOnChain(roundId: string, tierIndex?: number): Promise<{ success: boolean; signature?: string; error?: string }> {
  const url = `${FUNCTIONS_URL}/post-winners-on-chain`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ round_id: roundId, ...(tierIndex != null && { tier_index: tierIndex }) }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false, error: (json as { error?: string }).error || 'Failed to post winners on-chain' };
  return { success: true, signature: (json as { signature?: string }).signature };
}

// ─── Practice Mode API (Free play, no wallet required) ───────────────────

export interface PracticeGameResponse {
  practice_session_id: string;
  question_ids: string[];
  total_questions: number;
  mode: 'practice';
  category: string;
  has_game_pass: boolean;
}

export interface PracticeQuestion {
  index: number;
  id: string;
  category: string;
  difficulty: string;
  text: string;
  options: string[];
  correct_index: number; // Included for client-side scoring
}

export interface GetPracticeQuestionsResponse {
  questions: PracticeQuestion[];
  total_questions: number;
  time_per_question: number;
  mode: 'practice';
}

/** Start a practice game session (no payment required). Optional category + wallet for game pass gating. */
export async function startPracticeGame(options?: { category?: string; wallet_address?: string }): Promise<PracticeGameResponse> {
  const body: Record<string, string> = {};
  if (options?.category) body.category = options.category;
  if (options?.wallet_address) body.wallet_address = options.wallet_address;

  const response = await fetch(`${FUNCTIONS_URL}/practice-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const err = new Error(error.error || 'Failed to start practice game');
    (err as any).requires_pass = error.requires_pass ?? false;
    (err as any).category = error.category ?? null;
    // v29 EF: 429 PRACTICE_CAP_REACHED when at 5/24h cap. Surface the code
    // so callers can show a "buy Game Pass" CTA instead of a generic error.
    (err as any).code = error.code ?? null;
    (err as any).cap = error.cap ?? null;
    (err as any).remaining = error.remaining ?? null;
    (err as any).status = response.status;
    throw err;
  }

  return response.json();
}

/** Get practice questions for a practice session */
export async function getPracticeQuestions(question_ids: string[]): Promise<GetPracticeQuestionsResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/get-practice-questions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ question_ids }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get practice questions');
  }

  return response.json();
}

// ─── Practice mode , v2.1 server-side scoring + 5/24h cap ───────────────

/**
 * Server-side scoring for practice mode. Mirrors submit-answer v52 formula
 * (100 base + 900 speed bonus over 15s). Closes the dev-tools answer leak:
 * the client no longer reads correct_index from get-practice-questions for
 * scoring , it sends the picked index to this EF and gets the verdict back.
 *
 * Stateless: no session row, no persisted answer. Practice has no rewards.
 */
export interface SubmitPracticeAnswerParams {
  question_id: string;
  selected_index?: number;
  time_taken_ms: number;
  time_expired?: boolean;
}
export interface SubmitPracticeAnswerResponse {
  correct: boolean;
  correctIndex: number;
  pointsEarned: number;
  timeMs: number;
  timedOut: boolean;
}
export async function submitPracticeAnswer(params: SubmitPracticeAnswerParams): Promise<SubmitPracticeAnswerResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/submit-practice-answer`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to submit practice answer');
  }
  return response.json();
}

/**
 * Get remaining practice plays in the current 24h rolling window for this
 * wallet. Returns 0-5. Game Pass holders should bypass this RPC on the
 * frontend and treat as Infinity (the RPC itself doesn't special-case GP).
 */
export async function getFreePlaysRemaining(wallet_address: string): Promise<number> {
  if (!isSupabaseConfigured) return 5;
  const { data, error } = await supabase.rpc('get_free_plays_remaining', { p_wallet: wallet_address });
  if (error) {
    console.warn('[practice] get_free_plays_remaining RPC failed:', error);
    // Soft fail: assume 5 remaining if RPC is down. Client gates secondary
    // via the cap check on the next practice-game call.
    return 5;
  }
  return Math.max(0, Math.min(5, Number(data ?? 0)));
}

// ─── Game Pass (Category Unlock) ──────────────────────────────────────────

export interface GamePassResponse {
  success: boolean;
  wallet_address: string;
  is_active: boolean;
  purchased_at: string;
}

export interface GamePassStatus {
  has_pass: boolean;
  is_active: boolean;
  purchased_at: string | null;
  expires_at?: string | null;
}

export type GamePassPlan = 'monthly' | 'annual';

/** Purchase a game pass (unlocks premium categories + unlimited practice). */
export async function purchaseGamePass(
  walletAddress: string,
  txSignature: string,
  paymentToken?: string,
  amountUsd?: number,
  plan: GamePassPlan = 'monthly',
  opts?: { usd_price_cents?: number; token_mint?: string },
): Promise<GamePassResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/purchase-game-pass`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      walletAddress, txSignature, paymentToken, amountUsd, plan,
      ...(opts?.usd_price_cents != null && { usd_price_cents: opts.usd_price_cents }),
      ...(opts?.token_mint && { token_mint: opts.token_mint }),
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = body.details ? `${body.error || 'Failed to purchase game pass'}: ${body.details}` : (body.error || 'Failed to purchase game pass');
    throw new Error(msg);
  }
  return body as GamePassResponse;
}

// NEW (2026-05-30): build the multi-token + multi-recipient Game Pass purchase tx server-side.
// Returns base64 v0 tx for the client to sign + submit. Then the client calls purchaseGamePass
// with the new opts (usd_price_cents + token_mint) to trigger the new 2-leg verify path.
export interface BuildGamePassTxRequest {
  walletAddress: string;
  plan: GamePassPlan;
  paymentToken: 'SOL' | 'USDC' | 'SKR' | 'NERD';
  token_mint?: string;
  usd_price_cents?: number;
}

export interface BuildGamePassTxResponse {
  ok: boolean;
  tx_base64: string;
  blockhash: string;
  last_valid_block_height: number;
  plan: string;
  days: number;
  paymentToken: string;
  token_mint: string;
  usd_price_cents: number;
  total_token_amount: string;
  revenue_amount: string;
  referrer_amount: string;
  referrer_wallet: string | null;
  is_seeker: boolean;
  jupiter_price_usd: number;
  platform_fee_lamports: number;
}

export async function buildGamePassTx(
  params: BuildGamePassTxRequest,
): Promise<BuildGamePassTxResponse> {
  const url = `${FUNCTIONS_URL}/build-game-pass-tx`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = body.details ? `${body.error || 'Failed to build game pass tx'}: ${body.details}` : (body.error || 'Failed to build game pass tx');
    throw new Error(msg);
  }
  return body as BuildGamePassTxResponse;
}

/**
 * Check if a wallet has an active game pass. Direct Supabase read.
 * Monthly model: a pass is active only if not expired. `expires_at` NULL means
 * a grandfathered lifetime (one-time) pass. Falls back to the legacy select if
 * the expires_at column doesn't exist yet (pre-migration), so it never breaks.
 */
export async function checkGamePass(walletAddress: string): Promise<GamePassStatus> {
  const empty: GamePassStatus = { has_pass: false, is_active: false, purchased_at: null, expires_at: null };
  if (!isSupabaseConfigured || !walletAddress?.trim()) return empty;
  const wallet = walletAddress.trim();

  let { data, error } = await supabase
    .from('game_passes')
    .select('is_active, purchased_at, expires_at')
    .eq('wallet_address', wallet)
    .maybeSingle();

  // Pre-migration fallback: column missing -> retry without expires_at.
  if (error) {
    const legacy = await supabase
      .from('game_passes')
      .select('is_active, purchased_at')
      .eq('wallet_address', wallet)
      .maybeSingle();
    data = legacy.data as typeof data;
    error = legacy.error;
  }

  if (error || !data) return empty;
  const expiresAt = (data as { expires_at?: string | null }).expires_at ?? null;
  const expired = expiresAt != null && new Date(expiresAt).getTime() <= Date.now();
  return {
    has_pass: true,
    is_active: data.is_active === true && !expired,
    purchased_at: data.purchased_at ?? null,
    expires_at: expiresAt,
  };
}

// ─── Referral System ──────────────────────────────────────────────────────

export interface ReferralCodeResponse {
  code: string;
  referral_url: string;
  total_referrals: number;
  referral_points: number;
}

export interface ReferralStatsResponse {
  code: string;
  referral_url: string;
  total_referrals: number;
  completed_referrals: number;
  pending_referrals: number;
  referral_points: number;
  recent_referrals: {
    referred_wallet: string;
    status: string;
    points_awarded: number;
    referred_at: string;
    completed_at: string | null;
  }[];
}

/** Get or create a referral code for a wallet. Returns the code + shareable URL. */
export async function getReferralCode(walletAddress: string): Promise<ReferralCodeResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/get-referral-code`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address: walletAddress }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get referral code');
  }

  return response.json();
}

/** v2.1 — one-time custom referral code picker. Validates length (4-20) +
 *  alphanumeric on the EF; returns { success, code } on accept, or { success
 *  false, error } on reject. Resolves to a discriminated result so callers
 *  branch without try/catch. */
export type SetReferralCodeResult =
  | { success: true; code: string }
  | { success: false; error: string };

export async function setReferralCode(walletAddress: string, code: string): Promise<SetReferralCodeResult> {
  try {
    const response = await fetch(`${FUNCTIONS_URL}/set-referral-code`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ walletAddress, code }),
    });
    const data = await response.json().catch(() => ({} as { error?: string; success?: boolean; code?: string }));
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'Failed to set code' };
    }
    return { success: true, code: data.code || code };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Network error' };
  }
}

/** Register a referral when a new wallet connects with a stored referral code. */
export async function registerReferral(walletAddress: string, referralCode: string): Promise<{ success: boolean; message?: string }> {
  const response = await fetch(`${FUNCTIONS_URL}/register-referral`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address: walletAddress, referral_code: referralCode }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to register referral');
  }

  return response.json();
}

/** Get referral stats for the profile page (totals, points, recent referrals). */
export async function getReferralStats(walletAddress: string): Promise<ReferralStatsResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/get-referral-stats`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address: walletAddress }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get referral stats');
  }

  return response.json();
}

// ─── Seeker Perks ─────────────────────────────────────────────────────────

export interface SeekerVerificationResponse {
  is_seeker_verified: boolean;
  skr_domain: string | null;
  seeker_verified_at: string | null;
  already_verified: boolean;
}

export interface SeekerProfile {
  is_seeker_verified: boolean;
  skr_domain: string | null;
  use_skr_as_display: boolean;
  seeker_verified_at: string | null;
}

/** Verify SGT ownership via signed message proof + on-chain RPC check. */
export async function verifySeekerStatus(walletAddress: string, message: string, signature: string): Promise<SeekerVerificationResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/verify-seeker`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address: walletAddress, message, signature }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to verify Seeker status');
  }
  return response.json();
}

/** Get Seeker-specific profile fields from player_profiles. */
export async function getSeekerProfile(walletAddress: string): Promise<SeekerProfile> {
  const { data, error } = await supabase
    .from('player_profiles')
    .select('is_seeker_verified, skr_domain, use_skr_as_display, seeker_verified_at')
    .eq('wallet_address', walletAddress)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return {
    is_seeker_verified: (data as any)?.is_seeker_verified ?? false,
    skr_domain: (data as any)?.skr_domain ?? null,
    use_skr_as_display: (data as any)?.use_skr_as_display ?? false,
    seeker_verified_at: (data as any)?.seeker_verified_at ?? null,
  };
}

/** Toggle .skr domain as display name on/off. Also updates username so leaderboard reflects the change. */
export async function toggleSkrDisplay(walletAddress: string, useSkr: boolean, skrDomain?: string): Promise<void> {
  await updateProfile(walletAddress, {
    useSkrAsDisplay: useSkr,
    skrDomain: useSkr ? skrDomain : undefined,
  });
}

// ─── Custom Games API ─────────────────────────────────────────────────────

export interface CreateCustomGameParams {
  walletAddress: string;
  txSignature: string;
  name: string;
  slug?: string;
  questionCount: 5 | 10 | 15;
  roundCount: number;
  timeLimitSeconds: number;
  questions: Array<{
    questionText: string;
    options: [string, string, string, string];
    correctIndex: 0 | 1 | 2 | 3;
  }>;
  contentDisclaimerAccepted: boolean;
  // Prize pool fields
  prizeModel?: 'free' | 'player_funded' | 'creator_funded' | 'nft';
  entryFeeLamports?: number;
  maxPlayers?: number;
  gameDurationMinutes?: number;
  maxWinners?: number;
  creatorDepositLamports?: number;
  bannerUrl?: string;
  // v2.1 multi-token SPL custom games. When tokenMint is provided AND prizeModel
  // is player_funded or creator_funded, the EF dispatches an SPL create ix
  // instead of SOL. entryFeeLamports/creatorDepositLamports now carry the
  // token's base units (column name kept for back-compat across the API).
  tokenMint?: string;
  tokenDecimals?: number;
  tokenSymbol?: string;
  tokenProgram?: string;
  // v2.1 admin-only: marks game as "Featured by Sol Trivia". EF v41+ verifies
  // walletAddress is in the admin allowlist before honoring this flag.
  isFeatured?: boolean;
}

export interface CreateCustomGameResponse {
  success: boolean;
  game_id: string;
  slug: string;
  share_url: string;
  on_chain_game_id?: number;
  create_game_tx_signature?: string;
}

export async function createCustomGame(params: CreateCustomGameParams): Promise<CreateCustomGameResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/create-custom-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to create custom game');
  }
  return response.json();
}

export interface CustomGameData {
  game_id: string;
  name: string;
  slug: string;
  creator_wallet: string;
  creator_username: string | null;
  question_count: number;
  round_count: number;
  time_limit_seconds: number;
  total_plays: number;
  status: 'active' | 'started' | 'completed' | 'finalized' | 'expired' | 'banned';
  expires_at: string;
  created_at: string;
  is_expired: boolean;
  player_best_score: number | null;
  player_attempts: number;
  player_has_in_progress: boolean;
  // Prize pool fields (paid games) + v2.1 NFT prize support
  prize_model: 'free' | 'player_funded' | 'creator_funded' | 'nft';
  /** v2.1: when prize_model === 'nft', the on-chain asset address (Core asset or pNFT mint). */
  nft_mint?: string | null;
  /** v2.1: when prize_model === 'nft', the asset standard. */
  nft_standard?: 'core' | 'pnft' | null;
  on_chain_game_id: number | null;
  creator_deposit_lamports: number;
  fund_tx_signature: string | null;
  entry_fee_lamports: number;
  max_players: number | null;
  game_duration_minutes: number | null;
  max_winners: number;
  prize_split_bps: number[];
  platform_cut_bps: number;
  player_count: number;
  total_pot_lamports: number;
  prize_pot_lamports: number;
  started_at: string | null;
  ends_at: string | null;
  finalized_at: string | null;
  winner_wallets: string[] | null;
  winner_amounts: number[] | null;
  player_has_entered: boolean;
  banner_url: string | null;
  // v2.1 multi-token SPL custom games. NULL across all three = SOL game.
  token_mint?: string | null;
  token_decimals?: number | null;
  token_symbol?: string | null;
  // v2.1 RECENT PLAYERS strip (added in get-custom-game v30)
  recent_entries?: Array<{
    wallet_address: string;
    username: string;
    avatar_url: string | null;
    score: number | null;
    joined_at: string;
    finished_at: string | null;
  }>;
  leaderboard: Array<{
    rank: number;
    wallet_address: string;
    username: string;
    avatar_url: string | null;
    score: number;
    correct_count: number;
    time_taken_ms: number;
    is_seeker_verified: boolean;
  }>;
}

export async function getCustomGame(slug: string, walletAddress?: string): Promise<CustomGameData> {
  const response = await fetch(`${FUNCTIONS_URL}/get-custom-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ slug, wallet_address: walletAddress }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch custom game');
  }
  return response.json();
}

export interface StartCustomGameResponse {
  session_id: string;
  game_id: string;
  total_questions: number;
  round_count: number;
  time_limit_seconds: number;
  resumed: boolean;
}

export async function startCustomGame(gameId: string, walletAddress: string, txSignature?: string): Promise<StartCustomGameResponse> {
  const body: Record<string, string> = { game_id: gameId, wallet_address: walletAddress };
  if (txSignature) body.tx_signature = txSignature;
  const response = await fetch(`${FUNCTIONS_URL}/start-custom-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to start custom game');
  }
  return response.json();
}

export interface CustomQuestionResponse {
  session_id: string;
  current_round: number;
  total_rounds: number;
  questions: Array<{
    index: number;
    id: string;
    question: string;
    options: string[];
  }>;
  total_questions: number;
  time_per_question: number;
}

export async function getCustomQuestions(sessionId: string): Promise<CustomQuestionResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/get-custom-questions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to get custom questions');
  }
  return response.json();
}

export interface SubmitCustomAnswerParams {
  session_id: string;
  question_id: string;
  question_index: number;
  selected_index: number;
  time_taken_ms: number;
  time_expired?: boolean;
}

export interface SubmitCustomAnswerResponse {
  correct: boolean;
  correctIndex: number;
  pointsEarned: number;
  newScore: number;
  isLastQuestionInRound: boolean;
  isLastQuestion: boolean;
  nextRound: number;
}

export async function submitCustomAnswer(params: SubmitCustomAnswerParams): Promise<SubmitCustomAnswerResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/submit-custom-answer`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to submit custom answer');
  }
  return response.json();
}

export interface CompleteCustomSessionParams {
  session_id: string;
  total_score: number;
  correct_count: number;
  time_taken_ms: number;
}

export interface CompleteCustomSessionResponse {
  success: boolean;
  rank: number | null;
  score: number;
  correct_count: number;
  time_taken_ms: number;
}

export async function completeCustomSession(params: CompleteCustomSessionParams): Promise<CompleteCustomSessionResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/complete-custom-session`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to complete custom session');
  }
  return response.json();
}

export interface MyCustomGame {
  id: string;
  slug: string;
  name: string;
  question_count: number;
  round_count: number;
  total_plays: number;
  status: string;
  expires_at: string;
  created_at: string;
  share_url: string;
}

export async function getMyCustomGames(walletAddress: string): Promise<{ games: MyCustomGame[] }> {
  const response = await fetch(`${FUNCTIONS_URL}/get-my-custom-games`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ wallet_address: walletAddress }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to fetch custom games');
  }
  return response.json();
}

// ─── Custom Game Prize Pool Functions ────────────────────────────────────

export async function joinCustomGame(gameId: string, walletAddress: string, txSignature: string): Promise<{
  success: boolean;
  player_count: number;
  game_started: boolean;
  ends_at: string | null;
}> {
  const response = await fetch(`${FUNCTIONS_URL}/join-custom-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ game_id: gameId, wallet_address: walletAddress, tx_signature: txSignature }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to join custom game');
  }
  return response.json();
}

export async function startCustomGameTimer(gameId: string, walletAddress: string): Promise<{
  success: boolean;
  started_at: string;
  ends_at: string;
}> {
  const response = await fetch(`${FUNCTIONS_URL}/start-custom-game-timer`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ game_id: gameId, wallet_address: walletAddress }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to start custom game timer');
  }
  return response.json();
}

export async function recordCustomGameFunding(
  gameId: string,
  walletAddress: string,
  txSignature: string,
  amountLamports: number,
): Promise<{ success: boolean; ends_at: string }> {
  const response = await fetch(`${FUNCTIONS_URL}/record-custom-game-funding`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      game_id: gameId,
      wallet_address: walletAddress,
      tx_signature: txSignature,
      amount_lamports: amountLamports,
    }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to record game funding');
  }
  return response.json();
}

export async function finalizeCustomGame(gameId: string, creatorWallet?: string): Promise<{
  success: boolean;
  winners: string[];
  amounts: number[];
  signature: string;
}> {
  const body: Record<string, string> = { game_id: gameId };
  if (creatorWallet) body.creator_wallet = creatorWallet;
  const response = await fetch(`${FUNCTIONS_URL}/finalize-custom-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to finalize custom game');
  }
  return response.json();
}

// ─── Realtime Subscriptions ───────────────────────────────────────────────
/** Realtime subscription: pool and players update when someone enters. Uses polling when Realtime disabled. */
export function subscribeCurrentRoundStats(
  onStats: (stats: CurrentRoundStats) => void
): { unsubscribe: () => void } {
  if (!REALTIME_ON) return { unsubscribe: () => {} };
  const { date, roundNumber } = getCurrentRoundKey();
  const ch = supabase
    .channel('current-round-stats')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'daily_rounds',
        filter: `date=eq.${date}`,
      },
      (payload) => {
        const row = payload.new as { round_number?: number; pot_lamports?: number; player_count?: number } | undefined;
        if (row?.round_number !== roundNumber) return;
        const pot = (row.pot_lamports ?? 0) as number;
        const players = (row.player_count ?? 0) as number;
        onStats({
          prizePoolSol: pot / 1_000_000_000,
          playersEntered: players,
        });
      }
    );
  ch.subscribe();
  return {
    unsubscribe: () => supabase.removeChannel(ch),
  };
}

// ─── Duels API ─────────────────────────────────────────────────────────────

export interface DuelInfo {
  duel_id: number;
  db_duel_id: string;
  status: string;
  entry_fee_lamports: number;
  total_pot_lamports: number;
  is_public: boolean;
  share_code: string;
  share_url: string;
  player1: { wallet: string; username: string | null; avatar: string | null; score: number; correct: number; finished: boolean };
  player2: { wallet: string; username: string | null; avatar: string | null; score: number; correct: number; finished: boolean } | null;
  winner_wallet: string | null;
  expires_at: string;
  created_at: string;
  resolved_at: string | null;
  my_session?: { current_question_index: number; score: number; correct_count: number; finished: boolean };
  /** v2.1 SPL duel fields. Set when the duel is an SPL-token wager, undefined for SOL.
   *  Column names match the duels table canonical schema (token_mint /
   *  entry_token_amount) — NOT the earlier shipped-but-mismatched names. */
  token_mint?: string;
  token_symbol?: string;
  token_decimals?: number;
  /** Raw u64 amount in token smallest units. Returned as a number from
   *  Postgres bigint column; cast via BigInt() on the client when reading. */
  entry_token_amount?: number;
}

export interface CreateDuelResponse {
  duel_id: number;
  db_duel_id: string;
  share_code: string;
  share_url: string;
  question_count: number;
  expires_at: string;
}

export interface JoinDuelResponse {
  success: boolean;
  duel_id: number;
  db_duel_id: string;
  status: string;
  opponent_wallet: string;
  question_count: number;
  time_per_question: number;
}

export interface DuelQuestionResponse {
  duel_id: string;
  questions: Array<{ index: number; id: string; category: string; question: string; options: string[] }>;
  total_questions: number;
  time_per_question: number;
}

export interface SubmitDuelAnswerParams {
  db_duel_id: string;
  wallet_address: string;
  question_id: string;
  question_index: number;
  selected_index?: number;
  time_taken_ms: number;
  time_expired?: boolean;
}

export interface SubmitDuelAnswerResponse {
  correct: boolean;
  correctIndex: number;
  pointsEarned: number;
  totalScore: number;
  correctCount: number;
  opponentScore: number;
  opponentCorrectCount: number;
  isLastQuestion: boolean;
  duelComplete: boolean;
  winner: string | null;
}

export async function createDuel(params: {
  wallet_address: string;
  tx_signature: string;
  duel_id: number;
  entry_fee_lamports: number;
  is_public: boolean;
  /** v2.1 cluster scope. EF v28+ filters existing-row lookup by cluster so
   *  mainnet duel_id=N and devnet duel_id=N don't collide. Defaults
   *  server-side to 'mainnet' (and accepts 'mainnet-beta' as alias). */
  cluster?: 'mainnet' | 'devnet' | 'mainnet-beta';
  /** v2.1 SPL duel fields — pass these when the duel is an SPL wager. Column
   *  names match the create-duel EF v27+ expected request shape. */
  token_mint?: string;
  /** Raw u64 amount as a number (must be <= Number.MAX_SAFE_INTEGER); for
   *  amounts beyond that, send a stringified bigint and let the EF parse. */
  entry_token_amount?: number | string;
  token_symbol?: string;
  token_decimals?: number;
}): Promise<CreateDuelResponse> {
  const res = await fetch(`${FUNCTIONS_URL}/create-duel`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to create duel');
  return data;
}

export async function joinDuel(params: {
  wallet_address: string;
  tx_signature: string;
  duel_id: number;
  /** v2.1 cluster scope. EF v23+ filters duel lookup by cluster AND
   *  uses cluster-correct RPC URL for tx_signature verification. */
  cluster?: 'mainnet' | 'devnet' | 'mainnet-beta';
}): Promise<JoinDuelResponse> {
  const res = await fetch(`${FUNCTIONS_URL}/join-duel`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to join duel');
  return data;
}

export async function getDuel(params: {
  duel_id?: number;
  share_code?: string;
  wallet_address?: string;
  /** v2.1 cluster scope. EF v22+ scopes duel_id lookups by cluster.
   *  share_code lookups are not cluster-filtered (globally unique). */
  cluster?: 'mainnet' | 'devnet' | 'mainnet-beta';
}): Promise<DuelInfo> {
  const res = await fetch(`${FUNCTIONS_URL}/get-duel`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get duel');
  return data;
}

export async function getDuelQuestions(db_duel_id: string, wallet_address: string): Promise<DuelQuestionResponse> {
  const res = await fetch(`${FUNCTIONS_URL}/get-duel-questions`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ db_duel_id, wallet_address }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to get duel questions');
  return data;
}

export async function submitDuelAnswer(params: SubmitDuelAnswerParams): Promise<SubmitDuelAnswerResponse> {
  const res = await fetch(`${FUNCTIONS_URL}/submit-duel-answer`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to submit duel answer');
  return data;
}

export async function getOpenDuels(): Promise<Array<{
  id: string;
  duel_id: number;
  player1_wallet: string;
  entry_fee_lamports: number;
  is_public: boolean;
  share_code: string;
  created_at: string;
  expires_at: string;
  /** v2.1 SPL duel fields. Null/undefined for SOL duels. Column names match
   *  the canonical schema (token_mint / entry_token_amount). */
  token_mint?: string | null;
  token_symbol?: string | null;
  token_decimals?: number | null;
  entry_token_amount?: number | null;
}>> {
  if (!isSupabaseConfigured) return [];
  // Cluster scope: localhost on devnet sees only devnet duels; production
  // mainnet sees only mainnet duels. SOLANA_NETWORK comes from
  // VITE_SOLANA_NETWORK env (defaults to 'mainnet-beta' which the EF +
  // schema treat as 'mainnet').
  const clusterFilter = SOLANA_NETWORK === 'devnet' ? 'devnet' : 'mainnet';
  const { data, error } = await supabase
    .from('duels')
    .select('id, duel_id, player1_wallet, entry_fee_lamports, is_public, share_code, created_at, expires_at, token_mint, token_symbol, token_decimals, entry_token_amount')
    .eq('status', 'waiting')
    .eq('is_public', true)
    .eq('cluster', clusterFilter)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Completed duel for leaderboard display. */
export interface CompletedDuel {
  id: string;
  duel_id: number;
  player1_wallet: string;
  player2_wallet: string | null;
  player1_score: number;
  player2_score: number;
  player1_correct: number;
  player2_correct: number;
  player1_time_ms: number;
  player2_time_ms: number;
  winner_wallet: string | null;
  entry_fee_lamports: number;
  total_pot_lamports: number;
  status: string;
  created_at: string;
  resolved_at: string | null;
  player1_username: string | null;
  player1_avatar: string | null;
  player2_username: string | null;
  player2_avatar: string | null;
}

/** Fetch recent completed/resolved duels with player profiles for leaderboard. */
export async function fetchCompletedDuels(limit = 20, offset = 0): Promise<{ duels: CompletedDuel[]; totalCount: number }> {
  if (!isSupabaseConfigured) return { duels: [], totalCount: 0 };
  const { data, count, error } = await supabase
    .from('duels')
    .select('id, duel_id, player1_wallet, player2_wallet, player1_score, player2_score, player1_correct, player2_correct, player1_time_ms, player2_time_ms, winner_wallet, entry_fee_lamports, total_pot_lamports, status, created_at, resolved_at', { count: 'exact' })
    .in('status', ['completed', 'resolved', 'expired'])
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (error || !data?.length) return { duels: [], totalCount: count ?? 0 };

  const wallets = new Set<string>();
  data.forEach((d: any) => { wallets.add(d.player1_wallet); if (d.player2_wallet) wallets.add(d.player2_wallet); });
  let profiles: { wallet_address: string; username: string | null; avatar_url: string | null }[] = [];
  if (wallets.size > 0) {
    const { data: p } = await supabase.from('player_profiles').select('wallet_address, username, avatar_url').in('wallet_address', [...wallets]);
    profiles = p ?? [];
  }
  const byWallet = Object.fromEntries(profiles.map(p => [p.wallet_address, p]));

  const duels: CompletedDuel[] = data.map((d: any) => ({
    ...d,
    player1_username: byWallet[d.player1_wallet]?.username ?? null,
    player1_avatar: byWallet[d.player1_wallet]?.avatar_url ?? null,
    player2_username: d.player2_wallet ? (byWallet[d.player2_wallet]?.username ?? null) : null,
    player2_avatar: d.player2_wallet ? (byWallet[d.player2_wallet]?.avatar_url ?? null) : null,
  }));
  return { duels, totalCount: count ?? 0 };
}

/** Fetch duels the user won (for claiming prizes). */
export interface MyDuelWin {
  duel_id: number;
  total_pot_lamports: number;
  entry_fee_lamports: number;
  player1_wallet: string;
  player2_wallet: string | null;
  player1_score: number;
  player2_score: number;
  status: string;
  created_at: string;
  resolved_at: string | null;
  opponent_wallet: string;
  opponent_username: string | null;
  /** SPL mint when this duel was a token-denominated wager (USDC, NERD, etc.).
   *  null means SOL. Used to route to SPL claim handler vs SOL claim handler. */
  token_mint: string | null;
  token_symbol: string | null;
}

export async function fetchMyDuelWins(walletAddress: string): Promise<MyDuelWin[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('duels')
    .select('duel_id, total_pot_lamports, entry_fee_lamports, player1_wallet, player2_wallet, player1_score, player2_score, status, created_at, resolved_at, token_mint, token_symbol')
    .eq('winner_wallet', walletAddress)
    .in('status', ['completed', 'resolved'])
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data?.length) return [];

  // Resolve opponent usernames
  const oppWallets = data.map((d: any) => d.player1_wallet === walletAddress ? d.player2_wallet : d.player1_wallet).filter(Boolean);
  let profileMap: Record<string, string | null> = {};
  if (oppWallets.length > 0) {
    const { data: profiles } = await supabase.from('player_profiles').select('wallet_address, username').in('wallet_address', oppWallets);
    if (profiles) profileMap = Object.fromEntries(profiles.map((p: any) => [p.wallet_address, p.username]));
  }

  return data.map((d: any) => {
    const oppWallet = d.player1_wallet === walletAddress ? d.player2_wallet : d.player1_wallet;
    return {
      ...d,
      opponent_wallet: oppWallet || '',
      opponent_username: profileMap[oppWallet] ?? null,
    };
  });
}

/** Refundable duel for player1 (expired/waiting past expiry, no opponent joined). */
export interface RefundableDuel {
  id: string;
  duel_id: number;
  entry_fee_lamports: number;
  status: string;
  share_code: string;
  created_at: string;
  expires_at: string;
}

/** Fetch duels created by this wallet that are refundable (expired or waiting past expiry, no opponent). */
export async function fetchMyRefundableDuels(walletAddress: string): Promise<RefundableDuel[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('duels')
    .select('id, duel_id, entry_fee_lamports, status, share_code, created_at, expires_at')
    .eq('player1_wallet', walletAddress)
    .is('player2_wallet', null)
    .in('status', ['waiting', 'expired', 'cancelled'])
    .order('created_at', { ascending: false })
    .limit(20);
  if (error || !data?.length) return [];
  // Filter to only truly expired/cancelled (waiting with expires_at in the past)
  const now = new Date().toISOString();
  return data.filter((d: any) => d.status !== 'waiting' || d.expires_at < now);
}

/** Fetch the wallet's active waiting duel (if any). Returns null if none. */
export interface ActiveDuel {
  id: string;
  duel_id: number;
  entry_fee_lamports: number;
  is_public: boolean;
  share_code: string;
  created_at: string;
  expires_at: string;
  status: 'waiting' | 'playing';
}
export async function fetchMyActiveDuel(walletAddress: string): Promise<ActiveDuel | null> {
  if (!isSupabaseConfigured || !walletAddress?.trim()) return null;
  const { data, error } = await supabase
    .from('duels')
    .select('id, duel_id, entry_fee_lamports, is_public, share_code, created_at, expires_at, status')
    .eq('player1_wallet', walletAddress.trim())
    .in('status', ['waiting', 'playing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as ActiveDuel;
}

/** Update duel status in DB after on-chain cancel/expire. */
export async function updateDuelStatus(duelId: number, status: 'cancelled' | 'expired'): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase.from('duels').update({ status }).eq('duel_id', duelId);
}

/** Duel win count leaderboard entry. */
export interface DuelWinLeaderEntry {
  wallet_address: string;
  username: string | null;
  avatar: string | null;
  win_count: number;
  total_duels: number;
  total_earned_lamports: number;
  is_seeker_verified?: boolean;
}

/** Fetch duel wins leaderboard (aggregated by winner_wallet). */
export async function fetchDuelWinsLeaderboard(): Promise<DuelWinLeaderEntry[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('duels')
    .select('winner_wallet, entry_fee_lamports')
    .in('status', ['completed', 'resolved'])
    .not('winner_wallet', 'is', null);
  if (error || !data?.length) return [];

  // Aggregate wins per wallet
  const wins = new Map<string, { count: number; earned: number }>();
  for (const d of data as { winner_wallet: string; entry_fee_lamports: number }[]) {
    const w = d.winner_wallet;
    const cur = wins.get(w) || { count: 0, earned: 0 };
    cur.count++;
    cur.earned += (d.entry_fee_lamports || 0) * 2; // winner gets pot (2x entry)
    wins.set(w, cur);
  }

  // Count total duels per wallet (as p1 or p2)
  const { data: allDuels } = await supabase
    .from('duels')
    .select('player1_wallet, player2_wallet')
    .in('status', ['completed', 'resolved']);
  const totalDuels = new Map<string, number>();
  for (const d of (allDuels ?? []) as { player1_wallet: string; player2_wallet: string | null }[]) {
    totalDuels.set(d.player1_wallet, (totalDuels.get(d.player1_wallet) ?? 0) + 1);
    if (d.player2_wallet) totalDuels.set(d.player2_wallet, (totalDuels.get(d.player2_wallet) ?? 0) + 1);
  }

  const wallets = [...wins.keys()];
  let profiles: { wallet_address: string; username: string | null; avatar_url: string | null; is_seeker_verified?: boolean }[] = [];
  if (wallets.length > 0) {
    const { data: p } = await supabase.from('player_profiles').select('wallet_address, username, avatar_url, is_seeker_verified').in('wallet_address', wallets.slice(0, 100));
    profiles = p ?? [];
  }
  const byWallet = Object.fromEntries(profiles.map(p => [p.wallet_address, p]));

  return wallets
    .map(w => ({
      wallet_address: w,
      username: byWallet[w]?.username ?? null,
      avatar: byWallet[w]?.avatar_url ?? null,
      win_count: wins.get(w)!.count,
      total_duels: totalDuels.get(w) ?? 0,
      total_earned_lamports: wins.get(w)!.earned,
      is_seeker_verified: byWallet[w]?.is_seeker_verified ?? false,
    }))
    .sort((a, b) => b.win_count - a.win_count || b.total_earned_lamports - a.total_earned_lamports)
    .slice(0, 50);
}

/** Custom game leaderboard entry (top players by total custom game score). */
export interface CustomGameLeaderEntry {
  wallet_address: string;
  username: string | null;
  avatar: string | null;
  games_played: number;
  total_score: number;
  best_score: number;
  is_seeker_verified?: boolean;
}

/** Fetch custom game top players (aggregated from custom_game_sessions). */
export async function fetchCustomGameLeaderboard(): Promise<CustomGameLeaderEntry[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('custom_game_sessions')
    .select('wallet_address, score')
    .eq('status', 'completed');
  if (error || !data?.length) return [];

  // Aggregate per wallet
  const stats = new Map<string, { games: number; total: number; best: number }>();
  for (const row of data as { wallet_address: string; score: number }[]) {
    const cur = stats.get(row.wallet_address) || { games: 0, total: 0, best: 0 };
    cur.games++;
    cur.total += row.score ?? 0;
    cur.best = Math.max(cur.best, row.score ?? 0);
    stats.set(row.wallet_address, cur);
  }

  const wallets = [...stats.keys()];
  let profiles: { wallet_address: string; username: string | null; avatar_url: string | null; is_seeker_verified?: boolean }[] = [];
  if (wallets.length > 0) {
    const { data: p } = await supabase.from('player_profiles').select('wallet_address, username, avatar_url, is_seeker_verified').in('wallet_address', wallets.slice(0, 100));
    profiles = p ?? [];
  }
  const byWallet = Object.fromEntries(profiles.map(p => [p.wallet_address, p]));

  return wallets
    .map(w => ({
      wallet_address: w,
      username: byWallet[w]?.username ?? null,
      avatar: byWallet[w]?.avatar_url ?? null,
      games_played: stats.get(w)!.games,
      total_score: stats.get(w)!.total,
      best_score: stats.get(w)!.best,
      is_seeker_verified: byWallet[w]?.is_seeker_verified ?? false,
    }))
    .sort((a, b) => b.best_score - a.best_score || b.total_score - a.total_score)
    .slice(0, 50);
}

export function subscribeDuelUpdates(
  dbDuelId: string,
  onUpdate: (duel: Record<string, unknown>) => void
): { unsubscribe: () => void } {
  if (!REALTIME_ON) return { unsubscribe: () => {} };
  const ch = supabase
    .channel(`duel-${dbDuelId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'duels', filter: `id=eq.${dbDuelId}` },
      (payload) => { onUpdate(payload.new as Record<string, unknown>); }
    );
  ch.subscribe();
  return { unsubscribe: () => supabase.removeChannel(ch) };
}

// ═══ Custom Game Wins (for Profile / PlayView claiming) ═══════════════════

export interface ClaimableCustomGameWin {
  game_id: string;
  name: string;
  slug: string;
  on_chain_game_id: number;
  winner_index: number;
  prize_lamports: number;
  finalized_at: string;
  /** SPL mint when this custom game used a token-denominated prize. null = SOL.
   *  Used to route to SPL claim handler vs SOL claim handler. */
  token_mint: string | null;
  token_symbol: string | null;
  token_decimals: number | null;
}

/** Fetch custom games the wallet won (finalized, player_funded). */
export async function fetchMyCustomGameWins(walletAddress: string): Promise<ClaimableCustomGameWin[]> {
  if (!isSupabaseConfigured || !walletAddress?.trim()) return [];
  const { data, error } = await supabase
    .from('custom_games')
    .select('id, name, slug, on_chain_game_id, winner_wallets, winner_amounts, finalized_at, token_mint, token_symbol, token_decimals')
    .eq('status', 'finalized')
    .in('prize_model', ['player_funded', 'creator_funded'])
    .order('finalized_at', { ascending: false })
    .limit(50);
  if (error || !data?.length) return [];

  const results: ClaimableCustomGameWin[] = [];
  for (const g of data as any[]) {
    const wallets: string[] = g.winner_wallets ?? [];
    const amounts: number[] = g.winner_amounts ?? [];
    const idx = wallets.indexOf(walletAddress.trim());
    if (idx >= 0) {
      results.push({
        game_id: g.id,
        name: g.name ?? 'Custom Game',
        slug: g.slug ?? '',
        on_chain_game_id: g.on_chain_game_id,
        winner_index: idx,
        prize_lamports: amounts[idx] ?? 0,
        finalized_at: g.finalized_at,
        token_mint: g.token_mint ?? null,
        token_symbol: g.token_symbol ?? null,
        token_decimals: g.token_decimals ?? null,
      });
    }
  }
  return results;
}

// ═══ Refundable Entries (rounds with <5 finishers) ════════════════════════

export interface RefundableEntry {
  round_id: string;
  date: string;
  round_number: number;
  contract_round_id: number;
  tier_index: number;
  entry_fee_lamports: number;
  round_title: string;
}

const TIER_FEES = [20_000_000, 100_000_000, 500_000_000, 1_000_000_000];

/** Fetch rounds where the wallet entered but <5 players finished (status='refund'). */
export async function fetchRefundableEntries(walletAddress: string): Promise<RefundableEntry[]> {
  if (!isSupabaseConfigured || !walletAddress?.trim()) return [];

  // Get this wallet's sessions. Under the post-2026-04-26 lives model every entry pays the
  // 0.02 SOL entry fee (life_used = true for all new entries), so all sessions are refund-eligible
  // when their round ends in refund mode. Historical rows with life_used = false are kept
  // out of the filter for backward compatibility — those rounds were settled long ago.
  const { data: sessions, error: sessErr } = await supabase
    .from('game_sessions')
    .select('round_id, tier_index, life_used')
    .eq('wallet_address', walletAddress.trim());
  if (sessErr || !sessions?.length) return [];

  const paidSessions = (sessions as { round_id: string; tier_index: number | null; life_used: boolean | null }[])
    .filter(s => s.life_used !== false);
  if (paidSessions.length === 0) return [];

  const roundIds = [...new Set(paidSessions.map(s => s.round_id))];

  // Get rounds that may be refundable (status 'refund' or 'closed' — on-chain verification is the real gate).
  // auto-end-rounds sets refundMode on-chain then immediately transitions status to 'closed',
  // so we must check both. Only V2 rounds (>= 2026-02-22) can have on-chain tier PDAs.
  const { data: rounds, error: roundErr } = await supabase
    .from('daily_rounds')
    .select('id, date, round_number')
    .in('id', roundIds)
    .in('status', ['refund', 'closed'])
    .gte('date', '2026-02-22');
  if (roundErr || !rounds?.length) return [];

  const byId = Object.fromEntries(
    (rounds as { id: string; date: string; round_number: number }[]).map(r => [r.id, r])
  );

  function contractRoundId(dateStr: string, roundNumber: number): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    const epoch = new Date(Date.UTC(1970, 0, 1)).getTime();
    const day = new Date(Date.UTC(y, m - 1, d)).getTime();
    const daysSinceEpoch = Math.floor((day - epoch) / 86400_000);
    return daysSinceEpoch * 4 + (roundNumber & 3);
  }

  return paidSessions
    .map(s => {
      const r = byId[s.round_id];
      if (!r) return null;
      const ti = s.tier_index ?? 0;
      return {
        round_id: s.round_id,
        date: r.date,
        round_number: r.round_number,
        contract_round_id: contractRoundId(r.date, r.round_number),
        tier_index: ti,
        entry_fee_lamports: TIER_FEES[ti] ?? TIER_FEES[0],
        round_title: `${r.date} Round ${r.round_number + 1}`,
      };
    })
    .filter((x): x is RefundableEntry => x != null);
}

// ═════════════════════════════════════════════════════════════════════════════
// CUSTOM GAME REFUNDS
// ═════════════════════════════════════════════════════════════════════════════

export interface RefundableCustomGame {
  game_id: string;
  name: string;
  slug: string;
  on_chain_game_id: number;
  entry_fee_lamports: number;
  expired_at: string;
}

/** Fetch expired custom games where the wallet has a paid entry (eligible for refund). */
export async function fetchRefundableCustomGames(walletAddress: string): Promise<RefundableCustomGame[]> {
  if (!isSupabaseConfigured || !walletAddress?.trim()) return [];

  // Find entries by this wallet
  const { data: entries, error: entryErr } = await supabase
    .from('custom_game_entries')
    .select('game_id, entry_fee_lamports')
    .eq('wallet_address', walletAddress.trim());

  if (entryErr || !entries?.length) return [];

  const gameIds = [...new Set(entries.map((e: { game_id: string }) => e.game_id))];

  // Find expired games among those
  const { data: games, error: gameErr } = await supabase
    .from('custom_games')
    .select('id, name, slug, on_chain_game_id, entry_fee_lamports, finalized_at')
    .in('id', gameIds)
    .eq('status', 'expired');

  if (gameErr || !games?.length) return [];

  return games.map((g: { id: string; name: string; slug: string; on_chain_game_id: number; entry_fee_lamports: number; finalized_at: string }) => ({
    game_id: g.id,
    name: g.name,
    slug: g.slug,
    on_chain_game_id: Number(g.on_chain_game_id),
    entry_fee_lamports: Number(g.entry_fee_lamports),
    expired_at: g.finalized_at,
  }));
}

// ─── Referrals claim audit (Kyle 2026-06-05 Item 2) ─────────────────────────
// claim-referral-payout EF v1 LIVE per Kyle 2026-06-05. Idempotent (UNIQUE on
// tx_signature). Flow: client signs + sends claim_referral_balance ix via
// wallet → call this EF with {wallet_address, tx_signature} → EF verifies the
// tx drained the PDA + writes an audit row to referral_claims.

export type ClaimReferralPayoutResponse = {
  success: boolean;
  claimed_lamports: number;
  claimed_at: string;
};

export async function claimReferralPayout(params: {
  wallet_address: string;
  tx_signature: string;
}): Promise<ClaimReferralPayoutResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/claim-referral-payout`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error || 'claim-referral-payout failed');
  }
  return response.json();
}

/** Lifetime claimed = SUM(claimed_lamports) over all the wallet's audit rows.
 *  Returns 0 on missing rows / table errors. Used to derive the "claimed so
 *  far" stat on ReferralsViewV2. */
export async function fetchLifetimeReferralClaimed(
  walletAddress: string | null,
): Promise<number> {
  if (!walletAddress || !isSupabaseConfigured) return 0;
  const { data } = await supabase
    .from('referral_claims')
    .select('claimed_lamports')
    .eq('wallet_address', walletAddress);
  if (!Array.isArray(data)) return 0;
  let sum = 0;
  for (const r of data) {
    sum += Number((r as { claimed_lamports?: number }).claimed_lamports) || 0;
  }
  return sum;
}

// ─── Announcements ───────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  created_at: string;
  is_read?: boolean;
}

export async function fetchAnnouncements(walletAddress?: string): Promise<Announcement[]> {
  if (!isSupabaseConfigured) return [];

  // Filter: every user sees GLOBAL announcements (target_wallet IS NULL). When
  // we have a wallet, we ALSO include rows targeted specifically at this wallet
  // (per-wallet notifications like referral commission earned).
  let query = supabase
    .from('announcements')
    .select('id, title, body, link_url, created_at, target_wallet')
    .order('created_at', { ascending: false })
    .limit(20);
  if (walletAddress) {
    query = query.or(`target_wallet.is.null,target_wallet.eq.${walletAddress}`);
  } else {
    query = query.is('target_wallet', null);
  }

  const { data: announcements, error } = await query;
  if (error || !announcements) return [];

  if (!walletAddress) return announcements.map(a => ({ ...a, is_read: false }));

  const { data: reads } = await supabase
    .from('announcement_reads')
    .select('announcement_id')
    .eq('wallet_address', walletAddress);

  const readIds = new Set((reads ?? []).map((r: any) => r.announcement_id));
  return announcements.map(a => ({ ...a, is_read: readIds.has(a.id) }));
}

export async function markAnnouncementRead(walletAddress: string, announcementId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  await supabase
    .from('announcement_reads')
    .upsert({ wallet_address: walletAddress, announcement_id: announcementId }, { onConflict: 'wallet_address,announcement_id' });
}

export async function markAllAnnouncementsRead(walletAddress: string, announcementIds: string[]): Promise<void> {
  if (!isSupabaseConfigured) return;
  const rows = announcementIds.map(id => ({ wallet_address: walletAddress, announcement_id: id }));
  await supabase
    .from('announcement_reads')
    .upsert(rows, { onConflict: 'wallet_address,announcement_id' });
}

export async function getUnreadAnnouncementCount(walletAddress: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const { count: totalCount } = await supabase
    .from('announcements')
    .select('id', { count: 'exact', head: true });

  const { count: readCount } = await supabase
    .from('announcement_reads')
    .select('announcement_id', { count: 'exact', head: true })
    .eq('wallet_address', walletAddress);

  return (totalCount ?? 0) - (readCount ?? 0);
}

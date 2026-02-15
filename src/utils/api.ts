// API utility functions for Supabase Edge Functions
import { supabase, isSupabaseConfigured } from './supabase';
import { SUPABASE_FUNCTIONS_URL } from './constants';

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
export async function ensureRoundOnChain(options?: { date?: string; round_number?: number; useDevnet?: boolean }): Promise<{ ok: boolean; round_id_u64: number; created?: boolean; signature?: string }> {
  const body: { date?: string; round_number?: number; useDevnet?: boolean } = { ...options };
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

// Test-only: Post 5 winners for a round (no DB). So you can claim on test page with one entrant.
export async function postWinnersTest(options: { roundIdU64: number; winners: string[]; useDevnet?: boolean }): Promise<{ success: boolean; signature: string }> {
  const body: { round_id_u64: number; winners: string[]; useDevnet?: boolean } = {
    round_id_u64: options.roundIdU64,
    winners: options.winners,
  };
  if (options.useDevnet) body.useDevnet = true;
  const response = await fetch(`${FUNCTIONS_URL}/post-winners-test`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Failed to post winners (test)');
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
  entryTxSignature: string
): Promise<{ sessionId: string; roundId: string; totalQuestions: number; resumed: boolean; freeEntry?: boolean; freeEntriesRemaining?: number; freeEntryReason?: 'new_user' | 'welcome_bonus' }> {
  const response = await fetch(`${FUNCTIONS_URL}/start-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ walletAddress, entryTxSignature }),
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
}

export async function getLeaderboard(round_id?: string, wallet?: string, period?: 'daily' | 'weekly' | 'monthly' | 'all'): Promise<LeaderboardResponse> {
  const body: { round_id?: string; wallet?: string; period?: string } = { round_id, wallet };
  if (period) body.period = period;
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

// Purchase extra lives (with tier support)
export async function purchaseLives(
  walletAddress: string,
  txSignature: string,
  tier?: string
): Promise<PurchaseLivesResponse> {
  const url = `${FUNCTIONS_URL}/purchase-lives`;
  const response = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ walletAddress, txSignature, tier }),
  });

  const body = await response.json().catch(() => ({}));
  console.log('purchase-lives response:', { status: response.status, ok: response.ok, body });

  if (!response.ok) {
    const msg = body.details ? `${body.error || 'Failed to purchase lives'}: ${body.details}` : (body.error || 'Failed to purchase lives');
    throw new Error(msg);
  }
  return body as PurchaseLivesResponse;
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
  return (data || []) as UserQuestProgress[];
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

/** Submit proof URL for verification quests (e.g. TRUE RAIDER). Admin approves later; then user is rewarded automatically. */
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

/** Total SOL won (lamports) per wallet from round_payouts (prize/paid). For leaderboard SOL won column. */
export async function getTotalSolWonByWallets(walletAddresses: string[]): Promise<Record<string, number>> {
  if (!isSupabaseConfigured || walletAddresses.length === 0) return {};
  const uniq = [...new Set(walletAddresses)].slice(0, 200);
  const { data, error } = await supabase
    .from('round_payouts')
    .select('wallet_address, prize_lamports, paid_lamports')
    .in('wallet_address', uniq);
  if (error) return {};
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const w = row.wallet_address as string;
    const lamports = Number(row.paid_lamports ?? row.prize_lamports ?? 0) || 0;
    out[w] = (out[w] ?? 0) + lamports;
  }
  return out;
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
}

/** Fetch round payouts for a wallet with daily_rounds date/round_number (for claim button). */
export async function fetchClaimableRoundPayouts(walletAddress: string): Promise<ClaimablePayout[]> {
  if (!isSupabaseConfigured || !walletAddress?.trim()) return [];
  const { data: payouts, error: payErr } = await supabase
    .from('round_payouts')
    .select('round_id, rank, prize_lamports')
    .eq('wallet_address', walletAddress.trim())
    .is('paid_at', null);
  if (payErr || !payouts?.length) return [];
  const roundIds = [...new Set((payouts as { round_id: string }[]).map((p) => p.round_id))];
  const { data: rounds, error: roundErr } = await supabase
    .from('daily_rounds')
    .select('id, date, round_number')
    .in('id', roundIds);
  if (roundErr || !rounds?.length) return [];
  const byId = Object.fromEntries((rounds as { id: string; date: string; round_number: number }[]).map((r) => [r.id, r]));
  function contractRoundId(dateStr: string, roundNumber: number): number {
    const [y, m, d] = dateStr.split('-').map(Number);
    const epoch = new Date(Date.UTC(1970, 0, 1)).getTime();
    const day = new Date(Date.UTC(y, m - 1, d)).getTime();
    const daysSinceEpoch = Math.floor((day - epoch) / 86400_000);
    return daysSinceEpoch * 4 + (roundNumber & 3);
  }
  return (payouts as { round_id: string; rank: number; prize_lamports: number }[])
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
    headers: getAuthHeaders(),
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
export async function markPayoutClaimed(roundId: string, walletAddress: string): Promise<{ success: boolean; error?: string }> {
  const url = `${FUNCTIONS_URL}/mark-payout-claimed`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ round_id: roundId, wallet_address: walletAddress }),
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
    .in('id', roundIds);
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
export async function postWinnersOnChain(roundId: string): Promise<{ success: boolean; signature?: string; error?: string }> {
  const url = `${FUNCTIONS_URL}/post-winners-on-chain`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    body: JSON.stringify({ round_id: roundId }),
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
}

/** Purchase a game pass (unlocks premium categories + unlimited practice). */
export async function purchaseGamePass(walletAddress: string, txSignature: string): Promise<GamePassResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/purchase-game-pass`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ walletAddress, txSignature }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = body.details ? `${body.error || 'Failed to purchase game pass'}: ${body.details}` : (body.error || 'Failed to purchase game pass');
    throw new Error(msg);
  }
  return body as GamePassResponse;
}

/** Check if a wallet has an active game pass. Direct Supabase read. */
export async function checkGamePass(walletAddress: string): Promise<GamePassStatus> {
  const empty: GamePassStatus = { has_pass: false, is_active: false, purchased_at: null };
  if (!isSupabaseConfigured || !walletAddress?.trim()) return empty;

  const { data, error } = await supabase
    .from('game_passes')
    .select('is_active, purchased_at')
    .eq('wallet_address', walletAddress.trim())
    .maybeSingle();

  if (error || !data) return empty;
  return {
    has_pass: true,
    is_active: data.is_active === true,
    purchased_at: data.purchased_at ?? null,
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
  const update: Record<string, any> = {
    use_skr_as_display: useSkr,
    updated_at: new Date().toISOString(),
  };
  if (useSkr && skrDomain) {
    update.username = skrDomain;
  }
  const { error } = await supabase
    .from('player_profiles')
    .update(update)
    .eq('wallet_address', walletAddress);
  if (error) throw new Error(error.message);
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

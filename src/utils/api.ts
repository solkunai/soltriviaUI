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

// Start game (after payment)
export async function startGame(
  walletAddress: string,
  entryTxSignature: string
): Promise<{ sessionId: string; roundId: string; totalQuestions: number; resumed: boolean }> {
  const response = await fetch(`${FUNCTIONS_URL}/start-game`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ walletAddress, entryTxSignature }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start game');
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

// Get player's current lives count
export async function getPlayerLives(wallet_address: string): Promise<PlayerLivesResponse> {
  if (!isSupabaseConfigured) {
    return { lives_count: 1, total_purchased: 0, total_used: 0 };
  }

  const { data, error } = await supabase
    .from('player_lives')
    .select('lives_count, total_purchased, total_used')
    .eq('wallet_address', wallet_address)
    .maybeSingle();

  if (error) {
    console.error('Error fetching player lives:', error);
    return { lives_count: 1, total_purchased: 0, total_used: 0 };
  }

  // If no row exists, create one with default 1 life
  if (!data) {
    const { data: newData, error: insertError } = await supabase
      .from('player_lives')
      .insert({
        wallet_address,
        lives_count: 1,
        total_purchased: 0,
        total_used: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating player lives:', insertError);
      return { lives_count: 1, total_purchased: 0, total_used: 0 };
    }

    return newData || { lives_count: 1, total_purchased: 0, total_used: 0 };
  }

  return data;
}

// Purchase extra lives
export async function purchaseLives(
  walletAddress: string,
  txSignature: string
): Promise<PurchaseLivesResponse> {
  const response = await fetch(`${FUNCTIONS_URL}/purchase-lives`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ walletAddress, txSignature }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to purchase lives');
  }

  return response.json();
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

      // Also create a player_lives row with 1 default life
      const { error: livesError } = await supabase
        .from('player_lives')
        .insert({
          wallet_address: walletAddress,
          lives_count: 1,
          total_purchased: 0,
          total_used: 0,
        });

      if (livesError && livesError.code !== '23505') {
        // 23505 = unique violation (row already exists, which is fine)
        console.error('Error creating player lives:', livesError);
      } else {
        console.log('✅ Default life granted:', walletAddress);
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

/** Single payout row (top 5 per round, 80% pot share). */
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
  winner_wallet: string | null;
  winner_display_name: string | null;
  winner_avatar: string | null;
  winner_score: number;
  /** Top 5 payouts (80% of pot: 1st 50%, 2nd 20%, 3rd 15%, 4th 10%, 5th 5%). */
  payouts?: RoundPayout[];
}

/** Fetch past rounds with winner from dedicated round_winners table (fixed schema; no game_sessions query). */
export async function fetchRoundsWithWinners(limit = 40): Promise<RoundWithWinner[]> {
  const { data: rounds, error: roundsError } = await supabase
    .from('daily_rounds')
    .select('id, date, round_number, pot_lamports, player_count')
    .order('date', { ascending: false })
    .order('round_number', { ascending: false })
    .limit(limit);

  if (roundsError || !rounds?.length) return [];

  const roundIds = rounds.map((r) => r.id);
  const { data: winners, error: winnersError } = await supabase
    .from('round_winners')
    .select('round_id, winner_wallet, winner_score')
    .in('round_id', roundIds);

  const winnerByRoundId = new Map<string, { winner_wallet: string | null; winner_score: number }>();
  if (!winnersError && winners?.length) {
    winners.forEach((w: { round_id: string; winner_wallet: string | null; winner_score: number }) => {
      winnerByRoundId.set(w.round_id, { winner_wallet: w.winner_wallet ?? null, winner_score: Number(w.winner_score ?? 0) });
    });
  }

  const winnerWallets = [...new Set([...winnerByRoundId.values()].map((v) => v.winner_wallet).filter(Boolean) as string[])];
  let profiles: { wallet_address: string; display_name: string | null; avatar_url: string | null }[] = [];
  if (winnerWallets.length > 0) {
    const { data: prof } = await supabase
      .from('player_profiles')
      .select('wallet_address, display_name, avatar_url')
      .in('wallet_address', winnerWallets);
    profiles = prof ?? [];
  }
  const profileByWallet = Object.fromEntries(profiles.map((p) => [p.wallet_address, p]));

  const payoutsByRound = await fetchRoundPayouts(roundIds);
  const allPayoutWallets = new Set<string>();
  payoutsByRound.forEach((p) => allPayoutWallets.add(p.wallet_address));
  let payoutProfiles: { wallet_address: string; display_name: string | null; avatar_url: string | null }[] = [];
  if (allPayoutWallets.size > 0) {
    const { data: pp } = await supabase.from('player_profiles').select('wallet_address, display_name, avatar_url').in('wallet_address', [...allPayoutWallets]);
    payoutProfiles = pp ?? [];
  }
  const payoutProfileByWallet = Object.fromEntries(payoutProfiles.map((p) => [p.wallet_address, p]));

  return rounds.map((r) => {
    const w = winnerByRoundId.get(r.id);
    const winnerWallet = w?.winner_wallet ?? null;
    const winnerScore = w?.winner_score ?? 0;
    const profile = winnerWallet ? profileByWallet[winnerWallet] : null;
    const payouts: RoundPayout[] = (payoutsByRound.filter((p) => p.round_id === r.id) as RoundPayout[]).map((p) => ({
      ...p,
      winner_display_name: payoutProfileByWallet[p.wallet_address]?.display_name ?? null,
      winner_avatar: payoutProfileByWallet[p.wallet_address]?.avatar_url ?? null,
    }));
    return {
      round_id: r.id,
      date: r.date,
      round_number: r.round_number,
      round_title: getRoundLabel(r.date, r.round_number),
      pot_lamports: r.pot_lamports ?? 0,
      player_count: r.player_count ?? 0,
      winner_wallet: winnerWallet,
      winner_display_name: profile?.display_name ?? null,
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

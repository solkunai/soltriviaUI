// API utility functions for Supabase Edge Functions
import { supabase, isSupabaseConfigured } from './supabase';
import { SUPABASE_FUNCTIONS_URL } from './constants';

const FUNCTIONS_URL = SUPABASE_FUNCTIONS_URL;

// Get Supabase anon key for Edge Function authentication
const getSupabaseAnonKey = (): string => {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || '';
};

// Helper to create authenticated fetch headers
const getAuthHeaders = (): Record<string, string> => {
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
  selected_index: number;
  time_taken_ms: number;
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_index: number;
  points_earned: number;
  total_score: number;
  total_correct: number;
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
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit answer');
  }

  return response.json();
}

// Get leaderboard
export async function getLeaderboard(round_id?: string): Promise<LeaderboardEntry[]> {
  const response = await fetch(`${FUNCTIONS_URL}/get-leaderboard`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ round_id }),
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

/**
 * Supabase client for the web app.
 * Required env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
 * Optional: VITE_SUPABASE_FUNCTIONS_URL (see constants.ts).
 * When not set, isSupabaseConfigured is false and api.ts skips DB calls (lives, round entries, profile).
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Only create client if we have valid credentials
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createClient('https://placeholder.supabase.co', 'placeholder-key');

export const isSupabaseConfigured =
  SUPABASE_URL.length > 0 &&
  SUPABASE_ANON_KEY.length > 0 &&
  !SUPABASE_URL.includes('YOUR_PROJECT_ID') &&
  !SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');

/**
 * Feature flags + version gates, read from the public `app_config` Supabase
 * table. All values default to "locked off" if the row is missing or the
 * network call fails (fail-safe for releases).
 *
 * In-memory cache with a 60s TTL so the helpers can be called freely from
 * render paths without hammering Supabase.
 *
 * Defaults must match the migration in supabase/migrations/app_config_table.sql.
 */
import { supabase, isSupabaseConfigured } from './supabase';

export type AppConfig = {
  /** Commemorative NFT mint surface is live (mint page accessible, real txs). */
  mint_live: boolean;
  /** Custom games can attach NFT prizes (paid via this surface). */
  nft_customs_enabled: boolean;
  /** Duels can attach NFT prizes. */
  nft_duels_enabled: boolean;
  /** Referrer claim flow (claim_referral_balance ix) is exposed in the UI. */
  referral_claim_enabled: boolean;
  /** Minimum supported app version — older clients prompted to update softly. */
  min_app_version: string;
  /** Below this version the app force-blocks until the user updates. */
  force_update_below: string;
};

export const APP_CONFIG_DEFAULTS: AppConfig = {
  mint_live: false,
  nft_customs_enabled: false,
  nft_duels_enabled: false,
  referral_claim_enabled: false,
  min_app_version: '2.0.0',
  force_update_below: '1.0.0',
};

const CACHE_TTL_MS = 60_000;
let cachedAt = 0;
let cached: AppConfig | null = null;
let inFlight: Promise<AppConfig> | null = null;

async function fetchAppConfig(): Promise<AppConfig> {
  if (!isSupabaseConfigured) return APP_CONFIG_DEFAULTS;

  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('key, value');
    if (error || !data) return APP_CONFIG_DEFAULTS;

    const result: AppConfig = { ...APP_CONFIG_DEFAULTS };
    for (const row of data as Array<{ key: string; value: unknown }>) {
      if (!(row.key in APP_CONFIG_DEFAULTS)) continue;
      // value is JSONB; supabase-js parses it for us.
      (result as Record<string, unknown>)[row.key] = row.value;
    }
    return result;
  } catch {
    return APP_CONFIG_DEFAULTS;
  }
}

/**
 * Read the full feature flag set. Cached in-memory for 60s. Concurrent calls
 * during a fetch share the same promise (no thundering herd on cache miss).
 */
export async function getAppConfig(): Promise<AppConfig> {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_TTL_MS) return cached;
  if (inFlight) return inFlight;

  inFlight = fetchAppConfig().then((cfg) => {
    cached = cfg;
    cachedAt = Date.now();
    inFlight = null;
    return cfg;
  });
  return inFlight;
}

/** Convenience: read a single flag. */
export async function getFlag<K extends keyof AppConfig>(
  key: K,
): Promise<AppConfig[K]> {
  const cfg = await getAppConfig();
  return cfg[key];
}

/** Drop the cache so the next read hits Supabase. */
export function invalidateAppConfigCache(): void {
  cached = null;
  cachedAt = 0;
}

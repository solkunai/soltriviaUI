// Custom Game Drafts , localStorage-backed wizard state snapshots.
//
// DESIGN: drafts are purely client-side per-wallet. NO backend, NO DB, NO EFs.
// Each connected wallet gets its own slot up to MAX_DRAFTS entries; oldest
// draft is dropped on the next save when full (FIFO).
//
// EXCLUDED from drafts (intentionally not restored):
//   - bannerFile: blob URLs die on page reload, base64 in localStorage hits
//     the 5-10MB origin quota fast. User re-uploads on resume.
//   - selectedNft: full WalletNFT object includes runtime fields; user
//     re-picks an NFT from their wallet on resume.
// These omissions are surfaced in the UI as small banners on draft restore.

export const MAX_DRAFTS_PER_WALLET = 3;
const STORAGE_KEY_PREFIX = 'customGameDrafts_';

export interface CustomGameDraft {
  /** Stable UUID-ish id for delete + restore handles. */
  id: string;
  /** Wallet that saved the draft. Used to scope storage. */
  walletAddress: string;
  /** Ms-since-epoch timestamp of the last save. */
  savedAt: number;
  /** Wizard step the user was on when they saved. */
  step: 'settings' | 'prize' | 'questions' | 'review';
  // Step 1: Settings
  gameName: string;
  customSlug: string;
  questionCount: 5 | 10 | 15;
  roundCount: number;
  timeLimit: number;
  // Step 2: Prize Pool
  gameType: 'free' | 'players_fund' | 'creator_funds';
  playerFundTokenType: 'sol' | 'usdc' | 'spl';
  creatorPrizeType: 'sol' | 'usdc' | 'nft' | 'spl';
  customSplMint: string;
  manualSymbol: string;
  manualDecimals: number;
  entryFeeLamports: number;
  customEntryFee: string;
  maxPlayers: number | null;  // null = "No Max" (∞)
  gameDurationMinutes: number;
  maxWinners: number;
  // v44 re-entry settings. Optional for backward compat with older saved drafts.
  allowReEntries?: boolean;
  maxEntriesPerPlayer?: number | null;
  creatorDepositLamports: number;
  customCreatorDeposit: string;
  // Step 3: Questions
  questions: Array<{
    questionText: string;
    options: [string, string, string, string];
    correctIndex: 0 | 1 | 2 | 3;
  }>;
}

function storageKey(walletAddress: string): string {
  return STORAGE_KEY_PREFIX + walletAddress;
}

function safeRead(walletAddress: string): CustomGameDraft[] {
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((d) => d && typeof d.id === 'string' && d.walletAddress === walletAddress);
  } catch {
    return [];
  }
}

function safeWrite(walletAddress: string, drafts: CustomGameDraft[]): void {
  try {
    localStorage.setItem(storageKey(walletAddress), JSON.stringify(drafts));
  } catch (err) {
    // Quota exceeded or storage disabled , swallow. The user just won't have
    // a draft saved this round; the wizard continues to work.
    console.warn('Failed to write custom-game drafts:', err);
  }
}

/** Return all drafts for the connected wallet, newest-first. */
export function listDrafts(walletAddress: string | null): CustomGameDraft[] {
  if (!walletAddress) return [];
  return safeRead(walletAddress).sort((a, b) => b.savedAt - a.savedAt);
}

/**
 * Save a draft. If the draft.id already exists, update it (same-slot replace).
 * Otherwise insert; FIFO drop the oldest if we're at MAX_DRAFTS_PER_WALLET.
 */
export function saveDraft(draft: CustomGameDraft): void {
  if (!draft.walletAddress) return;
  const existing = safeRead(draft.walletAddress);
  const replaceIdx = existing.findIndex((d) => d.id === draft.id);
  let next: CustomGameDraft[];
  if (replaceIdx >= 0) {
    next = [...existing];
    next[replaceIdx] = draft;
  } else {
    next = [...existing, draft];
    // FIFO drop oldest when over quota
    if (next.length > MAX_DRAFTS_PER_WALLET) {
      next.sort((a, b) => b.savedAt - a.savedAt);
      next = next.slice(0, MAX_DRAFTS_PER_WALLET);
    }
  }
  safeWrite(draft.walletAddress, next);
}

/** Delete a single draft by id. Returns the remaining list. */
export function deleteDraft(walletAddress: string, draftId: string): CustomGameDraft[] {
  const existing = safeRead(walletAddress);
  const next = existing.filter((d) => d.id !== draftId);
  safeWrite(walletAddress, next);
  return next.sort((a, b) => b.savedAt - a.savedAt);
}

/** Wipe all drafts for the wallet. Used on game-creation success. */
export function clearDrafts(walletAddress: string): void {
  try {
    localStorage.removeItem(storageKey(walletAddress));
  } catch (err) {
    console.warn('Failed to clear custom-game drafts:', err);
  }
}

/** Generate a stable id for a new draft. Crypto-random when available. */
export function newDraftId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fall through */ }
  return `draft-${Date.now()}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

/** Human-readable display name for a draft (auto-titled if user hasn't set one). */
export function draftDisplayName(draft: CustomGameDraft, fallbackIndex: number): string {
  if (draft.gameName && draft.gameName.trim()) return draft.gameName.trim();
  return `Untitled Draft #${fallbackIndex + 1}`;
}

/** Relative timestamp (e.g. "2m ago", "3h ago", "Jun 4"). */
export function relativeSavedAt(savedAt: number, now: number = Date.now()): string {
  const diffMs = Math.max(0, now - savedAt);
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  try {
    return new Date(savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return `${diffDay}d ago`;
  }
}

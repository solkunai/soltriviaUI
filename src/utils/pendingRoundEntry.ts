/**
 * pendingRoundEntry (web) — durable record of "user paid for a round but
 * `start-game` hasn't completed yet."
 *
 * Mirror of SolTriviaNative/src/utils/pendingRoundEntry.ts, but uses
 * localStorage instead of AsyncStorage. Same key naming + same shape so
 * the recovery UX is identical across web + Seeker.
 *
 * Kyle 2026-06-07: built after the expo-updates boot-hang bug ate a paid
 * entry on native. The same class of bug (network blip, tab close mid-call,
 * JS crash) can hit web; localStorage covers it. Refund cron stays as
 * the absolute backstop.
 */

const KEY_PREFIX = "pendingRoundEntry:";

export type PendingRoundEntry = {
  txSignature: string;
  date: string;
  roundNumber: number;
  tierIndex: number;
  paidAt: number;
};

function entryKey(date: string, roundNumber: number): string {
  return `${KEY_PREFIX}${date}:${roundNumber}`;
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export function savePendingRoundEntry(entry: PendingRoundEntry): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.setItem(
      entryKey(entry.date, entry.roundNumber),
      JSON.stringify(entry),
    );
  } catch {
    // Quota errors / privacy-mode are non-fatal — refund cron is the backstop.
  }
}

export function clearPendingRoundEntry(date: string, roundNumber: number): void {
  if (!hasLocalStorage()) return;
  try {
    window.localStorage.removeItem(entryKey(date, roundNumber));
  } catch {
    // non-fatal
  }
}

export function listAllPendingRoundEntries(): PendingRoundEntry[] {
  if (!hasLocalStorage()) return [];
  try {
    const out: PendingRoundEntry[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (!k || !k.startsWith(KEY_PREFIX)) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as PendingRoundEntry;
        if (
          parsed?.txSignature &&
          parsed?.date &&
          typeof parsed?.roundNumber === "number"
        ) {
          out.push(parsed);
        }
      } catch {
        // skip corrupted
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function pruneStalePendingEntries(): void {
  if (!hasLocalStorage()) return;
  try {
    const all = listAllPendingRoundEntries();
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    for (const e of all) {
      if (e.paidAt < cutoff) {
        clearPendingRoundEntry(e.date, e.roundNumber);
      }
    }
  } catch {
    // non-fatal
  }
}

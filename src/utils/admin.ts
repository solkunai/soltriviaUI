// Admin wallet allowlist for "Featured by Sol Trivia" custom games and any
// other founder-only controls. Kept as a hardcoded constant for v2.1 launch
// simplicity. v2.1.1 polish: move to env var or a small `admin_wallets` table
// if the founder ever wants to delegate to a brand/social wallet.
//
// Server-side enforcement lives in the create-custom-game EF (v41+) which
// reads ADMIN_WALLETS from an env var. The two lists MUST stay in sync.

const ADMIN_WALLETS: ReadonlySet<string> = new Set([
  // Kyle (founder, primary). Confirmed 2026-06-05.
  'DCdHYML7ss1Xo6hXhVqGz1CHfQ37c6iYXVWaUTrDXcDa',
]);

/** Returns true if the connected wallet is in the admin allowlist. */
export function isAdminWallet(walletAddress: string | null | undefined): boolean {
  if (!walletAddress) return false;
  return ADMIN_WALLETS.has(walletAddress);
}

/**
 * PWA / install-prompt environment checks, shared by App (which decides WHEN
 * to show the Add-to-Homescreen prompt) and PwaInstallPrompt (which renders it).
 */

const A2HS_DISMISS_KEY = 'soltrivia-pwa-prompt-dismissed';
const A2HS_DISMISS_DAYS = 7;

/** True when already running as an installed PWA (or iOS standalone) — incl. the Seeker TWA. */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True only on a real mobile browser (no localhost/dev exception — mobile means mobile). */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * True inside the Seeker / Android TWA wrapper. These users installed from the
 * dApp store already, so they must never see an "add to home screen" prompt.
 * Matches the isSeekerTWA detection used in WalletContext / WalletConnectButton.
 */
export function isInTWA(): boolean {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return false;
  return navigator.userAgent.includes('wv') && document.referrer.startsWith('android-app://');
}

export function a2hsDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(A2HS_DISMISS_KEY);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (Number.isNaN(t)) return false;
    return Date.now() - t < A2HS_DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function markA2HSDismissed(): void {
  try {
    localStorage.setItem(A2HS_DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Returns true the FIRST time a given wallet connects on this device, then
 * records it so future connects of the same wallet are not "fresh". Used to
 * gate the install prompt to genuinely new signups/logins.
 */
export function isFreshWalletOnThisDevice(walletAddress: string): boolean {
  try {
    const key = `soltrivia_seen_wallet_${walletAddress}`;
    if (localStorage.getItem(key) === '1') return false;
    localStorage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}

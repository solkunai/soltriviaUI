import React, { useEffect, useState, useCallback } from 'react';
import { useWallet, useConnection, useWalletModal } from '../src/contexts/WalletContext';
import { getBalanceSafely } from '../src/utils/balance';

/**
 * Responsive wallet connect button component
 * Uses wallet adapter API directly for reliable connection on
 * both Seeker TWA (MWA/Seed Vault) and desktop browsers (Phantom, Backpack, etc.)
 */
const WalletConnectButton: React.FC = () => {
  const { publicKey, connected, disconnect, connecting, wallets, select } = useWallet();
  const { connection } = useConnection();
  const { setVisible } = useWalletModal();
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Fetch balance when wallet connects (optional, fails silently)
  useEffect(() => {
    if (connected && publicKey && connection) {
      setLoadingBalance(true);
      setConnectError(null);
      getBalanceSafely(connection, publicKey)
        .then((bal) => {
          setBalance(bal);
        })
        .finally(() => {
          setLoadingBalance(false);
        });
    } else {
      setBalance(null);
    }
  }, [connected, publicKey, connection]);

  // Clear error after 8 seconds
  useEffect(() => {
    if (!connectError) return;
    const t = setTimeout(() => setConnectError(null), 8000);
    return () => clearTimeout(t);
  }, [connectError]);

  // Truncate address for display
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const handleConnect = useCallback(() => {
    if (connecting) return;
    setConnectError(null);

    // Filter to installed/ready wallets
    const readyWallets = wallets.filter(
      (w) => w.readyState === 'Installed' || w.readyState === 'Loadable'
    );

    if (readyWallets.length === 1) {
      // Single wallet available (common on Seeker with MWA/Seed Vault) — connect directly
      select(readyWallets[0].adapter.name);
    } else if (readyWallets.length > 1) {
      // Multiple wallets (desktop with Phantom, Backpack, etc.) — show selection modal
      setVisible(true);
    } else {
      // No wallets detected — show the modal anyway (it lists installable wallets)
      // and show guidance for Seeker users
      setVisible(true);
      setConnectError('No wallet found. On Seeker, make sure Seed Vault is set up in Settings.');
    }
  }, [connecting, wallets, select, setVisible]);

  // If not connected, show connect button
  if (!connected) {
    return (
      <div className="relative">
        <button
          onClick={handleConnect}
          disabled={connecting}
          className={`w-full md:w-auto flex items-center justify-center gap-2 md:gap-1.5 h-11 md:h-10 px-4 md:px-6 rounded-full transition-all group shadow-[0_0_15px_rgba(20,241,149,0.15)] active:scale-95 min-h-[44px] md:min-h-0 ${
            connecting
              ? 'bg-[#14F195]/60 cursor-wait'
              : 'bg-[#14F195] hover:bg-[#14F195]/90'
          }`}
        >
          {connecting ? (
            <svg className="w-4 h-4 text-black shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 md:w-4 md:h-4 text-black shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 18H3V6h18v12zm-2-2V8H5v8h14zM16 11h2v2h-2v-2z" />
            </svg>
          )}
          <span className="text-[10px] md:text-[10px] font-black uppercase tracking-wider text-black whitespace-nowrap">
            {connecting ? (
              'Connecting...'
            ) : (
              <>
                <span className="hidden sm:inline">Connect Wallet</span>
                <span className="sm:hidden">Connect</span>
              </>
            )}
          </span>
        </button>
        {connectError && (
          <div className="absolute top-full left-0 right-0 mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-[10px] font-bold whitespace-normal z-50 min-w-[200px]">
            {connectError}
          </div>
        )}
      </div>
    );
  }

  // If connected, show wallet info with disconnect option
  return (
    <div className="flex items-center gap-2 md:gap-3">
      {/* Balance Display - Desktop only */}
      {balance !== null && (
        <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg">
          <span className="text-[#14F195] text-xs font-black uppercase">SOL</span>
          <span className="text-white text-sm font-[1000] italic">
            {loadingBalance ? '...' : balance.toFixed(2)}
          </span>
        </div>
      )}

      {/* Wallet Address */}
      <div className="
        flex items-center gap-2
        px-3 py-2 md:px-4 md:py-2.5
        bg-white/5 hover:bg-white/10
        border border-white/10 hover:border-[#14F195]/30
        rounded-lg md:rounded-xl
        transition-all
        cursor-pointer
        group
      ">
        <div className="w-2 h-2 rounded-full bg-[#14F195] shadow-[0_0_8px_#14F195] animate-pulse"></div>
        <span className="text-white text-xs md:text-sm font-black uppercase tracking-wider">
          {publicKey ? truncateAddress(publicKey.toBase58()) : 'Connected'}
        </span>
      </div>

      {/* Disconnect Button - Mobile shows icon, Desktop shows text */}
      <button
        onClick={disconnect}
        className="
          p-2 md:px-4 md:py-2
          bg-red-500/10 hover:bg-red-500/20
          border border-red-500/30 hover:border-red-500/50
          rounded-lg md:rounded-xl
          text-red-400 hover:text-red-300
          transition-all
          active:scale-95
        "
        title="Disconnect Wallet"
      >
        <span className="hidden md:inline text-xs font-black uppercase tracking-wider">Disconnect</span>
        <svg className="md:hidden w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default WalletConnectButton;

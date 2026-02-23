import React, { useEffect, useState, useCallback } from 'react';
import { useWallet, useWalletModal } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';

/**
 * Responsive wallet connect button component
 * Shows username (from .skr domain or display name) when connected.
 */
const WalletConnectButton: React.FC = () => {
  const { publicKey, connected, disconnect, connecting, wallets, select } = useWallet();
  const { setVisible } = useWalletModal();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Fetch username from player_profiles when connected
  useEffect(() => {
    if (!connected || !publicKey) {
      setDisplayName(null);
      return;
    }
    const wallet = publicKey.toBase58();
    (async () => {
      try {
        const { data } = await supabase
          .from('player_profiles')
          .select('username')
          .eq('wallet_address', wallet)
          .single();
        if (data?.username) {
          setDisplayName(data.username);
        }
      } catch { /* will fall back to truncated address */ }
    })();
  }, [connected, publicKey]);

  // Clear error after 8 seconds
  useEffect(() => {
    if (!connectError) return;
    const t = setTimeout(() => setConnectError(null), 8000);
    return () => clearTimeout(t);
  }, [connectError]);

  const handleConnect = useCallback(() => {
    if (connecting) return;
    setConnectError(null);

    // Filter to installed/ready wallets
    const readyWallets = wallets.filter(
      (w) => w.readyState === 'Installed' || w.readyState === 'Loadable'
    );

    if (readyWallets.length === 1) {
      select(readyWallets[0].adapter.name);
    } else if (readyWallets.length > 1) {
      setVisible(true);
    } else {
      setVisible(true);
      setConnectError('No wallet found. On Seeker, make sure Seed Vault is set up in Settings.');
    }
  }, [connecting, wallets, select, setVisible]);

  // Not connected — show connect button
  if (!connected) {
    return (
      <div className="relative">
        <button
          onClick={handleConnect}
          disabled={connecting}
          className={`flex items-center justify-center gap-1.5 h-8 px-4 rounded-full transition-all active:scale-95 ${
            connecting
              ? 'bg-[#14F195]/60 cursor-wait'
              : 'bg-[#14F195] hover:bg-[#14F195]/90'
          }`}
        >
          {connecting ? (
            <svg className="w-3.5 h-3.5 text-black shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-black shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M21 18H3V6h18v12zm-2-2V8H5v8h14zM16 11h2v2h-2v-2z" />
            </svg>
          )}
          <span className="text-[9px] font-black uppercase tracking-wider text-black whitespace-nowrap">
            {connecting ? 'Connecting...' : 'Connect'}
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

  // Connected — show username + disconnect
  const label = displayName || (publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : 'Connected');

  return (
    <div className="flex items-center gap-1.5">
      {/* Username pill */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full">
        <div className="w-1.5 h-1.5 rounded-full bg-[#14F195] shadow-[0_0_6px_#14F195]"></div>
        <span className="text-white text-[10px] font-black uppercase tracking-wide max-w-[120px] truncate">
          {label}
        </span>
      </div>

      {/* Disconnect */}
      <button
        onClick={disconnect}
        className="p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-full text-red-400 hover:text-red-300 transition-all active:scale-95"
        title="Disconnect Wallet"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
};

export default WalletConnectButton;

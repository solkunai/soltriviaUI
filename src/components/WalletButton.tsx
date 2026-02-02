import React from 'react';
import { useWallet, useConnection } from '../contexts/WalletContext';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

/**
 * Wallet connection button component
 * Uses @solana/wallet-adapter for wallet connection
 */
export const WalletButton: React.FC = () => {
  const { publicKey, connected, disconnect } = useWallet();
  const { connection } = useConnection();

  // Use the built-in WalletMultiButton from wallet-adapter
  return (
    <div className="wallet-adapter-button-wrapper">
      <WalletMultiButton />
    </div>
  );
};

/**
 * Custom wallet button with more control
 */
export const CustomWalletButton: React.FC = () => {
  const { publicKey, connected, disconnect, connecting } = useWallet();
  const { connection } = useConnection();

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-zinc-400">
          {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
        </div>
        <button
          onClick={disconnect}
          className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-lg text-red-400 text-sm font-semibold transition-all"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      disabled={connecting}
      className="px-6 py-3 bg-gradient-to-r from-[#9945FF] to-[#14F195] rounded-lg text-black font-bold hover:opacity-90 disabled:opacity-50 transition-all"
    >
      {connecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

import { useMemo, ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
  useConnection as useSolanaConnection
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LedgerWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { SOLANA_NETWORK } from '../utils/constants';
import { getSolanaRpcEndpoint } from '../utils/rpc';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

// Official Ledger logo - file in public/ledger-logo.svg
const LEDGER_ICON = '/ledger-logo.svg';

// Custom Ledger adapter with proper branded icon
class BrandedLedgerWalletAdapter extends LedgerWalletAdapter {
  override readonly icon = LEDGER_ICON;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const network = SOLANA_NETWORK === 'mainnet-beta'
    ? WalletAdapterNetwork.Mainnet
    : WalletAdapterNetwork.Devnet;

  const endpoint = useMemo(() => {
    if (SOLANA_NETWORK === 'mainnet-beta') {
      // Use getSolanaRpcEndpoint which prioritizes Helius > Alchemy > Public
      return getSolanaRpcEndpoint();
    }
    return clusterApiUrl(network);
  }, [network]);

  // Wallet adapters:
  // - BrandedLedgerWalletAdapter: Direct hardware wallet connection via WebHID with proper Ledger branding
  // - MWA is registered via registerMwa() in main.tsx for Solana mobile (Seed Vault, etc.)
  // - Phantom, Solflare, Backpack, Magic Eden, Jupiter use Wallet Standard and auto-detect
  const wallets = useMemo(() => [
    new BrandedLedgerWalletAdapter(),
  ], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect={true}>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}

// Re-export wallet adapter hooks for easy use in components
export { useSolanaWallet as useWallet, useSolanaConnection as useConnection, WalletMultiButton };
export { useWalletModal } from '@solana/wallet-adapter-react-ui';

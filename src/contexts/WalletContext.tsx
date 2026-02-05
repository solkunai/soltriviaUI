import { useMemo, ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
  useConnection as useSolanaConnection
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { SOLANA_NETWORK } from '../utils/constants';
import { getSolanaRpcEndpoint } from '../utils/rpc';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

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

  // MWA is now registered via registerMwa() in main.tsx using @solana-mobile/wallet-standard-mobile
  // This automatically detects Wallet Standard wallets including Seed Vault, Phantom, Solflare, etc.
  const wallets = useMemo(() => [], []);

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

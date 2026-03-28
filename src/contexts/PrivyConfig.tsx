import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';
import { getSolanaRpcEndpoint } from '../utils/rpc';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';
const SOLANA_RPC_URL = getSolanaRpcEndpoint();
const SOLANA_WSS_URL = SOLANA_RPC_URL.replace('https://', 'wss://');


const solanaConnectors = toSolanaWalletConnectors();

interface PrivyWrapperProps {
  children: React.ReactNode;
}

const PrivyWrapper: React.FC<PrivyWrapperProps> = ({ children }) => {
  if (!PRIVY_APP_ID) {
    // If no Privy app ID, just render children without Privy
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        solana: {
          rpcs: {
            'solana:mainnet': {
              rpc: createSolanaRpc(SOLANA_RPC_URL),
              rpcSubscriptions: createSolanaRpcSubscriptions(SOLANA_WSS_URL),
            },
          },
        },
        appearance: {
          theme: 'dark',
          accentColor: '#14F195',
          walletChainType: 'solana-only',
        },
        loginMethods: ['email', 'google', 'twitter', 'wallet'],
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
};

export default PrivyWrapper;

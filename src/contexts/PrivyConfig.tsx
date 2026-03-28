import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';

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

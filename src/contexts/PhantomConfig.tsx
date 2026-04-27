import React from 'react';
import { PhantomProvider, AddressType, darkTheme } from '@phantom/react-sdk';

const PHANTOM_APP_ID = '65e4534c-3a5e-4637-beb2-455d295b7053';

// Whitelisted in Phantom Portal — matches the redirect URL configured for OAuth providers.
const PHANTOM_REDIRECT_URL =
  import.meta.env.VITE_PHANTOM_REDIRECT_URL || 'https://soltrivia.app/';

const APP_ICON =
  'https://phantom-portal20240925173430423400000001.s3.ca-central-1.amazonaws.com/icons/f313a1ba-54b2-4af1-80c6-fc0869ee61e6.png';

interface PhantomConfigProps {
  children: React.ReactNode;
}

const PhantomConfig: React.FC<PhantomConfigProps> = ({ children }) => {
  return (
    <PhantomProvider
      config={{
        providers: ['google', 'apple', 'injected'],
        appId: PHANTOM_APP_ID,
        addressTypes: [AddressType.solana],
        authOptions: {
          redirectUrl: PHANTOM_REDIRECT_URL,
        },
      }}
      theme={darkTheme}
      appIcon={APP_ICON}
      appName="Sol Trivia"
    >
      {children}
    </PhantomProvider>
  );
};

export default PhantomConfig;

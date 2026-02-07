// Main entry point - Vite will use this
import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import App from './App';
import { WalletProvider } from './src/contexts/WalletContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import PasswordGate from './components/PasswordGate';

// Register Mobile Wallet Adapter as a Wallet Standard wallet (must be called before React renders)
import {
  registerMwa,
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
} from '@solana-mobile/wallet-standard-mobile';

// Only register on client-side (not SSR)
if (typeof window !== 'undefined') {
  registerMwa({
    appIdentity: {
      name: 'SOL Trivia',
      uri: 'https://soltrivia.app',
      icon: '/favicon.png',
    },
    authorizationCache: createDefaultAuthorizationCache(),
    chains: ['solana:mainnet'],
    chainSelector: createDefaultChainSelector(),
    onWalletNotFound: createDefaultWalletNotFoundHandler(),
  });
}

// Buffer is provided via Vite alias (see index.html comment). Console.warn suppression runs in index.html inline script.

// Register Service Worker for PWA
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration.scope);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element");
}

const root = ReactDOM.createRoot(rootElement);

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
});

try {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <PasswordGate>
          <WalletProvider>
            <App />
          </WalletProvider>
        </PasswordGate>
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Render failed:', error);
  root.render(
    <div style={{ padding: '40px', color: 'white', background: '#050505', minHeight: '100vh' }}>
      <h1 style={{ color: '#ff4444' }}>Render Error</h1>
      <p>{String(error)}</p>
    </div>
  );
}

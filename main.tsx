// Main entry point - Vite will use this
import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import App from './App';
import { WalletProvider } from './src/contexts/WalletContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { Buffer } from 'buffer/';

// Polyfill Buffer for Solana web3.js
(window as any).Buffer = Buffer;
(globalThis as any).Buffer = Buffer;

console.log('🚀 MAIN: Starting app initialization...');

// Suppress SES warnings and RPC errors
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  const msg = String(args[0] || '');
  if (
    msg.includes('SES') || 
    msg.includes('unpermitted intrinsics') ||
    msg.includes('403') ||
    msg.includes('Forbidden') ||
    msg.includes('failed to get') ||
    msg.includes('Blockhash attempt') ||
    msg.includes('Fallback endpoint')
  ) {
    return;
  }
  originalWarn.apply(console, args);
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element");
}

console.log('📦 MAIN: Creating root...');
const root = ReactDOM.createRoot(rootElement);

console.log('🎨 MAIN: Rendering app...');

window.addEventListener('error', (e) => {
  console.error('🚨 MAIN: Global error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('🚨 MAIN: Unhandled rejection:', e.reason);
});

try {
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <WalletProvider>
          <App />
        </WalletProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
  console.log('✨ MAIN: App rendered!');
} catch (error) {
  console.error('❌ MAIN: Render failed:', error);
  root.render(
    <div style={{ padding: '40px', color: 'white', background: '#050505', minHeight: '100vh' }}>
      <h1 style={{ color: '#ff4444' }}>Render Error</h1>
      <p>{String(error)}</p>
    </div>
  );
}

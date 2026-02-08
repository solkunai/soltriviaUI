/// <reference types="vite/client" />

declare module '@vitejs/plugin-react' {
  import type { Plugin } from 'vite';
  const react: () => Plugin;
  export default react;
}

interface ImportMetaEnv {
  readonly VITE_HELIUS_API_KEY?: string;
  readonly VITE_ALCHEMY_API_KEY?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_FUNCTIONS_URL?: string;
  readonly VITE_SOLANA_NETWORK?: string;
  readonly VITE_PRIZE_POOL_WALLET?: string;
  readonly VITE_REVENUE_WALLET?: string;
  readonly VITE_ENTRY_FEE_LAMPORTS?: string;
  readonly VITE_TXN_FEE_LAMPORTS?: string;
  readonly VITE_LIVES_PRICE_LAMPORTS?: string;
  readonly VITE_ADMIN_USERNAME?: string;
  readonly VITE_ADMIN_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** PWA install prompt (Chrome/Edge) */
interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

import { useMemo, useCallback, ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
  useConnection as useSolanaConnection
} from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { LedgerWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, PublicKey, VersionedTransaction, Connection } from '@solana/web3.js';
import { SOLANA_NETWORK } from '../utils/constants';
import { getSolanaRpcEndpoint } from '../utils/rpc';

// Privy imports — used for social login (email/Google/X) embedded wallets
import { usePrivy } from '@privy-io/react-auth';
import { useWallets as useWalletsFromPrivy, useSignAndSendTransaction as useSignAndSendTransactionFromPrivy } from '@privy-io/react-auth/solana';

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

// ═══════════════════════════════════════════════════════════════════
// Unified useWallet hook — bridges native wallet adapter + Privy
// Priority: native wallet > Privy embedded wallet
// ═══════════════════════════════════════════════════════════════════
export function useWallet() {
  const nativeWallet = useSolanaWallet();
  const privy = usePrivy();
  const { wallets: privyWallets } = useWalletsFromPrivy();
  const { signAndSendTransaction: privySignAndSend } = useSignAndSendTransactionFromPrivy();

  // Find Privy's embedded Solana wallet (if user logged in via email/Google/X)
  const privySolanaWallet = useMemo(() => {
    if (!privy.authenticated || !privyWallets || privyWallets.length === 0) return null;
    // Prefer the Privy embedded wallet, fallback to first available
    return privyWallets.find((w: any) => w.standardWallet?.name === 'Privy') || privyWallets[0] || null;
  }, [privy.authenticated, privyWallets]);

  // Priority: native wallet takes precedence over Privy
  const useNative = nativeWallet.connected && nativeWallet.publicKey;

  const publicKey = useMemo(() => {
    if (useNative) return nativeWallet.publicKey;
    if (privySolanaWallet?.address) {
      try { return new PublicKey(privySolanaWallet.address); } catch { return null; }
    }
    return null;
  }, [useNative, nativeWallet.publicKey, privySolanaWallet?.address]);

  const connected = !!(useNative || privySolanaWallet?.address);
  const connecting = nativeWallet.connecting;

  const disconnect = useCallback(async () => {
    if (useNative) {
      await nativeWallet.disconnect();
    } else if (privy.authenticated) {
      await privy.logout();
    }
  }, [useNative, nativeWallet, privy]);

  // Unified sendTransaction — routes to native or Privy
  const sendTransaction = useCallback(async (
    transaction: VersionedTransaction,
    connection: Connection,
  ): Promise<string> => {
    if (useNative) {
      // Native wallet adapter handles signing + sending
      return nativeWallet.sendTransaction(transaction, connection);
    }

    if (privySolanaWallet && privySignAndSend) {
      // Privy: sign and send in one call, returns signature
      const serialized = transaction.serialize();
      const signature = await privySignAndSend({
        transaction: serialized,
        wallet: privySolanaWallet,
      });
      return typeof signature === 'string' ? signature : String(signature);
    }

    throw new Error('No wallet connected');
  }, [useNative, nativeWallet, privySolanaWallet, privySignAndSend]);

  // Unified signMessage
  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (useNative && nativeWallet.signMessage) {
      return nativeWallet.signMessage(message);
    }
    // Privy signMessage can be added later if needed
    throw new Error('signMessage not available');
  }, [useNative, nativeWallet]);

  return {
    // Core — used by all 13 components
    publicKey,
    connected,
    connecting,
    disconnect,
    sendTransaction,
    signMessage,
    // Pass-through from native adapter (used by WalletConnectButton)
    wallets: nativeWallet.wallets,
    select: nativeWallet.select,
    wallet: nativeWallet.wallet,
    // Privy state (for components that need to know which auth path)
    isPrivyUser: !useNative && !!privySolanaWallet?.address,
  };
}

// Re-export connection hook unchanged
export { useSolanaConnection as useConnection, WalletMultiButton };
export { useWalletModal } from '@solana/wallet-adapter-react-ui';

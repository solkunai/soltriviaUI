import { useMemo, useCallback, useEffect, ReactNode } from 'react';
import bs58 from 'bs58';
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

// Phantom Connect SDK — used when the user explicitly picks "Continue with Phantom"
import {
  usePhantom,
  useSolana as usePhantomSolana,
  useDisconnect as usePhantomDisconnect,
  AddressType,
} from '@phantom/react-sdk';

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
// Unified useWallet hook — bridges native wallet adapter + Phantom Connect + Privy
// Priority: Phantom Connect (explicit user choice) > native > Privy embedded
// ═══════════════════════════════════════════════════════════════════
export function useWallet() {
  const nativeWallet = useSolanaWallet();
  const privy = usePrivy();
  const { wallets: privyWallets } = useWalletsFromPrivy();
  const { signAndSendTransaction: privySignAndSend } = useSignAndSendTransactionFromPrivy();

  // Phantom Connect SDK state (active only when user picks "Continue with Phantom")
  const phantomState = usePhantom();
  const { solana: phantomSolana, isAvailable: phantomSolanaAvailable } = usePhantomSolana();
  const { disconnect: phantomDisconnect } = usePhantomDisconnect();

  // Pull the Solana address out of Phantom's connected addresses array
  const phantomSolanaAddress = useMemo(() => {
    if (!phantomState.isConnected || !phantomState.addresses) return null;
    const addr = phantomState.addresses.find((a) => a.addressType === AddressType.solana);
    return addr?.address || null;
  }, [phantomState.isConnected, phantomState.addresses]);

  // Find Privy's embedded Solana wallet (if user logged in via email/Google/X)
  const privySolanaWallet = useMemo(() => {
    if (!privy.authenticated || !privyWallets || privyWallets.length === 0) return null;
    // Prefer the Privy embedded wallet, fallback to first available
    return privyWallets.find((w: any) => w.standardWallet?.name === 'Privy') || privyWallets[0] || null;
  }, [privy.authenticated, privyWallets]);

  // Priority order
  const usePhantomConnect = phantomState.isConnected && !!phantomSolanaAddress;
  const useNative = !usePhantomConnect && nativeWallet.connected && !!nativeWallet.publicKey;

  const publicKey = useMemo(() => {
    if (usePhantomConnect && phantomSolanaAddress) {
      try { return new PublicKey(phantomSolanaAddress); } catch { return null; }
    }
    if (useNative) return nativeWallet.publicKey;
    if (privySolanaWallet?.address) {
      try { return new PublicKey(privySolanaWallet.address); } catch { return null; }
    }
    return null;
  }, [usePhantomConnect, phantomSolanaAddress, useNative, nativeWallet.publicKey, privySolanaWallet?.address]);

  const connected = !!(usePhantomConnect || useNative || privySolanaWallet?.address);
  const connecting = nativeWallet.connecting || phantomState.isConnecting;

  const disconnect = useCallback(async () => {
    if (usePhantomConnect) {
      await phantomDisconnect();
    } else if (useNative) {
      await nativeWallet.disconnect();
    } else if (privy.authenticated) {
      await privy.logout();
    }
  }, [usePhantomConnect, useNative, phantomDisconnect, nativeWallet, privy]);

  // Unified sendTransaction — routes to whichever wallet is active
  const sendTransaction = useCallback(async (
    transaction: VersionedTransaction,
    connection: Connection,
  ): Promise<string> => {
    if (usePhantomConnect && phantomSolanaAvailable && phantomSolana) {
      // Phantom Connect: sign and send via SDK
      const result = await phantomSolana.signAndSendTransaction(transaction);
      return result.signature;
    }

    if (useNative) {
      // Native wallet adapter handles signing + sending
      return nativeWallet.sendTransaction(transaction, connection);
    }

    if (privySolanaWallet && privySignAndSend) {
      // Privy: sign and send in one call
      const serialized = transaction.serialize();
      const result = await privySignAndSend({
        transaction: serialized,
        wallet: privySolanaWallet,
      });
      // Privy React SDK returns { signature: Uint8Array } — encode to base58
      const sig = result.signature;
      if (sig instanceof Uint8Array) return bs58.encode(sig);
      if (typeof sig === 'string') return sig;
      throw new Error('Could not extract transaction signature from Privy response');
    }

    throw new Error('No wallet connected');
  }, [usePhantomConnect, phantomSolanaAvailable, phantomSolana, useNative, nativeWallet, privySolanaWallet, privySignAndSend]);

  // Unified signMessage
  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (usePhantomConnect && phantomSolanaAvailable && phantomSolana) {
      const result = await phantomSolana.signMessage(message);
      return result.signature;
    }
    if (useNative && nativeWallet.signMessage) {
      return nativeWallet.signMessage(message);
    }
    // Privy signMessage can be added later if needed
    throw new Error('signMessage not available');
  }, [usePhantomConnect, phantomSolanaAvailable, phantomSolana, useNative, nativeWallet]);

  // Diagnostic: surface wallet-adapter errors that don't bubble through select()
  // Captures errors from autoConnect, reauth handshake, and async wallet state changes.
  useEffect(() => {
    const adapter = nativeWallet.wallet?.adapter;
    if (!adapter) return;
    const handler = (err: any) => {
      console.error('[wallet-adapter error]', {
        walletName: adapter.name,
        code: err?.code || err?.cause?.code,
        name: err?.name,
        message: err?.message,
        stack: err?.stack,
      });
    };
    adapter.on('error', handler);
    return () => { adapter.off('error', handler); };
  }, [nativeWallet.wallet]);

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
    // Auth path indicators
    isPrivyUser: !usePhantomConnect && !useNative && !!privySolanaWallet?.address,
    isPhantomConnectUser: usePhantomConnect,
  };
}

// Re-export connection hook unchanged
export { useSolanaConnection as useConnection, WalletMultiButton };
export { useWalletModal } from '@solana/wallet-adapter-react-ui';

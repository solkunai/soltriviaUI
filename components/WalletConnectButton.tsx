import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useWallet, useWalletModal } from '../src/contexts/WalletContext';
import { supabase } from '../src/utils/supabase';
import { useLoginWithOAuth, useLoginWithEmail, usePrivy } from '@privy-io/react-auth';
import { useCreateWallet } from '@privy-io/react-auth/solana';
import { useModal as usePhantomModal } from '@phantom/react-sdk';

/**
 * Responsive login button component
 * Shows "Login" when disconnected — opens dropdown with wallet + social options.
 * Shows username when connected.
 */
const WalletConnectButton: React.FC = () => {
  const { t } = useTranslation();
  const { publicKey, connected, disconnect, connecting, wallets, select, isPrivyUser } = useWallet();
  const { setVisible } = useWalletModal();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [showLoginMenu, setShowLoginMenu] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [emailStep, setEmailStep] = useState<'email' | 'code'>('email');
  const loginMenuRef = useRef<HTMLDivElement>(null);

  const { authenticated, user } = usePrivy();
  const { createWallet } = useCreateWallet();

  // After Privy login, create embedded Solana wallet if user doesn't have one
  useEffect(() => {
    if (!authenticated || !user) return;
    const hasSolanaWallet = user.linkedAccounts?.some(
      (a: any) => (a.type === 'wallet' && a.chainType === 'solana') || a.type === 'solana_wallet'
    );
    if (!hasSolanaWallet) {
      createWallet().catch((err) => {
        console.warn('Failed to create embedded wallet:', err);
      });
    }
  }, [authenticated, user]);

  // Privy OAuth login
  const { initOAuth } = useLoginWithOAuth({
    onComplete: () => { setShowLoginMenu(false); setShowEmailInput(false); },
    onError: (err) => { setConnectError(err?.message || 'Login failed'); },
  });

  // Privy email login
  const { sendCode, loginWithCode, state: emailState } = useLoginWithEmail({
    onComplete: () => { setShowLoginMenu(false); setShowEmailInput(false); setEmailStep('email'); setEmail(''); setOtp(''); },
    onError: (err) => { setConnectError(err?.message || 'Email login failed'); },
  });

  // Fetch username from player_profiles when connected
  useEffect(() => {
    if (!connected || !publicKey) {
      setDisplayName(null);
      return;
    }
    const wallet = publicKey.toBase58();
    (async () => {
      try {
        const { data } = await supabase
          .from('player_profiles')
          .select('username')
          .eq('wallet_address', wallet)
          .single();
        if (data?.username) {
          setDisplayName(data.username);
        }
      } catch { /* will fall back to truncated address */ }
    })();
  }, [connected, publicKey]);

  // Clear error after 8 seconds
  useEffect(() => {
    if (!connectError) return;
    const timer = setTimeout(() => setConnectError(null), 8000);
    return () => clearTimeout(timer);
  }, [connectError]);

  // Close login menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (loginMenuRef.current && !loginMenuRef.current.contains(e.target as Node)) {
        setShowLoginMenu(false);
        setShowEmailInput(false);
      }
    };
    if (showLoginMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLoginMenu]);

  // Phantom Connect SDK modal — opens Phantom's branded connect flow (extension, social, deeplink)
  const phantomModal = usePhantomModal();
  const handlePhantomConnect = useCallback(() => {
    setShowLoginMenu(false);
    setConnectError(null);
    phantomModal.open();
  }, [phantomModal]);

  const handleWalletConnect = useCallback(async () => {
    setShowLoginMenu(false);
    if (connecting) return;
    setConnectError(null);
    const readyWallets = wallets.filter(
      (w) => w.readyState === 'Installed' || w.readyState === 'Loadable'
    );
    try {
      if (readyWallets.length === 1) {
        await select(readyWallets[0].adapter.name);
      } else if (readyWallets.length > 1) {
        setVisible(true);
      } else {
        setVisible(true);
        setConnectError(t('wallet.noWalletFound'));
      }
    } catch (err: any) {
      const code = err?.cause?.code || err?.code || 'UNKNOWN';
      const msg = err?.message || 'Wallet connection failed';
      console.error('[MWA connect error]', { code, message: msg, cause: err?.cause });
      setConnectError(`${code}: ${msg}`);
    }
  }, [connecting, wallets, select, setVisible, t]);

  const handleEmailSendCode = async () => {
    if (!email.trim()) return;
    await sendCode({ email: email.trim() });
    setEmailStep('code');
  };

  const handleEmailLogin = async () => {
    if (!otp.trim()) return;
    await loginWithCode({ code: otp.trim() });
  };

  // Not connected — show login button
  if (!connected) {
    return (
      <div className="relative" ref={loginMenuRef}>
        <button
          onClick={() => setShowLoginMenu(!showLoginMenu)}
          disabled={connecting}
          className={`flex items-center justify-center gap-1.5 h-8 px-4 rounded-full transition-all active:scale-95 ${
            connecting
              ? 'bg-[#14F195]/60 cursor-wait'
              : 'bg-[#14F195] hover:bg-[#14F195]/90'
          }`}
        >
          {connecting ? (
            <svg className="w-3.5 h-3.5 text-black shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-black shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          )}
          <span className="text-[9px] font-black uppercase tracking-wider text-black whitespace-nowrap">
            {connecting ? t('wallet.connecting') : 'Login'}
          </span>
        </button>

        {/* Login Options Dropdown */}
        {showLoginMenu && (
          <div className="fixed left-4 right-4 top-[120px] md:absolute md:left-auto md:right-0 md:top-full md:mt-2 md:w-[280px] bg-[#0D0D0D] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden z-[200]">
            <div className="px-4 py-3 border-b border-white/5">
              <span className="text-white font-black text-xs uppercase tracking-wider">Sign In</span>
            </div>

            {!showEmailInput ? (
              <div className="p-3 space-y-2">
                {/* Continue with Phantom (Phantom Connect SDK) */}
                <button
                  onClick={handlePhantomConnect}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-[#AB9FF2]/10 hover:bg-[#AB9FF2]/20 border border-[#AB9FF2]/30 rounded-xl transition-all active:scale-[0.98]"
                >
                  <img src="/phantom_logo.png" alt="Phantom" className="w-5 h-5 shrink-0 rounded-full" />
                  <div className="text-left">
                    <span className="text-white text-xs font-bold block">Continue with Phantom</span>
                    <span className="text-zinc-500 text-[9px]">Extension, mobile app, or social</span>
                  </div>
                </button>

                {/* Connect Wallet (other Solana wallets via wallet-adapter) */}
                <button
                  onClick={handleWalletConnect}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-[0.98]"
                >
                  <svg className="w-5 h-5 text-[#14F195] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 18H3V6h18v12zm-2-2V8H5v8h14zM16 11h2v2h-2v-2z" />
                  </svg>
                  <div className="text-left">
                    <span className="text-white text-xs font-bold block">Other Wallets</span>
                    <span className="text-zinc-500 text-[9px]">Solflare, Backpack, Ledger, Seeker</span>
                  </div>
                </button>

                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-zinc-600 text-[8px] font-bold uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>

                {/* Google */}
                <button
                  onClick={() => { initOAuth({ provider: 'google' }); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-[0.98]"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span className="text-white text-xs font-bold">Continue with Google</span>
                </button>

                {/* X / Twitter */}
                <button
                  onClick={() => { initOAuth({ provider: 'twitter' }); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-[0.98]"
                >
                  <svg className="w-5 h-5 text-white shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  <span className="text-white text-xs font-bold">Continue with X</span>
                </button>

                {/* Email */}
                <button
                  onClick={() => setShowEmailInput(true)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all active:scale-[0.98]"
                >
                  <svg className="w-5 h-5 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="text-white text-xs font-bold">Continue with Email</span>
                </button>
              </div>
            ) : (
              /* Email Input Flow */
              <div className="p-4 space-y-3">
                <button
                  onClick={() => { setShowEmailInput(false); setEmailStep('email'); setOtp(''); }}
                  className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider hover:text-white transition-colors"
                >
                  &larr; Back
                </button>

                {emailStep === 'email' ? (
                  <>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#14F195]/40"
                      onKeyDown={e => e.key === 'Enter' && handleEmailSendCode()}
                      autoFocus
                    />
                    <button
                      onClick={handleEmailSendCode}
                      disabled={!email.trim() || emailState.status === 'sending-code'}
                      className="w-full py-3 bg-[#14F195] text-black font-bold text-xs uppercase tracking-wider rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all"
                    >
                      {emailState.status === 'sending-code' ? 'Sending...' : 'Send Code'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-zinc-400 text-xs">Code sent to <span className="text-white font-bold">{email}</span></p>
                    <input
                      type="text"
                      value={otp}
                      onChange={e => setOtp(e.target.value)}
                      placeholder="Enter verification code"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-[#14F195]/40 text-center tracking-widest"
                      onKeyDown={e => e.key === 'Enter' && handleEmailLogin()}
                      autoFocus
                    />
                    <button
                      onClick={handleEmailLogin}
                      disabled={!otp.trim() || emailState.status === 'submitting-code'}
                      className="w-full py-3 bg-[#14F195] text-black font-bold text-xs uppercase tracking-wider rounded-xl disabled:opacity-50 active:scale-[0.98] transition-all"
                    >
                      {emailState.status === 'submitting-code' ? 'Verifying...' : 'Log In'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {connectError && (
          <div className="absolute top-full left-0 right-0 mt-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400 text-[10px] font-bold whitespace-normal z-50 min-w-[200px]">
            {connectError}
          </div>
        )}
      </div>
    );
  }

  // Connected — show username + disconnect
  const label = displayName || (publicKey ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}` : 'Connected');

  return (
    <div className="flex items-center gap-1.5 relative">
      {/* Username pill — tappable on mobile to show disconnect dropdown */}
      <button
        onClick={() => setShowDisconnect((prev) => !prev)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full active:scale-95 transition-all"
      >
        <div className={`w-1.5 h-1.5 rounded-full ${isPrivyUser ? 'bg-[#9945FF] shadow-[0_0_6px_#9945FF]' : 'bg-[#14F195] shadow-[0_0_6px_#14F195]'}`}></div>
        <span className="text-white text-[10px] font-black uppercase tracking-wide max-w-[120px] truncate">
          {label}
        </span>
      </button>

      {/* Desktop: always-visible red X */}
      <button
        onClick={disconnect}
        className="hidden md:flex p-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 rounded-full text-red-400 hover:text-red-300 transition-all active:scale-95"
        title={t('wallet.disconnect')}
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Mobile disconnect dropdown */}
      {showDisconnect && (
        <div className="md:hidden absolute top-full right-0 mt-2 z-50">
          <button
            onClick={() => { disconnect(); setShowDisconnect(false); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#0D0D0D] border border-red-500/30 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all active:scale-95 shadow-lg shadow-black/50 whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-[10px] font-black uppercase tracking-wider">Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnectButton;

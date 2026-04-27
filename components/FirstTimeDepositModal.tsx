import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Connection, PublicKey } from '@solana/web3.js';
import { getBalanceSafely } from '../src/utils/balance';

interface FirstTimeDepositModalProps {
  walletAddress: string;
  connection: Connection;
  provider: 'privy' | 'phantom-connect';
  onClose: () => void;
  onGoToProfile?: () => void;
}

// Need at least 0.0225 SOL for one round entry (0.02 prize + 0.0025 platform fee).
// Round up slightly so users have a buffer for tx fees.
const FUND_THRESHOLD_SOL = 0.025;

const FirstTimeDepositModal: React.FC<FirstTimeDepositModalProps> = ({
  walletAddress,
  connection,
  provider,
  onClose,
  onGoToProfile,
}) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshBalance = useCallback(async () => {
    setRefreshing(true);
    try {
      const lamports = await getBalanceSafely(connection, new PublicKey(walletAddress));
      setBalance(lamports / 1e9);
    } catch {
      // ignore — keep last value
    } finally {
      setRefreshing(false);
    }
  }, [connection, walletAddress]);

  useEffect(() => {
    refreshBalance();
    const interval = setInterval(refreshBalance, 10000);
    return () => clearInterval(interval);
  }, [refreshBalance]);

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFunded = balance !== null && balance >= FUND_THRESHOLD_SOL;

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-[#14F195]/30 rounded-2xl p-5 md:p-6 max-w-md w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#14F195]/15 border border-[#14F195]/40 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-black text-base uppercase tracking-wide">Welcome to Sol Trivia</h3>
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Fund your wallet to play</p>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wider">Your Sol Trivia wallet</p>
          <button
            onClick={copyAddress}
            className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-black/40 border border-white/10 rounded-xl hover:bg-black/60 transition-all active:scale-[0.99]"
          >
            <span className="text-white text-[11px] md:text-xs font-mono break-all text-left">{walletAddress}</span>
            {copied ? (
              <svg className="w-4 h-4 text-[#14F195] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-zinc-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            )}
          </button>
        </div>

        <div className={`px-4 py-3 mb-4 rounded-xl border ${isFunded ? 'bg-[#14F195]/10 border-[#14F195]/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
          <div className="flex items-center justify-between">
            <span className={`text-[10px] font-black uppercase tracking-wider ${isFunded ? 'text-[#14F195]' : 'text-yellow-300'}`}>
              Current balance
            </span>
            <span className={`text-sm font-black ${isFunded ? 'text-[#14F195]' : 'text-yellow-300'}`}>
              {balance === null ? '—' : `${balance.toFixed(4)} SOL`}
            </span>
          </div>
          {!isFunded && (
            <p className="text-yellow-300/70 text-[10px] mt-1.5 leading-relaxed">
              You need at least <span className="font-bold">{FUND_THRESHOLD_SOL} SOL</span> to play one ranked round (0.02 prize + 0.0025 platform fee).
            </p>
          )}
          {isFunded && (
            <p className="text-[#14F195]/80 text-[10px] mt-1.5 leading-relaxed">
              You're funded. Ready to play!
            </p>
          )}
        </div>

        <div className="mb-4">
          <p className="text-zinc-400 text-[10px] font-black uppercase tracking-wider mb-2">How to deposit SOL</p>
          <ul className="space-y-1.5 text-zinc-300 text-[11px] leading-relaxed">
            <li className="flex gap-2">
              <span className="text-[#14F195] shrink-0">•</span>
              <span>Send SOL from any exchange (Coinbase, Binance, Kraken) to the address above</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#14F195] shrink-0">•</span>
              <span>Or send from any Solana wallet (Phantom, Solflare, Backpack)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-[#14F195] shrink-0">•</span>
              <span>Balance updates automatically every 10 seconds</span>
            </li>
          </ul>
        </div>

        <div className="mb-5 p-3 bg-white/5 border border-white/10 rounded-xl">
          <p className="text-zinc-300 text-[11px] leading-relaxed">
            <span className="font-bold text-white">Self-custody: </span>
            {provider === 'privy' ? (
              <>
                Your private key lives in your Sol Trivia profile. From{' '}
                <span className="text-white font-semibold">Profile → Export Key</span>, you can copy your seed phrase to import this wallet into Phantom, Solflare, or any other Solana wallet.
              </>
            ) : (
              <>
                This is your Phantom wallet. To export your seed phrase or use it in another wallet, sign in to{' '}
                <a href="https://phantom.com" target="_blank" rel="noopener noreferrer" className="text-[#AB9FF2] underline font-semibold">
                  phantom.com
                </a>{' '}
                with the same Google or Apple account you used here.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 text-xs font-black uppercase tracking-wider hover:bg-zinc-700 transition-all active:scale-[0.98]"
          >
            {isFunded ? "Let's Play" : "I'll Deposit Later"}
          </button>
          {!isFunded && (
            <button
              onClick={refreshBalance}
              disabled={refreshing}
              className="px-4 py-3 bg-[#14F195] text-black rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-60"
            >
              {refreshing ? '…' : 'Check Balance'}
            </button>
          )}
          {isFunded && provider === 'privy' && onGoToProfile && (
            <button
              onClick={() => { onClose(); onGoToProfile(); }}
              className="px-4 py-3 bg-[#FFD700]/15 border border-[#FFD700]/30 text-[#FFD700] rounded-xl text-xs font-black uppercase tracking-wider hover:bg-[#FFD700]/25 transition-all active:scale-[0.98]"
            >
              View Profile
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FirstTimeDepositModal;

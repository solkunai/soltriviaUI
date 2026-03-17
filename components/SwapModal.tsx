import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { PublicKey } from '@solana/web3.js';
import { getSwapQuote, createSwapTransaction, type SwapQuote } from '../src/utils/bagsApi';
import { getSplTokenBalance } from '../src/utils/splTransfer';
import { NERD_MINT } from '../src/utils/constants';

interface SwapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOL_DECIMALS = 9;
const NERD_DECIMALS = 9;

const SwapModal: React.FC<SwapModalProps> = ({ isOpen, onClose }) => {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [direction, setDirection] = useState<'buy' | 'sell'>('buy'); // buy = SOL→NERD
  const [inputAmount, setInputAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [nerdBalance, setNerdBalance] = useState<bigint>(0n);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const quoteAbortRef = useRef<AbortController | null>(null);

  const inputToken = direction === 'buy' ? 'SOL' : 'NERD';
  const outputToken = direction === 'buy' ? 'NERD' : 'SOL';
  const inputDecimals = direction === 'buy' ? SOL_DECIMALS : NERD_DECIMALS;
  const outputDecimals = direction === 'buy' ? NERD_DECIMALS : SOL_DECIMALS;

  // Fetch balances
  const loadBalances = useCallback(async () => {
    if (!publicKey || !connection) return;
    try {
      const [sol, nerd] = await Promise.all([
        connection.getBalance(publicKey),
        getSplTokenBalance(connection, publicKey, 'NERD'),
      ]);
      setSolBalance(sol);
      setNerdBalance(nerd);
    } catch {
      // Silently fail — balances just won't show
    }
  }, [publicKey, connection]);

  useEffect(() => {
    if (isOpen && connected) loadBalances();
  }, [isOpen, connected, loadBalances]);

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setInputAmount('');
      setQuote(null);
      setError(null);
      setSuccess(null);
      setQuoteLoading(false);
      setSwapping(false);
    }
  }, [isOpen]);

  // Debounced quote fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (quoteAbortRef.current) quoteAbortRef.current.abort();

    const parsed = parseFloat(inputAmount);
    if (!inputAmount || isNaN(parsed) || parsed <= 0) {
      setQuote(null);
      setQuoteLoading(false);
      return;
    }

    setQuoteLoading(true);
    setError(null);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      quoteAbortRef.current = controller;

      try {
        const smallestUnits = Math.round(parsed * Math.pow(10, inputDecimals));
        const q = await getSwapQuote(direction, smallestUnits);
        if (!controller.signal.aborted) {
          setQuote(q);
          setQuoteLoading(false);
        }
      } catch (err: any) {
        if (!controller.signal.aborted) {
          setQuote(null);
          setQuoteLoading(false);
          if (err.message !== 'Bags API key not configured') {
            setError('Failed to get quote. Try again.');
          } else {
            setError('Swap not configured. Contact support.');
          }
        }
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputAmount, direction, inputDecimals]);

  const handleFlip = () => {
    setDirection(d => d === 'buy' ? 'sell' : 'buy');
    setInputAmount('');
    setQuote(null);
    setError(null);
    setSuccess(null);
  };

  const handleMax = () => {
    if (direction === 'buy') {
      // Leave ~0.005 SOL for tx fees
      const maxLamports = Math.max(0, solBalance - 5_000_000);
      setInputAmount((maxLamports / 1e9).toString());
    } else {
      setInputAmount((Number(nerdBalance) / 1e9).toString());
    }
  };

  const handleSwap = async () => {
    if (!connected || !publicKey || !quote) return;

    setSwapping(true);
    setError(null);
    setSuccess(null);

    try {
      const { transaction } = await createSwapTransaction(
        quote,
        publicKey.toBase58(),
      );

      const signature = await sendTransaction(transaction, connection);

      // Confirm with timeout
      await Promise.race([
        connection.confirmTransaction(signature, 'confirmed'),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30_000)
        ),
      ]);

      setSuccess(signature);
      setInputAmount('');
      setQuote(null);

      // Refresh balances after swap
      setTimeout(loadBalances, 2000);
    } catch (err: any) {
      if (err.message?.includes('User rejected') || err.message?.includes('user rejected')) {
        setError('Transaction cancelled.');
      } else if (err.message?.includes('insufficient') || err.message?.includes('Insufficient')) {
        setError('Insufficient balance.');
      } else if (err.message?.includes('timeout')) {
        setError('Transaction timed out. Check your wallet for status.');
      } else {
        setError(err.message || 'Swap failed. Try again.');
      }
    } finally {
      setSwapping(false);
    }
  };

  const formatOutput = (amount: string, decimals: number): string => {
    const num = Number(amount) / Math.pow(10, decimals);
    if (decimals === 9 && outputToken === 'SOL') return num.toFixed(4);
    return num.toFixed(2);
  };

  const inputBalance = direction === 'buy'
    ? `${(solBalance / 1e9).toFixed(4)} SOL`
    : `${(Number(nerdBalance) / 1e9).toFixed(2)} NERD`;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-3xl"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm bg-[#0D0D0D] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
        {/* Accent strip */}
        <div className="h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500" />

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <img src="/token-nerd.png" alt="$NERD" className="w-6 h-6 rounded-full" />
              <h2 className="text-white text-lg font-black uppercase tracking-wide">
                Swap
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-500 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* You Pay */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">You Pay</span>
              <button
                onClick={handleMax}
                className="text-amber-400/70 text-[10px] font-bold uppercase tracking-wider hover:text-amber-400 transition-colors"
              >
                MAX
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                inputMode="decimal"
                value={inputAmount}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^\d*\.?\d*$/.test(val)) setInputAmount(val);
                }}
                placeholder="0.00"
                disabled={swapping}
                className="flex-1 bg-transparent text-white text-2xl font-bold outline-none placeholder-zinc-600 min-w-0"
              />
              <div className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-lg shrink-0">
                <img
                  src={direction === 'buy' ? '/token-sol.png' : '/token-nerd.png'}
                  alt={inputToken}
                  className="w-4 h-4 rounded-full"
                />
                <span className="text-white text-xs font-black uppercase">{inputToken}</span>
              </div>
            </div>
            <div className="text-zinc-500 text-[10px] font-medium mt-1.5">
              Balance: {inputBalance}
            </div>
          </div>

          {/* Flip Button */}
          <div className="flex justify-center -my-1 relative z-10">
            <button
              onClick={handleFlip}
              disabled={swapping}
              className="w-9 h-9 rounded-full bg-[#1A1A1A] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90"
            >
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </button>
          </div>

          {/* You Receive */}
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 mt-2 mb-4">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider block mb-2">You Receive</span>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {quoteLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                    <span className="text-zinc-500 text-lg">Getting quote...</span>
                  </div>
                ) : quote ? (
                  <span className="text-white text-2xl font-bold">
                    {formatOutput(quote.outAmount, outputDecimals)}
                  </span>
                ) : (
                  <span className="text-zinc-600 text-2xl font-bold">0.00</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 bg-white/[0.06] px-3 py-1.5 rounded-lg shrink-0">
                <img
                  src={direction === 'buy' ? '/token-nerd.png' : '/token-sol.png'}
                  alt={outputToken}
                  className="w-4 h-4 rounded-full"
                />
                <span className="text-white text-xs font-black uppercase">{outputToken}</span>
              </div>
            </div>
            {quote && (
              <div className="text-zinc-500 text-[10px] font-medium mt-1.5">
                Min: {formatOutput(quote.minOutAmount, outputDecimals)} {outputToken}
              </div>
            )}
          </div>

          {/* Quote Details */}
          {quote && (
            <div className="bg-white/[0.02] rounded-lg px-3 py-2 mb-4 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500 font-medium">Price Impact</span>
                <span className={`font-bold ${parseFloat(quote.priceImpactPct) > 1 ? 'text-red-400' : 'text-zinc-400'}`}>
                  {parseFloat(quote.priceImpactPct).toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-zinc-500 font-medium">Slippage</span>
                <span className="text-zinc-400 font-bold">{(quote.slippageBps / 100).toFixed(1)}%</span>
              </div>
              {quote.routePlan.length > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span className="text-zinc-500 font-medium">Route</span>
                  <span className="text-zinc-400 font-bold">{quote.routePlan.map(r => r.venue).join(' → ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
              <p className="text-red-400 text-[11px] font-bold">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2 mb-4">
              <p className="text-green-400 text-[11px] font-bold">Swap successful!</p>
              <a
                href={`https://solscan.io/tx/${success}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400/70 text-[10px] hover:underline"
              >
                View on Solscan
              </a>
            </div>
          )}

          {/* Swap Button */}
          <button
            onClick={handleSwap}
            disabled={!connected || !quote || swapping || quoteLoading || !!success}
            className={`w-full py-3 rounded-xl font-black text-sm uppercase tracking-wider transition-all active:scale-[0.98] ${
              !connected || !quote || swapping || quoteLoading || !!success
                ? 'bg-white/5 text-zinc-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400'
            }`}
          >
            {swapping ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Swapping...
              </span>
            ) : !connected ? (
              'Connect Wallet'
            ) : success ? (
              'Done'
            ) : (
              `Swap ${inputToken} for ${outputToken}`
            )}
          </button>

          {/* Powered by */}
          <div className="flex items-center justify-center gap-1.5 mt-4">
            <span className="text-zinc-600 text-[9px] font-medium">Powered by</span>
            <a
              href="https://bags.fm"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-500 text-[9px] font-bold hover:text-zinc-400 transition-colors"
            >
              Bags.fm
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SwapModal;

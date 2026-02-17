import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { SystemProgram, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { purchaseLives } from '../src/utils/api';
import {
  REVENUE_WALLET,
  LIVES_TIERS,
  SEEKER_LIVES_TIERS,
  LIVES_USD_PRICING,
  type LivesTierId,
  type PaymentToken,
} from '@/src/utils/constants';
import { fetchTokenPrices, calculateTokenAmount, formatTokenAmount, type TokenPrices } from '@/src/utils/tokenPrices';
import { buildSplTransferInstructions, getSplTokenBalance } from '@/src/utils/splTransfer';

interface BuyLivesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuySuccess?: (newLivesCount?: number) => void;
  isSeekerVerified?: boolean;
}

const TOKEN_OPTIONS: { id: PaymentToken; label: string; color: string }[] = [
  { id: 'SOL', label: 'SOL', color: '#9945FF' },
  { id: 'USDC', label: 'USDC', color: '#2775CA' },
  { id: 'SKR', label: 'SKR', color: '#14F195' },
];

const BuyLivesModal: React.FC<BuyLivesModalProps> = ({ isOpen, onClose, onBuySuccess, isSeekerVerified = false }) => {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchasedLives, setPurchasedLives] = useState(0);
  const [selectedTier, setSelectedTier] = useState<LivesTierId>('basic');
  const [selectedToken, setSelectedToken] = useState<PaymentToken>('SOL');
  const [prices, setPrices] = useState<TokenPrices | null>(null);
  const [pricesLoading, setPricesLoading] = useState(false);

  // Fetch prices on open and refresh every 15s
  const loadPrices = useCallback(async () => {
    try {
      setPricesLoading(true);
      const p = await fetchTokenPrices();
      setPrices(p);
    } catch (err) {
      console.error('Failed to fetch token prices:', err);
    } finally {
      setPricesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadPrices();
    const interval = setInterval(loadPrices, 15000);
    return () => clearInterval(interval);
  }, [isOpen, loadPrices]);

  if (!isOpen) return null;

  // Get USD price for the selected tier
  const tierPricing = LIVES_USD_PRICING[selectedTier as keyof typeof LIVES_USD_PRICING];
  const usdPrice = isSeekerVerified ? tierPricing.seeker : tierPricing.standard;
  const livesCount = tierPricing.lives;

  // Calculate token amount if prices are loaded
  const tokenAmount = prices ? calculateTokenAmount(usdPrice, selectedToken, prices) : null;

  // Legacy SOL tiers (fallback for SOL payments — use fixed lamport amounts)
  const legacySolTiers = isSeekerVerified ? SEEKER_LIVES_TIERS : LIVES_TIERS;
  const legacySolTier = legacySolTiers.find(t => t.id === selectedTier) || legacySolTiers[0];

  const handlePurchase = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    if (selectedToken !== 'SOL' && !prices) {
      setError('Prices not loaded yet. Please wait a moment.');
      return;
    }

    setPurchasing(true);
    setError(null);

    try {
      // Pre-check: verify the user has enough balance
      if (selectedToken !== 'SOL') {
        const balance = await getSplTokenBalance(connection, publicKey, selectedToken);
        if (balance < tokenAmount!) {
          const needed = formatTokenAmount(tokenAmount!, selectedToken);
          setError(`Insufficient ${selectedToken} balance. You need at least ${needed} ${selectedToken}.`);
          setPurchasing(false);
          return;
        }
      }

      const { blockhash } = await connection.getLatestBlockhash();

      let instructions;
      if (selectedToken === 'SOL') {
        // Use legacy fixed lamport amounts for SOL (exact match on EF)
        instructions = [
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(REVENUE_WALLET),
            lamports: legacySolTier.lamports,
          }),
        ];
      } else {
        // USDC or SKR — SPL token transfer
        instructions = buildSplTransferInstructions(publicKey, selectedToken, tokenAmount!);
      }

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(transaction, connection);

      // Wait for on-chain confirmation
      await Promise.race([
        connection.confirmTransaction(signature, 'confirmed'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)),
      ]);

      // Call Edge Function with payment token info
      const result = await purchaseLives(
        publicKey.toBase58(),
        signature,
        selectedTier,
        selectedToken,
        usdPrice
      );

      if (result.success) {
        const added = result.livesPurchased ?? livesCount;
        const newTotal = typeof result.livesCount === 'number' ? result.livesCount : added;
        setPurchasedLives(added);
        setShowSuccess(true);

        if (onBuySuccess) {
          onBuySuccess(newTotal);
        }

        setTimeout(() => {
          setShowSuccess(false);
          onClose();
        }, 3000);
      } else {
        setError((result as any).error || 'Purchase recorded but verification failed. Please refresh.');
      }
    } catch (err: any) {
      console.error('Purchase error:', err);

      let errorMessage = 'Failed to purchase lives. Please try again.';
      if (err.message?.includes('User rejected')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (err.message?.includes('insufficient funds') || err.message?.includes('Insufficient')) {
        errorMessage = `Insufficient balance. You need enough ${selectedToken} plus SOL for transaction fees.`;
      } else if (err.message?.includes('blockhash') || err.message?.includes('403')) {
        errorMessage = 'Network error. Please try again or check your connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
    } finally {
      setPurchasing(false);
    }
  };

  // Format the display price for the current selection
  const displayPrice = (): string => {
    if (selectedToken === 'SOL' && !prices) {
      return `${legacySolTier.sol} SOL`;
    }
    if (!prices || !tokenAmount) return '...';
    return `${formatTokenAmount(tokenAmount, selectedToken)} ${selectedToken}`;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/90 animate-fade-in overflow-hidden">
      <div className="relative w-full max-w-md bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(255,49,49,0.1)] overflow-hidden flex flex-col rounded-2xl">
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF3131] via-[#818cf8] to-[#FF3131]"></div>

        <div className="p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-[#FF3131] text-[10px] font-black tracking-[0.4em] uppercase mb-1 block italic">Neural Restoration</span>
              <h2 className="text-3xl font-[1000] italic uppercase tracking-tighter text-white leading-none">VITALITY <span className="text-[#FF3131]">SYNC</span></h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-zinc-300 text-[11px] font-black uppercase tracking-widest mb-5 italic text-center">
            Unlock multi-entry access. Unused lives roll over indefinitely.
          </p>

          {/* Seeker Discount Banner */}
          {isSeekerVerified && (
            <div className="bg-[#14F195]/10 border border-[#14F195]/30 p-3 rounded-lg mb-4">
              <p className="text-[#14F195] text-[9px] font-black uppercase tracking-wider text-center italic leading-tight">
                Seeker discount applied — exclusive pricing for SGT holders
              </p>
            </div>
          )}

          {/* Token Selector */}
          <div className="flex gap-2 mb-5">
            {TOKEN_OPTIONS.map((tok) => {
              const isActive = selectedToken === tok.id;
              return (
                <button
                  key={tok.id}
                  onClick={() => { setSelectedToken(tok.id); setError(null); }}
                  disabled={purchasing}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-[900] italic uppercase tracking-wider transition-all border-2 ${
                    isActive
                      ? 'text-white shadow-lg'
                      : 'border-white/5 bg-white/[0.02] text-zinc-500 hover:border-white/10 hover:text-zinc-300'
                  } ${purchasing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={isActive ? { borderColor: tok.color, backgroundColor: `${tok.color}15`, boxShadow: `0 0 15px ${tok.color}20` } : undefined}
                >
                  {tok.label}
                </button>
              );
            })}
          </div>

          {/* USD Price Indicator */}
          {pricesLoading && !prices && (
            <div className="text-center mb-3">
              <span className="text-zinc-500 text-[10px] font-bold italic">Loading prices...</span>
            </div>
          )}

          {/* Tier Selection */}
          <div className="space-y-3 mb-5">
            {(['basic', 'value', 'bulk'] as const).map((tierId) => {
              const tp = LIVES_USD_PRICING[tierId];
              const isSelected = selectedTier === tierId;
              const tierUsd = isSeekerVerified ? tp.seeker : tp.standard;
              const badge = tierId === 'value' ? 'POPULAR' : tierId === 'bulk' ? 'BEST VALUE' : null;
              // Calculate display price for this tier
              let tierDisplayPrice = `$${tierUsd}`;
              if (prices) {
                const amt = calculateTokenAmount(tierUsd, selectedToken, prices);
                tierDisplayPrice = `${formatTokenAmount(amt, selectedToken)} ${selectedToken}`;
              } else if (selectedToken === 'SOL') {
                const legacy = legacySolTiers.find(t => t.id === tierId);
                if (legacy) tierDisplayPrice = `${legacy.sol} SOL`;
              }

              return (
                <button
                  key={tierId}
                  onClick={() => { setSelectedTier(tierId); setError(null); }}
                  disabled={purchasing}
                  className={`w-full p-4 rounded-xl border-2 transition-all relative ${
                    isSelected
                      ? 'border-[#FF3131] bg-[#FF3131]/10 shadow-[0_0_20px_rgba(255,49,49,0.15)]'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                  } ${purchasing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {badge && (
                    <span className={`absolute -top-2 right-3 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      tierId === 'bulk' ? 'bg-[#14F195] text-black' : 'bg-[#818cf8] text-white'
                    }`}>
                      {badge}
                    </span>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isSelected ? 'bg-[#FF3131]/20' : 'bg-white/5'
                      }`}>
                        <svg className={`w-5 h-5 ${isSelected ? 'text-[#FF3131] fill-[#FF3131]' : 'text-zinc-500 fill-zinc-500'}`} viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <span className="text-white font-[1000] text-lg italic tracking-tighter block leading-tight">
                          {tp.lives} LIVES
                        </span>
                        <span className="text-zinc-500 text-[9px] font-bold uppercase">
                          ${tierUsd} USD
                        </span>
                      </div>
                    </div>
                    <span className={`font-[1000] text-xl italic tracking-tighter ${
                      isSelected ? 'text-[#00FFA3]' : 'text-zinc-400'
                    }`}>
                      {tierDisplayPrice}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg mb-5">
            <p className="text-amber-400 text-[9px] font-black uppercase tracking-wider text-center italic leading-tight">
              You get 2 round entries included each round. Extra lives are for additional plays beyond that. Entry fee (0.0225 SOL) still applies.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-xs font-black uppercase text-center">{error}</p>
            </div>
          )}

          <button
            onClick={handlePurchase}
            disabled={purchasing || !connected || (selectedToken !== 'SOL' && !prices)}
            className="w-full py-5 bg-[#FF3131] disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-[1000] text-xl italic uppercase tracking-tighter shadow-[0_0_30px_rgba(255,49,49,0.4)] active:scale-95 transition-all rounded-sm disabled:cursor-not-allowed"
          >
            {purchasing ? 'PROCESSING...' : `BUY ${livesCount} LIVES — ${displayPrice()}`}
          </button>

          <p className="text-[8px] text-zinc-600 text-center font-black uppercase tracking-[0.2em] mt-4 italic">
            Secured by Solana Protocol
          </p>
        </div>

        {/* Brainy Decor */}
        <div className="absolute -bottom-6 -left-6 w-32 h-32 opacity-10 pointer-events-none rotate-12">
           <img src="brainy-worried.png" alt="" className="w-full h-full grayscale" />
        </div>
      </div>

      {/* Success Overlay */}
      {showSuccess && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-gradient-to-br from-[#00FFA3] to-[#14F195] p-8 rounded-2xl shadow-2xl max-w-sm mx-4 text-center animate-pulse-once">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <svg className="w-12 h-12 text-[#00FFA3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-3xl font-[1000] italic uppercase text-black mb-2">SUCCESS!</h3>
            <p className="text-black font-bold text-lg mb-4">
              +{purchasedLives} Lives Purchased Successfully!
            </p>
            <p className="text-black/80 font-black text-sm italic uppercase tracking-wider">
              Time to Play!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyLivesModal;

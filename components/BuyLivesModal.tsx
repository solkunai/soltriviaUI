import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { VersionedTransaction } from '@solana/web3.js';
import { purchaseLives, buildLivesPurchaseTx } from '../src/utils/api';
import {
  LIVES_USD_PRICING,
  NERD_PAYMENT_DISCOUNT,
  getTokenMint,
  type LivesTierId,
  type PaymentToken,
} from '@/src/utils/constants';
import { fetchTokenPrices, calculateTokenAmount, formatTokenAmount, type TokenPrices } from '@/src/utils/tokenPrices';
import { getSplTokenBalance } from '@/src/utils/splTransfer';

interface BuyLivesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuySuccess?: (newLivesCount?: number) => void;
  isSeekerVerified?: boolean;
}

const TOKEN_OPTIONS: { id: PaymentToken; label: string; color: string; icon: string }[] = [
  { id: 'SOL', label: 'SOL', color: '#9945FF', icon: '/token-sol.png' },
  { id: 'USDC', label: 'USDC', color: '#2775CA', icon: '/token-usdc.png' },
  { id: 'SKR', label: 'SKR', color: '#14F195', icon: '/token-skr.png' },
  { id: 'NERD', label: '$NERD', color: '#F59E0B', icon: '/token-nerd.png' },
];

const BuyLivesModal: React.FC<BuyLivesModalProps> = ({ isOpen, onClose, onBuySuccess, isSeekerVerified = false }) => {
  const { t } = useTranslation();
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
      // Auto-fallback: if NERD is selected but price unavailable, switch to SOL
      if (selectedToken === 'NERD' && !p.NERD) {
        setSelectedToken('SOL');
      }
    } catch (err) {
      console.error('Failed to fetch token prices:', err);
    } finally {
      setPricesLoading(false);
    }
  }, [selectedToken]);

  useEffect(() => {
    if (!isOpen) return;
    loadPrices();
    const interval = setInterval(loadPrices, 15000);
    return () => clearInterval(interval);
  }, [isOpen, loadPrices]);

  if (!isOpen) return null;

  // Get USD price for the selected tier
  const tierPricing = LIVES_USD_PRICING[selectedTier as keyof typeof LIVES_USD_PRICING];
  let usdPrice: number = isSeekerVerified ? tierPricing.seeker : tierPricing.standard;
  if (selectedToken === 'NERD') {
    usdPrice = +(usdPrice * (1 - NERD_PAYMENT_DISCOUNT)).toFixed(2);
  }
  const livesCount = tierPricing.lives;

  // Calculate token amount if prices are loaded
  const tokenAmount = prices ? calculateTokenAmount(usdPrice, selectedToken, prices) : null;

  const handlePurchase = async () => {
    if (!connected || !publicKey) {
      setError(t('buyLives.walletNotConnected'));
      return;
    }

    if (selectedToken !== 'SOL' && !prices) {
      setError(t('buyLives.pricesNotLoaded'));
      return;
    }

    setPurchasing(true);
    setError(null);

    try {
      // SOL native balance pre-check: every purchase pays 0.0025 SOL platform fee + tx fee.
      // Need at least ~0.005 SOL native to avoid cryptic execution failures (esp. for SPL buyers).
      const nativeBalance = await connection.getBalance(publicKey);
      const MIN_NATIVE_LAMPORTS = 5_000_000; // 0.005 SOL
      if (nativeBalance < MIN_NATIVE_LAMPORTS) {
        setError(t('buyLives.insufficientNativeSol') || 'Need at least 0.005 SOL native (covers the 0.0025 SOL platform fee + tx fee)');
        setPurchasing(false);
        return;
      }

      // SPL pre-check: verify the user has enough token balance for the chosen token.
      if (selectedToken !== 'SOL') {
        const balance = await getSplTokenBalance(connection, publicKey, selectedToken);
        if (balance < tokenAmount!) {
          const needed = formatTokenAmount(tokenAmount!, selectedToken);
          setError(t('buyLives.insufficientTokenBalance', { token: selectedToken, needed }));
          setPurchasing(false);
          return;
        }
      }

      // Build the multi-token, multi-recipient tx server-side (EF returns base64 v0 tx).
      const usdPriceCents = Math.round(usdPrice * 100);
      const tokenMint = getTokenMint(selectedToken);
      const builtTx = await buildLivesPurchaseTx({
        walletAddress: publicKey.toBase58(),
        tier: selectedTier,
        paymentToken: selectedToken,
        token_mint: tokenMint,
        usd_price_cents: usdPriceCents,
      });

      // Deserialize, sign, send
      const txBytes = Uint8Array.from(atob(builtTx.tx_base64), c => c.charCodeAt(0));
      const transaction = VersionedTransaction.deserialize(txBytes);
      const signature = await sendTransaction(transaction, connection);

      // Wait for on-chain confirmation
      await Promise.race([
        connection.confirmTransaction(signature, 'confirmed'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)),
      ]);

      // Verify + credit via the existing purchase-lives EF (new payload triggers the 2-leg path).
      const result = await purchaseLives(
        publicKey.toBase58(),
        signature,
        selectedTier,
        selectedToken,
        usdPrice,
        { usd_price_cents: usdPriceCents, token_mint: tokenMint },
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

      let errorMessage = t('buyLives.purchaseFailed');
      if (err.message?.includes('User rejected')) {
        errorMessage = t('buyLives.transactionCancelled');
      } else if (err.message?.includes('insufficient funds') || err.message?.includes('Insufficient')) {
        errorMessage = t('buyLives.insufficientBalance', { token: selectedToken });
      } else if (err.message?.includes('blockhash') || err.message?.includes('403')) {
        errorMessage = t('buyLives.networkError');
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
    if (!prices || !tokenAmount) return `$${usdPrice}`;
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
              <span className="text-[#FF3131] text-[10px] font-black tracking-[0.4em] uppercase mb-1 block italic">{t('buyLives.neuralRestoration')}</span>
              <h2 className="text-3xl font-[1000] italic uppercase tracking-tighter text-white leading-none">VITALITY <span className="text-[#FF3131]">SYNC</span></h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p className="text-zinc-300 text-[11px] font-black uppercase tracking-widest mb-5 italic text-center">
            {t('buyLives.unlockMultiEntry')}
          </p>

          {/* Seeker Discount Banner */}
          {isSeekerVerified && (
            <div className="bg-[#14F195]/10 border border-[#14F195]/30 p-3 rounded-lg mb-4">
              <p className="text-[#14F195] text-[9px] font-black uppercase tracking-wider text-center italic leading-tight">
                {t('buyLives.seekerDiscount')}
              </p>
            </div>
          )}

          {/* NERD Discount Banner */}
          {selectedToken === 'NERD' && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg mb-4">
              <p className="text-amber-400 text-[9px] font-black uppercase tracking-wider text-center italic leading-tight">
                10% discount applied — paying with $NERD
              </p>
            </div>
          )}

          {/* Token Selector */}
          <div className="flex gap-2 mb-5">
            {TOKEN_OPTIONS.map((tok) => {
              const isActive = selectedToken === tok.id;
              const nerdUnavailable = tok.id === 'NERD' && prices && !prices.NERD;
              return (
                <button
                  key={tok.id}
                  onClick={() => { if (!nerdUnavailable) { setSelectedToken(tok.id); setError(null); } }}
                  disabled={purchasing || !!nerdUnavailable}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-[900] italic uppercase tracking-wider transition-all border-2 ${
                    isActive
                      ? 'text-white shadow-lg'
                      : nerdUnavailable
                        ? 'border-white/5 bg-white/[0.01] text-zinc-700 cursor-not-allowed'
                        : 'border-white/5 bg-white/[0.02] text-zinc-500 hover:border-white/10 hover:text-zinc-300'
                  } ${purchasing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  style={isActive && !nerdUnavailable ? { borderColor: tok.color, backgroundColor: `${tok.color}15`, boxShadow: `0 0 15px ${tok.color}20` } : undefined}
                  title={nerdUnavailable ? '$NERD price unavailable — coming soon' : undefined}
                >
                  <img src={tok.icon} alt={tok.label} className={`w-4 h-4 rounded-full object-cover inline-block mr-1 align-middle ${nerdUnavailable ? 'opacity-30' : ''}`} />
                  {tok.label}
                </button>
              );
            })}
          </div>

          {/* USD Price Indicator */}
          {pricesLoading && !prices && (
            <div className="text-center mb-3">
              <span className="text-zinc-500 text-[10px] font-bold italic">{t('buyLives.loadingPrices')}</span>
            </div>
          )}

          {/* Tier Selection */}
          <div className="space-y-3 mb-5">
            {(['basic', 'value', 'bulk'] as const).map((tierId) => {
              const tp = LIVES_USD_PRICING[tierId];
              const isSelected = selectedTier === tierId;
              let tierUsd: number = isSeekerVerified ? tp.seeker : tp.standard;
              if (selectedToken === 'NERD') {
                tierUsd = +(tierUsd * (1 - NERD_PAYMENT_DISCOUNT)).toFixed(2);
              }
              const badge = tierId === 'value' ? t('buyLives.popular') : tierId === 'bulk' ? t('buyLives.bestValue') : null;
              // Calculate display price for this tier
              let tierDisplayPrice = `$${tierUsd}`;
              if (prices) {
                const amt = calculateTokenAmount(tierUsd, selectedToken, prices);
                tierDisplayPrice = `${formatTokenAmount(amt, selectedToken)} ${selectedToken}`;
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
              {t('buyLives.freeEntriesNote')}
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
            {purchasing ? t('buyLives.processing') : t('buyLives.buyButton', { count: livesCount, price: displayPrice() })}
          </button>

          <p className="text-[8px] text-zinc-600 text-center font-black uppercase tracking-[0.2em] mt-4 italic">
            {t('buyLives.securedBySolana')}
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
            <h3 className="text-3xl font-[1000] italic uppercase text-black mb-2">{t('buyLives.successTitle')}</h3>
            <p className="text-black font-bold text-lg mb-4">
              {t('buyLives.successMessage', { count: purchasedLives })}
            </p>
            <p className="text-black/80 font-black text-sm italic uppercase tracking-wider">
              {t('buyLives.timeToPlay')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyLivesModal;

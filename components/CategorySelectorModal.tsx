import React, { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { SystemProgram, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { purchaseGamePass } from '../src/utils/api';
import {
  REVENUE_WALLET,
  FREE_CATEGORIES,
  ALL_CATEGORIES,
  CATEGORY_LABELS,
  GAME_PASS_PRICE_LAMPORTS,
  GAME_PASS_PRICE_SOL,
  SEEKER_GAME_PASS_PRICE_LAMPORTS,
  SEEKER_GAME_PASS_PRICE_SOL,
  GAME_PASS_USD_PRICING,
  PracticeCategory,
  type PaymentToken,
} from '../src/utils/constants';
import { fetchTokenPrices, calculateTokenAmount, formatTokenAmount, type TokenPrices } from '../src/utils/tokenPrices';
import { buildSplTransferInstructions, getSplTokenBalance } from '../src/utils/splTransfer';

interface CategorySelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCategory: (category: PracticeCategory | 'all') => void;
  hasGamePass: boolean;
  isSeekerVerified: boolean;
  onGamePassPurchased: () => void;
}

const CATEGORY_ICONS: Record<PracticeCategory | 'all', string> = {
  all: '🎲',
  general: '🧠',
  crypto: '₿',
  sports: '⚽',
  history: '📜',
  geography: '🌍',
  entertainment: '🎬',
  science: '🔬',
};

const TOKEN_OPTIONS: { id: PaymentToken; label: string; color: string }[] = [
  { id: 'SOL', label: 'SOL', color: '#9945FF' },
  { id: 'USDC', label: 'USDC', color: '#2775CA' },
  { id: 'SKR', label: 'SKR', color: '#14F195' },
];

const CategorySelectorModal: React.FC<CategorySelectorModalProps> = ({
  isOpen,
  onClose,
  onSelectCategory,
  hasGamePass,
  isSeekerVerified,
  onGamePassPurchased,
}) => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [selectedToken, setSelectedToken] = useState<PaymentToken>('SOL');
  const [prices, setPrices] = useState<TokenPrices | null>(null);

  // Legacy SOL pricing (fixed lamport amounts)
  const priceLamports = isSeekerVerified ? SEEKER_GAME_PASS_PRICE_LAMPORTS : GAME_PASS_PRICE_LAMPORTS;
  const priceSol = isSeekerVerified ? SEEKER_GAME_PASS_PRICE_SOL : GAME_PASS_PRICE_SOL;

  // USD-based pricing
  const usdPrice = isSeekerVerified ? GAME_PASS_USD_PRICING.seeker : GAME_PASS_USD_PRICING.standard;

  // Fetch prices on open and refresh every 15s
  const loadPrices = useCallback(async () => {
    try {
      const p = await fetchTokenPrices();
      setPrices(p);
    } catch (err) {
      console.error('Failed to fetch token prices:', err);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadPrices();
    const interval = setInterval(loadPrices, 15000);
    return () => clearInterval(interval);
  }, [isOpen, loadPrices]);

  if (!isOpen) return null;

  // Calculate token amount
  const tokenAmount = prices ? calculateTokenAmount(usdPrice, selectedToken, prices) : null;

  // Display price string
  const displayPrice = (): string => {
    if (selectedToken === 'SOL' && !prices) return `${priceSol} SOL`;
    if (!prices || !tokenAmount) return '...';
    return `${formatTokenAmount(tokenAmount, selectedToken)} ${selectedToken}`;
  };

  const handlePurchasePass = async () => {
    if (!connected || !publicKey) return;

    if (selectedToken !== 'SOL' && !prices) {
      setPurchaseError('Prices not loaded yet. Please wait a moment.');
      return;
    }

    setPurchasing(true);
    setPurchaseError(null);

    try {
      // Pre-check: verify the user has enough token balance
      if (selectedToken !== 'SOL') {
        const balance = await getSplTokenBalance(connection, publicKey, selectedToken);
        if (balance < tokenAmount!) {
          const needed = formatTokenAmount(tokenAmount!, selectedToken);
          setPurchaseError(`Insufficient ${selectedToken} balance. You need at least ${needed} ${selectedToken}.`);
          setPurchasing(false);
          return;
        }
      }

      const { blockhash } = await connection.getLatestBlockhash();

      let instructions;
      if (selectedToken === 'SOL') {
        instructions = [
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: new PublicKey(REVENUE_WALLET),
            lamports: priceLamports,
          }),
        ];
      } else {
        instructions = buildSplTransferInstructions(publicKey, selectedToken, tokenAmount!);
      }

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation
      await Promise.race([
        connection.confirmTransaction(signature, 'confirmed'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Confirmation timeout')), 30000)),
      ]);

      // Register with backend (pass token info)
      await purchaseGamePass(publicKey.toBase58(), signature, selectedToken, usdPrice);
      onGamePassPurchased();
    } catch (err: any) {
      if (err.message?.includes('User rejected')) {
        // User cancelled — do nothing
      } else if (err.message?.includes('insufficient funds') || err.message?.includes('Insufficient')) {
        setPurchaseError(`Insufficient balance. You need enough ${selectedToken} plus SOL for transaction fees.`);
      } else {
        setPurchaseError(err.message || 'Purchase failed. Please try again.');
      }
    } finally {
      setPurchasing(false);
    }
  };

  const isFree = (cat: PracticeCategory) => (FREE_CATEGORIES as readonly string[]).includes(cat);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-white/5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-[1000] italic uppercase tracking-tighter text-white">Choose Category</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-zinc-500 text-xs font-bold italic mt-1">Pick a topic or play all categories</p>
        </div>

        {/* Categories Grid */}
        <div className="p-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            {/* "All Categories" option */}
            <button
              onClick={() => onSelectCategory('all')}
              className="col-span-2 flex items-center gap-3 p-4 bg-gradient-to-r from-[#14F195]/10 to-[#9945FF]/10 border border-[#14F195]/20 rounded-xl hover:border-[#14F195]/40 transition-all active:scale-[0.98] group"
            >
              <span className="text-2xl">{CATEGORY_ICONS.all}</span>
              <div className="text-left flex-1">
                <span className="text-white font-[900] italic uppercase text-sm tracking-tight">All Categories</span>
                <span className="block text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Random mix</span>
              </div>
              <svg className="w-4 h-4 text-[#14F195] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Free Categories */}
            {ALL_CATEGORIES.map((cat) => {
              const free = isFree(cat);
              const locked = !free && !hasGamePass;

              return (
                <button
                  key={cat}
                  onClick={() => {
                    if (!locked) onSelectCategory(cat);
                  }}
                  disabled={locked}
                  className={`flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98] group ${
                    locked
                      ? 'bg-zinc-900/50 border border-zinc-800/50 opacity-60 cursor-not-allowed'
                      : free
                        ? 'bg-[#0F0F0F] border border-white/5 hover:border-[#14F195]/30'
                        : 'bg-[#0F0F0F] border border-[#9945FF]/20 hover:border-[#9945FF]/40'
                  }`}
                >
                  <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
                  <div className="text-left flex-1 min-w-0">
                    <span className="text-white font-[900] italic uppercase text-xs tracking-tight block truncate">
                      {CATEGORY_LABELS[cat]}
                    </span>
                    {free ? (
                      <span className="text-[#14F195] text-[9px] font-black uppercase tracking-wider">Free</span>
                    ) : locked ? (
                      <span className="text-zinc-600 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        Game Pass
                      </span>
                    ) : (
                      <span className="text-[#9945FF] text-[9px] font-black uppercase tracking-wider">Premium</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Game Pass Purchase Section */}
          {!hasGamePass && (
            <div className="mt-5 p-4 bg-gradient-to-br from-[#9945FF]/10 to-[#14F195]/10 border border-[#9945FF]/20 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-white font-[900] italic uppercase text-sm tracking-tight">Game Pass</h3>
                  <p className="text-zinc-500 text-[10px] font-bold">Unlock all categories + unlimited practice</p>
                </div>
              </div>

              {/* Token Selector for Game Pass */}
              <span className="text-zinc-400 text-[10px] font-black italic uppercase tracking-wider block mt-3 mb-2">Choose your payment method</span>
              <div className="flex gap-2 mb-3">
                {TOKEN_OPTIONS.map((tok) => {
                  const isActive = selectedToken === tok.id;
                  return (
                    <button
                      key={tok.id}
                      onClick={() => { setSelectedToken(tok.id); setPurchaseError(null); }}
                      disabled={purchasing}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-[900] italic uppercase tracking-wider transition-all border-2 ${
                        isActive
                          ? 'text-white'
                          : 'border-white/5 bg-white/[0.02] text-zinc-500 hover:border-white/10 hover:text-zinc-300'
                      } ${purchasing ? 'opacity-50 cursor-not-allowed' : ''}`}
                      style={isActive ? { borderColor: tok.color, backgroundColor: `${tok.color}15` } : undefined}
                    >
                      {tok.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-3">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-white font-[900] text-lg italic">{displayPrice()}</span>
                    <span className="text-zinc-500 text-[10px] font-bold">(${usdPrice} USD)</span>
                  </div>
                  {isSeekerVerified && (
                    <span className="text-[9px] font-black uppercase tracking-wider text-[#14F195] bg-[#14F195]/10 px-2 py-0.5 rounded-full">
                      Seeker Price
                    </span>
                  )}
                  <span className="block text-zinc-500 text-[10px] font-bold mt-1">One-time purchase</span>
                </div>

                {connected ? (
                  <button
                    onClick={handlePurchasePass}
                    disabled={purchasing || (selectedToken !== 'SOL' && !prices)}
                    className={`px-5 py-2.5 rounded-full font-[900] italic uppercase text-sm tracking-tight transition-all active:scale-[0.97] ${
                      purchasing
                        ? 'bg-zinc-700 text-zinc-400 cursor-wait'
                        : 'bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white hover:shadow-lg hover:shadow-[#9945FF]/30'
                    }`}
                  >
                    {purchasing ? 'Processing...' : 'Buy Pass'}
                  </button>
                ) : (
                  <span className="text-zinc-500 text-xs font-bold italic">Connect wallet to buy</span>
                )}
              </div>

              {purchaseError && (
                <p className="mt-2 text-[#FF3131] text-xs font-bold">{purchaseError}</p>
              )}
            </div>
          )}

          {hasGamePass && (
            <div className="mt-4 flex items-center gap-2 px-1">
              <div className="w-5 h-5 rounded-full bg-[#14F195]/20 flex items-center justify-center">
                <svg className="w-3 h-3 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-[#14F195] text-xs font-[900] italic uppercase tracking-wider">Game Pass Active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CategorySelectorModal;

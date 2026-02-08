import React, { useState } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { SystemProgram, PublicKey, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { purchaseLives } from '../src/utils/api';
import { REVENUE_WALLET, LIVES_TIERS, type LivesTierId } from '@/src/utils/constants';


interface BuyLivesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuySuccess?: (newLivesCount?: number) => void;
}

const BuyLivesModal: React.FC<BuyLivesModalProps> = ({ isOpen, onClose, onBuySuccess }) => {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchasedLives, setPurchasedLives] = useState(0);
  const [selectedTier, setSelectedTier] = useState<LivesTierId>('basic');

  if (!isOpen) return null;

  const tier = LIVES_TIERS.find(t => t.id === selectedTier) || LIVES_TIERS[0];

  const handlePurchase = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setPurchasing(true);
    setError(null);

    try {
      console.log('Creating purchase lives transaction:', {
        from: publicKey.toBase58(),
        to: REVENUE_WALLET,
        tier: tier.id,
        lamports: tier.lamports,
        sol: tier.sol,
      });

      const { blockhash } = await connection.getLatestBlockhash();

      const instructions = [
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(REVENUE_WALLET),
          lamports: tier.lamports,
        }),
      ];

      const messageV0 = new TransactionMessage({
        payerKey: publicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const transaction = new VersionedTransaction(messageV0);

      const signature = await sendTransaction(transaction, connection);

      const confirmationPromise = connection.confirmTransaction(signature, 'confirmed');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)
      );

      await Promise.race([confirmationPromise, timeoutPromise]);

      console.log('Calling purchase-lives API:', {
        walletAddress: publicKey.toBase58(),
        txSignature: signature,
        tier: tier.id,
      });

      const result = await purchaseLives(publicKey.toBase58(), signature, tier.id);

      if (result.success) {
        setPurchasedLives(result.livesPurchased || tier.lives);
        setShowSuccess(true);

        if (onBuySuccess) {
          onBuySuccess(result.livesCount);
        }

        setTimeout(() => {
          setShowSuccess(false);
          onClose();
        }, 3000);
      } else {
        setError(result.error || 'Purchase recorded but verification failed. Please refresh.');
      }
    } catch (err: any) {
      console.error('Purchase error:', err);

      let errorMessage = 'Failed to purchase lives. Please try again.';
      if (err.message?.includes('User rejected')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = `Insufficient SOL balance. You need at least ${tier.sol} SOL.`;
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

          {/* Tier Selection */}
          <div className="space-y-3 mb-5">
            {LIVES_TIERS.map((t) => {
              const isSelected = selectedTier === t.id;
              const pricePerLife = (t.sol / t.lives).toFixed(4);
              return (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTier(t.id); setError(null); }}
                  disabled={purchasing}
                  className={`w-full p-4 rounded-xl border-2 transition-all relative ${
                    isSelected
                      ? 'border-[#FF3131] bg-[#FF3131]/10 shadow-[0_0_20px_rgba(255,49,49,0.15)]'
                      : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                  } ${purchasing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {'badge' in t && t.badge && (
                    <span className={`absolute -top-2 right-3 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      t.id === 'bulk' ? 'bg-[#14F195] text-black' : 'bg-[#818cf8] text-white'
                    }`}>
                      {t.badge}
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
                          {t.lives} LIVES
                        </span>
                        <span className="text-zinc-500 text-[9px] font-bold uppercase">
                          {pricePerLife} SOL / life
                        </span>
                      </div>
                    </div>
                    <span className={`font-[1000] text-xl italic tracking-tighter ${
                      isSelected ? 'text-[#00FFA3]' : 'text-zinc-400'
                    }`}>
                      {t.sol} SOL
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
            disabled={purchasing || !connected}
            className="w-full py-5 bg-[#FF3131] disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-[1000] text-xl italic uppercase tracking-tighter shadow-[0_0_30px_rgba(255,49,49,0.4)] active:scale-95 transition-all rounded-sm disabled:cursor-not-allowed"
          >
            {purchasing ? 'PROCESSING...' : `BUY ${tier.lives} LIVES — ${tier.sol} SOL`}
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

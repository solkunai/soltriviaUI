import React, { useState } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { Transaction, SystemProgram, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { purchaseLives } from '../src/utils/api';
import { REVENUE_WALLET, LIVES_PRICE_LAMPORTS } from '../src/utils/constants';


interface BuyLivesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuySuccess?: () => void;
}

const BuyLivesModal: React.FC<BuyLivesModalProps> = ({ isOpen, onClose, onBuySuccess }) => {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [purchasedLives, setPurchasedLives] = useState(0);

  if (!isOpen) return null;

  const handlePurchase = async () => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setPurchasing(true);
    setError(null);

    try {
      // Create the transaction
      console.log('Creating purchase lives transaction:', {
        from: publicKey.toBase58(),
        to: REVENUE_WALLET,
        lamports: LIVES_PRICE_LAMPORTS,
        sol: LIVES_PRICE_LAMPORTS / 1_000_000_000,
      });
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(REVENUE_WALLET),
          lamports: LIVES_PRICE_LAMPORTS,
        })
      );

      // Set feePayer and blockhash
      transaction.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      // Sign with wallet (MWA requires signTransaction + sendRawTransaction pattern)
      const signedTx = await signTransaction!(transaction);
      const signature = await connection.sendRawTransaction(signedTx.serialize());

      // Wait for confirmation with timeout
      const confirmationPromise = connection.confirmTransaction(signature, 'confirmed');
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Transaction confirmation timeout')), 30000)
      );
      
      await Promise.race([confirmationPromise, timeoutPromise]);

      // Call the backend API to record the purchase
      console.log('Calling purchase-lives API:', {
        walletAddress: publicKey.toBase58(),
        txSignature: signature,
      });
      
      const result = await purchaseLives(publicKey.toBase58(), signature);

      if (result.success) {
        // Show success modal
        setPurchasedLives(result.livesPurchased || 3);
        setShowSuccess(true);
        
        // Refresh lives after successful purchase
        if (onBuySuccess) {
          await onBuySuccess();
        }
        
        // Auto-close success modal and main modal after 3 seconds
        setTimeout(() => {
          setShowSuccess(false);
          onClose();
        }, 3000);
      } else {
        setError(result.error || 'Purchase recorded but verification failed. Please refresh.');
      }
    } catch (err: any) {
      console.error('Purchase error:', err);
      
      // Provide user-friendly error messages
      let errorMessage = 'Failed to purchase lives. Please try again.';
      if (err.message?.includes('User rejected')) {
        errorMessage = 'Transaction was cancelled.';
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL balance. You need at least 0.03 SOL.';
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
      {/* Use max-w-md for professional desktop size, w-full for mobile */}
      <div className="relative w-full max-w-md bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(255,49,49,0.1)] overflow-hidden flex flex-col rounded-2xl">
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF3131] via-[#818cf8] to-[#FF3131]"></div>
        
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
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

          <div className="flex justify-center mb-8 relative">
              <div className="relative z-10 w-24 h-24 bg-[#FF3131]/10 rounded-full border border-[#FF3131]/30 flex items-center justify-center shadow-[0_0_30px_rgba(255,49,49,0.2)]">
                  <svg className="w-12 h-12 text-[#FF3131] fill-[#FF3131]" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  <div className="absolute -bottom-1 -right-1 bg-white text-black text-xs font-black px-2 py-0.5 rounded-full italic">+3</div>
              </div>
              <div className="absolute inset-0 bg-[#FF3131]/5 blur-3xl rounded-full"></div>
          </div>

          <div className="text-center mb-8">
              <p className="text-zinc-300 text-[11px] font-black uppercase tracking-widest mb-4 italic">
                Unlock multi-entry access. Unused lives roll over and can be used for any future trivia round.
              </p>
              <div className="bg-black/40 border border-white/5 p-4 rounded-xl mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-300 text-[10px] font-black uppercase italic">Service</span>
                    <span className="text-white font-black text-sm italic tracking-tighter">3 ROLLING LIVES</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-zinc-300 text-[10px] font-black uppercase italic">Cost</span>
                    <span className="text-[#00FFA3] font-black text-sm italic tracking-tighter">0.03 SOL</span>
                </div>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg mb-6">
                <p className="text-amber-400 text-[9px] font-black uppercase tracking-wider text-center italic leading-tight">
                  Note: Lives purchase does NOT include entry fee. You'll still need to pay 0.02 SOL entry fee + 0.0025 SOL transaction fee to play.
                </p>
              </div>
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
            {purchasing ? 'PROCESSING...' : 'PURCHASE LIVES'}
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
              Time to Play! 🚀
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyLivesModal;

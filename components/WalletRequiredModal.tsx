import React, { useEffect } from 'react';
import { useWallet } from '../src/contexts/WalletContext';
import WalletConnectButton from './WalletConnectButton';

interface WalletRequiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

const WalletRequiredModal: React.FC<WalletRequiredModalProps> = ({ isOpen, onClose, onOpenTerms, onOpenPrivacy }) => {
  const { connected } = useWallet();

  // Auto-close modal when wallet connects
  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#9945FF]/20 to-[#14F195]/20 flex items-center justify-center border border-[#9945FF]/30">
            <svg className="w-10 h-10 text-[#14F195]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-[1000] italic text-white text-center mb-3 uppercase tracking-tighter">
          Wallet Required
        </h2>

        {/* Description */}
        <p className="text-zinc-400 text-center mb-4 text-sm md:text-base leading-relaxed">
          Please connect your Solana wallet to access this feature. Your wallet is required to play games, view your profile, and participate in SOL Trivia.
        </p>

        {/* TOS/Privacy Acknowledgment */}
        <p className="text-zinc-500 text-center mb-8 text-[11px] md:text-xs leading-relaxed">
          By connecting your wallet, you confirm that you have read and agree to our{' '}
          <button
            onClick={() => { onClose(); onOpenTerms?.(); }}
            className="text-[#14F195] hover:underline font-bold"
          >
            Terms of Service
          </button>
          {' '}and{' '}
          <button
            onClick={() => { onClose(); onOpenPrivacy?.(); }}
            className="text-[#14F195] hover:underline font-bold"
          >
            Privacy Policy
          </button>.
        </p>

        {/* Connect Button */}
        <div className="flex justify-center mb-4">
          <WalletConnectButton />
        </div>

        {/* Help Text */}
        <p className="text-zinc-500 text-xs text-center mt-6">
          Don't have a wallet? Download{' '}
          <a 
            href="https://phantom.app" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#14F195] hover:underline"
          >
            Phantom
          </a>
          {' '}or{' '}
          <a 
            href="https://solflare.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#14F195] hover:underline"
          >
            Solflare
          </a>
        </p>
      </div>
    </div>
  );
};

export default WalletRequiredModal;

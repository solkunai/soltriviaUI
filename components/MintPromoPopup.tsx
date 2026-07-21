import React, { useEffect, useState } from 'react';
import { useWallet, useConnection } from '../src/contexts/WalletContext';
import { fetchMinterRecord, SOLTRIVIA_PROGRAM_ID } from '../src/utils/soltriviaContract';

interface MintPromoPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onMintNow: () => void;
}

const MAX_PER_WALLET = 15;

const MintPromoPopup: React.FC<MintPromoPopupProps> = ({ isOpen, onClose, onMintNow }) => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [maxedOut, setMaxedOut] = useState(false);

  // Skip the popup only if a connected wallet already holds all 15 mints.
  // Anonymous / not-yet-connected visitors always see it (that's the point).
  useEffect(() => {
    if (!connected || !publicKey) {
      setMaxedOut(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const record = await fetchMinterRecord(connection, publicKey, SOLTRIVIA_PROGRAM_ID);
        if (!cancelled && record && record.mintCount >= MAX_PER_WALLET) {
          setMaxedOut(true);
        }
      } catch {
        // On-chain read failed — fail open, don't block the promo on an RPC hiccup.
      }
    })();
    return () => { cancelled = true; };
  }, [connected, publicKey, connection]);

  if (!isOpen || maxedOut) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative bg-[#0A0A0A] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <img
            src="/mint/brain-icon-mint.png"
            alt="Sol Trivia Elementals"
            className="w-24 h-24"
            width={300}
            height={300}
          />
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-[1000] italic text-white text-center mb-2 uppercase tracking-tighter">
          Sol Trivia Elementals
        </h2>
        <p className="text-[#14F195] text-center font-bold uppercase text-sm tracking-wide mb-4">
          Commemorative NFT collection is live
        </p>

        {/* Description */}
        <p className="text-zinc-400 text-center mb-8 text-sm md:text-base leading-relaxed">
          4 archetypes. Blind reveal. 15 max per wallet. Gotta collect em all.
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={onMintNow}
            className="w-full py-3 rounded-xl bg-[#14F195] text-black font-[1000] uppercase tracking-tight text-sm hover:bg-[#0fd884] transition-colors"
          >
            Mint Now
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-transparent text-zinc-400 font-bold text-sm hover:text-white transition-colors"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  );
};

export default MintPromoPopup;

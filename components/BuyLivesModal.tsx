
import React from 'react';

interface BuyLivesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BuyLivesModal: React.FC<BuyLivesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/90 animate-fade-in overflow-hidden">
      <div className="relative w-full max-w-sm bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(255,49,49,0.1)] overflow-hidden flex flex-col rounded-2xl">
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#FF3131] via-[#818cf8] to-[#FF3131]"></div>
        
        <div className="p-8">
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[#FF3131] text-[10px] font-black tracking-[0.4em] uppercase mb-1 block">Refill Protocol</span>
              <h2 className="text-3xl font-[1000] italic uppercase tracking-tighter text-white leading-none">EXTRA <span className="text-[#FF3131]">LIVES</span></h2>
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
              <p className="text-zinc-500 text-[11px] font-black uppercase tracking-widest mb-4">
                Unlock multi-entry access. Unused lives roll over and can be used for any future trivia round.
              </p>
              <div className="bg-black/40 border border-white/5 p-4 rounded-xl mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-zinc-600 text-[10px] font-black uppercase">Service</span>
                    <span className="text-white font-black text-sm italic tracking-tighter">3 ROLLING LIVES</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-zinc-600 text-[10px] font-black uppercase">Cost</span>
                    <span className="text-[#00FFA3] font-black text-sm italic tracking-tighter">0.03 SOL</span>
                </div>
              </div>
          </div>

          <button className="w-full py-5 bg-[#FF3131] text-white font-[1000] text-xl italic uppercase tracking-tighter shadow-[0_0_30px_rgba(255,49,49,0.4)] active:scale-95 transition-all">
            CONFIRM PURCHASE
          </button>
          
          <p className="text-[8px] text-zinc-600 text-center font-black uppercase tracking-[0.2em] mt-4">
            Secured by Solana Protocol
          </p>
        </div>

        {/* Brainy Decor */}
        <div className="absolute -bottom-6 -left-6 w-32 h-32 opacity-10 pointer-events-none rotate-12">
           <img src="brainy-worried.png" alt="" className="w-full h-full grayscale" />
        </div>
      </div>
    </div>
  );
};

export default BuyLivesModal;

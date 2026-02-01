
import React from 'react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const steps = [
    { title: "1. Connect wallet", desc: "Connect your Solana wallet to verify your identity on-chain." },
    { title: "2. Join the trivia", desc: "0.02 SOL standard entry per arena session." },
    { title: "3. Extra Entries", desc: "Buy 3 lives for 0.03 SOL to enter multiple times. Unused lives roll over!" },
    { title: "4. Top 5 win", desc: "Answer correctly + fast. Top 5 split the pot!" },
    { title: "5. Claim winnings", desc: "Claim instantly after results via smart contract." },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/90 animate-fade-in overflow-hidden">
      <div className="relative w-full max-w-lg bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden max-h-[85vh] flex flex-col rounded-2xl">
        {/* Color Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#10b981]"></div>
        
        <div className="p-6 md:p-10 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-start mb-8">
            <div>
              <span className="text-[#00FFA3] text-[10px] font-black tracking-[0.4em] uppercase mb-1 block">Protocol Guide</span>
              <h2 className="text-3xl font-[1000] italic uppercase tracking-tighter text-white leading-none">HOW TO <span className="sol-gradient-text">PLAY</span></h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-6 mb-10">
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-5 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#00FFA3] font-black italic text-sm">
                  {idx + 1}
                </div>
                <div>
                  <h4 className="text-white font-black uppercase text-xs tracking-widest mb-1">{step.title}</h4>
                  <p className="text-zinc-500 text-[11px] font-medium leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#111] border border-white/5 p-5 rounded-xl">
            <h3 className="text-zinc-400 font-black uppercase text-[10px] tracking-[0.3em] mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#FFD700]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
              Payout Matrix
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-600 font-bold uppercase">1st Place</span>
                <span className="text-[#00FFA3] font-black italic">80% NET POT</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-600 font-bold uppercase">2nd - 5th</span>
                <span className="text-white font-black italic">5% EACH</span>
              </div>
              <div className="pt-3 mt-3 border-t border-white/5 flex justify-between text-[9px] text-zinc-500 font-bold uppercase">
                <span>Network Fee</span>
                <span>0.0025 SOL</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Mascot Decor */}
        <div className="absolute bottom-0 right-0 w-24 h-24 opacity-5 pointer-events-none translate-x-4 translate-y-4">
           <img src="brainy-idea.png" alt="" className="w-full h-full grayscale" />
        </div>
      </div>
    </div>
  );
};

export default GuideModal;

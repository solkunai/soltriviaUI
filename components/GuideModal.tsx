import React from 'react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTerms?: () => void;
  onOpenPrivacy?: () => void;
}

const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose, onOpenTerms, onOpenPrivacy }) => {
  if (!isOpen) return null;

  const steps = [
    { title: "Connect your wallet", desc: "Connect any Solana wallet (Phantom, Backpack, Seed Vault on Seeker) to get started. Your wallet is your identity on SolTrivia." },
    { title: "2 free entries", desc: "Every wallet gets 2 lifetime free entries to try the game — no SOL needed. After that, you'll need lives to keep playing." },
    { title: "Buy lives to play more", desc: "Lives let you enter paid rounds. Buy in bulk: 3 for 0.03 SOL, 15 for 0.1 SOL, or 35 for 0.25 SOL. Seeker holders get discounted rates. Lives never expire." },
    { title: "Enter a round", desc: "4 rounds run daily (every 6 hours UTC). Each entry costs 0.02 SOL to the prize pool + 0.0025 SOL platform fee. Max 5 entries per round, 20 per day." },
    { title: "Answer 10 questions", desc: "Each round gives you 10 trivia questions across crypto, science, history, and more. You have 7 seconds per question — no pausing." },
    { title: "Speed = more points", desc: "Every correct answer earns 100 base points + up to 900 bonus points for speed. The faster you answer, the higher your score. Max 1,000 pts per question." },
    { title: "Top 5 win the pot", desc: "Once a round has 5+ finishers, the entire prize pool is split among the top 5: 1st gets 50%, 2nd 20%, 3rd 15%, 4th 10%, 5th 5%. Zero platform deduction from the pot." },
    { title: "Claim your winnings", desc: "Winners are posted on-chain after each round. Claim your SOL directly from the smart contract — fully verifiable and trustless." },
    { title: "Custom games", desc: "Create your own trivia games with custom questions, share a link, and challenge friends. Free with a Game Pass, or 0.0225 SOL per game." },
    { title: "1v1 Duels", desc: "Challenge another player head-to-head in real-time. Pick your wager (0.01 to 1 SOL), answer the same questions, and the winner takes the pot." },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-3xl bg-black/90 animate-fade-in overflow-hidden">
      <div className="relative w-full max-w-md md:max-w-lg bg-[#0D0D0D] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden max-h-[85vh] flex flex-col rounded-2xl">
        {/* Color Strip */}
        <div className="h-1.5 w-full bg-gradient-to-r from-[#a855f7] via-[#3b82f6] to-[#10b981]"></div>

        <div className="p-5 md:p-8 overflow-y-auto custom-scrollbar">
          <div className="flex justify-between items-start mb-6">
            <div>
              <span className="text-[#00FFA3] text-[10px] font-black tracking-[0.4em] uppercase mb-1 block">Protocol Guide</span>
              <h2 className="text-2xl md:text-3xl font-[1000] italic uppercase tracking-tighter text-white leading-none">HOW TO <span className="sol-gradient-text">PLAY</span></h2>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 mb-8">
            {steps.map((step, idx) => (
              <div key={idx} className="flex gap-3.5 items-start">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#00FFA3] font-black italic text-[11px]">
                  {idx + 1}
                </div>
                <div className="pt-0.5">
                  <h4 className="text-white font-black uppercase text-[11px] tracking-wider mb-0.5">{step.title}</h4>
                  <p className="text-zinc-500 text-[10px] font-medium leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#111] border border-white/5 p-4 rounded-xl">
            <h3 className="text-zinc-400 font-black uppercase text-[9px] tracking-[0.3em] mb-3 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#FFD700]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
              Payout Matrix
            </h3>
            <div className="space-y-1.5">
              {[
                { place: '1st Place', pct: '50%', accent: true },
                { place: '2nd Place', pct: '20%', accent: false },
                { place: '3rd Place', pct: '15%', accent: false },
                { place: '4th Place', pct: '10%', accent: false },
                { place: '5th Place', pct: '5%', accent: false },
              ].map((row) => (
                <div key={row.place} className="flex justify-between text-[10px]">
                  <span className="text-zinc-600 font-bold uppercase">{row.place}</span>
                  <span className={`font-black italic ${row.accent ? 'text-[#00FFA3]' : 'text-white'}`}>{row.pct}</span>
                </div>
              ))}
              <div className="pt-2.5 mt-2.5 border-t border-white/5 space-y-1">
                <div className="flex justify-between text-[9px] text-zinc-500 font-bold uppercase">
                  <span>Platform Fee (per entry)</span>
                  <span>0.0025 SOL</span>
                </div>
                <div className="flex justify-between text-[9px] text-[#14F195]/60 font-bold uppercase">
                  <span>Pot Deduction</span>
                  <span>0% — all goes to winners</span>
                </div>
              </div>
            </div>
          </div>

          {/* Entry Limits */}
          <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-xl mt-4">
            <p className="text-zinc-500 text-[9px] font-black uppercase tracking-wider text-center italic leading-relaxed">
              Fair play limits: max 5 entries per round, 20 per 24 hours. 4 rounds daily (every 6h UTC).
            </p>
          </div>

          {/* Legal links */}
          <div className="pt-5 mt-5 border-t border-white/5 flex flex-wrap items-center justify-center gap-3 text-zinc-500">
            <button
              type="button"
              onClick={() => { onClose(); onOpenTerms?.(); }}
              className="text-[10px] font-black uppercase tracking-widest italic hover:text-[#14F195] transition-colors"
            >
              Terms of Service
            </button>
            <span className="text-white/20 text-[10px]">|</span>
            <button
              type="button"
              onClick={() => { onClose(); onOpenPrivacy?.(); }}
              className="text-[10px] font-black uppercase tracking-widest italic hover:text-[#14F195] transition-colors"
            >
              Privacy Policy
            </button>
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

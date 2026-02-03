import React from 'react';

interface TermsOfServiceViewProps {
  onBack: () => void;
}

const TermsOfServiceView: React.FC<TermsOfServiceViewProps> = ({ onBack }) => {
  return (
    <div className="min-h-full bg-[#050505] overflow-x-hidden safe-top relative flex flex-col">
      <div className="flex items-center justify-between px-6 py-6 border-b border-white/5 bg-[#050505] sticky top-0 z-[60]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors group"
        >
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-[10px] font-black uppercase tracking-widest italic">Return</span>
        </button>
        <h2 className="text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter text-white">LEGAL</h2>
        <div className="w-10"></div>
      </div>

      <div className="p-6 md:p-12 lg:p-20 max-w-4xl mx-auto w-full pb-32">
        <h1 className="text-5xl md:text-8xl font-[1000] italic uppercase tracking-tighter sol-gradient-text leading-none mb-4">
          Terms of Service
        </h1>
        <p className="text-[#14F195] font-black uppercase tracking-widest text-[10px] italic mb-16 border-l-2 border-[#14F195] pl-4">
          SOL Trivia Last Updated: February 2, 2026
        </p>

        <div className="space-y-16">
          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">1. Acceptance of Terms</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              By downloading, installing, or using SOL Trivia (&quot;App&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the App.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">2. Description of Service</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia is a cryptocurrency-based trivia game application where users:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2 marker:text-[#14F195] text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              <li>Pay an entry fee in SOL to participate in trivia rounds</li>
              <li>Answer questions to earn points based on accuracy and speed</li>
              <li>Compete for prize pools distributed to top-performing players</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">3. Eligibility</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              To use SOL Trivia, you must be at least 18 years of age, have legal capacity to enter into binding agreements, and reside in a jurisdiction where participation in cryptocurrency-based games is legal. You must own a compatible Solana wallet with sufficient funds.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-6">4. Wallet Connection and Transactions</h2>
            <div className="space-y-10">
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">4.1 Wallet Requirements</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  You must connect a Solana-compatible wallet to participate. You are solely responsible for maintaining the security of your wallet and private keys. We never have access to your private keys or seed phrases.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">4.2 Entry Fees</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Each round requires 0.02 SOL entry + 0.0025 SOL transaction fee (total 0.0225 SOL). Fees are non-refundable once started. Entry fees fund the prize pool; transaction fees fund platform operations.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">4.3 Lives System</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  One free life per round. Extra lives: 0.03 SOL for 3 lives. Lives allow re-entry after mistakes and roll over across rounds. Lives purchases are non-refundable.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">4.4 Prize Distribution</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Prizes distributed automatically after each round: 1st Place (80%), 2nd-5th Place (5% each). Winners must claim prizes via the App.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">5. Game Structure</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                <h3 className="text-[#14F195] text-[10px] font-black uppercase italic tracking-widest mb-2">5.1 Schedule</h3>
                <p className="text-white text-xs font-bold opacity-80 leading-relaxed">4 daily rounds, 6 hours each. 10 questions per quiz.</p>
              </div>
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                <h3 className="text-[#14F195] text-[10px] font-black uppercase italic tracking-widest mb-2">5.2 Scoring</h3>
                <p className="text-white text-xs font-bold opacity-80 leading-relaxed">Max 1,000 pts per question (100 base + 900 speed bonus).</p>
              </div>
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                <h3 className="text-[#14F195] text-[10px] font-black uppercase italic tracking-widest mb-2">5.3 Gameplay</h3>
                <p className="text-white text-xs font-bold opacity-80 leading-relaxed">16s limit per question. Rankings decided by total points and time.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">6. Fair Play & Anti-Cheat</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Prohibited: Bots, scripts, bugs exploits, collusion, or multiple accounts for advantage. We implement timing verification to detect suspicious activity. Disqualification results in forfeited prizes and account bans.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">9. Disclaimers</h2>
            <div className="space-y-4">
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">9.1 No Guarantees:</span> outcomes depend on skill and competition; returns are not guaranteed.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">9.2 Crypto Risks:</span> Volatile values; network congestion may affect gameplay.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">9.4 Entertainment:</span> intended for entertainment only. Spend responsibly.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">16. Contact</h2>
            <div className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Email: <span className="text-[#14F195] font-black italic">soltriviateam@gmail.com</span><br /><br />
              By using SOL Trivia, you acknowledge you have read and agree to these Terms.<br /><br />
              Effective Date: February 2, 2026.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceView;

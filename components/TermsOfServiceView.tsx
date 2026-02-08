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
          SOL Trivia Last Updated: February 7, 2026
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
              SOL Trivia is a cryptocurrency-themed trivia game application on the Solana blockchain where users:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2 marker:text-[#14F195] text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              <li>Pay an entry fee in SOL to participate in trivia rounds</li>
              <li>Answer crypto-related questions to earn points based on accuracy and speed</li>
              <li>Compete for prize pools distributed to top-performing players</li>
              <li>Purchase extra lives for additional entries within set limits</li>
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
                  Each round requires 0.02 SOL entry fee + 0.0025 SOL platform fee (total 0.0225 SOL). Entry fees are non-refundable once submitted. Entry fees fund the prize pool; platform fees fund operations and development.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">4.3 Lives System</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  New wallets receive 1 free life to start. Additional lives can be purchased at 0.03 SOL for 3 lives. Each game entry consumes 1 life. Unused lives roll over across rounds indefinitely. Lives purchases are non-refundable. Lives purchases are separate from entry fees &mdash; you still pay the standard 0.0225 SOL entry fee each time you play.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">4.4 Prize Distribution</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  100% of the prize pool is distributed to the top 5 finishers each round: 1st Place (50%), 2nd Place (20%), 3rd Place (15%), 4th Place (10%), 5th Place (5%). No platform fee is deducted from the pot. Prizes are currently distributed manually by the SOL Trivia team after each round. An in-app claim mechanism may be added in the future.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">5. Game Structure</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                <h3 className="text-[#14F195] text-[10px] font-black uppercase italic tracking-widest mb-2">5.1 Schedule</h3>
                <p className="text-white text-xs font-bold opacity-80 leading-relaxed">4 daily rounds (every 6 hours UTC). 10 questions per quiz session.</p>
              </div>
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                <h3 className="text-[#14F195] text-[10px] font-black uppercase italic tracking-widest mb-2">5.2 Scoring</h3>
                <p className="text-white text-xs font-bold opacity-80 leading-relaxed">Max 1,000 pts per question (100 base + 900 speed bonus). Rankings decided by total points and time.</p>
              </div>
              <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                <h3 className="text-[#14F195] text-[10px] font-black uppercase italic tracking-widest mb-2">5.3 Gameplay</h3>
                <p className="text-white text-xs font-bold opacity-80 leading-relaxed">7-second limit per question. Questions are randomized each session to ensure freshness.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">6. Entry Limits</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              To ensure fair competition and prevent leaderboard manipulation, the following limits apply per wallet:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2 marker:text-[#14F195] text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              <li><span className="text-[#14F195] font-black">Per Round:</span> Maximum 5 entries per wallet per round</li>
              <li><span className="text-[#14F195] font-black">Per 24 Hours:</span> Maximum 20 entries per wallet per 24-hour period</li>
            </ul>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 mt-4">
              Entry limits are checked before payment is processed. You will not be charged if you have reached the limit. These limits may be adjusted at our discretion with notice.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">7. Fair Play & Anti-Cheat</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Prohibited: Bots, scripts, bug exploits, collusion, or multiple wallets used to gain unfair advantage. We implement timing verification, entry limits, and question randomization to detect and prevent suspicious activity. Disqualification results in forfeited prizes and potential permanent bans. We reserve the right to void results and withhold payouts if manipulation is detected.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">8. User Accounts & Profiles</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Your wallet address serves as your account identifier. You may optionally set a display name and upload an avatar image. Display names and avatars are publicly visible on leaderboards. You are responsible for any content you upload and must not use offensive, infringing, or misleading material. We reserve the right to remove inappropriate content.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">9. Intellectual Property</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              All content, design, code, and branding of SOL Trivia (including questions, graphics, logos, and UI) are owned by or licensed to SOL Trivia. You may not copy, modify, distribute, or create derivative works from our content without prior written consent. Your use of the App does not grant you any ownership rights in our intellectual property.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">10. Disclaimers</h2>
            <div className="space-y-4">
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">10.1 No Guarantees:</span> Outcomes depend on skill and competition; returns are not guaranteed. Past performance does not indicate future results.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">10.2 Crypto Risks:</span> Cryptocurrency values are volatile. Network congestion, RPC outages, or blockchain issues may affect gameplay or transaction processing. We are not responsible for losses caused by network conditions.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">10.3 Service Availability:</span> The App is provided &quot;as is&quot; without warranty of any kind. We do not guarantee uninterrupted or error-free operation.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">10.4 Entertainment:</span> SOL Trivia is intended for entertainment purposes only. Please spend responsibly and never risk more than you can afford to lose.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">11. Limitation of Liability</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              To the maximum extent permitted by law, SOL Trivia and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App, including but not limited to: loss of funds due to blockchain transactions, wallet security breaches, network failures, or smart contract interactions. Our total liability shall not exceed the amount of entry fees you have paid in the preceding 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">12. Modifications to Terms</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We reserve the right to modify these Terms at any time. Changes will be posted within the App with an updated &quot;Last Updated&quot; date. Continued use of the App after changes constitutes acceptance of the revised Terms. Material changes (such as fee adjustments or rule changes) will be announced in advance where possible.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">13. Termination</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We may suspend or terminate your access to the App at any time for violation of these Terms, suspected fraud, or any other reason at our discretion. Upon termination, any unclaimed prizes may be forfeited. You may stop using the App and disconnect your wallet at any time.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">14. Contact</h2>
            <div className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Email: <span className="text-[#14F195] font-black italic">soltriviateam@gmail.com</span><br /><br />
              By using SOL Trivia, you acknowledge you have read and agree to these Terms.<br /><br />
              Effective Date: February 7, 2026.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceView;

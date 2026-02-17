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
          SOL Trivia Last Updated: February 17, 2026
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
              <li>Claim prizes directly on-chain via the SOL Trivia smart contract</li>
              <li>Purchase extra lives for additional entries within set limits</li>
              <li>Try free Practice Runs to learn the game without risking SOL</li>
              <li>Purchase a Game Pass for unlimited practice plays, all question categories, and free custom game creation</li>
              <li>Create and share Custom Games with friends (user-generated trivia with per-game leaderboards)</li>
              <li>Verify Solana Seeker Genesis Token ownership for exclusive perks</li>
              <li>Earn XP through a referral program by inviting friends</li>
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
                  Every wallet receives 2 round entries per round (every 6 hours). Beyond the 2 included round entries, extra lives can be purchased in three tiers: 3 lives for 0.03 SOL, 15 lives for 0.1 SOL, or 35 lives for 0.25 SOL. Purchased extra lives roll over across rounds indefinitely. Lives purchases are non-refundable. Both round entries and extra lives require the standard 0.0225 SOL entry fee each time you play.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">4.4 Prize Distribution</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  100% of the prize pool is distributed to the top 5 finishers each round: 1st Place (50%), 2nd Place (20%), 3rd Place (15%), 4th Place (10%), 5th Place (5%). No platform fee is deducted from the pot. Winners are posted on-chain via the SOL Trivia smart contract at the end of each round, and eligible players can claim their prizes directly from the contract vault through the in-app claim button on their Profile page. On-chain claims are final and irreversible once confirmed on the Solana blockchain.
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
                <p className="text-white text-xs font-bold opacity-80 leading-relaxed">7-second limit per question in paid mode; 12 seconds in practice mode. Questions are randomized each session to ensure freshness.</p>
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
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">7. Practice Mode</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia offers a free Practice Run mode for users to experience the game before playing for real SOL:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2 marker:text-[#14F195] text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              <li><span className="text-[#14F195] font-black">No Wallet Required:</span> Practice runs do not require a connected wallet or any SOL payment.</li>
              <li><span className="text-[#14F195] font-black">Daily Limit:</span> 5 practice runs per day per device (unlimited for Game Pass holders). Usage resets at midnight local time.</li>
              <li><span className="text-[#14F195] font-black">No Prizes:</span> Practice mode has no prize pool, no leaderboard ranking, and no SOL payouts.</li>
              <li><span className="text-[#14F195] font-black">Separate Questions:</span> Practice mode uses a separate question pool from the paid game to maintain competitive integrity.</li>
              <li><span className="text-[#14F195] font-black">Client-Side Scoring:</span> Practice answers are scored locally on your device. This data is not stored on our servers.</li>
            </ul>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 mt-4">
              Practice mode usage limits are tracked via browser local storage and may be adjusted at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">8. Fair Play & Anti-Cheat</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Prohibited: Bots, scripts, bug exploits, collusion, or multiple wallets used to gain unfair advantage. We implement timing verification, entry limits, and question randomization to detect and prevent suspicious activity. Disqualification results in forfeited prizes and potential permanent bans. We reserve the right to void results and withhold payouts if manipulation is detected.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-6">9. On-Chain Prize Claims</h2>
            <div className="space-y-10">
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">9.1 Claiming Process</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  At the end of each round, winners are posted to the SOL Trivia smart contract on the Solana blockchain. Eligible players can claim their prize directly from the contract vault via the Claim button on their Profile page. Claims require a connected wallet and a valid Solana transaction signature.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">9.2 Finality</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  On-chain prize claims are final and irreversible once confirmed on the Solana blockchain. SOL Trivia cannot reverse, modify, or reissue claimed prizes. You are responsible for ensuring you are claiming to the correct wallet.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">9.3 Unclaimed Prizes</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Prizes that remain unclaimed after the contract vault is closed for a given round may be forfeited. We recommend claiming prizes promptly after each round ends.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-6">10. Game Pass</h2>
            <div className="space-y-10">
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">10.1 Overview</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  The Game Pass is a one-time purchase that unlocks premium features including unlimited practice plays, access to all question categories, and free custom game creation. Game Pass pricing is displayed in USD and can be paid in SOL, USDC, or SKR tokens. The token amount is calculated at the time of purchase based on current market prices.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">10.2 Pricing & Payments</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Game Pass costs $20 USD (or $10 USD for verified Seeker holders). Payment is sent to the Revenue wallet. Game Pass purchases are non-refundable. Token prices are fetched from third-party price APIs and may fluctuate; the price shown at checkout is the price you pay.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">10.3 Benefits</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Game Pass holders receive: unlimited practice plays (no daily limit), access to all question categories in practice mode, and free custom game creation (platform fee of 0.0025 SOL still applies). Game Pass benefits may be expanded or modified at our discretion with notice.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-6">11. Custom Games</h2>
            <div className="space-y-10">
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">11.1 Overview</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Custom Games allow users to create their own trivia games with custom questions, share them via a unique link, and compete on a per-game leaderboard. Custom games are free for other players to join. Games expire automatically after 7 days from creation.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">11.2 Creation Fees</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Creating a custom game costs 0.0225 SOL (0.02 SOL creation fee + 0.0025 SOL platform fee). Game Pass holders pay only the 0.0025 SOL platform fee. Creation fees are non-refundable. Payment is verified on-chain before the game is created.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">11.3 User-Generated Content</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  You are solely responsible for the content of your custom game questions and answers. You must accept our Content Guidelines before creating a custom game. Prohibited content includes hate speech, discrimination, harassment, terrorism, violence, threats, sexually explicit material, scams, and phishing links. We reserve the right to ban games and permanently ban wallet addresses that violate these guidelines without notice or refund.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">11.4 Game Limits</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Players may attempt each custom game up to 3 times. Only the best score per wallet counts on the per-game leaderboard. Custom games do not affect the main XP leaderboard, player stats, or prize pools. Custom games have no prize pot in the current version.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-6">12. Seeker Perks</h2>
            <div className="space-y-10">
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">12.1 Verification</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Users who hold a Solana Seeker Genesis Token (SGT) in their connected wallet can verify their ownership by signing a message. Verification is performed by checking token holdings on-chain via a third-party RPC provider (Helius). Verification status is stored in our database and may be revoked if the token is no longer detected.
                </p>
              </div>
              <div>
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest mb-3 flex items-center gap-3">12.2 Benefits</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Verified Seeker holders receive: +25% XP boost on profile total points (applied to profile stats only, not individual game session scores), discounted lives tiers, discounted Game Pass pricing ($10 USD instead of $20 USD), automatic .skr domain detection as optional display name, and a Seeker badge on leaderboards.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">13. Referral Program</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Each user receives a unique referral link. When a referred user connects their wallet and completes their first paid game, the referrer earns 1,000 XP. Referral XP is added to the referrer&apos;s total points. Referral abuse (self-referrals, bot referrals, or creating fake accounts) is prohibited and may result in XP forfeiture and account suspension. The referral program and XP rewards may be modified or discontinued at our discretion.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">14. User Accounts & Profiles</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Your wallet address serves as your account identifier. You may optionally set a display name and upload an avatar image. Display names and avatars are publicly visible on leaderboards. You are responsible for any content you upload and must not use offensive, infringing, or misleading material. We reserve the right to remove inappropriate content.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">15. Intellectual Property</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              All content, design, code, and branding of SOL Trivia (including questions, graphics, logos, and UI) are owned by or licensed to SOL Trivia. You may not copy, modify, distribute, or create derivative works from our content without prior written consent. Your use of the App does not grant you any ownership rights in our intellectual property.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">16. Disclaimers</h2>
            <div className="space-y-4">
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">16.1 No Guarantees:</span> Outcomes depend on skill and competition; returns are not guaranteed. Past performance does not indicate future results.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">16.2 Crypto Risks:</span> Cryptocurrency values are volatile. Network congestion, RPC outages, or blockchain issues may affect gameplay or transaction processing. We are not responsible for losses caused by network conditions.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">16.3 Service Availability:</span> The App is provided &quot;as is&quot; without warranty of any kind. We do not guarantee uninterrupted or error-free operation.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">16.4 Smart Contract Risk:</span> Prize claims interact with a Solana smart contract. While we take care to ensure correctness, smart contracts carry inherent risk. We are not liable for losses caused by smart contract bugs, exploits, or blockchain-level issues.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">16.5 Entertainment:</span> SOL Trivia is intended for entertainment purposes only. Please spend responsibly and never risk more than you can afford to lose.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">17. Limitation of Liability</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              To the maximum extent permitted by law, SOL Trivia and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App, including but not limited to: loss of funds due to blockchain transactions, wallet security breaches, network failures, or smart contract interactions. Our total liability shall not exceed the amount of entry fees you have paid in the preceding 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">18. Modifications to Terms</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We reserve the right to modify these Terms at any time. Changes will be posted within the App with an updated &quot;Last Updated&quot; date. Continued use of the App after changes constitutes acceptance of the revised Terms. Material changes (such as fee adjustments or rule changes) will be announced in advance where possible.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">19. Termination</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We may suspend or terminate your access to the App at any time for violation of these Terms, suspected fraud, or any other reason at our discretion. Upon termination, any unclaimed prizes may be forfeited. You may stop using the App and disconnect your wallet at any time.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">20. Not Financial Advice</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia is an entertainment platform only. Nothing in the App constitutes financial, investment, legal, or tax advice. You should consult qualified professionals before making decisions involving cryptocurrency. We make no representations about the value, stability, or future price of SOL or any digital asset.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">21. Tax Responsibility</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              You are solely responsible for determining and fulfilling any tax obligations arising from your use of SOL Trivia, including but not limited to prizes won, entry fees paid, and any other transactions. We do not provide tax documentation and recommend consulting a tax professional.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">22. Indemnification</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              You agree to indemnify, defend, and hold harmless SOL Trivia, its operators, and affiliates from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the App, violation of these Terms, or infringement of any third party&apos;s rights.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">23. Governing Law & Disputes</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising from these Terms or your use of the App shall first be attempted to be resolved informally by contacting us. If informal resolution fails, disputes shall be resolved through binding arbitration on an individual basis. You waive any right to participate in class action lawsuits or class-wide arbitration.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">24. Contact</h2>
            <div className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Email: <span className="text-[#14F195] font-black italic">soltriviateam@gmail.com</span><br /><br />
              By using SOL Trivia, you acknowledge you have read and agree to these Terms.<br /><br />
              Effective Date: February 17, 2026.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceView;

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
        <h1 className="st-display text-5xl md:text-8xl sol-gradient-text mb-4">
          Terms of Service
        </h1>
        <p className="text-[#14F195] font-black uppercase tracking-widest text-[10px] italic mb-16 border-l-2 border-[#14F195] pl-4">
          SOL Trivia Last Updated: June 5, 2026
        </p>

        <div className="space-y-16">
          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">1. Acceptance of Terms</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              By downloading, installing, or using SOL Trivia (&quot;App&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the App.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">2. Description of Service</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia is a cryptocurrency-themed trivia game application on the Solana blockchain where users:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2 marker:text-[#14F195] text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              <li>Pay an entry fee in SOL to participate in trivia rounds</li>
              <li>Answer crypto-related questions to earn points based on accuracy and speed</li>
              <li>Compete for prize pools distributed to the top 5 finishers each round</li>
              <li>Claim prizes directly on-chain via the SOL Trivia smart contract</li>
              <li>Purchase extra Lives (USD-pegged tiers, payable in SOL / USDC / SKR / NERD) for additional entries within set limits</li>
              <li>Try free Practice Runs to learn the game without risking SOL</li>
              <li>Purchase a Game Pass for unlimited practice plays, all question categories, and reduced custom game creation fees</li>
              <li>Create and share Custom Games with friends &mdash; supporting four prize models (free, player-funded, creator-funded, NFT-prize) across SOL or any SPL token</li>
              <li>Curated &quot;Featured by Sol Trivia&quot; games (admin-curated) appearing in the swipeable Featured strip</li>
              <li>Challenge other players to real-time 1v1 Duels with SOL or SPL token wagers</li>
              <li>Swap tokens in-app via Jupiter Aggregator routing (SOL &harr; NERD by default, expandable to any token Jupiter routes)</li>
              <li>Earn XP and on-chain claimable balances through a referral program</li>
              <li>Complete Quests for XP and claimable rewards, with optional proof submission</li>
              <li>Verify Solana Seeker Genesis Token ownership for 35% discounts, +25% XP boost, and .skr display name</li>
              <li>Receive optional push notifications for game events (round results, duels matched, prizes claimable)</li>
              <li>Upload an avatar image to personalize your leaderboard appearance</li>
            </ul>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">3. Eligibility</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              To use SOL Trivia, you must be at least 18 years of age, have legal capacity to enter into binding agreements, and reside in a jurisdiction where participation in cryptocurrency-based games is legal. You must own a compatible Solana wallet with sufficient funds.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-6">4. Wallet Connection and Transactions</h2>
            <div className="space-y-10">
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">4.1 Wallet Requirements</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  You must connect a Solana-compatible wallet to participate. You are solely responsible for maintaining the security of your wallet and private keys. We never have access to your private keys or seed phrases.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">4.2 Entry Fees</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Each round requires 0.02 SOL entry fee + 0.0025 SOL platform fee (total 0.0225 SOL). Entry fees are non-refundable once submitted. Entry fees fund the prize pool; platform fees fund operations and development.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">4.3 Lives System</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Every wallet's first entry per round is free of life cost — you can play all 4 daily rounds without lives. Lives are required to re-enter the same round (up to 5 entries per round, 20 per 24 hours). Lives are sold in three USD-pegged tiers: <span className="text-[#14F195] font-black">$3 USD for 5 lives, $10 USD for 20 lives, or $20 USD for 50 lives</span>. Verified Seeker holders receive a 35% discount on every tier ($1.95 / $6.50 / $13.00). Lives can be paid in <span className="text-[#14F195] font-black">SOL, USDC, SKR, or NERD</span>; the token amount at checkout is calculated from real-time third-party price quotes. The price shown at checkout is the price you pay; quotes may move if you delay confirmation. Purchased lives roll over indefinitely across rounds. Lives purchases are non-refundable. Every entry — first or re-entry — requires the standard 0.0225 SOL round entry fee.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">4.4 Prize Distribution</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  100% of the prize pool is distributed to the top 5 finishers each round: 1st Place (50%), 2nd Place (20%), 3rd Place (15%), 4th Place (10%), 5th Place (5%). No platform fee is deducted from the pot. Winners are posted on-chain via the SOL Trivia smart contract at the end of each round, and eligible players can claim their prizes directly from the contract vault through the in-app claim button on their Profile page. On-chain claims are final and irreversible once confirmed on the Solana blockchain.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">5. Game Structure</h2>
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
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">6. Entry Limits</h2>
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
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">7. Practice Mode</h2>
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
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">8. Fair Play & Anti-Cheat</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Prohibited: Bots, scripts, bug exploits, collusion, or multiple wallets used to gain unfair advantage. We implement timing verification, entry limits, and question randomization to detect and prevent suspicious activity. Disqualification results in forfeited prizes and potential permanent bans. We reserve the right to void results and withhold payouts if manipulation is detected.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-6">9. On-Chain Prize Claims</h2>
            <div className="space-y-10">
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">9.1 Claiming Process</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  At the end of each round, winners are posted to the SOL Trivia smart contract on the Solana blockchain. Eligible players can claim their prize directly from the contract vault via the Claim button on their Profile page. Claims require a connected wallet and a valid Solana transaction signature.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">9.2 Finality</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  On-chain prize claims are final and irreversible once confirmed on the Solana blockchain. SOL Trivia cannot reverse, modify, or reissue claimed prizes. You are responsible for ensuring you are claiming to the correct wallet.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">9.3 Unclaimed Prizes</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Prizes that remain unclaimed after the contract vault is closed for a given round may be forfeited. We recommend claiming prizes promptly after each round ends.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-6">10. Game Pass</h2>
            <div className="space-y-10">
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">10.1 Overview</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  The Game Pass is a one-time purchase that unlocks premium features including unlimited practice plays, access to all question categories, and reduced custom-game creation fees. Game Pass pricing is displayed in USD and can be paid in <span className="text-[#14F195] font-black">SOL, USDC, SKR, or NERD</span>. The token amount is calculated at the time of purchase based on real-time market prices fetched from third-party APIs (primarily Jupiter Aggregator).
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">10.2 Pricing & Payments</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Game Pass costs $10 USD (or $6.50 USD for verified Seeker holders, reflecting the 35% Seeker discount). Payment is sent to the dedicated Game Pass / Lives revenue wallet. Game Pass purchases are non-refundable. Token prices are fetched from third-party price APIs and may fluctuate; the price shown at checkout is the price you pay. If a paid transaction does not confirm on-chain within a reasonable window, the purchase may be voided and the tokens returned to your wallet by the network.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">10.3 Benefits</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Game Pass holders receive: unlimited practice plays (no daily limit), access to all question categories in practice mode, and free custom game creation (platform fee of 0.0025 SOL still applies). Game Pass benefits may be expanded or modified at our discretion with notice.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-6">11. Custom Games</h2>
            <div className="space-y-10">
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">11.1 Overview</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Custom Games allow users to create their own trivia games with custom questions, optional banner images, share them via a unique link, and compete on a per-game leaderboard. Custom games may be free or paid (player-funded, creator-funded, or NFT-prize). Games expire automatically after the configured duration (10 minutes to 48 hours for paid games, or 7 days for free games).
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">11.2 Creation Fees</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Creating a custom game costs <span className="text-[#14F195] font-black">0.0075 SOL</span> (0.005 SOL creation fee + 0.0025 SOL platform fee). Game Pass holders pay only the 0.0025 SOL platform fee. Creation fees are non-refundable. Payment is verified on-chain before the game is created. For paid game models, additional escrow / prize deposits are required as described below.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">11.3 Prize Models</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Each custom game uses one of four prize models, chosen by the creator at creation time:
                </p>
                <ul className="list-disc list-inside mt-3 space-y-2 marker:text-[#14F195] text-white font-medium text-sm leading-relaxed opacity-90">
                  <li><span className="text-[#14F195] font-black">Free:</span> No entry fee, no prize pool. Players compete for XP and bragging rights only.</li>
                  <li><span className="text-[#14F195] font-black">Player-Funded:</span> Each player pays an entry fee into the on-chain custom-game vault. The pot (minus a 10% platform cut) is distributed among the top finishers (1, 3, or 5 winners as configured by the creator).</li>
                  <li><span className="text-[#14F195] font-black">Creator-Funded:</span> The creator deposits the entire prize pool upfront. Players join free. The full deposit (0% platform cut) is distributed among the top finishers per the configured split. If the game expires without enough finishers, the creator may reclaim the deposit on-chain.</li>
                  <li><span className="text-[#14F195] font-black">NFT Prize:</span> The creator escrows a single NFT (Metaplex Core or pNFT standard) into the on-chain custom-game program. The winner claims the NFT. If the game expires without a winner, the creator may reclaim the NFT on-chain.</li>
                </ul>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">11.4 Multi-Token Support</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Player-funded and creator-funded prize models support SOL and any SPL token (classic SPL Token or Token-2022). When using an SPL token, the creator selects the mint at creation; entry fees and prize pots are denominated in the chosen token. USD value indicators are provided as estimates only via Jupiter Aggregator price quotes and may not reflect real-time market prices at all times. You accept the risk that the value of an SPL token may decline between game start and prize claim. Tokens with limited liquidity, low organic activity, or unknown provenance carry additional risk; we provide informational risk indicators (e.g., RISK, launchpad attribution) but do not guarantee token safety or value.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">11.5 Featured by Sol Trivia</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Games marked &quot;Featured by Sol Trivia&quot; appear in the curated Featured strip on the Custom Games hub. The Featured flag may only be set by wallets on an internal administrator allowlist. All Featured games are subject to the same Content Guidelines as user-created games. Inclusion in Featured does not constitute an endorsement of any token, NFT, or external project referenced by the game.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">11.6 User-Generated Content</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  You are solely responsible for the content of your custom game questions, answers, names, and banner images. You must accept our Content Guidelines before creating a custom game. Prohibited content includes hate speech, discrimination, harassment, terrorism, violence, threats, sexually explicit material, scams, phishing links, copyright infringement, and content that promotes illegal activity. We reserve the right to remove games, void prize pools (returning escrowed funds where possible), and permanently ban wallet addresses that violate these guidelines without notice or refund.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">11.7 Drafts (Local Storage)</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Wizard drafts of custom games in progress are saved in your browser local storage per wallet, capped at 3 slots (first-in-first-out rotation). Drafts never leave your device. Drafts are cleared automatically after a successful game creation, when you delete them manually, or if you clear browser data.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">11.8 Game Limits</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Players may attempt each free custom game up to 3 times; only the best score per wallet counts on the per-game leaderboard. Paid custom games (player-funded, creator-funded, NFT-prize) restrict each wallet to a single paid entry per game. Custom games do not affect the main XP leaderboard, daily round prize pools, or Seeker stats. Reclaim mechanisms exist on-chain for creator-deposited pots and NFT escrows in the event a game expires without sufficient finishers; however, smart-contract risk applies (see Section 17.4).
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-6">12. 1v1 Duels</h2>
            <div className="space-y-10">
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">12.1 Overview</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Duels are real-time 1v1 trivia battles where two players wager the same entry fee. Both players answer 5 questions with a 10-second time limit per question. The winner is determined by highest score; ties are broken by fastest total time. Duels can be created as public (visible in the lobby) or private (shared via a unique link).
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">12.2 Entry Fees, Tokens &amp; Prize Distribution</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Each player pays the chosen entry fee plus a 0.0025 SOL platform fee. Duels support both SOL and SPL-token wagers (creator chooses the token at creation; opponent must match). Entry fees are sent to the on-chain duel vault via the SOL Trivia smart contract. The winner receives the combined pot minus a 10% house fee. All duel payments are verified on-chain before the match begins. Duel entry fees are non-refundable once both players have joined.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">12.3 Cancellation &amp; Expiration</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  If no opponent joins within <span className="text-[#14F195] font-black">24 hours</span>, the waiting duel expires and the creator may reclaim their entry fee on-chain via the cancel/forfeit instruction. The creator may also cancel a waiting duel at any time before an opponent joins and receive a refund. Once an opponent has joined and the duel enters &quot;playing&quot; status, cancellation is no longer possible and the match must be completed. If a player abandons mid-match, the on-chain forfeit instruction awards the pot to the remaining player.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">12.4 On-Chain Resolution</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  After both players finish, the duel outcome is resolved on-chain by the platform authority. The winner can then claim their prize from the contract vault via the in-app claim button. On-chain resolution and prize claims are final and irreversible once confirmed on the Solana blockchain.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-6">13. Seeker Perks</h2>
            <div className="space-y-10">
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">13.1 Verification</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Users who hold a Solana Seeker Genesis Token (SGT) in their connected wallet can verify their ownership by signing a message. Verification is performed by checking token holdings on-chain via a third-party RPC provider (Helius). Verification status is stored in our database and may be revoked if the token is no longer detected.
                </p>
              </div>
              <div>
                <h3 className="st-uplabel text-[#14F195] text-sm mb-3 flex items-center gap-3">13.2 Benefits</h3>
                <p className="text-white font-medium text-sm leading-relaxed opacity-90">
                  Verified Seeker holders receive: +25% XP boost on profile total points (applied to profile stats only, not individual game session scores), discounted lives tiers, discounted Game Pass pricing ($5 USD instead of $10 USD), automatic .skr domain detection as optional display name, and a Seeker badge on leaderboards.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">14. Referral Program</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Each user receives a unique referral link. When a referred user connects their wallet and completes their first paid game, the referrer earns referral XP credited to their profile. Additionally, when a referred user purchases Lives (5% of paid amount) or a Game Pass (10% of paid amount) using your referral link, you accrue an on-chain claimable referral balance in the SOL Trivia smart contract. Claimable balances can be claimed from the contract via the in-app Referrals page. Referral abuse (self-referrals, bot referrals, fake accounts, or coordinated farming) is prohibited and may result in XP forfeiture, balance voiding, and account suspension. The referral program, rates, and rewards may be modified or discontinued at our discretion.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">15. In-App Token Swap</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia offers an in-app token swap feature for converting between SOL, NERD, and supported SPL tokens. Swap routing and quotes are provided by <span className="text-[#14F195] font-black">Jupiter Aggregator</span>, a third-party Solana DEX aggregator. By using the swap feature you acknowledge: (i) quotes are real-time market estimates and may change before your transaction confirms; (ii) slippage, network congestion, or stale quotes may cause execution to differ from the displayed estimate; (iii) the swap is executed via Jupiter's aggregated liquidity sources — SOL Trivia does not custody your funds during the swap; (iv) a small platform fee (currently 1%) may be included in routed swaps for tokens outside the default NERD pair, separately disclosed at quote time; (v) launchpad attribution (e.g., pump.fun, bags.fun, letsbonk.fun, Meteora DBC) is sourced from Jupiter's metadata and is informational only — it is not an endorsement, audit, or warranty of the token; and (vi) SPL tokens may have zero or negative value, may be subject to mint authority controls, freeze authority, or other centralized actions that affect transferability. You are solely responsible for evaluating the token before swapping.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">16. Push Notifications</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              If you grant push notification permission, SOL Trivia may send notifications to your device for game events including round results, duel matched / claimable, custom-game results, quest claim-ready, and referral activity. Push notifications are delivered via Expo Push Notification Service. We do not use push notifications for marketing or third-party advertising. You may revoke push permission at any time via your device's system settings, which immediately stops all SOL Trivia notifications. Push tokens are anonymous and tied to your active wallet; switching wallets re-registers the token for the new wallet.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">17. Quests & Achievements</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Quests are optional in-app objectives that may reward XP, lives, or claimable tokens upon completion. Some quests require <span className="text-[#14F195] font-black">proof of completion</span>, which may include URLs (e.g., social media posts), screenshots, or text fields. Submitted proofs are reviewed by SOL Trivia administrators before quest rewards are released. You agree not to submit confidential, personal, defamatory, infringing, or sensitive information as quest proofs. Image proofs are stored in Supabase Storage; URL/text proofs are stored in our database. Rewards for approved quests are credited to your wallet via in-app claim. Quests and their rewards may be modified, paused, or discontinued at our discretion. Submission of fraudulent or manipulative proofs may result in quest forfeiture and account suspension.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">18. User Accounts & Profiles</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Your wallet address serves as your account identifier. You may optionally set a display name and upload an avatar image. Display names and avatars are publicly visible on leaderboards. You are responsible for any content you upload and must not use offensive, infringing, or misleading material. We reserve the right to remove inappropriate content.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">19. Intellectual Property</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              All content, design, code, and branding of SOL Trivia (including questions, graphics, logos, and UI) are owned by or licensed to SOL Trivia. You may not copy, modify, distribute, or create derivative works from our content without prior written consent. Your use of the App does not grant you any ownership rights in our intellectual property.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">20. Disclaimers</h2>
            <div className="space-y-4">
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">20.1 No Guarantees:</span> Outcomes depend on skill and competition; returns are not guaranteed. Past performance does not indicate future results.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">20.2 Crypto Risks:</span> Cryptocurrency values are volatile. Network congestion, RPC outages, or blockchain issues may affect gameplay or transaction processing. We are not responsible for losses caused by network conditions.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">20.3 Service Availability:</span> The App is provided &quot;as is&quot; without warranty of any kind. We do not guarantee uninterrupted or error-free operation.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">20.4 Smart Contract Risk:</span> Prize claims, NFT escrows, custom-game vaults, and duel vaults all interact with the SOL Trivia Solana smart contract. While we take care to ensure correctness, smart contracts carry inherent risk including bugs, exploits, upgrade-authority compromise, and unexpected interactions with other on-chain programs. We are not liable for losses caused by smart contract issues or blockchain-level events.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">20.5 Token Price &amp; Risk Disclosures:</span> USD-pegged prices (Lives, Game Pass), USD value indicators on SPL custom games and prize pots, and Jupiter Aggregator swap quotes are all real-time estimates that may fluctuate. SPL tokens (including USDC, SKR, NERD, and any token used in custom games or duels) carry independent volatility, liquidity, custody, and counterparty risks. The price displayed at checkout is the price charged. Launchpad attribution (pump.fun, bags.fun, letsbonk.fun, Meteora) and risk indicators (RISK, organic score) are informational signals sourced from Jupiter and other third parties — they are not endorsements, audits, or guarantees of token safety.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">20.6 NFT &amp; SPL Custom Game Risk:</span> When a custom game uses NFT or SPL prize models, the prize asset is escrowed in the on-chain custom-game program. If the game expires without sufficient finishers, reclaim mechanisms exist for the creator. SOL Trivia is not liable for losses arising from a creator's failure to reclaim, marketplace-level NFT freezes, royalty-enforcement failures, or token blacklists by third parties.
              </p>
              <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 italic">
                <span className="text-[#14F195] font-black not-italic">20.7 Entertainment:</span> SOL Trivia is intended for entertainment purposes only. Please spend responsibly and never risk more than you can afford to lose.
              </p>
            </div>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">21. Limitation of Liability</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              To the maximum extent permitted by law, SOL Trivia and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App, including but not limited to: loss of funds due to blockchain transactions, wallet security breaches, network failures, or smart contract interactions. Our total liability shall not exceed the amount of entry fees you have paid in the preceding 30 days.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">22. Modifications to Terms</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We reserve the right to modify these Terms at any time. Changes will be posted within the App with an updated &quot;Last Updated&quot; date. Continued use of the App after changes constitutes acceptance of the revised Terms. Material changes (such as fee adjustments or rule changes) will be announced in advance where possible.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">23. Termination</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We may suspend or terminate your access to the App at any time for violation of these Terms, suspected fraud, or any other reason at our discretion. Upon termination, any unclaimed prizes may be forfeited. You may stop using the App and disconnect your wallet at any time.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">24. Not Financial Advice</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia is an entertainment platform only. Nothing in the App constitutes financial, investment, legal, or tax advice. You should consult qualified professionals before making decisions involving cryptocurrency. We make no representations about the value, stability, or future price of SOL or any digital asset.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">25. Tax Responsibility</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              You are solely responsible for determining and fulfilling any tax obligations arising from your use of SOL Trivia, including but not limited to prizes won, entry fees paid, and any other transactions. We do not provide tax documentation and recommend consulting a tax professional.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">26. Indemnification</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              You agree to indemnify, defend, and hold harmless SOL Trivia, its operators, and affiliates from any claims, damages, losses, or expenses (including reasonable legal fees) arising from your use of the App, violation of these Terms, or infringement of any third party&apos;s rights.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">27. Governing Law & Disputes</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising from these Terms or your use of the App shall first be attempted to be resolved informally by contacting us. If informal resolution fails, disputes shall be resolved through binding arbitration on an individual basis. You waive any right to participate in class action lawsuits or class-wide arbitration.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">28. Contact</h2>
            <div className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Email: <span className="text-[#14F195] font-black italic">soltriviateam@gmail.com</span><br /><br />
              By using SOL Trivia, you acknowledge you have read and agree to these Terms.<br /><br />
              Effective Date: June 5, 2026.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServiceView;

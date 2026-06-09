import React from 'react';

interface PrivacyPolicyViewProps {
  onBack: () => void;
}

const PrivacyPolicyView: React.FC<PrivacyPolicyViewProps> = ({ onBack }) => {
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
          Privacy Policy
        </h1>
        <p className="text-[#14F195] font-black uppercase tracking-widest text-[10px] italic mb-16 border-l-2 border-[#14F195] pl-4">
          SOL Trivia Last Updated: June 5, 2026
        </p>

        <div className="space-y-16">
          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Introduction</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application (&quot;App&quot;).<br /><br />
              By using SOL Trivia, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-8">Information We Collect</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Wallet Information</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li><span className="text-white font-bold italic">Public Wallet Address:</span> Collected when you connect your wallet to verify participation and process payouts.</li>
                  <li><span className="text-white font-bold italic">Transaction Signatures:</span> Stored for entry fees, lives purchases, and prize claims to verify legitimate on-chain transactions.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Game Data</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li>Answers, scores, completion times, and rankings per session.</li>
                  <li>Aggregated stats: games played, win/loss record, accuracy.</li>
                  <li>Session history including round participation and entry counts.</li>
                  <li>Answer timing data used for anti-cheat verification.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Profile Information</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li><span className="text-white font-bold italic">Display Name:</span> Optional, stored for leaderboard display.</li>
                  <li><span className="text-white font-bold italic">Avatar Images:</span> Optional, stored in Supabase Storage with public read access.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Purchase & Lives Data</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li><span className="text-white font-bold italic">Lives Purchases:</span> Wallet, transaction signature, payment token (SOL, USDC, SKR, or NERD), tier purchased ($3/5 lives, $10/20 lives, or $20/50 lives, with Seeker 35% discount where applicable), USD amount paid, token amount paid, and purchase date.</li>
                  <li>Current lives balance, total purchased, and total used.</li>
                  <li>Entry counts per round and per 24-hour period for limit enforcement.</li>
                  <li><span className="text-white font-bold italic">Game Pass Purchases:</span> Wallet, transaction signature, payment token (SOL, USDC, SKR, or NERD), USD amount, token amount, and purchase date.</li>
                  <li><span className="text-white font-bold italic">Token Price Quotes:</span> Real-time USD prices fetched from Jupiter for the four accepted tokens at the moment of checkout. The price displayed is the price paid; quotes may change if not confirmed promptly.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Custom Games Data</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li><span className="text-white font-bold italic">User-Generated Content:</span> Custom game names, optional banner images, question text, answer options, and correct answer indices that you create. This content is publicly visible to anyone who accesses the game link. Banner images, if uploaded, are stored in Supabase Storage with public read access.</li>
                  <li>Game metadata: slug, settings (question count, rounds, time limit), prize model (free / player-funded / creator-funded / NFT), creation date, expiry date, total plays.</li>
                  <li><span className="text-white font-bold italic">Multi-Token Payment Data:</span> For SPL-token custom games, we store the token mint address, decimals, and symbol of the chosen token (SOL, USDC, or any SPL token you select) along with entry-fee amounts in token base units.</li>
                  <li><span className="text-white font-bold italic">NFT-Prize Custom Games:</span> For NFT-prize games, we store the NFT mint address, asset standard (Core or pNFT), and the on-chain custom-game ID. The NFT itself remains escrowed in the on-chain custom-game program until the winner is determined or the game expires.</li>
                  <li><span className="text-white font-bold italic">Featured Games:</span> A boolean flag (is_featured) indicating whether the game appears in the curated Featured strip on the Custom Games hub. This flag is only set when the creator is on an internal administrator allowlist.</li>
                  <li>Custom game session data: player wallet, scores, answers, completion status, and timestamps.</li>
                  <li>Content disclaimer acceptance stored in browser local storage.</li>
                  <li><span className="text-white font-bold italic">Drafts (Local Only):</span> Saved drafts of custom games in progress (name, partial questions, settings) are stored in your browser local storage per wallet, capped at 3 slots. Drafts never leave your device and are cleared automatically after a successful game creation.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">1v1 Duels Data</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li>Duel creation and join transaction signatures, verified on-chain before play begins.</li>
                  <li>Duel session data: scores, correct answers, time taken per question, and completion timestamps for both players.</li>
                  <li>Opponent wallet address, entry fee amount, and duel outcome (winner determination).</li>
                  <li>Share codes and share links generated for private duel invitations.</li>
                  <li>Real-time score updates broadcast via Supabase Realtime during active duels (visible to both participants).</li>
                  <li>On-chain resolution transaction signatures when the smart contract pays out the winner.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Seeker Verification Data</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li>Seeker Genesis Token verification status and verification date.</li>
                  <li>Signed message used for wallet ownership verification (not stored permanently).</li>
                  <li>.skr domain name if detected, and display name preference.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Referral Data</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li>Your unique referral code and referral link.</li>
                  <li>Wallet addresses of users referred by you and their completion status.</li>
                  <li>Referral points earned and referral activity timestamps.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Activity & Technical</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li>Daily login activity and play streaks.</li>
                  <li>Quest and achievement progress.</li>
                  <li>Device type and anonymous crash/error logs.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Push Notifications</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li><span className="text-white font-bold italic">Push Tokens:</span> If you grant push notification permission, your device's anonymous push token (issued by Expo or the platform OS) is stored on our servers and associated with your wallet address. Push tokens are used solely to deliver in-app event notifications (e.g., round results, duel matched, claimable winnings).</li>
                  <li>Push tokens are re-registered when you switch wallets so notifications follow the active wallet. Tokens are automatically removed when the OS reports them as invalid.</li>
                  <li>You can revoke push permission at any time via your device's system settings, which immediately stops all SOL Trivia notifications.</li>
                  <li>We do not use push notifications for marketing or third-party advertising.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Quest Proof Submissions</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li><span className="text-white font-bold italic">Proof Content:</span> Quests that require proof of completion (e.g., social posts, screenshots, or external links) involve storing the proof you submit (URLs, image uploads, or text fields). Image proofs are stored in Supabase Storage; URL/text proofs are stored in our database.</li>
                  <li>Submitted proofs are reviewed by administrators to verify quest completion. Proofs that reference public content (e.g., social media posts) may remain accessible via the original URL.</li>
                  <li>You should not submit confidential, personal, or sensitive information as quest proofs.</li>
                  <li>Approved quest XP and claim records are retained for audit purposes. You may request deletion of rejected or unreviewed proofs at any time.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Local Storage</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li>Session identifiers stored temporarily in your browser to maintain game state during active play.</li>
                  <li>Wallet connection preferences for reconnecting on return visits.</li>
                  <li><span className="text-white font-bold italic">Practice Run Usage:</span> Daily practice run count and date stored locally to enforce the 5-per-day limit. This data never leaves your device.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="st-uplabel text-[#14F195] text-sm border-b border-[#14F195]/20 pb-2">Practice Mode Data</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li>Practice mode does not require a wallet connection and collects no wallet information.</li>
                  <li>Practice answers are scored client-side (on your device) and are not sent to or stored on our servers.</li>
                  <li>Practice questions are fetched from a separate database table that is isolated from the paid game.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Cookies & Tracking</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia does <span className="text-[#14F195] font-black italic">not</span> set tracking, analytics, advertising, or retargeting cookies. We do not use Google Analytics, Meta Pixel, Mixpanel, or any third-party ad / tracking network. Our application uses browser local storage for session state, drafts, wallet reconnection, and feature limits &mdash; that data never leaves your device.
            </p>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 mt-4">
              Third-party SDKs and our hosting provider may set <span className="text-[#14F195] font-black italic">essential technical cookies</span> necessary for the application to function:
            </p>
            <ul className="list-disc list-inside mt-3 space-y-2 marker:text-[#14F195] text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              <li><span className="text-[#14F195] font-black">Privy (Wallet Authentication):</span> may set session and CSRF cookies required to securely manage your wallet connection.</li>
              <li><span className="text-[#14F195] font-black">Render (Hosting Provider):</span> may set load-balancer and routing cookies for service reliability.</li>
              <li><span className="text-[#14F195] font-black">Supabase (Backend):</span> our Supabase client uses browser local storage, not cookies, for session tokens.</li>
            </ul>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 mt-4">
              These technical cookies are not used for cross-site tracking, behavioral profiling, or advertising. You may disable cookies in your browser settings; however, this may impact your ability to maintain a persistent wallet connection or use the App reliably.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">How We Use Your Information</h2>
            <div className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We use collected information to:
              <ul className="list-disc list-inside mt-4 space-y-2 marker:text-[#14F195]">
                <li>Process entry fees, lives purchases, and distribute prizes (including on-chain claim transactions)</li>
                <li>Display leaderboards and rankings with your display name or wallet address</li>
                <li>Calculate scores, streaks, and track quest/achievement progress</li>
                <li>Enforce entry limits (5 per round, 20 per 24 hours) to ensure fair play</li>
                <li>Randomize questions and track previously seen questions to provide fresh content</li>
                <li>Match players in 1v1 duels, broadcast live scores, and resolve outcomes on-chain</li>
                <li>Detect and prevent cheating, fraud, and manipulation</li>
                <li>Communicate important updates and generate aggregated analytics</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Payment Processing</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We use a <span className="text-[#14F195] font-black italic">multi-wallet routing system</span>. Round entry fees (0.02 SOL) are sent to the on-chain prize pool vault for winner payouts. Platform fees (0.0025 SOL) on round entries flow to the platform Revenue wallet. Lives and Game Pass purchases (multi-token: SOL, USDC, SKR, or NERD) are sent to a dedicated Game Pass / Lives revenue wallet. Custom-game creation fees (0.005 SOL + 0.0025 platform fee) and custom-game player entries route to the custom-game vault and platform fee wallet. NFT mint proceeds route to a separate cold wallet. All payments are verified on-chain via Solana RPC before crediting. Transaction replay protection prevents the same transaction from being used twice. For multi-token purchases, the USD-pegged tier price is converted to token amounts at checkout using third-party price APIs (Jupiter); the displayed price at checkout is the price you pay.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Blockchain Transactions</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia operates on the Solana blockchain. All on-chain transactions (entry fees, lives purchases, prize claims) are public, permanent, and visible to anyone with access to a Solana block explorer. We cannot modify or delete blockchain transaction records. The immutable nature of blockchain means these records exist independently of our service.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Third-Party Services</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We use the following third-party services to operate the App:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2 marker:text-[#14F195] text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              <li><span className="text-[#14F195] font-black">Supabase:</span> Database hosting, edge functions, authentication, and file storage (avatars, custom game banners, quest image proofs).</li>
              <li><span className="text-[#14F195] font-black">Solana RPC Providers:</span> Transaction verification, on-chain account reads, and blockchain interaction.</li>
              <li><span className="text-[#14F195] font-black">Helius:</span> Solana RPC provider used for Seeker Genesis Token verification (Token-2022 holdings check) and Digital Asset Standard (DAS) NFT lookups for wallet asset enumeration.</li>
              <li><span className="text-[#14F195] font-black">Jupiter Aggregator API:</span> Real-time token price quotes (for USD-pegged Lives + Game Pass pricing), token list metadata (symbol, decimals, logo, verification status, launchpad attribution), and swap routing for the in-app token swap feature. We send the mint addresses being quoted/swapped but no personally identifiable information.</li>
              <li><span className="text-[#14F195] font-black">CoinGecko:</span> Fallback price API for tokens not covered by Jupiter. No user data is sent.</li>
              <li><span className="text-[#14F195] font-black">Expo Push Notification Service:</span> Delivers push notifications to your device. Receives anonymous push tokens and notification payloads.</li>
              <li><span className="text-[#14F195] font-black">Render:</span> Frontend application hosting.</li>
            </ul>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 mt-4">
              These services have their own privacy policies. We do not sell or share your personal information with third parties for marketing purposes.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Data Storage and Security</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Game data is stored securely using Supabase with Row Level Security (RLS) policies. Avatar images are stored in Supabase Storage with public read access. We implement industry-standard security measures including encrypted connections (HTTPS/TLS), service role separation, and input validation. We never store your private keys, seed phrases, or wallet passwords.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Data Retention</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Game session data and transaction records are retained indefinitely for leaderboard integrity and dispute resolution. Question history is tracked on a rolling 24-hour basis for question freshness and is not permanently stored per-user. Profile information (display name, avatar) is retained until you request deletion. You may request deletion of optional profile data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Children&apos;s Privacy</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia is not intended for users under 18 years of age. We do not knowingly collect personal information from minors. If we become aware that a user is under 18, we will take steps to remove their data and restrict access.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Your Rights</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              You have the right to:
            </p>
            <ul className="list-disc list-inside mt-4 space-y-2 marker:text-[#14F195] text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              <li>Access your game data, scores, and transaction history</li>
              <li>Request correction of inaccurate profile information</li>
              <li>Delete optional profile data (display name, avatar)</li>
              <li>Disconnect your wallet at any time to stop participating</li>
            </ul>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90 mt-4">
              To exercise these rights, please contact us with your wallet address. Note that blockchain transaction records and game session data necessary for leaderboard integrity cannot be deleted from our systems.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Changes to This Policy</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We may update this Privacy Policy from time to time. Changes will be posted within the App with an updated &quot;Last Updated&quot; date. Continued use of the App after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="st-display text-[#14F195] text-xl md:text-2xl mb-4">Contact Us</h2>
            <div className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              If you have questions about this Privacy Policy, contact us at:<br /><br />
              <span className="text-[#14F195] font-black italic">Email: soltriviateam@gmail.com</span><br /><br />
              Effective Date: June 5, 2026.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyView;

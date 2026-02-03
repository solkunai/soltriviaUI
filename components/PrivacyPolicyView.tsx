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
        <h1 className="text-5xl md:text-8xl font-[1000] italic uppercase tracking-tighter sol-gradient-text leading-none mb-4">
          Privacy Policy
        </h1>
        <p className="text-[#14F195] font-black uppercase tracking-widest text-[10px] italic mb-16 border-l-2 border-[#14F195] pl-4">
          SOL Trivia Last Updated: February 2, 2026
        </p>

        <div className="space-y-16">
          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">Introduction</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application (&quot;App&quot;).<br /><br />
              By using SOL Trivia, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-8">Information We Collect</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest border-b border-[#14F195]/20 pb-2">Wallet Information</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li><span className="text-white font-bold italic">Public Wallet Address:</span> Collected when you connect your wallet to verify participation and process payouts.</li>
                  <li><span className="text-white font-bold italic">Transaction Signatures:</span> Stored for fees, lives, and claims to verify legitimate transactions.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest border-b border-[#14F195]/20 pb-2">Game Data</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li>Answers, scores, completion times, and rankings.</li>
                  <li>Aggregated stats: games played, win/loss, accuracy.</li>
                  <li>Daily play streaks and answer timing for anti-cheat.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest border-b border-[#14F195]/20 pb-2">Profile Information</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li><span className="text-white font-bold italic">Display Name:</span> Stored for leaderboard display.</li>
                  <li><span className="text-white font-bold italic">Avatar Images:</span> Stored in Supabase Storage and publicly accessible.</li>
                </ul>
              </div>

              <div className="space-y-4">
                <h3 className="text-[#14F195] text-sm font-black uppercase italic tracking-widest border-b border-[#14F195]/20 pb-2">Activity & Technical</h3>
                <ul className="list-disc list-inside text-white font-medium text-xs md:text-sm leading-relaxed opacity-80 space-y-2 marker:text-[#14F195]">
                  <li>Daily login activity and most recent activity timestamp.</li>
                  <li>Device type and anonymous crash logs.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">How We Use Your Information</h2>
            <div className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We use collected information to:
              <ul className="list-disc list-inside mt-4 space-y-2 marker:text-[#14F195]">
                <li>Process entry fees, lives purchases, and distribute prizes</li>
                <li>Display leaderboards and rankings with your identity</li>
                <li>Calculate scores, streaks, and anti-cheat timing</li>
                <li>Communicate important updates and generate analytics</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">Payment Processing</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              We use a <span className="text-[#14F195] font-black italic">Dual Wallet System</span>. Entry fees go to the Prize Pool wallet, while transaction fees and lives purchases go to the Revenue wallet. All payments are verified on-chain via Solana RPC before crediting.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">Blockchain Transactions</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              SOL Trivia operates on the Solana blockchain. All transactions are public, permanent, and visible to anyone. We cannot modify or delete blockchain transaction records. The immutable nature of blockchain means these records exist forever.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">Data Storage and Security</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              Game data is stored securely using Supabase. Avatar images are stored in Supabase Storage with public read access. We implement industry-standard security measures and Row Level Security (RLS). We never store your private keys or seed phrases.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">Your Rights</h2>
            <p className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              You have the right to access your data, request correction, or delete optional profile data. You can disconnect your wallet at any time. To exercise these rights, please contact us with your wallet address.
            </p>
          </section>

          <section>
            <h2 className="text-[#14F195] text-xl md:text-2xl font-[1000] italic uppercase tracking-tighter mb-4">Contact Us</h2>
            <div className="text-white font-medium text-sm md:text-base leading-relaxed opacity-90">
              If you have questions, contact us at:<br /><br />
              <span className="text-[#14F195] font-black italic">Email: soltriviateam@gmail.com</span><br /><br />
              Effective Date: February 2, 2026.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyView;

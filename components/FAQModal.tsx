import React, { useState } from 'react';

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FAQItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    q: 'What is SOL Trivia?',
    a: 'SOL Trivia is a crypto-themed trivia game on the Solana blockchain. Answer questions to earn points, compete against other players, and win real SOL prizes from the prize pool each round.',
  },
  {
    q: 'How do I play?',
    a: 'Connect your Solana wallet, pay the entry fee (0.02 SOL + 0.0025 SOL platform fee), and answer 10 questions in 7 seconds each. Your score is based on accuracy and speed. Top 5 players win SOL prizes.',
  },
  {
    q: 'How are prizes distributed?',
    a: '100% of the prize pool goes to the top 5: 1st (50%), 2nd (20%), 3rd (15%), 4th (10%), 5th (5%). No platform cut from the pot. Winners claim directly on-chain from their Profile page.',
  },
  {
    q: 'What are rounds?',
    a: 'There are 4 rounds per day (every 6 hours UTC: 00:00, 06:00, 12:00, 18:00). Each round has its own prize pool and leaderboard. You can enter up to 5 times per round, 20 times per 24 hours.',
  },
  {
    q: 'What is Practice Mode?',
    a: 'Practice mode lets you play trivia for free with no wallet required. You get 5 practice runs per day (unlimited with Game Pass). Practice uses separate questions with a 12-second timer. No prizes or leaderboard ranking.',
  },
  {
    q: 'What are Lives?',
    a: 'Every wallet gets 2 free entries per round. Beyond that, you need extra lives. Buy them in 3 tiers: 3 for 0.03 SOL, 15 for 0.1 SOL, or 35 for 0.25 SOL. Purchased lives roll over indefinitely across rounds.',
  },
  {
    q: 'What is the Game Pass?',
    a: 'A one-time purchase ($20 USD, or $10 for Seeker holders) that unlocks: unlimited practice plays, all question categories, and free custom game creation. Pay with SOL, USDC, or SKR.',
  },
  {
    q: 'What are Custom Games?',
    a: 'Create your own trivia with custom questions, share a link with friends, and compete on a per-game leaderboard. Games expire after 7 days. Players get 3 attempts each. Free to join, no prize pot in v1.',
  },
  {
    q: 'How much does it cost to create a Custom Game?',
    a: 'Game Pass holders pay only 0.0025 SOL (platform fee). Without Game Pass, it costs 0.0225 SOL (0.02 SOL creation fee + 0.0025 SOL platform fee).',
  },
  {
    q: 'What are Seeker Perks?',
    a: 'Solana Seeker device owners who verify their Genesis Token (SGT) get: +25% XP boost on profile stats, discounted lives, $10 Game Pass (instead of $20), .skr domain as display name, and a badge on the leaderboard.',
  },
  {
    q: 'How does the Referral Program work?',
    a: 'Share your unique referral link from your Profile page. When someone you refer connects their wallet and completes their first paid game, you earn 1,000 XP.',
  },
  {
    q: 'Is my wallet safe?',
    a: 'We never have access to your private keys or seed phrases. All transactions require your explicit wallet approval. Funds go directly to the on-chain smart contract vault or revenue wallet — never to a personal address.',
  },
];

const FAQModal: React.FC<FAQModalProps> = ({ isOpen, onClose }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-5 pb-3 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-[1000] italic uppercase tracking-tighter text-white">FAQ</h2>
            <p className="text-zinc-500 text-[10px] font-bold italic mt-0.5">Frequently Asked Questions</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* FAQ Items */}
        <div className="p-4 overflow-y-auto flex-1 space-y-1">
          {FAQ_ITEMS.map((item, i) => {
            const isExpanded = openIndex === i;
            return (
              <div key={i} className="border border-white/5 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenIndex(isExpanded ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-white text-sm font-bold pr-4">{item.q}</span>
                  <svg
                    className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-zinc-400 text-xs leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FAQModal;

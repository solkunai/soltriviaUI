/**
 * mintData — data model for the Sol Trivia Elementals commemorative NFT mint.
 *
 * Ported from the design handoff (stw-mint.jsx → MINT_ARCHETYPES). Drives the
 * web MintViewV2: the 4 archetypes, their art/colors/traits, and the
 * trivia-gate question pool.
 *
 * The archetype `key` maps 1:1 to the backend variant key (Brain Type):
 *   lightning → champion · fire → competitor · earth → genius · ice → scholar
 *
 * `img`/`icon` are public-root paths (assets live in public/mint/).
 * MTC = the deliberately warmer navy + gold "trading card" palette. It is NOT
 * the app's #FFD700 gold — keep the distinction (design source of truth).
 */

export const MTC = {
  navy: '#0E1A3D',
  navyDeep: '#070F26',
  gold: '#FBBF24',
  goldDeep: '#E89F0F',
  goldGlow: '#FFE066',
} as const;

export type ArchetypeKey = 'genius' | 'scholar' | 'competitor' | 'champion';

export const VARIANT_TO_ARCHETYPE: Record<string, ArchetypeKey> = {
  lightning: 'champion',
  fire: 'competitor',
  earth: 'genius',
  ice: 'scholar',
};
export const ARCHETYPE_TO_VARIANT: Record<ArchetypeKey, string> = {
  champion: 'lightning',
  competitor: 'fire',
  genius: 'earth',
  scholar: 'ice',
};

export type Trait = { trait: string; value: string; pct: string };
export type Archetype = {
  key: ArchetypeKey;
  label: string;
  element: string;
  rarity: string;
  supply: string;
  accent: string;
  bg1: string;
  bg2: string;
  lore: string;
  img: string;
  icon: string;
  attributes: Trait[];
};

export const ARCHETYPES: Record<ArchetypeKey, Archetype> = {
  genius: {
    key: 'genius',
    label: 'THE GENIUS',
    element: 'EARTH',
    rarity: 'LEGENDARY',
    supply: '25,000',
    accent: '#7DD356',
    bg1: '#A5E07B',
    bg2: '#5B9C3E',
    lore: 'Patient, methodical, eternally observant.',
    img: '/mint/nft-genius.png',
    icon: '/mint/icon-earth.png',
    attributes: [
      { trait: 'Brain Type', value: 'Earth', pct: '65%' },
      { trait: 'Background', value: 'Enchanted Forest', pct: '65%' },
      { trait: 'Accessory', value: 'Wooden Staff', pct: '18%' },
      { trait: 'Headpiece', value: 'Moss Crown', pct: '22%' },
      { trait: 'Mood', value: 'Curious', pct: '31%' },
      { trait: 'Aura', value: 'Wisdom', pct: '12%' },
    ],
  },
  scholar: {
    key: 'scholar',
    label: 'THE SCHOLAR',
    element: 'ICE',
    rarity: 'LEGENDARY',
    supply: '25,000',
    accent: '#7CD4F5',
    bg1: '#A9E4F7',
    bg2: '#5BAFD6',
    lore: 'Curious, studious, hungry for knowledge.',
    img: '/mint/nft-scholar.png',
    icon: '/mint/icon-ice.png',
    attributes: [
      { trait: 'Brain Type', value: 'Ice', pct: '25%' },
      { trait: 'Background', value: 'Crystal Glacier', pct: '25%' },
      { trait: 'Accessory', value: 'Trivia Nerd 101', pct: '11%' },
      { trait: 'Eyewear', value: 'Gold Round', pct: '9%' },
      { trait: 'Mood', value: 'Studious', pct: '14%' },
      { trait: 'Aura', value: 'Frost', pct: '6%' },
    ],
  },
  competitor: {
    key: 'competitor',
    label: 'THE COMPETITOR',
    element: 'FIRE',
    rarity: 'LEGENDARY',
    supply: '25,000',
    accent: '#FF6E3C',
    bg1: '#FF9264',
    bg2: '#D14424',
    lore: 'Fierce, driven, never backs down.',
    img: '/mint/nft-competitor.png',
    icon: '/mint/icon-fire.png',
    attributes: [
      { trait: 'Brain Type', value: 'Fire', pct: '9%' },
      { trait: 'Background', value: 'Erupting Volcano', pct: '9%' },
      { trait: 'Accessory', value: 'Red Boxing Gloves', pct: '4%' },
      { trait: 'Effect', value: 'Roaring Flames', pct: '3%' },
      { trait: 'Mood', value: 'Fierce', pct: '7%' },
      { trait: 'Aura', value: 'Inferno', pct: '2%' },
    ],
  },
  champion: {
    key: 'champion',
    label: 'THE CHAMPION',
    element: 'LIGHTNING',
    rarity: 'LEGENDARY',
    supply: '25,000',
    accent: '#FFD93D',
    bg1: '#FFE26B',
    bg2: '#D9A91A',
    lore: 'Master of the storm. Reigns supreme.',
    img: '/mint/nft-champion.png',
    icon: '/mint/icon-lightning.png',
    attributes: [
      { trait: 'Brain Type', value: 'Lightning', pct: '1%' },
      { trait: 'Background', value: 'Storm Over City', pct: '1%' },
      { trait: 'Accessory', value: 'Onyx Fists', pct: '0.4%' },
      { trait: 'Effect', value: 'Chain Lightning', pct: '0.3%' },
      { trait: 'Mood', value: 'Triumphant', pct: '0.8%' },
      { trait: 'Aura', value: 'Storm', pct: '0.2%' },
    ],
  },
};

export const ARCHETYPE_ORDER: ArchetypeKey[] = ['genius', 'scholar', 'competitor', 'champion'];

// Total commemorative supply across all 4 archetypes (25K each).
export const MINT_SUPPLY = 100000;

// Trivia gate questions shown before a mint. Mix of crypto culture + Solana
// knowledge filter. Updated 2026-06-02 — removed broken ◎ symbol Q, dropped
// archetype-element Q (users can't know pre-mint), upgraded founder Q to the
// "chad" version with degen wrong answers, added hacker-house + WAGMI +
// Proof-of-History. Cycles per-wallet so the same wallet sees all 10 before
// any repeat (see pickGateQuestionForWallet).
export const GATE_QUESTIONS: { q: string; options: string[]; correct: number }[] = [
  { q: "Solana's native token?", options: ['SOL', 'ETH', 'BTC', 'SUI'], correct: 0 },
  { q: "Who's the chad who co-founded Solana?", options: ['SBF', 'Toly', 'Elon', 'Andrew Tate'], correct: 1 },
  { q: 'How many archetypes drop tonight?', options: ['3', '4', '5', '7'], correct: 1 },
  { q: "What does 'WAGMI' mean?", options: ['We Are Going Maximum In', "We're All Gonna Make It", 'Wallet Already Got My Info', 'Win And Get My Investment'], correct: 1 },
  { q: 'What does NFT stand for?', options: ['Network File Transfer', 'Non-Fungible Token', 'New Function Tag', 'Native Fee Token'], correct: 1 },
  { q: "Where's the 2026 Solana hacker house?", options: ['New York', 'Tokyo', 'London', 'Dubai'], correct: 2 },
  { q: 'Solana-native wallet?', options: ['MetaMask', 'Trezor', 'Phantom', 'Ledger'], correct: 2 },
  { q: "Solana's consensus innovation?", options: ['Proof of Work', 'Proof of Stake', 'Proof of History', 'Proof of Authority'], correct: 2 },
  { q: 'Solana mainnet launched?', options: ['2018', '2019', '2020', '2021'], correct: 2 },
  { q: "'gm' means…", options: ['Got Mint', 'Good Morning', 'God Mode', 'Good Money'], correct: 1 },
];

// LocalStorage key prefix for the per-wallet question rotation index.
const GATE_IDX_KEY = (wallet: string) => `mint:gateIdx:${wallet}`;

/**
 * Pick the next trivia gate question for this wallet, cycling so the same wallet
 * sees all 10 before any repeat. If wallet is missing, falls back to random.
 *
 * Reads + writes localStorage as a side effect — call ONCE per gate-show (e.g.
 * inside `useState` initializer).
 */
export function pickGateQuestionForWallet(walletAddress: string | null | undefined) {
  if (!walletAddress) {
    return GATE_QUESTIONS[Math.floor(Math.random() * GATE_QUESTIONS.length)];
  }
  const key = GATE_IDX_KEY(walletAddress);
  let nextIdx: number;
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      nextIdx = (parsed + 1) % GATE_QUESTIONS.length;
    } else {
      // First time this wallet hits the gate — start at a random index so
      // adjacent wallets don't all see Q1 first.
      nextIdx = Math.floor(Math.random() * GATE_QUESTIONS.length);
    }
    localStorage.setItem(key, String(nextIdx));
  } catch {
    nextIdx = Math.floor(Math.random() * GATE_QUESTIONS.length);
  }
  return GATE_QUESTIONS[nextIdx];
}

/** @deprecated kept for back-compat — prefer `pickGateQuestionForWallet`. */
export const randomGateQuestion = () =>
  GATE_QUESTIONS[Math.floor(Math.random() * GATE_QUESTIONS.length)];

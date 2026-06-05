
export enum View {
  HOME = 'HOME',
  LEADERBOARD = 'LEADERBOARD',
  ROUND_WINNERS = 'ROUND_WINNERS',
  PLAY = 'PLAY',
  QUESTS = 'QUESTS',
  PROFILE = 'PROFILE',
  QUIZ = 'QUIZ',
  RESULTS = 'RESULTS',
  ADMIN = 'ADMIN',
  CONTRACT_TEST = 'CONTRACT_TEST',
  TERMS = 'TERMS',
  PRIVACY = 'PRIVACY',
  PRACTICE = 'PRACTICE',
  PRACTICE_RESULTS = 'PRACTICE_RESULTS',
  CUSTOM_GAMES_HUB = 'CUSTOM_GAMES_HUB',
  CUSTOM_GAME_CREATE = 'CUSTOM_GAME_CREATE',
  CUSTOM_GAME_LOBBY = 'CUSTOM_GAME_LOBBY',
  CUSTOM_GAME_PLAY = 'CUSTOM_GAME_PLAY',
  CUSTOM_GAME_RESULTS = 'CUSTOM_GAME_RESULTS',
  DUEL_LOBBY = 'DUEL_LOBBY',
  DUEL_WAITING = 'DUEL_WAITING',
  DUEL_PLAY = 'DUEL_PLAY',
  DUEL_RESULTS = 'DUEL_RESULTS',
  COMPETE_LOBBY = 'COMPETE_LOBBY',
  REFERRALS = 'REFERRALS',
  GAME_PASS = 'GAME_PASS',
  LIVES = 'LIVES',
  MINT = 'MINT',
  SWAP = 'SWAP'
}

export interface Player {
  rank: string;
  username: string;
  score: string;
  reward: string;
  isYou?: boolean;
  avatar?: string;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  progress: number;
  maxProgress: number;
  reward: string;
  status: 'LOCKED' | 'CLAIM' | 'GO';
  icon?: string;
}

export interface Question {
  /** Question id: UUID string from API (for submit-answer) or number for display */
  id: number | string;
  text: string;
  options: string[];
  correctAnswer: number;
  /** Lowercase category slug from `questions.category` column. Drives the
   *  category pill color in QuizView via CATEGORY_COLORS map. Empty string
   *  when unknown , pill falls back to neutral zinc. */
  category?: string;
}
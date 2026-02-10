
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
  PRIVACY = 'PRIVACY'
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
}
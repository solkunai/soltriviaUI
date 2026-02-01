
export enum View {
  HOME = 'HOME',
  LEADERBOARD = 'LEADERBOARD',
  PLAY = 'PLAY',
  QUESTS = 'QUESTS',
  PROFILE = 'PROFILE',
  QUIZ = 'QUIZ',
  RESULTS = 'RESULTS'
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
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
}
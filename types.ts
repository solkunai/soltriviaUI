
export enum View {
  HOME = 'HOME',
  QUESTS = 'QUESTS',
  RANKS = 'RANKS',
  LOGS = 'LOGS',
  PROFILE = 'PROFILE'
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

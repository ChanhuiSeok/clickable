export type GameState = 'waiting' | 'countdown' | 'playing' | 'ended';

export interface Participant {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  lastCps: number;
  maxCps: number;
  rank?: number;
  lastActive: number;
  role?: 'student' | 'screen';
  isQualified?: boolean;
}

export interface GameControlPayload {
  action: 'countdown' | 'start' | 'end' | 'reset';
  countdownSec?: number;
  gameDuration?: number; // default 15
  startTime?: number; // timestamp ms
  endTime?: number; // timestamp ms
  isFinalRound?: boolean;
  qualifiedPlayerIds?: string[];
}

export interface ScoreBatchPayload {
  id: string;
  nickname: string;
  avatar: string;
  addedClicks: number;
  totalScore: number;
  cps: number;
  timestamp: number;
}

export interface PlayerJoinPayload {
  id: string;
  nickname: string;
  avatar: string;
}

export interface PlayerLeavePayload {
  id: string;
}

export interface ScreenSyncPayload {
  state: GameState;
  remainingTime: number;
  startTime?: number;
  scores: Record<string, number>;
}

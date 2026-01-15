import { Match } from './match';
import { User } from './user';

export type LeagueFormat = 'swiss' | 'round_robin';
export type LeagueStatus = 'draft' | 'running' | 'completed';
export type PairingStatus = 'pending' | 'done';

export interface LeagueParticipant {
  id: number;
  league_id: number;
  user_id: number;
  seed?: number;
  dropped: boolean;
  user?: User;
}

export interface League {
  id: number;
  name: string;
  format: LeagueFormat;
  status: LeagueStatus;
  round_count: number;
  created_at: string;
  participants?: LeagueParticipant[];
}

export interface LeaguePairing {
  id: number;
  league_id: number;
  round_no: number;
  player1_user_id: number;
  player2_user_id?: number;
  is_bye: boolean;
  status: PairingStatus;
  linked_match_id?: number;
  created_at: string;
  player1?: User;
  player2?: User;
  linked_match?: Match;
}

export interface CreateLeagueRequest {
  name: string;
  format: LeagueFormat;
  round_count?: number;
  participant_user_ids: number[];
}

export interface LeagueStanding {
  user_id: number;
  name: string;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
}



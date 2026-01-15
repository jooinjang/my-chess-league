import { Match } from './match';
import { User } from './user';
import { PairingStatus } from './league';

export type TournamentStatus = 'draft' | 'running' | 'completed';
export type TournamentBracket = 'W' | 'L' | 'GF' | 'GF_RESET';

export interface TournamentParticipant {
  id: number;
  tournament_id: number;
  user_id: number;
  seed: number;
  wins: number;
  losses: number;
  eliminated: boolean;
  user?: User;
}

export interface Tournament {
  id: number;
  name: string;
  status: TournamentStatus;
  created_at: string;
  participants?: TournamentParticipant[];
}

export interface TournamentMatch {
  id: number;
  tournament_id: number;
  bracket: TournamentBracket;
  round_no: number;
  match_no: number;
  player1_user_id?: number;
  player2_user_id?: number;
  winner_user_id?: number;
  loser_user_id?: number;
  status: PairingStatus;
  armageddon_required: boolean;
  initial_match_id?: number;
  tiebreak_match_id?: number;
  linked_match_id?: number;
  created_at: string;
  player1?: User;
  player2?: User;
  initial_match?: Match;
  tiebreak_match?: Match;
  linked_match?: Match;
}

export interface CreateTournamentRequest {
  name: string;
  participant_user_ids: number[];
}

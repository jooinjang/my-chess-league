import { User } from './user';

export type MatchResult = 'white_win' | 'black_win' | 'draw';

export interface Match {
  id: number;
  white_player_id: number;
  black_player_id: number;
  result: MatchResult;
  played_at: string;
  white_rating_before: number;
  black_rating_before: number;
  white_rating_after: number;
  black_rating_after: number;
  chesscom_game_id?: string;
  white_player?: User;
  black_player?: User;
  created_at: string;
}

export interface CreateMatchRequest {
  white_player_id: number;
  black_player_id: number;
  result: MatchResult;
  played_at: string;
  chesscom_game_id?: string;
}

export interface BulkCreateMatchRequest {
  matches: CreateMatchRequest[];
}

// Chess.com types
export interface ChesscomPlayer {
  username: string;
  rating: number;
  result: string;
}

export interface ChesscomGame {
  url: string;
  game_id: string;
  pgn: string;
  end_time: number;
  time_class: string;
  rated: boolean;
  white: ChesscomPlayer;
  black: ChesscomPlayer;
}

export interface ChesscomGamesResponse {
  games: ChesscomGame[];
  already_imported: string[];
  user1: {
    id: number;
    name: string;
    chesscom_username: string;
  };
  user2: {
    id: number;
    name: string;
    chesscom_username: string;
  };
}

export interface ChesscomSyncResponse {
  year: number;
  month: number;
  recalculate: boolean;
  recalculate_done: boolean;
  users_considered: number;
  total_fetched: number;
  total_between_players: number;
  already_imported: number;
  created_count: number;
}

export interface ChesscomUserProfile {
  player_id: number;
  username: string;
  name?: string;
  status: string;
  country?: string;
  joined: number;
  last_online: number;
}

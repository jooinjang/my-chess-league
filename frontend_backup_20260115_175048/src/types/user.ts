export interface User {
  id: number;
  name: string;
  rating: number;
  rating_deviation: number;
  initial_rating?: number;
  initial_rd?: number;
  memo: string;
  chesscom_username?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  name: string;
  rating?: number;
  memo?: string;
  chesscom_username?: string;
}

export interface UpdateUserRequest {
  name?: string;
  memo?: string;
  chesscom_username?: string;
}

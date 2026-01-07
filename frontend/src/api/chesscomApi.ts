import { apiClient } from './client';
import { ApiResponse, ChesscomGamesResponse, ChesscomSyncResponse, ChesscomUserProfile } from '../types';

export const chesscomApi = {
  validateUsername: async (username: string): Promise<ChesscomUserProfile> => {
    const response = await apiClient.get<ApiResponse<ChesscomUserProfile>>(
      `/chesscom/validate/${encodeURIComponent(username)}`
    );
    return response.data.data!;
  },

  getGames: async (
    user1Id: number,
    user2Id: number,
    year: number,
    month: number
  ): Promise<ChesscomGamesResponse> => {
    const response = await apiClient.get<ApiResponse<ChesscomGamesResponse>>(
      `/chesscom/games`,
      {
        params: {
          user1_id: user1Id,
          user2_id: user2Id,
          year,
          month,
        },
      }
    );
    return response.data.data!;
  },

  syncMonth: async (params: {
    year: number;
    month: number;
    recalculate?: boolean;
  }): Promise<ChesscomSyncResponse> => {
    const response = await apiClient.post<ApiResponse<ChesscomSyncResponse>>(
      `/chesscom/sync`,
      null,
      { params }
    );
    return response.data.data!;
  },
};

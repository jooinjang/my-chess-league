import { apiClient } from './client';
import { ApiResponse, Tournament, TournamentMatch, CreateTournamentRequest } from '../types';

export const tournamentApi = {
  getAll: async (): Promise<Tournament[]> => {
    const res = await apiClient.get<ApiResponse<Tournament[]>>('/tournaments');
    return res.data.data || [];
  },

  getById: async (id: number): Promise<Tournament> => {
    const res = await apiClient.get<ApiResponse<Tournament>>(`/tournaments/${id}`);
    return res.data.data!;
  },

  create: async (data: CreateTournamentRequest): Promise<Tournament> => {
    const res = await apiClient.post<ApiResponse<Tournament>>('/tournaments', data);
    return res.data.data!;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/tournaments/${id}`);
  },

  getBracket: async (tournamentId: number): Promise<TournamentMatch[]> => {
    const res = await apiClient.get<ApiResponse<{ matches: TournamentMatch[] }>>(`/tournaments/${tournamentId}/bracket`);
    return res.data.data?.matches || [];
  },

  generateNextRound: async (tournamentId: number): Promise<TournamentMatch[]> => {
    const res = await apiClient.post<ApiResponse<{ matches: TournamentMatch[] }>>(`/tournaments/${tournamentId}/rounds/next`);
    return res.data.data?.matches || [];
  },

  reportMatchChesscom: async (
    tournamentId: number,
    matchId: number,
    payload: { year: number; month: number; game_id: string }
  ): Promise<TournamentMatch> => {
    const res = await apiClient.post<ApiResponse<TournamentMatch>>(
      `/tournaments/${tournamentId}/matches/${matchId}/result/chesscom`,
      payload
    );
    return res.data.data!;
  },
};



import { apiClient } from './client';
import { ApiResponse, League, LeaguePairing, LeagueStanding, CreateLeagueRequest } from '../types';

export const leagueApi = {
  getAll: async (): Promise<League[]> => {
    const res = await apiClient.get<ApiResponse<League[]>>('/leagues');
    return res.data.data || [];
  },

  getById: async (id: number): Promise<League> => {
    const res = await apiClient.get<ApiResponse<League>>(`/leagues/${id}`);
    return res.data.data!;
  },

  create: async (data: CreateLeagueRequest): Promise<League> => {
    const res = await apiClient.post<ApiResponse<League>>('/leagues', data);
    return res.data.data!;
  },

  updateName: async (id: number, name: string): Promise<League> => {
    const res = await apiClient.put<ApiResponse<League>>(`/leagues/${id}`, { name });
    return res.data.data!;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/leagues/${id}`);
  },

  getPairings: async (leagueId: number): Promise<LeaguePairing[]> => {
    const res = await apiClient.get<ApiResponse<{ pairings: LeaguePairing[] }>>(`/leagues/${leagueId}/pairings`);
    return res.data.data?.pairings || [];
  },

  generateNextRound: async (leagueId: number): Promise<LeaguePairing[]> => {
    const res = await apiClient.post<ApiResponse<{ pairings: LeaguePairing[] }>>(`/leagues/${leagueId}/rounds/next`);
    return res.data.data?.pairings || [];
  },

  getStandings: async (leagueId: number): Promise<LeagueStanding[]> => {
    const res = await apiClient.get<ApiResponse<{ standings: LeagueStanding[] }>>(`/leagues/${leagueId}/standings`);
    return res.data.data?.standings || [];
  },

  reportPairingChesscom: async (
    leagueId: number,
    pairingId: number,
    payload: { year: number; month: number; game_id: string }
  ): Promise<LeaguePairing> => {
    const res = await apiClient.post<ApiResponse<LeaguePairing>>(
      `/leagues/${leagueId}/pairings/${pairingId}/result/chesscom`,
      payload
    );
    return res.data.data!;
  },
};



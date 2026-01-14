import { apiClient } from './client';
import { ApiResponse, Match, CreateMatchRequest, BulkCreateMatchRequest } from '../types';
import type { GameAnalysis } from '../types/analysis';

interface BulkCreateResponse {
  matches: Match[];
  created_count: number;
}

export const matchApi = {
  getAll: async (): Promise<Match[]> => {
    const response = await apiClient.get<ApiResponse<Match[]>>('/matches');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<Match> => {
    const response = await apiClient.get<ApiResponse<Match>>(`/matches/${id}`);
    return response.data.data!;
  },

  create: async (data: CreateMatchRequest): Promise<Match> => {
    const response = await apiClient.post<ApiResponse<Match>>('/matches', data);
    return response.data.data!;
  },

  createBulk: async (data: BulkCreateMatchRequest): Promise<BulkCreateResponse> => {
    const response = await apiClient.post<ApiResponse<BulkCreateResponse>>('/matches/bulk', data);
    return response.data.data!;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/matches/${id}`);
  },

  deleteAll: async (): Promise<{ deleted_count: number }> => {
    const response = await apiClient.delete<ApiResponse<{ deleted_count: number }>>('/matches');
    return response.data.data!;
  },

  analyze: async (matchId: number, opts?: { depth?: number; multipv?: number }): Promise<void> => {
    const params = new URLSearchParams();
    if (opts?.depth) params.set('depth', String(opts.depth));
    if (opts?.multipv) params.set('multipv', String(opts.multipv));
    const q = params.toString();
    await apiClient.post<ApiResponse<unknown>>(`/matches/${matchId}/analyze${q ? `?${q}` : ''}`);
  },

  getAnalysis: async (matchId: number): Promise<GameAnalysis> => {
    const response = await apiClient.get<ApiResponse<GameAnalysis>>(`/matches/${matchId}/analysis`);
    return response.data.data!;
  },
};

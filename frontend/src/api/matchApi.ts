import { apiClient } from './client';
import { ApiResponse, Match, CreateMatchRequest, BulkCreateMatchRequest } from '../types';

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
};

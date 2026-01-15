import { apiClient } from './client';
import { ApiResponse, User, CreateUserRequest, UpdateUserRequest, Match } from '../types';

export const userApi = {
  getAll: async (): Promise<User[]> => {
    const response = await apiClient.get<ApiResponse<User[]>>('/users');
    return response.data.data || [];
  },

  getById: async (id: number): Promise<User> => {
    const response = await apiClient.get<ApiResponse<User>>(`/users/${id}`);
    return response.data.data!;
  },

  create: async (data: CreateUserRequest): Promise<User> => {
    const response = await apiClient.post<ApiResponse<User>>('/users', data);
    return response.data.data!;
  },

  update: async (id: number, data: UpdateUserRequest): Promise<User> => {
    const response = await apiClient.put<ApiResponse<User>>(`/users/${id}`, data);
    return response.data.data!;
  },

  delete: async (id: number): Promise<void> => {
    await apiClient.delete(`/users/${id}`);
  },

  getMatches: async (id: number): Promise<Match[]> => {
    const response = await apiClient.get<ApiResponse<Match[]>>(`/users/${id}/matches`);
    return response.data.data || [];
  },

  getRankings: async (): Promise<User[]> => {
    const response = await apiClient.get<ApiResponse<User[]>>('/rankings');
    return response.data.data || [];
  },
};

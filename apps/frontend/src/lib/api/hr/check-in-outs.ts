import { apiClient } from '../client';
import type {
  CheckInOut,
  CreateCheckInOutDto,
  UpdateCheckInOutDto,
  FilterCheckInOutsDto,
  CheckInOutsListResponse,
} from '@/types/hr/check-in-out';

export const checkInOutsApi = {
  getAll: async (filters?: FilterCheckInOutsDto) => {
    const { data } = await apiClient.get<CheckInOutsListResponse>('/hr/check-in-outs', {
      params: filters,
    });
    return data;
  },

  getMine: async (filters?: FilterCheckInOutsDto) => {
    const { data } = await apiClient.get<CheckInOutsListResponse>('/hr/check-in-outs/my', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<CheckInOut>(`/hr/check-in-outs/${id}`);
    return data;
  },

  create: async (payload: CreateCheckInOutDto) => {
    const { data } = await apiClient.post<CheckInOut>('/hr/check-in-outs', payload);
    return data;
  },

  update: async (id: string, payload: UpdateCheckInOutDto) => {
    const { data } = await apiClient.patch<CheckInOut>(`/hr/check-in-outs/${id}`, payload);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/hr/check-in-outs/${id}`);
    return data;
  },
};


import { apiClient } from '../client';
import type {
  EmployeeCheckIn,
  CreateCheckInDto,
  UpdateCheckInDto,
  CheckInFilters,
  CheckInsListResponse,
} from '@/types/hr';

export const checkInsApi = {
  // Get all check-ins
  getAll: async (params: CheckInFilters = {}) => {
    const { data } = await apiClient.get<CheckInsListResponse>('/hr/check-ins', {
      params,
    });
    return data;
  },

  // Get check-in by ID
  getById: async (id: string) => {
    const { data } = await apiClient.get<EmployeeCheckIn>(`/hr/check-ins/${id}`);
    return data;
  },

  // Create check-in
  create: async (dto: CreateCheckInDto) => {
    const { data } = await apiClient.post<EmployeeCheckIn>('/hr/check-ins', dto);
    return data;
  },

  // Update check-in
  update: async (id: string, dto: UpdateCheckInDto) => {
    const { data } = await apiClient.patch<EmployeeCheckIn>(`/hr/check-ins/${id}`, dto);
    return data;
  },

  // Delete check-in
  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/hr/check-ins/${id}`);
    return data;
  },
};


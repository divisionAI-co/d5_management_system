import { apiClient } from './client';
import type { DashboardResponse } from '@/types/dashboard';

export const dashboardApi = {
  getMy: async () => {
    const { data } = await apiClient.get<DashboardResponse>('/dashboard/me');
    return data;
  },
};



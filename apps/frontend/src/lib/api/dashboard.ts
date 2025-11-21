import { apiClient } from './client';
import type { DashboardResponse, AdminDashboardResponse } from '@/types/dashboard';

export const dashboardApi = {
  getMy: async () => {
    const { data } = await apiClient.get<DashboardResponse>('/dashboard/me');
    return data;
  },
  getAdmin: async () => {
    const { data } = await apiClient.get<AdminDashboardResponse>('/dashboard/admin');
    return data;
  },
};



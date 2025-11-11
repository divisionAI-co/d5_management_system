import { apiClient } from '../client';
import type {
  EodReport,
  CreateEodReportDto,
  UpdateEodReportDto,
} from '@/types/hr';

interface EodReportFilters {
  userId?: string;
  startDate?: string;
  endDate?: string;
}

export const eodReportsApi = {
  getAll: async (filters?: EodReportFilters) => {
    const { data } = await apiClient.get<EodReport[]>('/hr/eod-reports', {
      params: filters,
    });
    return data;
  },

  getMine: async () => {
    const { data } = await apiClient.get<EodReport[]>('/hr/eod-reports/my');
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<EodReport>(`/hr/eod-reports/${id}`);
    return data;
  },

  create: async (payload: CreateEodReportDto) => {
    const { data } = await apiClient.post<EodReport>('/hr/eod-reports', payload);
    return data;
  },

  update: async (id: string, payload: UpdateEodReportDto) => {
    const { data } = await apiClient.patch<EodReport>(`/hr/eod-reports/${id}`, payload);
    return data;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/hr/eod-reports/${id}`);
    return data;
  },
};



import { apiClient } from '../client';
import type {
  SalesPerformanceReport,
  CreateSalesPerformanceReportDto,
  UpdateSalesPerformanceReportDto,
  SalesPerformanceReportFilters,
  SalesPerformanceReportsListResponse,
} from '@/types/sales-performance-reports';

export const salesPerformanceReportsApi = {
  getAll: async (filters?: SalesPerformanceReportFilters) => {
    const { data } = await apiClient.get<SalesPerformanceReportsListResponse>(
      '/sales-performance-reports',
      {
        params: filters,
      },
    );
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<SalesPerformanceReport>(
      `/sales-performance-reports/${id}`,
    );
    return data;
  },

  create: async (payload: CreateSalesPerformanceReportDto) => {
    const { data } = await apiClient.post<SalesPerformanceReport>(
      '/sales-performance-reports',
      payload,
    );
    return data;
  },

  update: async (id: string, payload: UpdateSalesPerformanceReportDto) => {
    const { data } = await apiClient.patch<SalesPerformanceReport>(
      `/sales-performance-reports/${id}`,
      payload,
    );
    return data;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/sales-performance-reports/${id}`);
    return data;
  },

  downloadPdf: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/sales-performance-reports/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  preview: async (id: string, payload?: { templateId?: string; templateData?: Record<string, any> }) => {
    const { data } = await apiClient.post<{ renderedHtml: string; templateId?: string | null }>(
      `/sales-performance-reports/${id}/preview`,
      payload || {},
    );
    return data;
  },

  send: async (id: string, payload: { to?: string[]; cc?: string[]; subject?: string; message?: string; templateId?: string }) => {
    const { data } = await apiClient.post<SalesPerformanceReport>(
      `/sales-performance-reports/${id}/send`,
      payload,
    );
    return data;
  },
};


import { apiClient } from '../client';
import type {
  RecruiterPerformanceReport,
  CreateRecruiterPerformanceReportDto,
  UpdateRecruiterPerformanceReportDto,
  RecruiterPerformanceReportFilters,
  RecruiterPerformanceReportsListResponse,
} from '@/types/recruiter-performance-reports';

export const recruiterPerformanceReportsApi = {
  getAll: async (filters?: RecruiterPerformanceReportFilters) => {
    const { data } = await apiClient.get<RecruiterPerformanceReportsListResponse>(
      '/recruiter-performance-reports',
      {
        params: filters,
      },
    );
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<RecruiterPerformanceReport>(
      `/recruiter-performance-reports/${id}`,
    );
    return data;
  },

  create: async (payload: CreateRecruiterPerformanceReportDto) => {
    const { data } = await apiClient.post<RecruiterPerformanceReport>(
      '/recruiter-performance-reports',
      payload,
    );
    return data;
  },

  update: async (id: string, payload: UpdateRecruiterPerformanceReportDto) => {
    const { data } = await apiClient.patch<RecruiterPerformanceReport>(
      `/recruiter-performance-reports/${id}`,
      payload,
    );
    return data;
  },

  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/recruiter-performance-reports/${id}`);
    return data;
  },

  downloadInternalPdf: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/recruiter-performance-reports/${id}/pdf/internal`, {
      responseType: 'blob',
    });
    return response.data;
  },

  downloadCustomerPdf: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`/recruiter-performance-reports/${id}/pdf/customer`, {
      responseType: 'blob',
    });
    return response.data;
  },

  preview: async (id: string, type: 'internal' | 'customer' = 'customer', templateId?: string): Promise<{ html: string }> => {
    const { data } = await apiClient.get<{ html: string }>(
      `/recruiter-performance-reports/${id}/preview`,
      {
        params: {
          type,
          ...(templateId && { templateId }),
        },
      },
    );
    return data;
  },

  sendToCustomer: async (id: string, payload: { recipientEmail: string; message?: string; templateId?: string }) => {
    const { data } = await apiClient.post<RecruiterPerformanceReport>(
      `/recruiter-performance-reports/${id}/send`,
      payload,
    );
    return data;
  },
};


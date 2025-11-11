import { apiClient } from '../client';
import type {
  PerformanceReview,
  CreatePerformanceReviewDto,
  UpdatePerformanceReviewDto,
  Employee,
} from '@/types/hr';

export const performanceReviewsApi = {
  // Get all performance reviews
  getAll: async (params?: { employeeId?: string }) => {
    const { data } = await apiClient.get<PerformanceReview[]>('/hr/performance-reviews', { params });
    return data;
  },

  // Get performance review by ID
  getById: async (id: string) => {
    const { data } = await apiClient.get<PerformanceReview>(`/hr/performance-reviews/${id}`);
    return data;
  },

  // Get employees needing upcoming reviews
  getUpcoming: async (daysAhead?: number) => {
    const { data } = await apiClient.get<Employee[]>('/hr/performance-reviews/upcoming', {
      params: { daysAhead },
    });
    return data;
  },

  // Download performance review PDF
  downloadPdf: async (id: string) => {
    const response = await apiClient.get(`/hr/performance-reviews/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Create performance review
  create: async (dto: CreatePerformanceReviewDto) => {
    const { data } = await apiClient.post<PerformanceReview>('/hr/performance-reviews', dto);
    return data;
  },

  // Update performance review
  update: async (id: string, dto: UpdatePerformanceReviewDto) => {
    const { data } = await apiClient.patch<PerformanceReview>(`/hr/performance-reviews/${id}`, dto);
    return data;
  },

  // Delete performance review
  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/hr/performance-reviews/${id}`);
    return data;
  },
};


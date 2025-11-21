import apiClient from '@/lib/api/client';
import type {
  CaseStudy,
  CreateCaseStudyDto,
  UpdateCaseStudyDto,
  CaseStudyFilters,
  PaginatedResponse,
} from '@/types/content';

export const caseStudiesApi = {
  async list(filters?: CaseStudyFilters) {
    const { data } = await apiClient.get<PaginatedResponse<CaseStudy>>(
      '/content/case-studies',
      {
        params: filters,
      },
    );
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<CaseStudy>(`/content/case-studies/${id}`);
    return data;
  },

  async getBySlug(slug: string) {
    const { data } = await apiClient.get<CaseStudy>(`/content/case-studies/public/${slug}`);
    return data;
  },

  async create(payload: CreateCaseStudyDto) {
    const { data } = await apiClient.post<CaseStudy>('/content/case-studies', payload);
    return data;
  },

  async update(id: string, payload: UpdateCaseStudyDto) {
    const { data } = await apiClient.patch<CaseStudy>(
      `/content/case-studies/${id}`,
      payload,
    );
    return data;
  },

  async delete(id: string) {
    const { data } = await apiClient.delete<{ message: string }>(
      `/content/case-studies/${id}`,
    );
    return data;
  },
};


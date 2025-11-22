import apiClient from '@/lib/api/client';
import type {
  CaseStudy,
  CreateCaseStudyDto,
  UpdateCaseStudyDto,
  CaseStudyFilters,
  PaginatedResponse,
} from '@/types/content';

export interface UploadFileResult {
  id: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  category: 'IMAGE' | 'DOCUMENT' | 'OTHER';
  url: string;
  path: string;
}

const multipartHeaders = { 'Content-Type': 'multipart/form-data' };

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

  async uploadImage(caseStudyId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await apiClient.post<UploadFileResult>(
      `/content/case-studies/${caseStudyId}/upload-image`,
      formData,
      {
        headers: multipartHeaders,
      },
    );
    return data;
  },
};


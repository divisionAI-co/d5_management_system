import { apiClient } from './client';
import type {
  CreateTemplatePayload,
  TemplateFilters,
  TemplateModel,
  TemplatePreviewPayload,
  TemplatePreviewResponse,
  UpdateTemplatePayload,
} from '@/types/templates';

export const templatesApi = {
  list: async (filters: TemplateFilters = {}) => {
    const { data } = await apiClient.get<TemplateModel[]>('/templates', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<TemplateModel>(`/templates/${id}`);
    return data;
  },

  create: async (payload: CreateTemplatePayload) => {
    const { data } = await apiClient.post<TemplateModel>('/templates', payload);
    return data;
  },

  update: async (id: string, payload: UpdateTemplatePayload) => {
    const { data } = await apiClient.patch<TemplateModel>(`/templates/${id}`, payload);
    return data;
  },

  preview: async (id: string, payload: TemplatePreviewPayload = {}) => {
    const { data } = await apiClient.post<TemplatePreviewResponse>(
      `/templates/${id}/preview`,
      payload,
    );
    return data;
  },
};



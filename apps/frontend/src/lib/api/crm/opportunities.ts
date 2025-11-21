import { apiClient } from '../client';
import type {
  CloseOpportunityPayload,
  CreateOpportunityPayload,
  OpportunityDetail,
  OpportunityFilters,
  OpportunitiesListResponse,
  UpdateOpportunityPayload,
} from '@/types/crm';

export const opportunitiesApi = {
  list: async (filters: OpportunityFilters = {}) => {
    const { data } = await apiClient.get<OpportunitiesListResponse>('/crm/opportunities', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<OpportunityDetail>(`/crm/opportunities/${id}`);
    return data;
  },

  create: async (payload: CreateOpportunityPayload) => {
    const { data } = await apiClient.post<OpportunityDetail>('/crm/opportunities', payload);
    return data;
  },

  update: async (id: string, payload: UpdateOpportunityPayload) => {
    const { data } = await apiClient.patch<OpportunityDetail>(`/crm/opportunities/${id}`, payload);
    return data;
  },

  close: async (id: string, payload: CloseOpportunityPayload) => {
    const { data } = await apiClient.post<OpportunityDetail>(`/crm/opportunities/${id}/close`, payload);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete<{ deleted: boolean }>(`/crm/opportunities/${id}`);
    return data;
  },

  sendEmail: async (id: string, payload: {
    to: string;
    subject: string;
    templateId?: string;
    htmlContent?: string;
    textContent?: string;
    cc?: string;
    bcc?: string;
  }) => {
    const { data } = await apiClient.post<{ success: boolean; message: string; to: string; subject: string }>(
      `/crm/opportunities/${id}/send-email`,
      payload,
    );
    return data;
  },

  previewEmail: async (id: string, payload: {
    templateId?: string;
    htmlContent?: string;
    textContent?: string;
  }) => {
    const { data } = await apiClient.post<{ html: string; text: string }>(
      `/crm/opportunities/${id}/preview-email`,
      payload,
    );
    return data;
  },
};



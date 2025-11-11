import { apiClient } from '../client';
import type {
  ConvertLeadPayload,
  CreateLeadPayload,
  Lead,
  LeadFilters,
  LeadsListResponse,
  UpdateLeadPayload,
  UpdateLeadStatusPayload,
  Contact,
} from '@/types/crm';

export const leadsApi = {
  list: async (filters: LeadFilters = {}) => {
    const { data } = await apiClient.get<LeadsListResponse>('/crm/leads', {
      params: filters,
    });
    return data;
  },

  listContacts: async (search?: string) => {
    const { data } = await apiClient.get<Contact[]>('/crm/leads/lookup/contacts', {
      params: search ? { search } : undefined,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<Lead>(`/crm/leads/${id}`);
    return data;
  },

  create: async (payload: CreateLeadPayload) => {
    const { data } = await apiClient.post<Lead>('/crm/leads', payload);
    return data;
  },

  update: async (id: string, payload: UpdateLeadPayload) => {
    const { data } = await apiClient.patch<Lead>(`/crm/leads/${id}`, payload);
    return data;
  },

  updateStatus: async (id: string, payload: UpdateLeadStatusPayload) => {
    const { data } = await apiClient.patch<Lead>(`/crm/leads/${id}/status`, payload);
    return data;
  },

  convert: async (id: string, payload: ConvertLeadPayload) => {
    const { data } = await apiClient.post<Lead>(`/crm/leads/${id}/convert`, payload);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete<{ deleted: boolean }>(`/crm/leads/${id}`);
    return data;
  },
};

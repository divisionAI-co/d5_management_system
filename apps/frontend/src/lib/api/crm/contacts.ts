import { apiClient } from '../client';
import type {
  ContactDetail,
  ContactFilters,
  ContactSummary,
  ContactsListResponse,
  ConvertContactToLeadPayload,
  CreateContactPayload,
  UpdateContactPayload,
} from '@/types/crm';

export const contactsApi = {
  list: async (filters: ContactFilters = {}) => {
    const { data } = await apiClient.get<ContactsListResponse>('/crm/contacts', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<ContactDetail>(`/crm/contacts/${id}`);
    return data;
  },

  create: async (payload: CreateContactPayload) => {
    const { data } = await apiClient.post<ContactSummary>('/crm/contacts', payload);
    return data;
  },

  update: async (id: string, payload: UpdateContactPayload) => {
    const { data } = await apiClient.patch<ContactSummary>(`/crm/contacts/${id}`, payload);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete<{ deleted: boolean }>(`/crm/contacts/${id}`);
    return data;
  },

  convertToLead: async (id: string, payload: ConvertContactToLeadPayload) => {
    const { data } = await apiClient.post(`/crm/contacts/${id}/convert-to-lead`, payload);
    return data;
  },
};

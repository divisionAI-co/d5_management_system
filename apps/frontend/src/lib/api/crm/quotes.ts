import { apiClient } from '../client';
import type {
  CreateQuotePayload,
  Quote,
  QuoteFilters,
  QuotesListResponse,
  SendQuotePayload,
  UpdateQuotePayload,
} from '@/types/crm';

export const quotesApi = {
  list: async (filters: QuoteFilters = {}) => {
    const { data } = await apiClient.get<QuotesListResponse>('/crm/quotes', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<Quote>(`/crm/quotes/${id}`);
    return data;
  },

  create: async (payload: CreateQuotePayload) => {
    const { data } = await apiClient.post<Quote>('/crm/quotes', payload);
    return data;
  },

  update: async (id: string, payload: UpdateQuotePayload) => {
    const { data } = await apiClient.patch<Quote>(`/crm/quotes/${id}`, payload);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete<{ deleted: boolean }>(`/crm/quotes/${id}`);
    return data;
  },

  preview: async (id: string) => {
    const { data } = await apiClient.get<{ html: string }>(`/crm/quotes/${id}/preview`);
    return data;
  },

  generatePdf: async (id: string) => {
    const response = await apiClient.get(`/crm/quotes/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  send: async (id: string, payload: SendQuotePayload) => {
    const { data } = await apiClient.post<Quote>(`/crm/quotes/${id}/send`, payload);
    return data;
  },
};


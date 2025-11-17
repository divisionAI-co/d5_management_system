import { apiClient } from './client';
import type {
  CreateInvoicePayload,
  InvoiceDetail,
  InvoiceFilters,
  InvoicesListResponse,
  MarkInvoicePaidPayload,
  PreviewInvoicePayload,
  PreviewInvoiceResponse,
  SendInvoicePayload,
  UpdateInvoicePayload,
} from '@/types/invoices';

export const invoicesApi = {
  list: async (filters: InvoiceFilters = {}) => {
    const { data } = await apiClient.get<InvoicesListResponse>('/invoices', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<InvoiceDetail>(`/invoices/${id}`);
    return data;
  },

  create: async (payload: CreateInvoicePayload) => {
    const { data } = await apiClient.post<InvoiceDetail>('/invoices', payload);
    return data;
  },

  update: async (id: string, payload: UpdateInvoicePayload) => {
    const { data } = await apiClient.patch<InvoiceDetail>(`/invoices/${id}`, payload);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete<{ deleted: boolean }>(`/invoices/${id}`);
    return data;
  },

  markPaid: async (id: string, payload: MarkInvoicePaidPayload) => {
    const { data } = await apiClient.patch<InvoiceDetail>(
      `/invoices/${id}/mark-paid`,
      payload,
    );
    return data;
  },

  send: async (id: string, payload: SendInvoicePayload) => {
    const { data } = await apiClient.post<InvoiceDetail>(`/invoices/${id}/send`, payload);
    return data;
  },

  preview: async (id: string, payload: PreviewInvoicePayload = {}) => {
    const { data } = await apiClient.post<PreviewInvoiceResponse>(
      `/invoices/${id}/preview`,
      payload,
    );
    return data;
  },

  downloadPdf: async (id: string) => {
    const response = await apiClient.get<Blob>(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },
};



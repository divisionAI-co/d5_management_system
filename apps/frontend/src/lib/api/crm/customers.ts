import { apiClient } from '../client';
import type {
  CustomerDetail,
  CustomerFilters,
  CustomerOpportunity,
  CustomersListResponse,
  CreateCustomerPayload,
  UpdateCustomerPayload,
  UpdateCustomerStatusPayload,
} from '@/types/crm';
import type { Activity } from '@/types/activities';

export const customersApi = {
  list: async (filters: CustomerFilters = {}) => {
    const { data } = await apiClient.get<CustomersListResponse>('/crm/customers', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<CustomerDetail>(`/crm/customers/${id}`);
    return data;
  },

  create: async (payload: CreateCustomerPayload) => {
    const { data } = await apiClient.post<CustomerDetail>('/crm/customers', payload);
    return data;
  },

  update: async (id: string, payload: UpdateCustomerPayload) => {
    const { data } = await apiClient.patch<CustomerDetail>(`/crm/customers/${id}`, payload);
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete<{ deleted: boolean }>(`/crm/customers/${id}`);
    return data;
  },

  updateStatus: async (id: string, payload: UpdateCustomerStatusPayload) => {
    const { data } = await apiClient.patch<CustomerDetail>(`/crm/customers/${id}/status`, payload);
    return data;
  },

  getActivities: async (id: string, take?: number) => {
    const { data } = await apiClient.get<Activity[]>(`/crm/customers/${id}/activities`, {
      params: take ? { take } : undefined,
    });
    return data;
  },

  getOpportunities: async (id: string) => {
    const { data } = await apiClient.get<CustomerOpportunity[]>(`/crm/customers/${id}/opportunities`);
    return data;
  },
};



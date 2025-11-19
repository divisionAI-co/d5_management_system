import { apiClient } from './client';

export interface CrmDataCounts {
  contacts: number;
  leads: number;
  opportunities: number;
  total: number;
}

export interface CleanupResult {
  success: boolean;
  message: string;
  results: {
    opportunities: number;
    leads: number;
    contacts: number;
    errors: string[];
  };
  error?: string;
}

export const dataCleanupApi = {
  // Get counts of CRM data
  getCounts: async (): Promise<CrmDataCounts> => {
    const { data } = await apiClient.get<CrmDataCounts>('/admin/data-cleanup/counts');
    return data;
  },

  // Clean up CRM data
  cleanupCrm: async (): Promise<CleanupResult> => {
    const { data } = await apiClient.post<CleanupResult>('/admin/data-cleanup/crm');
    return data;
  },
};


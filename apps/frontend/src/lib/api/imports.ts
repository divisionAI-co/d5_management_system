import { apiClient } from './client';
import type {
  ContactImportSummary,
  CrmImportType,
  ExecuteImportPayload,
  MapImportPayload,
  UploadImportResult,
} from '@/types/imports';

export const importsApi = {
  upload: async (type: CrmImportType, file: File) => {
    const formData = new FormData();
    formData.append('type', type);
    formData.append('file', file);

    const { data } = await apiClient.post<UploadImportResult>(
      '/imports/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return data;
  },

  uploadContacts: async (file: File) => {
    return importsApi.upload('contacts', file);
  },

  uploadLeads: async (file: File) => {
    return importsApi.upload('leads', file);
  },

  uploadOpportunities: async (file: File) => {
    return importsApi.upload('opportunities', file);
  },

  saveMapping: async (importId: string, payload: MapImportPayload) => {
    const { data } = await apiClient.post(`/imports/${importId}/map`, payload);
    return data;
  },

  executeImport: async (
    importId: string,
    payload: ExecuteImportPayload,
  ) => {
    const { data } = await apiClient.post<ContactImportSummary>(
      `/imports/${importId}/execute`,
      payload,
    );
    return data;
  },
};



import { apiClient } from './client';
import type {
  ContactImportSummary,
  ExecuteImportPayload,
  MapImportPayload,
  UploadContactsResult,
} from '@/types/imports';

export const importsApi = {
  uploadContacts: async (file: File) => {
    const formData = new FormData();
    formData.append('type', 'contacts');
    formData.append('file', file);

    const { data } = await apiClient.post<UploadContactsResult>(
      '/imports/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return data;
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



import { apiClient } from './client';
import type { DriveFile, ListDriveFilesResponse } from '@/types/integrations';

export interface ListFilesParams {
  parentId?: string;
  pageToken?: string;
  pageSize?: number;
  search?: string;
  recursive?: boolean;
}

export const googleDriveApi = {
  async listFiles(params: ListFilesParams = {}) {
    const { data } = await apiClient.get<ListDriveFilesResponse>('/drive/files', {
      params,
    });
    return data;
  },

  async getFile(fileId: string) {
    const { data } = await apiClient.get<DriveFile>(`/drive/files/${fileId}`);
    return data;
  },

  downloadFileUrl(fileId: string) {
    return `${apiClient.defaults.baseURL}/drive/files/${fileId}/content`;
  },

  async downloadFile(fileId: string) {
    const response = await apiClient.get<Blob>(`/drive/files/${fileId}/content`, {
      responseType: 'blob',
    });

    return response.data;
  },

  async uploadFile(file: File, parentId?: string) {
    const formData = new FormData();
    formData.append('file', file);
    if (parentId) {
      formData.append('parentId', parentId);
    }

    const { data } = await apiClient.post<DriveFile>('/drive/files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return data;
  },

  async renameFile(fileId: string, name: string) {
    const { data } = await apiClient.patch<DriveFile>(`/drive/files/${fileId}`, { name });
    return data;
  },

  async deleteFile(fileId: string) {
    await apiClient.delete(`/drive/files/${fileId}`);
  },
};



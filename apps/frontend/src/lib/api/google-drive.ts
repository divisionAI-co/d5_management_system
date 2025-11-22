import { apiClient } from './client';
import type { DriveFile, ListDriveFilesResponse, DrivePermission, UserFilePermissions } from '@/types/integrations';

export interface ListFilesParams {
  parentId?: string;
  pageToken?: string;
  pageSize?: number;
  search?: string;
  recursive?: boolean;
  mimeTypeFilter?: 'image'; // Filter by mime type (e.g., 'image' for images only)
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

  // Permissions
  async getFilePermissions(fileId: string) {
    const { data } = await apiClient.get<DrivePermission[]>(`/drive/files/${fileId}/permissions`);
    return data;
  },

  async getMyPermissions(fileId: string) {
    const { data } = await apiClient.get<UserFilePermissions>(`/drive/files/${fileId}/permissions/me`);
    return data;
  },

  async getUserPermissions(fileId: string, userEmail: string) {
    const { data } = await apiClient.get<UserFilePermissions>(
      `/drive/files/${fileId}/permissions/user`,
      {
        params: { email: userEmail },
      },
    );
    return data;
  },

  async checkPermission(fileId: string, userEmail: string, role: DrivePermission['role']) {
    const { data } = await apiClient.get<boolean>(`/drive/files/${fileId}/permissions/check`, {
      params: { email: userEmail, role },
    });
    return data;
  },

  // OAuth Connection
  async getConnectionStatus() {
    const { data } = await apiClient.get<{
      connected: boolean;
      externalEmail: string | null;
      externalAccountId: string | null;
      expiresAt: string | null;
      scope: string | null;
      lastSyncedAt: string | null;
      connectedAt: string | null;
    }>('/drive/status');
    return data;
  },

  async generateAuthUrl(redirectUri?: string, state?: string) {
    const params: Record<string, string> = {};
    if (redirectUri) params.redirectUri = redirectUri;
    if (state) params.state = state;
    const { data } = await apiClient.get<{ url: string }>('/drive/connect', {
      params: Object.keys(params).length > 0 ? params : undefined,
    });
    return data.url;
  },

  async exchangeCode(code: string, redirectUri?: string) {
    const { data } = await apiClient.post('/drive/connect/callback', {
      code,
      redirectUri,
    });
    return data;
  },

  async disconnect() {
    await apiClient.delete('/drive/disconnect');
  },
};



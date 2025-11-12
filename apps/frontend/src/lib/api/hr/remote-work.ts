import apiClient from '@/lib/api/client';
import type {
  RemoteWorkLog,
  RemoteWorkWindowState,
  SetRemotePreferencesPayload,
  OpenRemoteWindowPayload,
} from '@/types/hr';

export interface RemoteLogFilters {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
}

export interface RemoteLogQuery {
  startDate?: string;
  endDate?: string;
}

export const remoteWorkApi = {
  getWindow: async (): Promise<RemoteWorkWindowState> => {
    const response = await apiClient.get('/hr/remote-work/window');
    return response.data;
  },

  openWindow: async (payload: OpenRemoteWindowPayload): Promise<RemoteWorkWindowState> => {
    const response = await apiClient.patch('/hr/remote-work/window/open', payload);
    return response.data;
  },

  closeWindow: async (): Promise<RemoteWorkWindowState> => {
    const response = await apiClient.patch('/hr/remote-work/window/close', {});
    return response.data;
  },

  setPreferences: async (payload: SetRemotePreferencesPayload): Promise<RemoteWorkLog[]> => {
    const response = await apiClient.post('/hr/remote-work/preferences', payload);
    return response.data;
  },

  listLogs: async (filters: RemoteLogFilters = {}): Promise<RemoteWorkLog[]> => {
    const response = await apiClient.get('/hr/remote-work/logs', { params: filters });
    return response.data;
  },

  listMyLogs: async (filters: RemoteLogQuery = {}): Promise<RemoteWorkLog[]> => {
    const response = await apiClient.get('/hr/remote-work/logs/my', { params: filters });
    return response.data;
  },
};


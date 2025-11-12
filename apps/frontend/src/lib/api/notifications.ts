import { apiClient } from './client';
import type { Notification } from '@/types/notifications';

export const notificationsApi = {
  list: async (params: { limit?: number } = {}) => {
    const { data } = await apiClient.get<Notification[]>('/notifications', {
      params,
    });

    return data;
  },

  markAsRead: async (id: string) => {
    const { data } = await apiClient.patch<Notification>(`/notifications/${id}/read`);
    return data;
  },
};



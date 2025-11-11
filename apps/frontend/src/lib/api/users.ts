import { apiClient } from './client';
import type {
  CreateUserPayload,
  ResetUserPasswordPayload,
  UpdateUserPayload,
  UpdateUserStatusPayload,
  UserDetail,
  UserListFilters,
  UsersListResponse,
  NotificationSettings,
} from '@/types/users';

export const usersApi = {
  list: async (filters: UserListFilters = {}) => {
    const { data } = await apiClient.get<UsersListResponse>('/users', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<UserDetail>(`/users/${id}`);
    return data;
  },

  create: async (payload: CreateUserPayload) => {
    const { data } = await apiClient.post<UserDetail>('/users', payload);
    return data;
  },

  update: async (id: string, payload: UpdateUserPayload) => {
    const { data } = await apiClient.patch<UserDetail>(`/users/${id}`, payload);
    return data;
  },

  remove: async (id: string) => {
    await apiClient.delete(`/users/${id}`);
  },

  updateStatus: async (id: string, payload: UpdateUserStatusPayload) => {
    const { data } = await apiClient.patch<UserDetail>(`/users/${id}/status`, payload);
    return data;
  },

  resetPassword: async (id: string, payload: ResetUserPasswordPayload) => {
    const { data } = await apiClient.patch<UserDetail>(`/users/${id}/reset-password`, payload);
    return data;
  },

  getNotificationSettings: async () => {
    const { data } = await apiClient.get<NotificationSettings>('/users/me/notification-settings');
    return data;
  },

  updateNotificationSettings: async (payload: Partial<NotificationSettings>) => {
    const { data } = await apiClient.patch<NotificationSettings>(
      '/users/me/notification-settings',
      payload,
    );
    return data;
  },
};

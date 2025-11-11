import { apiClient } from './client';
import type {
  CompanySettings,
  IntegrationSettings,
  NotificationSettings,
  UpdateCompanySettingsPayload,
  UpdateIntegrationPayload,
  UpdateNotificationSettingsPayload,
} from '@/types/settings';

export const settingsApi = {
  async getCompanySettings() {
    const { data } = await apiClient.get<CompanySettings>('/settings/company');
    return data;
  },

  async updateCompanySettings(payload: UpdateCompanySettingsPayload) {
    const { data } = await apiClient.patch<CompanySettings>(
      '/settings/company',
      payload,
    );
    return data;
  },

  async getNotificationSettings() {
    const { data } = await apiClient.get<NotificationSettings>(
      '/users/me/notification-settings',
    );
    return data;
  },

  async updateNotificationSettings(
    payload: UpdateNotificationSettingsPayload,
  ) {
    const { data } = await apiClient.patch<NotificationSettings>(
      '/users/me/notification-settings',
      payload,
    );
    return data;
  },

  async getIntegrations() {
    const { data } = await apiClient.get<IntegrationSettings[]>(
      '/settings/integrations',
    );
    return data;
  },

  async updateIntegration(
    name: string,
    payload: UpdateIntegrationPayload,
  ) {
    const { data } = await apiClient.patch<IntegrationSettings>(
      `/settings/integrations/${name}`,
      payload,
    );
    return data;
  },
};



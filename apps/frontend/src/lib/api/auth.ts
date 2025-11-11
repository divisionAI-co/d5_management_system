import apiClient from './client';

export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
}

export const authApi = {
  async generateTwoFactorSecret() {
    const { data } = await apiClient.get<TwoFactorSetupResponse>('/auth/2fa/generate');
    return data;
  },

  async enableTwoFactor(code: string) {
    const { data } = await apiClient.patch<{ message: string }>('/auth/2fa/enable', { code });
    return data;
  },

  async disableTwoFactor(code: string) {
    const { data } = await apiClient.patch<{ message: string }>('/auth/2fa/disable', { code });
    return data;
  },
};



import axios from 'axios';
import { useAuthStore } from '@/lib/stores/auth-store';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Helper function to decode JWT and check expiration
function isTokenExpiringSoon(token: string | null): boolean {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const timeUntilExpiry = exp - now;
    
    // Refresh if token expires in less than 5 minutes (300000 ms)
    return timeUntilExpiry < 5 * 60 * 1000;
  } catch {
    return true; // If we can't parse, assume it's expired
  }
}

// Helper function to refresh token proactively
let refreshPromise: Promise<string | null> | null = null;

async function refreshTokenIfNeeded(): Promise<string | null> {
  // If a refresh is already in progress, wait for it
  if (refreshPromise) {
    return refreshPromise;
  }

  const { accessToken } = useAuthStore.getState();
  
  // Only refresh if token is expiring soon
  if (!isTokenExpiringSoon(accessToken)) {
    return accessToken;
  }

  // Start refresh process
  refreshPromise = (async () => {
    try {
      const response = await axios.post(
        `${API_URL}/auth/refresh`,
        {},
        {
          withCredentials: true,
        }
      );

      const { accessToken: newToken } = response.data;
      const user = useAuthStore.getState().user;

      if (user && newToken) {
        useAuthStore.getState().setAuth(user, newToken);
      }

      return newToken;
    } catch (error) {
      // If refresh fails, don't logout immediately - let the 401 handler deal with it
      // This prevents logout on transient network errors
      if (import.meta.env.DEV) {
        console.error('Token refresh failed:', error);
      }
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Allow backend to set/read HttpOnly cookies for refresh tokens
  withCredentials: true,
});

// Request interceptor to add auth token and refresh if needed
apiClient.interceptors.request.use(
  async (config) => {
    // Proactively refresh token if it's expiring soon
    const refreshedToken = await refreshTokenIfNeeded();
    const token = refreshedToken || useAuthStore.getState().accessToken;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for token refresh on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh token is sent via HttpOnly cookie; no body payload needed
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
          }
        );

        const { accessToken } = response.data;
        const user = useAuthStore.getState().user;

        if (user && accessToken) {
          useAuthStore.getState().setAuth(user, accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError: any) {
        // Only logout if refresh explicitly fails (401/403), not on network errors
        if (refreshError.response?.status === 401 || refreshError.response?.status === 403) {
          useAuthStore.getState().clearAuth();
          window.location.href = '/auth/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;


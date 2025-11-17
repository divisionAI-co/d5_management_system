import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';
import { useAuthStore } from './lib/stores/auth-store';
import apiClient from './lib/api/client';

// Validate token on app load and refresh if needed
async function validateAndRefreshToken() {
  const { accessToken, user, isAuthenticated } = useAuthStore.getState();
  
  // Only validate if user is authenticated
  if (!isAuthenticated || !accessToken || !user) {
    return;
  }

  try {
    // Try to get current user profile - this will trigger token refresh if needed
    await apiClient.get('/auth/me');
  } catch (error: any) {
    // If validation fails with 401/403, clear auth (refresh token is invalid)
    if (error.response?.status === 401 || error.response?.status === 403) {
      useAuthStore.getState().clearAuth();
    }
    // Other errors (network, etc.) are ignored - user can still use the app
  }
}

// Validate token on app startup
validateAndRefreshToken();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  </React.StrictMode>,
);


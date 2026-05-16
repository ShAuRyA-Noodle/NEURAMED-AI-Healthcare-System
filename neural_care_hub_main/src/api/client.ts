import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
  // Send httpOnly cookies automatically on every request (same-origin + credentialed)
  withCredentials: true,
});

// Inject Bearer token only as fallback for environments where cookies aren't sent
// (e.g., cross-origin dev without a proxy). Token lives in sessionStorage, not
// localStorage — cleared on tab close, inaccessible across tabs, still JS-readable
// but narrower attack window than localStorage. Full httpOnly-only mode works when
// frontend and backend share an origin or are proxied via the same domain.
client.interceptors.request.use(config => {
  const token = sessionStorage.getItem('neuramed_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 — clear session storage and redirect to login
client.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      const isAuthCheck = error.config?.url?.includes('/api/auth/me');
      const isRefresh = error.config?.url?.includes('/api/auth/refresh');

      if (!isAuthCheck && !isRefresh) {
        // Attempt silent token refresh before giving up
        try {
          await axios.post(
            `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/auth/refresh`,
            {},
            { withCredentials: true },
          );
          // Retry original request with refreshed cookie
          return client(error.config);
        } catch {
          // Refresh failed — clear storage and redirect
          sessionStorage.removeItem('neuramed_token');
          sessionStorage.removeItem('neuramed_user');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
        }
      } else {
        sessionStorage.removeItem('neuramed_token');
        sessionStorage.removeItem('neuramed_user');
      }
    }

    if (!error.response) {
      throw new Error('Backend offline');
    }
    const detail = error.response.data?.detail;
    throw new Error(detail || 'Request failed');
  },
);

export default client;

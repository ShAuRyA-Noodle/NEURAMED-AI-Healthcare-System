import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
});

// Inject JWT token on every request
client.interceptors.request.use(config => {
  const token = localStorage.getItem('neuramed_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (import.meta.env.DEV) {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

// Handle errors + 401 redirect
client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('neuramed_token');
      localStorage.removeItem('neuramed_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    if (!error.response) {
      throw new Error('Backend offline');
    }
    const detail = error.response.data?.detail;
    throw new Error(detail || 'Request failed');
  }
);

export default client;

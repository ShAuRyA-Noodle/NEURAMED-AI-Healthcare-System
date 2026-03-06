import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  timeout: 30000,
});

client.interceptors.request.use(config => {
  if (import.meta.env.DEV) {
    console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`);
  }
  return config;
});

client.interceptors.response.use(
  response => response,
  error => {
    if (!error.response) {
      throw new Error('Backend offline');
    }
    const detail = error.response.data?.detail;
    throw new Error(detail || 'Request failed');
  }
);

export default client;

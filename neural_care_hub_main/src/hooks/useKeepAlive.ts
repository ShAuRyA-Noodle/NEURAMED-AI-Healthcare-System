import { useEffect } from 'react';

const PING_INTERVAL_MS = 12 * 60 * 1000; // 12 minutes

export const useKeepAlive = () => {
  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

    const ping = async () => {
      try {
        await fetch(`${baseUrl}/health`, { method: 'GET', mode: 'cors' });
      } catch {
        // Silently ignore - backend may be waking up
      }
    };

    ping();
    const interval = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);
};

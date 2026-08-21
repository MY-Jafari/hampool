import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/features/auth/store';

export const API_BASE: string = import.meta.env.VITE_API_BASE_URL ?? '/api/v1/';

export const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().access;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };

let refreshPromise: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const refresh = useAuthStore.getState().refresh;
  if (!refresh) return null;
  try {
    // Direct axios call — bypasses interceptors to avoid recursion.
    const { data } = await axios.post<{ access: string; refresh?: string }>(
      `${API_BASE}accounts/token/refresh/`,
      { refresh },
    );
    const newRefresh = data.refresh ?? refresh; // ROTATE_REFRESH_TOKENS gives a new one
    useAuthStore.getState().setTokens(data.access, newRefresh);
    return data.access;
  } catch {
    useAuthStore.getState().clear();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? '';
    const isAuthCall =
      url.includes('login') || url.includes('register') || url.includes('refresh') || url.includes('verify-otp');

    if (error.response?.status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      refreshPromise ??= tryRefresh();
      try {
        const token = await refreshPromise;
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }
      } finally {
        refreshPromise = null;
      }
    }
    return Promise.reject(error);
  },
);

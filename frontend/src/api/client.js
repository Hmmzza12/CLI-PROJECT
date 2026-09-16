import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

// Same-origin in dev thanks to the Vite proxy; withCredentials sends the
// httpOnly refresh cookie on /auth/refresh.
export const api = axios.create({ baseURL: '/api/v1', withCredentials: true });

// Attach the in-memory access token to every request.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Endpoints that must NOT trigger a refresh-retry on 401.
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

let refreshing = null;

/** Deduplicated silent refresh using the httpOnly cookie. */
function doRefresh() {
  if (!refreshing) {
    refreshing = axios
      .post('/api/v1/auth/refresh', {}, { withCredentials: true })
      .then((res) => {
        const { accessToken, user } = res.data;
        useAuthStore.getState().setAuth({ accessToken, user });
        return accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const skip = original?._retry || NO_REFRESH.some((p) => original?.url?.includes(p));

    if (status === 401 && !skip) {
      original._retry = true;
      try {
        const token = await doRefresh();
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original); // retry once
      } catch {
        // Second failure → session is gone.
        useAuthStore.getState().clearAuth();
        if (window.location.pathname !== '/login') {
          window.location.assign('/login');
        }
      }
    }
    return Promise.reject(error);
  },
);

/** Attempt to restore a session on app start (silent refresh via cookie). */
export async function bootstrapAuth() {
  try {
    await doRefresh();
  } catch {
    // No valid refresh cookie — user starts logged out.
  }
}

/** Normalize an axios error into a friendly message. */
export function apiErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.error?.message ?? error?.message ?? fallback;
}

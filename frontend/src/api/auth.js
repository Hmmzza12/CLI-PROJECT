import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuthStore } from '@/stores/auth';

export function useLogin() {
  return useMutation({
    mutationFn: (credentials) => api.post('/auth/login', credentials).then((r) => r.data),
    onSuccess: (data) => useAuthStore.getState().setAuth(data),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload) => api.post('/auth/register', payload).then((r) => r.data),
    onSuccess: (data) => useAuthStore.getState().setAuth(data),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout', {}).then((r) => r.data),
    onSettled: () => {
      useAuthStore.getState().clearAuth();
      qc.clear();
    },
  });
}

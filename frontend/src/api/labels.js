import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useLabels(projectId) {
  return useQuery({
    queryKey: ['labels', projectId],
    queryFn: () => api.get(`/projects/${projectId}/labels`).then((r) => r.data),
    enabled: Boolean(projectId),
  });
}

export function useCreateLabel(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post(`/projects/${projectId}/labels`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels', projectId] }),
  });
}

export function useDeleteLabel(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (labelId) => api.delete(`/labels/${labelId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['labels', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

export function useAttachLabel(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, labelId }) =>
      api.post(`/tasks/${taskId}/labels/${labelId}`).then((r) => r.data),
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

export function useDetachLabel(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, labelId }) =>
      api.delete(`/tasks/${taskId}/labels/${labelId}`).then((r) => r.data),
    onSuccess: (_data, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['task', taskId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });
}

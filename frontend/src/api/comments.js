import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useComments(taskId, params = {}) {
  return useQuery({
    queryKey: ['comments', taskId, params],
    queryFn: () => api.get(`/tasks/${taskId}/comments`, { params }).then((r) => r.data),
    enabled: Boolean(taskId),
  });
}

export function useAddComment(taskId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post(`/tasks/${taskId}/comments`, { body }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
}

export function useDeleteComment(taskId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (commentId) => api.delete(`/comments/${commentId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', taskId] }),
  });
}

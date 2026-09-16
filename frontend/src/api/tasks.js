import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

/** Strip empty/undefined filter values so we don't send blank query params. */
function cleanParams(params = {}) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

export function useTasks(projectId, filters = {}) {
  const params = cleanParams(filters);
  return useQuery({
    queryKey: ['tasks', projectId, params],
    queryFn: () => api.get(`/projects/${projectId}/tasks`, { params }).then((r) => r.data),
    enabled: Boolean(projectId),
  });
}

export function useTask(taskId) {
  return useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get(`/tasks/${taskId}`).then((r) => r.data),
    enabled: Boolean(taskId),
  });
}

export function useCreateTask(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post(`/projects/${projectId}/tasks`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });
}

/**
 * Update a task with an optimistic cache write so drag-and-drop and inline
 * edits feel instant. Rolls back on error; reconciles on settle.
 */
export function useUpdateTask(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, patch }) => api.patch(`/tasks/${taskId}`, patch).then((r) => r.data),
    onMutate: async ({ taskId, patch }) => {
      await qc.cancelQueries({ queryKey: ['tasks', projectId] });
      await qc.cancelQueries({ queryKey: ['task', taskId] });

      const previousLists = qc.getQueriesData({ queryKey: ['tasks', projectId] });
      const previousTask = qc.getQueryData(['task', taskId]);

      qc.setQueriesData({ queryKey: ['tasks', projectId] }, (old) => {
        if (!old?.data) return old;
        return { ...old, data: old.data.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) };
      });
      qc.setQueryData(['task', taskId], (old) => (old ? { ...old, ...patch } : old));

      return { previousLists, previousTask, taskId };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previousLists?.forEach(([key, data]) => qc.setQueryData(key, data));
      if (ctx?.previousTask) qc.setQueryData(['task', ctx.taskId], ctx.previousTask);
    },
    onSettled: (_data, _err, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });
}

export function useDeleteTask(projectId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (taskId) => api.delete(`/tasks/${taskId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });
}

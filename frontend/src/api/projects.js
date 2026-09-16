import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useProjects(orgId) {
  return useQuery({
    queryKey: ['projects', orgId],
    queryFn: () => api.get(`/orgs/${orgId}/projects`).then((r) => r.data),
    enabled: Boolean(orgId),
  });
}

export function useProject(projectId) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then((r) => r.data),
    enabled: Boolean(projectId),
  });
}

export function useCreateProject(orgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post(`/orgs/${orgId}/projects`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', orgId] }),
  });
}

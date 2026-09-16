import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';

export function useOrgs() {
  return useQuery({
    queryKey: ['orgs'],
    queryFn: () => api.get('/orgs').then((r) => r.data),
  });
}

/** Derive a single org from the list (the API has no GET /orgs/:id). */
export function useOrg(orgId) {
  const orgs = useOrgs();
  return { ...orgs, data: orgs.data?.find((o) => o.id === orgId) };
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/orgs', payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orgs'] }),
  });
}

export function useMembers(orgId, params = {}) {
  return useQuery({
    queryKey: ['members', orgId, params],
    queryFn: () => api.get(`/orgs/${orgId}/members`, { params }).then((r) => r.data),
    enabled: Boolean(orgId),
  });
}

export function useInviteMember(orgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (email) => api.post(`/orgs/${orgId}/members`, { email }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', orgId] }),
  });
}

export function useChangeRole(orgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }) =>
      api.patch(`/orgs/${orgId}/members/${userId}`, { role }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', orgId] }),
  });
}

export function useRemoveMember(orgId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId) => api.delete(`/orgs/${orgId}/members/${userId}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['members', orgId] }),
  });
}

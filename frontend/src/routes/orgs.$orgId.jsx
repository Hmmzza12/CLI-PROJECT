import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/lib/guards';
import { OrgPage } from '@/pages/OrgPage';

export const Route = createFileRoute('/orgs/$orgId')({
  beforeLoad: requireAuth,
  component: OrgPage,
});

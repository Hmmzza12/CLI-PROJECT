import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/lib/guards';
import { DashboardPage } from '@/pages/DashboardPage';

export const Route = createFileRoute('/')({
  beforeLoad: requireAuth,
  component: DashboardPage,
});

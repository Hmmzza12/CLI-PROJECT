import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '@/lib/guards';
import { ProjectPage } from '@/pages/ProjectPage';

export const Route = createFileRoute('/projects/$projectId')({
  beforeLoad: requireAuth,
  component: ProjectPage,
});

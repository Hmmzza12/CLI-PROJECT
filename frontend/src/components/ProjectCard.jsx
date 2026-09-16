import { Link } from '@tanstack/react-router';
import { FolderKanban } from 'lucide-react';
import { useTasks } from '@/api/tasks';
import { formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export function ProjectCard({ project }) {
  const tasks = useTasks(project.id, { limit: 1 });
  const count = tasks.data?.meta?.total;

  return (
    <Link to="/projects/$projectId" params={{ projectId: project.id }}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
              <FolderKanban className="h-5 w-5" />
            </span>
            <CardTitle className="text-base">{project.name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{count == null ? '…' : `${count} task${count === 1 ? '' : 's'}`}</span>
            <span>{formatDate(project.createdAt)}</span>
          </div>
          {project.description && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

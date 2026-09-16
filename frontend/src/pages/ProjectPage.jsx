import { useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, LayoutGrid, List, Plus, Settings, Search, X, ListTodo } from 'lucide-react';
import { useProject } from '@/api/projects';
import { useMembers } from '@/api/orgs';
import { useLabels } from '@/api/labels';
import { useTasks } from '@/api/tasks';
import { STATUSES, PRIORITIES, STATUS_LABELS } from '@/lib/constants';
import { AppLayout } from '@/components/AppLayout';
import { EmptyState } from '@/components/EmptyState';
import { KanbanSkeleton, TableSkeleton } from '@/components/Skeletons';
import { KanbanBoard } from '@/components/KanbanBoard';
import { TaskListView } from '@/components/TaskListView';
import { CreateTaskDialog } from '@/components/CreateTaskDialog';
import { LabelManagerDialog } from '@/components/LabelManagerDialog';
import { TaskSlideOver } from '@/components/TaskSlideOver';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const ALL = '__all__';
const clean = (v) => (v && v !== ALL ? v : undefined);

export function ProjectPage() {
  const { projectId } = useParams({ from: '/projects/$projectId' });
  const project = useProject(projectId);
  const members = useMembers(project.data?.orgId, { limit: 100 });
  const labels = useLabels(projectId);

  const [view, setView] = useState('kanban');
  const [filters, setFilters] = useState({ status: ALL, priority: ALL, assignee: ALL, label: ALL, search: '' });
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);

  const query = {
    status: clean(filters.status),
    priority: clean(filters.priority),
    assignee: clean(filters.assignee),
    label: clean(filters.label),
    search: filters.search || undefined,
    limit: 100,
  };
  const tasks = useTasks(projectId, query);
  const rows = tasks.data?.data ?? [];

  const memberList = members.data?.data ?? [];
  const labelList = labels.data ?? [];
  const hasFilters =
    clean(filters.status) ||
    clean(filters.priority) ||
    clean(filters.assignee) ||
    clean(filters.label) ||
    filters.search;

  const set = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () =>
    setFilters({ status: ALL, priority: ALL, assignee: ALL, label: ALL, search: '' });

  return (
    <AppLayout>
      {project.data?.orgId && (
        <Link
          to="/orgs/$orgId"
          params={{ orgId: project.data.orgId }}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to organization
        </Link>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{project.data?.name ?? 'Project'}</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            <Button
              variant={view === 'kanban' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setView('kanban')}
            >
              <LayoutGrid className="h-4 w-4" /> Board
            </Button>
            <Button
              variant={view === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7"
              onClick={() => setView('list')}
            >
              <List className="h-4 w-4" /> List
            </Button>
          </div>
          <Button variant="outline" size="icon" onClick={() => setLabelsOpen(true)} title="Labels">
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => set('search')(e.target.value)}
            placeholder="Search…"
            className="h-9 w-44 pl-8"
          />
        </div>
        <FilterSelect value={filters.status} onChange={set('status')} placeholder="Status" width="w-32">
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={filters.priority} onChange={set('priority')} placeholder="Priority" width="w-32">
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={filters.assignee} onChange={set('assignee')} placeholder="Assignee" width="w-36">
          <SelectItem value="me">Me</SelectItem>
          {memberList.map((m) => (
            <SelectItem key={m.userId} value={m.userId}>
              {m.name}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect value={filters.label} onChange={set('label')} placeholder="Label" width="w-32">
          {labelList.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name}
            </SelectItem>
          ))}
        </FilterSelect>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {/* Views */}
      {tasks.isLoading ? (
        view === 'kanban' ? (
          <KanbanSkeleton />
        ) : (
          <TableSkeleton />
        )
      ) : rows.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={Search} title="No matching tasks" description="Try adjusting or clearing your filters." />
        ) : (
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description="Create your first task to get things moving."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New task
              </Button>
            }
          />
        )
      ) : view === 'kanban' ? (
        <KanbanBoard projectId={projectId} tasks={rows} onOpen={setSelectedTaskId} />
      ) : (
        <TaskListView tasks={rows} onOpen={setSelectedTaskId} />
      )}

      <CreateTaskDialog
        projectId={projectId}
        members={memberList}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
      <LabelManagerDialog projectId={projectId} open={labelsOpen} onOpenChange={setLabelsOpen} />
      <TaskSlideOver
        projectId={projectId}
        taskId={selectedTaskId}
        members={memberList}
        open={Boolean(selectedTaskId)}
        onOpenChange={(o) => !o && setSelectedTaskId(null)}
      />
    </AppLayout>
  );
}

function FilterSelect({ value, onChange, placeholder, width, children }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-9 ${width}`}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {placeholder.toLowerCase()}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}

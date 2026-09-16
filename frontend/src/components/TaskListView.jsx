import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { StatusBadge, PriorityBadge, LabelChip } from '@/components/Badges';
import { formatDate, cn } from '@/lib/utils';

const PRIORITY_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
const STATUS_ORDER = { TODO: 0, IN_PROGRESS: 1, IN_REVIEW: 2, DONE: 3 };

export function TaskListView({ tasks, onOpen }) {
  const [sort, setSort] = useState({ key: 'created', dir: 'desc' });

  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));

  const sorted = [...tasks].sort((a, b) => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    switch (sort.key) {
      case 'title':
        return a.title.localeCompare(b.title) * dir;
      case 'status':
        return (STATUS_ORDER[a.status] - STATUS_ORDER[b.status]) * dir;
      case 'priority':
        return (PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]) * dir;
      case 'assignee':
        return (a.assignee?.name ?? '').localeCompare(b.assignee?.name ?? '') * dir;
      case 'due': {
        const av = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bv = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return (av - bv) * dir;
      }
      default:
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    }
  });

  const SortHeader = ({ k, children, className }) => (
    <th className={cn('px-3 py-2 font-medium', className)}>
      <button
        type="button"
        onClick={() => toggle(k)}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {children}
        {sort.key === k &&
          (sort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-muted-foreground">
          <tr>
            <SortHeader k="title">Title</SortHeader>
            <SortHeader k="status">Status</SortHeader>
            <SortHeader k="priority">Priority</SortHeader>
            <SortHeader k="assignee" className="hidden md:table-cell">
              Assignee
            </SortHeader>
            <th className="hidden px-3 py-2 font-medium lg:table-cell">Labels</th>
            <SortHeader k="due" className="hidden sm:table-cell">
              Due
            </SortHeader>
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr
              key={t.id}
              onClick={() => onOpen(t.id)}
              className="cursor-pointer border-t hover:bg-muted/40"
            >
              <td className="px-3 py-2 font-medium">{t.title}</td>
              <td className="px-3 py-2">
                <StatusBadge status={t.status} />
              </td>
              <td className="px-3 py-2">
                <PriorityBadge priority={t.priority} />
              </td>
              <td className="hidden px-3 py-2 text-muted-foreground md:table-cell">
                {t.assignee?.name ?? '—'}
              </td>
              <td className="hidden px-3 py-2 lg:table-cell">
                <div className="flex flex-wrap gap-1">
                  {t.labels?.map((l) => (
                    <LabelChip key={l.id} label={l} />
                  ))}
                </div>
              </td>
              <td className="hidden px-3 py-2 text-muted-foreground sm:table-cell">
                {formatDate(t.dueDate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

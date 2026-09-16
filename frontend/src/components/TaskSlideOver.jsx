import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Send } from 'lucide-react';
import { useTask, useUpdateTask, useDeleteTask } from '@/api/tasks';
import { useLabels, useAttachLabel, useDetachLabel } from '@/api/labels';
import { useComments, useAddComment, useDeleteComment } from '@/api/comments';
import { apiErrorMessage } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { STATUSES, PRIORITIES, STATUS_LABELS } from '@/lib/constants';
import { formatDate, initials } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { LabelChip } from '@/components/Badges';

const NONE = '__none__';
const Field = ({ children, label }) => (
  <div className="space-y-1.5">
    <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
    {children}
  </div>
);

function CommentThread({ taskId, members }) {
  const comments = useComments(taskId);
  const addComment = useAddComment(taskId);
  const deleteComment = useDeleteComment(taskId);
  const [body, setBody] = useState('');
  const currentUserId = useAuthStore((s) => s.user?.id);
  const currentRole = members.find((m) => m.userId === currentUserId)?.role;
  const canModerate = currentRole === 'OWNER' || currentRole === 'ADMIN';

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await addComment.mutateAsync(body.trim());
      setBody('');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const rows = comments.data?.data ?? [];

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Comments</h3>

      <form onSubmit={submit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a comment…"
          className="min-h-[60px]"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={addComment.isPending || !body.trim()}>
            <Send className="h-3.5 w-3.5" /> Comment
          </Button>
        </div>
      </form>

      {comments.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : rows.length ? (
        <ul className="space-y-3">
          {rows.map((c) => (
            <li key={c.id} className="rounded-md border p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
                    {initials(c.author?.name)}
                  </span>
                  {c.author?.name}
                  <span className="font-normal text-muted-foreground">· {formatDate(c.createdAt)}</span>
                </span>
                {(c.author?.id === currentUserId || canModerate) && (
                  <button
                    type="button"
                    onClick={() =>
                      deleteComment
                        .mutateAsync(c.id)
                        .catch((err) => toast.error(apiErrorMessage(err)))
                    }
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      )}
    </div>
  );
}

function TaskDetail({ projectId, taskId, members, onClose }) {
  const task = useTask(taskId);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);
  const labels = useLabels(projectId);
  const attachLabel = useAttachLabel(projectId);
  const detachLabel = useDetachLabel(projectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [seeded, setSeeded] = useState(false);

  if (task.data && !seeded) {
    setTitle(task.data.title);
    setDescription(task.data.description ?? '');
    setSeeded(true);
  }

  const save = (patch) =>
    updateTask.mutate(
      { taskId, patch },
      { onError: (err) => toast.error(apiErrorMessage(err)) },
    );

  if (task.isLoading || !task.data) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  const t = task.data;
  const attachedIds = new Set((t.labels ?? []).map((l) => l.id));
  const available = (labels.data ?? []).filter((l) => !attachedIds.has(l.id));

  return (
    <>
      <SheetHeader>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== t.title && save({ title: title.trim() })}
          className="border-0 px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
        />
        <SheetDescription>Task detail</SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <Select value={t.status} onValueChange={(v) => save({ status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Priority">
            <Select value={t.priority} onValueChange={(v) => save({ priority: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Assignee">
            <Select
              value={t.assignee?.id ?? NONE}
              onValueChange={(v) => save({ assigneeId: v === NONE ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Due date">
            <Input
              type="date"
              value={t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : ''}
              onChange={(e) => save({ dueDate: e.target.value || null })}
            />
          </Field>
        </div>

        <Field label="Labels">
          <div className="flex flex-wrap items-center gap-2">
            {(t.labels ?? []).map((l) => (
              <LabelChip
                key={l.id}
                label={l}
                onRemove={() =>
                  detachLabel
                    .mutateAsync({ taskId, labelId: l.id })
                    .catch((err) => toast.error(apiErrorMessage(err)))
                }
              />
            ))}
            {available.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs">
                    <Plus className="h-3 w-3" /> Label
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {available.map((l) => (
                    <DropdownMenuItem
                      key={l.id}
                      onClick={() =>
                        attachLabel
                          .mutateAsync({ taskId, labelId: l.id })
                          .catch((err) => toast.error(apiErrorMessage(err)))
                      }
                    >
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: l.color }}
                      />
                      {l.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {(t.labels ?? []).length === 0 && available.length === 0 && (
              <span className="text-sm text-muted-foreground">No labels in this project yet.</span>
            )}
          </div>
        </Field>

        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (t.description ?? '') && save({ description: description || null })}
            placeholder="Add a description…"
            className="min-h-[100px]"
          />
        </Field>

        <div className="border-t pt-4">
          <CommentThread taskId={taskId} members={members} />
        </div>

        <div className="border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() =>
              deleteTask
                .mutateAsync(taskId)
                .then(() => {
                  toast.success('Task deleted');
                  onClose?.();
                })
                .catch((err) => toast.error(apiErrorMessage(err)))
            }
          >
            <Trash2 className="h-4 w-4" /> Delete task
          </Button>
        </div>
      </div>
    </>
  );
}

export function TaskSlideOver({ projectId, taskId, members, open, onOpenChange }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        {taskId && (
          <TaskDetail
            key={taskId}
            projectId={projectId}
            taskId={taskId}
            members={members}
            onClose={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

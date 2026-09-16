import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { STATUSES, STATUS_LABELS } from '@/lib/constants';
import { useUpdateTask } from '@/api/tasks';
import { apiErrorMessage } from '@/api/client';
import { TaskCard } from '@/components/TaskCard';
import { cn } from '@/lib/utils';

function Column({ status, tasks, onOpen }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-3 rounded-lg bg-muted/40 p-3 transition-colors lg:w-auto',
        isOver && 'bg-muted ring-2 ring-ring',
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="flex min-h-[3rem] flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} onOpen={onOpen} />
        ))}
        {tasks.length === 0 && (
          <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
            Drop tasks here
          </p>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({ projectId, tasks, onOpen }) {
  const updateTask = useUpdateTask(projectId);
  const [activeTask, setActiveTask] = useState(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (event) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id;
    const task = active.data.current?.task;
    if (task && STATUSES.includes(newStatus) && task.status !== newStatus) {
      updateTask.mutate(
        { taskId: task.id, patch: { status: newStatus } },
        { onError: (err) => toast.error(apiErrorMessage(err)) },
      );
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={(e) => setActiveTask(e.active.data.current?.task ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-4 lg:overflow-visible">
        {STATUSES.map((s) => (
          <Column key={s} status={s} tasks={tasks.filter((t) => t.status === s)} onOpen={onOpen} />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCard task={activeTask} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

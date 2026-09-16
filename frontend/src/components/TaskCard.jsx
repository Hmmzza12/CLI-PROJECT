import { useDraggable } from '@dnd-kit/core';
import { cn, initials } from '@/lib/utils';
import { PriorityBadge, LabelChip } from '@/components/Badges';

/**
 * A kanban task card. The whole card is draggable (via a pointer sensor with a
 * small activation distance, so a plain click still opens the detail panel).
 */
export function TaskCard({ task, onOpen, overlay = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(task.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onOpen?.(task.id);
      }}
      className={cn(
        'cursor-grab touch-none rounded-lg border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring active:cursor-grabbing',
        isDragging && !overlay && 'opacity-40',
        overlay && 'shadow-xl',
      )}
    >
      <p className="text-sm font-medium leading-snug">{task.title}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PriorityBadge priority={task.priority} />
        {task.labels?.map((l) => (
          <LabelChip key={l.id} label={l} />
        ))}
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        {task.assignee ? (
          <span className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium">
              {initials(task.assignee.name)}
            </span>
            {task.assignee.name}
          </span>
        ) : (
          <span>Unassigned</span>
        )}
      </div>
    </div>
  );
}

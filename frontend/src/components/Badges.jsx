import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_STYLES, PRIORITY_STYLES, ROLE_STYLES } from '@/lib/constants';

function Pill({ className, children }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }) {
  return <Pill className={STATUS_STYLES[status]}>{STATUS_LABELS[status] ?? status}</Pill>;
}

export function PriorityBadge({ priority }) {
  return <Pill className={PRIORITY_STYLES[priority]}>{priority}</Pill>;
}

export function RoleBadge({ role }) {
  return <Pill className={ROLE_STYLES[role]}>{role}</Pill>;
}

/** Colored chip for a label, using its stored hex color. */
export function LabelChip({ label, onRemove }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${label.color}22`,
        color: label.color,
        border: `1px solid ${label.color}55`,
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: label.color }}
      />
      {label.name}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 opacity-60 hover:opacity-100"
          aria-label={`Remove ${label.name}`}
        >
          ×
        </button>
      )}
    </span>
  );
}

import { useMemo, useState } from 'react';
import { Calendar, ChevronDown, ClipboardList, Clock, Edit2, PenSquare, Trash2, User } from 'lucide-react';
import type { Task, TaskPriority, TaskStatus } from '@/types/tasks';

const PRIORITY_STYLES: Record<
  TaskPriority,
  { bg: string; text: string; label: string }
> = {
  LOW: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Low' },
  MEDIUM: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Medium' },
  HIGH: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'High' },
  URGENT: { bg: 'bg-red-100', text: 'text-red-700', label: 'Urgent' },
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onDelete?: (task: Task) => void;
  statusOptions: TaskStatus[];
  disableStatusChange?: boolean;
  onAddToEod?: (task: Task) => void;
  disableAddToEod?: boolean;
  onOpenActivity?: (task: Task) => void;
}

export function TaskCard({
  task,
  onEdit,
  onStatusChange,
  onDelete,
  statusOptions,
  disableStatusChange,
  onAddToEod,
  disableAddToEod,
  onOpenActivity,
}: TaskCardProps) {
  const priorityVariant = PRIORITY_STYLES[task.priority];

  const dueDateInfo = useMemo(() => {
    if (!task.dueDate) {
      return null;
    }
    const dueDate = new Date(task.dueDate);
    const now = new Date();
    const isPastDue = dueDate < now && task.status !== 'DONE';
    const formatted = dueDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });

    return {
      formatted,
      isPastDue,
    };
  }, [task.dueDate, task.status]);

  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded((prev) => !prev);
  };

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-card p-4 shadow-sm transition hover:shadow-md"
      role="button"
      tabIndex={0}
      onClick={toggleExpanded}
      onKeyDown={handleCardKeyDown}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${priorityVariant.bg} ${priorityVariant.text}`}
            >
              {priorityVariant.label}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {STATUS_LABELS[task.status]}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-foreground">
            {task.title}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          {onOpenActivity && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onOpenActivity(task);
              }}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-blue-600"
              aria-label="View task activities"
            >
              <PenSquare className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded();
            }}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted"
            aria-label={isExpanded ? 'Collapse task details' : 'Expand task details'}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {!isExpanded && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {task.assignedTo && (
            <span className="inline-flex items-center gap-1">
              <User className="h-4 w-4" />
              {task.assignedTo.firstName} {task.assignedTo.lastName}
            </span>
          )}
          {dueDateInfo && (
            <span
              className={`inline-flex items-center gap-1 ${
                dueDateInfo.isPastDue ? 'font-semibold text-red-600' : ''
              }`}
            >
              <Calendar className="h-4 w-4" />
              Due {dueDateInfo.formatted}
            </span>
          )}
          {task.tags && task.tags.length > 0 && (
            <span className="inline-flex items-center gap-1 uppercase tracking-wide text-muted-foreground">
              Tags: {(task.tags ?? []).slice(0, 2).join(', ')}
              {task.tags.length > 2 ? ` +${task.tags.length - 2}` : ''}
            </span>
          )}
        </div>
      )}

      {isExpanded && (
        <div className="space-y-4">
          {task.description && (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-none">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {task.assignedTo && (
              <span className="inline-flex items-center gap-1">
                <User className="h-4 w-4" />
                {task.assignedTo.firstName} {task.assignedTo.lastName}
              </span>
            )}
            {dueDateInfo && (
              <span
                className={`inline-flex items-center gap-1 ${
                  dueDateInfo.isPastDue ? 'font-semibold text-red-600' : ''
                }`}
              >
                <Calendar className="h-4 w-4" />
                Due {dueDateInfo.formatted}
              </span>
            )}
            {task.estimatedHours !== undefined &&
              task.estimatedHours !== null &&
              task.estimatedHours > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  Est. {task.estimatedHours}h
                </span>
              )}
            {task.actualHours !== undefined &&
              task.actualHours !== null &&
              task.actualHours > 0 && (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  Logged {task.actualHours}h
                </span>
              )}
          </div>

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center rounded-full bg-muted/70 px-2 py-1 text-xs font-medium text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              onClick={(event) => {
                event.stopPropagation();
                onEdit(task);
              }}
              className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-blue-600"
              aria-label="Edit task"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            {onAddToEod && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onAddToEod(task);
                }}
                disabled={disableAddToEod}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Add task to EOD report"
              >
                <ClipboardList className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(task);
                }}
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-red-600"
                aria-label="Delete task"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Update Status
            </label>
            <select
              onClick={(event) => event.stopPropagation()}
              value={task.status}
              onChange={(event) =>
                onStatusChange(task, event.target.value as TaskStatus)
              }
              disabled={disableStatusChange}
              className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}



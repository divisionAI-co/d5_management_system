import { useMemo } from 'react';
import { Calendar, Clock, Edit2, Trash2, User } from 'lucide-react';
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
}

export function TaskCard({
  task,
  onEdit,
  onStatusChange,
  onDelete,
  statusOptions,
  disableStatusChange,
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${priorityVariant.bg} ${priorityVariant.text}`}
            >
              {priorityVariant.label}
            </span>
            <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {STATUS_LABELS[task.status]}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-gray-900">
            {task.title}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(task)}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-blue-600"
            aria-label="Edit task"
          >
            <Edit2 className="h-4 w-4" />
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(task)}
              className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-red-600"
              aria-label="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {task.description && (
        <p className="mt-2 text-sm text-gray-600 line-clamp-3">
          {task.description}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-500">
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
            <span className="inline-flex items-center gap-1 text-gray-600">
              Logged {task.actualHours}h
            </span>
          )}
      </div>

      {task.tags && task.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4">
        <label className="text-xs font-semibold uppercase text-gray-400">
          Update Status
        </label>
        <select
          value={task.status}
          onChange={(event) =>
            onStatusChange(task, event.target.value as TaskStatus)
          }
          disabled={disableStatusChange}
          className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}



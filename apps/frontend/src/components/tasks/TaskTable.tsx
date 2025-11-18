import { ClipboardList, Edit2, PenSquare, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Task, TaskStatus } from '@/types/tasks';

interface TaskTableProps {
  tasks: Task[];
  statusOptions: TaskStatus[];
  onEditTask: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onDeleteTask?: (task: Task) => void;
  disableStatusChange?: boolean;
  onAddTaskToEod?: (task: Task) => void;
  addingTaskId?: string | null;
  onOpenActivity?: (task: Task) => void;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

export function TaskTable({
  tasks,
  statusOptions,
  onEditTask,
  onStatusChange,
  onDeleteTask,
  disableStatusChange,
  onAddTaskToEod,
  addingTaskId,
  onOpenActivity,
}: TaskTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Task
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Priority
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Assignee
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Due Date
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-muted">
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {task.title}
                  </span>
                  {task.description && (
                    <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {task.description}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                <select
                  value={task.status}
                  onChange={(event) =>
                    onStatusChange(task, event.target.value as TaskStatus)
                  }
                  disabled={disableStatusChange}
                  className="w-full rounded-lg border border-border px-2 py-1 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {task.priority.charAt(0) +
                  task.priority.slice(1).toLowerCase()}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {task.assignedTo
                  ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                  : 'Unassigned'}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {task.dueDate
                  ? format(new Date(task.dueDate), 'MMM d, yyyy')
                  : '—'}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  {onOpenActivity && (
                    <button
                      onClick={() => onOpenActivity(task)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                      aria-label="View task activities"
                    >
                      <PenSquare className="h-4 w-4" />
                    </button>
                  )}
                  {onAddTaskToEod && (
                    <button
                      onClick={() => onAddTaskToEod(task)}
                      disabled={addingTaskId === task.id}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Add task to EOD report"
                    >
                      <ClipboardList className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onEditTask(task)}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                    aria-label="Edit task"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {onDeleteTask && (
                    <button
                      onClick={() => onDeleteTask(task)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete task"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {tasks.length === 0 && (
        <div className="border-t border-border bg-muted px-6 py-8 text-center text-sm text-muted-foreground">
          No tasks found. Adjust filters or create a new task to get started.
        </div>
      )}
    </div>
  );
}



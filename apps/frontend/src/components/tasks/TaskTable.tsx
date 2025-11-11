import { Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { Task, TaskStatus } from '@/types/tasks';

interface TaskTableProps {
  tasks: Task[];
  statusOptions: TaskStatus[];
  onEditTask: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onDeleteTask?: (task: Task) => void;
  disableStatusChange?: boolean;
  canDeleteTasks?: boolean;
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
  canDeleteTasks = false,
}: TaskTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Task
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Priority
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Assignee
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Due Date
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {tasks.map((task) => (
            <tr key={task.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-gray-900">
                    {task.title}
                  </span>
                  {task.description && (
                    <span className="mt-1 line-clamp-2 text-xs text-gray-500">
                      {task.description}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                <select
                  value={task.status}
                  onChange={(event) =>
                    onStatusChange(task, event.target.value as TaskStatus)
                  }
                  disabled={disableStatusChange}
                  className="w-full rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {task.priority.charAt(0) +
                  task.priority.slice(1).toLowerCase()}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {task.assignedTo
                  ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
                  : 'Unassigned'}
              </td>
              <td className="px-6 py-4 text-sm text-gray-700">
                {task.dueDate
                  ? format(new Date(task.dueDate), 'MMM d, yyyy')
                  : '—'}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEditTask(task)}
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                    aria-label="Edit task"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {canDeleteTasks && onDeleteTask && (
                    <button
                      onClick={() => onDeleteTask(task)}
                      className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
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
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-8 text-center text-sm text-gray-500">
          No tasks found. Adjust filters or create a new task to get started.
        </div>
      )}
    </div>
  );
}



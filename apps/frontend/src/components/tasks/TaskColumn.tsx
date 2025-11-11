import { Plus } from 'lucide-react';
import type { Task, TaskStatus } from '@/types/tasks';
import { TaskCard } from './TaskCard';

const STATUS_TITLES: Record<TaskStatus, string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
};

const STATUS_ACCENTS: Record<TaskStatus, string> = {
  TODO: 'border-blue-200 bg-blue-50 text-blue-700',
  IN_PROGRESS: 'border-amber-200 bg-amber-50 text-amber-700',
  IN_REVIEW: 'border-purple-200 bg-purple-50 text-purple-700',
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-gray-200 bg-gray-50 text-gray-600',
};

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  statusOptions: TaskStatus[];
  onCreateTask?: (status: TaskStatus) => void;
  onEditTask: (task: Task) => void;
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onDeleteTask?: (task: Task) => void;
  disableStatusChange?: boolean;
}

export function TaskColumn({
  status,
  tasks,
  statusOptions,
  onCreateTask,
  onEditTask,
  onStatusChange,
  onDeleteTask,
  disableStatusChange,
}: TaskColumnProps) {
  return (
    <div className="flex min-h-[400px] flex-1 flex-col rounded-2xl border border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between rounded-t-2xl border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_ACCENTS[status]}`}
          >
            {STATUS_TITLES[status]}
          </span>
          <span className="text-xs font-medium text-gray-400">
            {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'}
          </span>
        </div>
        {onCreateTask && (
          <button
            onClick={() => onCreateTask(status)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-500 transition hover:bg-gray-100"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        {tasks.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/80 px-4 py-8 text-center text-sm text-gray-500">
            <p>No tasks in this stage yet.</p>
            {onCreateTask && (
              <button
                onClick={() => onCreateTask(status)}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Task
              </button>
            )}
          </div>
        )}

        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            statusOptions={statusOptions}
            onEdit={onEditTask}
            onStatusChange={onStatusChange}
            onDelete={onDeleteTask}
            disableStatusChange={disableStatusChange}
          />
        ))}
      </div>
    </div>
  );
}



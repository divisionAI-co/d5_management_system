import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns, Kanban, Filter, Plus, RefreshCw, Search } from 'lucide-react';
import type { DropResult } from '@hello-pangea/dnd';
import { useNavigate } from 'react-router-dom';
import { tasksApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { TaskForm } from '@/components/tasks/TaskForm';
import { useAuthStore } from '@/lib/stores/auth-store';
import { TaskBoard } from '@/components/tasks/TaskBoard';
import { TaskTable } from '@/components/tasks/TaskTable';
import { ActivitySidebar } from '@/components/activities/ActivitySidebar';
import type {
  Task,
  TaskEodLinkResponse,
  TaskFilters,
  TaskPriority,
  TaskStatus,
  TasksKanbanResponse,
} from '@/types/tasks';
import type { UsersListResponse, UserSummary } from '@/types/users';

const STATUS_ORDER: TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

interface LocalFilters {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedToId?: string;
  search?: string;
}

export default function TasksPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<LocalFilters>({
    status: undefined,
    priority: undefined,
    assignedToId: undefined,
    search: '',
  });
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus | undefined>(
    undefined,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoadingTaskDetail, setIsLoadingTaskDetail] = useState(false);
  const [addingTaskId, setAddingTaskId] = useState<string | null>(null);
  const [eodPrompt, setEodPrompt] = useState<TaskEodLinkResponse | null>(null);
  const [showActivitySidebar, setShowActivitySidebar] = useState(false);
  const [activityTaskId, setActivityTaskId] = useState<string | null>(null);

  const sanitizedFilters = useMemo(() => {
    const payload: TaskFilters = {};
    if (filters.status) {
      payload.status = filters.status;
    }
    if (filters.priority) {
      payload.priority = filters.priority;
    }
    if (filters.assignedToId) {
      payload.assignedToId = filters.assignedToId;
    }
    if (filters.search && filters.search.trim().length > 0) {
      payload.search = filters.search.trim();
    }
    return payload;
  }, [filters]);

  const tasksQuery = useQuery<TasksKanbanResponse>({
    queryKey: ['tasks', sanitizedFilters],
    queryFn: () => tasksApi.list(sanitizedFilters),
  });

  const usersQuery = useQuery<UsersListResponse>({
    queryKey: ['users', 'options'],
    queryFn: () =>
      usersApi.list({ page: 1, pageSize: 100, sortBy: 'firstName', sortOrder: 'asc' }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      tasksApi.updateStatus(id, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setFeedback(`Task "${updated.title}" moved to ${updated.status}.`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setFeedback('Task deleted successfully.');
    },
  });

  const addToEodMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.addToEod(taskId),
  });

  const handleOpenCreate = (status?: TaskStatus) => {
    setEditingTask(null);
    setDefaultStatus(status);
    setShowForm(true);
  };

  const handleOpenActivities = (task: Task) => {
    setActivityTaskId(task.id);
    setShowActivitySidebar(true);
  };

  const handleAddToEod = (task: Task) => {
    if (!user) {
      setFeedback('You need to be signed in to add tasks to an EOD report.');
      return;
    }

    setAddingTaskId(task.id);
    addToEodMutation.mutate(task.id, {
      onSuccess: (result) => {
        setFeedback(null);
        setEodPrompt(result);
      },
      onError: (error: any) => {
        const message =
          error?.response?.data?.message ??
          (Array.isArray(error?.response?.data) ? error.response.data.join(' ') : null) ??
          'Unable to add the task to your EOD report.';
        setFeedback(Array.isArray(message) ? message.join(' ') : String(message));
        setEodPrompt(null);
      },
      onSettled: () => {
        setAddingTaskId(null);
      },
    });
  };

  const handleViewReport = () => {
    setEodPrompt(null);
    if (user?.id) {
      navigate('/employees/eod-reports', {
        state: { userId: user.id },
      });
    } else {
      navigate('/employees/eod-reports');
    }
  };

  const handleEditTask = async (task: Task) => {
    setIsLoadingTaskDetail(true);
    try {
      const detail = await tasksApi.getById(task.id);
      setEditingTask(detail);
      setDefaultStatus(undefined);
      setShowForm(true);
    } finally {
      setIsLoadingTaskDetail(false);
    }
  };

  const handleStatusChange = (task: Task, status: TaskStatus) => {
    statusMutation.mutate({ id: task.id, status });
  };

  const handleDeleteTask = (task: Task) => {
    if (
      window.confirm(
        `Delete task "${task.title}"? This action cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(task.id);
    }
  };

  const handleTaskMoveOptimistic = useMemo(() => {
    return (result: DropResult, task: Task) => {
      const { destination, source } = result;
      if (!destination) {
        return;
      }

      const destinationStatus = destination.droppableId as TaskStatus;
      const sourceStatus = source.droppableId as TaskStatus;

      queryClient.setQueryData<TasksKanbanResponse>(
        ['tasks', sanitizedFilters],
        (prev) => {
          if (!prev) {
            return prev;
          }

          const nextColumns = prev.columns.map((column) => ({
            ...column,
            tasks: column.tasks.map((existingTask) => ({ ...existingTask })),
          }));

          const sourceColumn = nextColumns.find(
            (column) => column.status === sourceStatus,
          );
          const destinationColumn = nextColumns.find(
            (column) => column.status === destinationStatus,
          );

          if (!sourceColumn || !destinationColumn) {
            return prev;
          }

          const [removed] = sourceColumn.tasks.splice(source.index, 1);
          if (!removed) {
            return prev;
          }

          const updatedTask = {
            ...removed,
            status: destinationStatus,
          };

          destinationColumn.tasks.splice(destination.index, 0, updatedTask);

          const total = nextColumns.reduce(
            (sum, column) => sum + column.tasks.length,
            0,
          );

          return {
            ...prev,
            total,
            columns: nextColumns,
          };
        },
      );

      if (task.status !== destinationStatus) {
        statusMutation.mutate({ id: task.id, status: destinationStatus });
      }
    };
  }, [queryClient, sanitizedFilters, statusMutation]);

  const users = usersQuery.data?.data ?? [];
  const canDeleteTasks = user?.role === 'ADMIN';

  const columns = useMemo(() => {
    const responseColumns = tasksQuery.data?.columns ?? [];
    return STATUS_ORDER.map((status) => {
      const column = responseColumns.find((col) => col.status === status);
      return {
        status,
        tasks: column?.tasks ?? [],
      };
    });
  }, [tasksQuery.data]);

  const flatTasks = useMemo(
    () => columns.flatMap((column) => column.tasks),
    [columns],
  );

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Task Board</h1>
          <p className="text-sm text-muted-foreground">
            Track cross-functional work across the lifecycle. Use filters to
            focus on assignments, review progress and keep delivery on track.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-1 text-sm font-medium text-muted-foreground">
            <button
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 transition ${
                viewMode === 'board'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-muted/70'
              }`}
            >
              <Kanban className="h-4 w-4" /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 transition ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-muted/70'
              }`}
            >
              <Columns className="h-4 w-4" /> List
            </button>
          </div>

          <button
            onClick={() => tasksQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                tasksQuery.isFetching ? 'animate-spin' : ''
              }`}
            />
            Refresh
          </button>
          <button
            onClick={() => handleOpenCreate()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            disabled={!user}
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Search
            </label>
            <div className="relative">
              <input
                type="text"
                value={filters.search ?? ''}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: event.target.value,
                  }))
                }
                placeholder="Search by title or description..."
                className="w-full rounded-lg border border-border px-3 py-2 pl-9 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Status
            </label>
            <select
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: (event.target.value || undefined) as
                    | TaskStatus
                    | undefined,
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              {STATUS_ORDER.map((status) => (
                <option key={status} value={status}>
                  {status.replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Priority
            </label>
            <select
              value={filters.priority ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  priority: (event.target.value || undefined) as
                    | TaskPriority
                    | undefined,
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All priorities</option>
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Assignee
            </label>
            <div className="relative">
              <select
                value={filters.assignedToId ?? ''}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    assignedToId: event.target.value || undefined,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 pl-9 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All team members</option>
                {users.map((member: UserSummary) => (
                  <option key={member.id} value={member.id}>
                    {member.firstName} {member.lastName} ({member.role})
                  </option>
                ))}
              </select>
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          <span>{feedback}</span>
          <button
            className="text-xs font-semibold uppercase tracking-wide text-blue-800"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {eodPrompt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{eodPrompt.message}</span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleViewReport}
              className="inline-flex items-center gap-2 rounded-lg border border-emerald-500 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20"
            >
              Go to report
            </button>
            <button
              type="button"
              onClick={() => setEodPrompt(null)}
              className="text-xs font-semibold uppercase tracking-wide text-emerald-700 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {tasksQuery.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Unable to load tasks right now. Please try refreshing the view.
          </div>
        )}

        {tasksQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {STATUS_ORDER.slice(0, 3).map((status) => (
              <div
                key={status}
                className="h-64 animate-pulse rounded-2xl border border-border bg-card"
              />
            ))}
          </div>
        ) : viewMode === 'board' ? (
          <TaskBoard
            columns={columns}
            onCreateTask={handleOpenCreate}
            onEditTask={handleEditTask}
            onStatusChange={handleStatusChange}
            onDeleteTask={canDeleteTasks ? handleDeleteTask : undefined}
            statusOptions={STATUS_ORDER}
            disableStatusChange={statusMutation.isPending}
            canDeleteTasks={canDeleteTasks}
            onTaskMove={handleTaskMoveOptimistic}
            onAddTaskToEod={handleAddToEod}
            addingTaskId={addingTaskId}
            onOpenActivity={handleOpenActivities}
          />
        ) : (
          <TaskTable
            tasks={flatTasks}
            statusOptions={STATUS_ORDER}
            onEditTask={handleEditTask}
            onStatusChange={handleStatusChange}
            onDeleteTask={canDeleteTasks ? handleDeleteTask : undefined}
            disableStatusChange={statusMutation.isPending}
            canDeleteTasks={canDeleteTasks}
            onAddTaskToEod={handleAddToEod}
            addingTaskId={addingTaskId}
            onOpenActivity={handleOpenActivities}
          />
        )}

        {!tasksQuery.isLoading &&
          !tasksQuery.isError &&
          (tasksQuery.data?.total ?? 0) === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
              <p className="font-medium text-muted-foreground">
                No tasks found for the selected filters.
              </p>
              <p className="mt-1">
                Adjust filters or create a new task to kick off a workstream.
              </p>
              <button
                onClick={() => handleOpenCreate(filters.status)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </button>
            </div>
          )}
      </div>

      {showForm && user && (
        <TaskForm
          task={editingTask}
          currentUserId={user.id}
          defaultStatus={defaultStatus}
          onClose={() => {
            setShowForm(false);
            setEditingTask(null);
            setDefaultStatus(undefined);
          }}
          onSuccess={(savedTask) => {
            setShowForm(false);
            setEditingTask(null);
            setDefaultStatus(undefined);
            setFeedback(
              `Task "${savedTask.title}" ${
                editingTask ? 'updated' : 'created'
              } successfully.`,
            );
          }}
        />
      )}

      {isLoadingTaskDetail && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/20">
          <div className="rounded-lg bg-card px-4 py-3 text-sm text-muted-foreground shadow-lg">
            Loading task details...
          </div>
        </div>
      )}

      {activityTaskId && (
        <ActivitySidebar
          open={showActivitySidebar}
          onClose={() => {
            setShowActivitySidebar(false);
            setActivityTaskId(null);
          }}
          entityId={activityTaskId}
          entityType="task"
          title="Task Activities"
        />
      )}
    </div>
  );
}

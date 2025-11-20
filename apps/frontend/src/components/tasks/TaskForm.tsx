import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { tasksApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { customersApi } from '@/lib/api/crm';
import type {
  CreateTaskPayload,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateTaskPayload,
} from '@/types/tasks';
import type { UsersListResponse, UserSummary } from '@/types/users';
import type {
  CustomersListResponse,
  CustomerFilters,
  CustomerSummary,
} from '@/types/crm';
import { MentionInput } from '@/components/shared/MentionInput';

const STATUS_OPTIONS: TaskStatus[] = [
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
];

const PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

type FormValues = {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedToIds?: string[];
  customerId?: string;
  dueDate?: string;
  startDate?: string;
  tags?: string;
  estimatedHours?: string;
  actualHours?: string;
  // Task Relationships
  parentId?: string;
  blockedByTaskIds?: string[];
  relatedTaskIds?: string[];
};

interface TaskFormProps {
  task?: Task | null;
  currentUserId: string;
  currentUserRole?: string;
  defaultStatus?: TaskStatus;
  defaultParentId?: string;
  onClose: () => void;
  onSuccess: (task: Task) => void;
}

export function TaskForm({
  task,
  currentUserId,
  currentUserRole,
  defaultStatus,
  defaultParentId,
  onClose,
  onSuccess,
}: TaskFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(task);

  const defaultValues = useMemo<FormValues>(() => {
    if (!task) {
      return {
        title: '',
        description: '',
        status: defaultStatus ?? 'TODO',
        priority: 'MEDIUM',
        assignedToIds: [currentUserId], // Default to current user when creating
        customerId: undefined,
        dueDate: undefined,
        startDate: undefined,
        tags: '',
        estimatedHours: '',
        actualHours: '',
        // Task Relationships
        parentId: defaultParentId || undefined,
        blockedByTaskIds: [],
        relatedTaskIds: [],
      };
    }

    // Handle multiple assignees - prefer new assignees array, fall back to legacy assignedToId
    let assignedToIds: string[] = [];
    if (task.assignees && task.assignees.length > 0) {
      assignedToIds = task.assignees.map((ta) => ta.userId);
    } else if (task.assignedToId) {
      // Legacy format: single assignee
      assignedToIds = [task.assignedToId];
    }

    return {
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      assignedToIds,
      customerId: task.customerId ?? undefined,
      dueDate: task.dueDate ? task.dueDate.substring(0, 10) : undefined,
      startDate: task.startDate ? task.startDate.substring(0, 10) : undefined,
      tags: task.tags?.join(', ') ?? '',
      estimatedHours:
        task.estimatedHours !== undefined && task.estimatedHours !== null
          ? String(task.estimatedHours)
          : '',
      actualHours:
        task.actualHours !== undefined && task.actualHours !== null
          ? String(task.actualHours)
          : '',
      // Task Relationships
      parentId: task.parentId ?? undefined,
      blockedByTaskIds: task.blockedBy?.map((t) => t.id) ?? [],
      relatedTaskIds: task.related?.map((t) => t.id) ?? [],
    };
  }, [task, defaultStatus, defaultParentId, currentUserId]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  const descriptionValue = watch('description') || '';

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  // Set parentId when defaultParentId is provided (for creating child tasks)
  useEffect(() => {
    if (!task && defaultParentId) {
      setValue('parentId', defaultParentId);
    }
  }, [task, defaultParentId, setValue]);

  const usersQuery = useQuery<UsersListResponse>({
    queryKey: ['users', 'options', 'task-assignment'],
    queryFn: () => {
      console.log('[TaskForm] Fetching users for assignment...');
      return usersApi.getOptions({ page: 1, pageSize: 100, sortBy: 'firstName', sortOrder: 'asc' });
    },
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache (renamed from cacheTime in React Query v5)
  });

  const customersQuery = useQuery<CustomersListResponse>({
    queryKey: ['customers', 'options'],
    queryFn: () => {
      const filters: CustomerFilters & {
        sortBy: 'name';
        sortOrder: 'asc' | 'desc';
        page: number;
        pageSize: number;
      } = {
        page: 1,
        pageSize: 50,
        sortBy: 'name',
        sortOrder: 'asc',
      };
      return customersApi.list(filters);
    },
  });

  // Fetch all tasks for relationship selectors
  const allTasksQuery = useQuery<TasksKanbanResponse>({
    queryKey: ['tasks', 'all', 'for-relationships'],
    queryFn: async () => {
      try {
        const result = await tasksApi.list({ limit: 200 }); // Get up to 200 tasks for selectors (backend max)
        console.log('[TaskForm] Tasks loaded for relationships:', result);
        return result;
      } catch (error) {
        console.error('[TaskForm] Error loading tasks for relationships:', error);
        throw error;
      }
    },
    enabled: true,
    retry: 2,
  });

  // Flatten tasks from kanban columns
  const allTasks = useMemo(() => {
    if (!allTasksQuery.data) {
      console.log('[TaskForm] No tasks data available');
      return [];
    }
    const tasks = allTasksQuery.data.columns.flatMap((col) => col.tasks);
    console.log('[TaskForm] Flattened tasks:', tasks.length);
    return tasks;
  }, [allTasksQuery.data]);

  // Filter out current task from relationship options
  const availableTasksForRelations = useMemo(() => {
    const filtered = allTasks.filter((t) => t.id !== task?.id);
    console.log('[TaskForm] Available tasks for relationships:', filtered.length, 'out of', allTasks.length);
    return filtered;
  }, [allTasks, task?.id]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksApi.create(payload),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateTaskPayload) => tasksApi.update(task!.id, payload),
  });

  const onSubmit = (values: FormValues) => {
    const payloadBase = {
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      priority: values.priority,
      assignedToIds: values.assignedToIds && values.assignedToIds.length > 0 ? values.assignedToIds : undefined,
      customerId: values.customerId || undefined,
      dueDate: values.dueDate || undefined,
      startDate: values.startDate || undefined,
      tags: values.tags
        ? values.tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
      estimatedHours:
        values.estimatedHours && values.estimatedHours !== ''
          ? Number(values.estimatedHours)
          : undefined,
      actualHours:
        values.actualHours && values.actualHours !== ''
          ? Number(values.actualHours)
          : undefined,
      // Task Relationships
      parentId: values.parentId || undefined,
      blockedByTaskIds: values.blockedByTaskIds && values.blockedByTaskIds.length > 0 ? values.blockedByTaskIds : undefined,
      relatedTaskIds: values.relatedTaskIds && values.relatedTaskIds.length > 0 ? values.relatedTaskIds : undefined,
    };

    if (isEdit) {
      updateMutation.mutate(payloadBase, {
        onSuccess: (updated) => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          onSuccess(updated);
        },
      });
    } else {
      const payload: CreateTaskPayload = {
        ...payloadBase,
        createdById: currentUserId,
      };

      createMutation.mutate(payload, {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
          onSuccess(created);
        },
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const users = usersQuery.data?.data ?? [];
  const customers = customersQuery.data?.data ?? [];

  // Ensure current user is selected by default when creating a task
  useEffect(() => {
    if (!task && currentUserId && users.length > 0) {
      const currentUserInList = users.find((u: UserSummary) => u.id === currentUserId);
      if (currentUserInList) {
        setValue('assignedToIds', [currentUserId]);
      }
    }
  }, [task, currentUserId, users, setValue]);

  // Debug: Log users to see if employees are included
  useEffect(() => {
    if (users.length > 0) {
      console.log('[TaskForm] Users loaded:', users.length);
      const employees = users.filter((u: UserSummary) => u.role === 'EMPLOYEE');
      if (employees.length > 0) {
        console.error('[TaskForm] ERROR: Found', employees.length, 'EMPLOYEE users in dropdown:', employees.map((e: UserSummary) => `${e.firstName} ${e.lastName}`));
      } else {
        console.log('[TaskForm] No EMPLOYEE users found (correct)');
      }
    }
  }, [users]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Update Task' : 'Create Task'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Edit task details, assignment and scheduling details.'
                : 'Capture new work items for the task board.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            aria-label="Close task form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Title *
              </label>
              <input
                type="text"
                {...register('title', { required: 'Task title is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Status
              </label>
              <select
                {...register('status', { required: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_OPTIONS.map((statusOption) => (
                  <option key={statusOption} value={statusOption}>
                    {statusOption.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Priority
              </label>
              <select
                {...register('priority', { required: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map((priorityOption) => (
                  <option key={priorityOption} value={priorityOption}>
                    {priorityOption.charAt(0) +
                      priorityOption.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Assignees (select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 md:grid-cols-3 lg:grid-cols-4">
                {users.map((user: UserSummary) => {
                  const fieldName = 'assignedToIds' as const;
                  const currentValues = watch(fieldName) || [];
                  const isChecked = Array.isArray(currentValues) && currentValues.includes(user.id);
                  
                  return (
                    <label
                      key={user.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-border bg-card hover:bg-muted'
                      } ${currentUserRole === 'EMPLOYEE' && !task ? 'cursor-not-allowed opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const currentArray = watch(fieldName) || [];
                          let newArray: string[];
                          if (e.target.checked) {
                            newArray = Array.isArray(currentArray) 
                              ? [...currentArray, user.id]
                              : [user.id];
                          } else {
                            newArray = Array.isArray(currentArray)
                              ? currentArray.filter((id: string) => id !== user.id)
                              : [];
                          }
                          setValue(fieldName, newArray, { shouldValidate: true });
                        }}
                        disabled={currentUserRole === 'EMPLOYEE' && !task}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                    </label>
                  );
                })}
              </div>
              {currentUserRole === 'EMPLOYEE' && !task && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Tasks are assigned to you by default
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Related Customer
              </label>
              <select
                {...register('customerId')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {customers.map((customer: CustomerSummary) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Start Date
              </label>
              <input
                type="date"
                {...register('startDate')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Due Date
              </label>
              <input
                type="date"
                {...register('dueDate')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Estimated Hours
              </label>
              <input
                type="number"
                step="0.25"
                min="0"
                {...register('estimatedHours')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Actual Hours
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('actualHours')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Tags
            </label>
            <input
              type="text"
              {...register('tags')}
              placeholder="frontend, onboarding"
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Description
            </label>
            <MentionInput
              value={descriptionValue}
              onChange={(value) => setValue('description', value)}
              rows={4}
              placeholder="Provide context, goals and success criteria... Type @ to mention someone"
              multiline={true}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Task Relationships Section */}
          <div className="space-y-4 border-t border-border pt-6">
            <div>
              <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
                Task Relationships
              </h3>
              <p className="mb-4 text-xs text-muted-foreground">
                Define how this task relates to other tasks. Children tasks are automatically related to each other, and parent tasks are automatically blocked by their children.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Parent Task
              </label>
              {allTasksQuery.isLoading ? (
                <div className="w-full rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                  Loading tasks...
                </div>
              ) : allTasksQuery.isError ? (
                <div className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Error loading tasks. Please try again.
                </div>
              ) : (
                <select
                  {...register('parentId')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None (top-level task)</option>
                  {availableTasksForRelations.length === 0 ? (
                    <option value="" disabled>
                      No other tasks available
                    </option>
                  ) : (
                    availableTasksForRelations.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.status})
                      </option>
                    ))
                  )}
                </select>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Select a parent task to create a hierarchical structure. This task will be a child of the selected parent.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Blocked By These Tasks
              </label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {availableTasksForRelations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other tasks available</p>
                ) : (
                  availableTasksForRelations.map((t) => {
                    const fieldName = 'blockedByTaskIds' as const;
                    const currentValues = watch(fieldName) || [];
                    const isChecked = Array.isArray(currentValues) && currentValues.includes(t.id);
                    
                    return (
                      <label
                        key={t.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition ${
                          isChecked
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-border bg-card hover:bg-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const currentArray = watch(fieldName) || [];
                            let newArray: string[];
                            if (e.target.checked) {
                              newArray = Array.isArray(currentArray) 
                                ? [...currentArray, t.id]
                                : [t.id];
                            } else {
                              newArray = Array.isArray(currentArray)
                                ? currentArray.filter((id: string) => id !== t.id)
                                : [];
                            }
                            setValue(fieldName, newArray, { shouldValidate: true });
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-2 focus:ring-orange-500"
                        />
                        <span className="text-sm font-medium">
                          {t.title}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {t.status}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Select tasks that must be completed before this task can start. This task is blocked by the selected tasks.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Related Tasks
              </label>
              <div className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                {availableTasksForRelations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No other tasks available</p>
                ) : (
                  availableTasksForRelations.map((t) => {
                    const fieldName = 'relatedTaskIds' as const;
                    const currentValues = watch(fieldName) || [];
                    const isChecked = Array.isArray(currentValues) && currentValues.includes(t.id);
                    
                    return (
                      <label
                        key={t.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition ${
                          isChecked
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-border bg-card hover:bg-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const currentArray = watch(fieldName) || [];
                            let newArray: string[];
                            if (e.target.checked) {
                              newArray = Array.isArray(currentArray) 
                                ? [...currentArray, t.id]
                                : [t.id];
                            } else {
                              newArray = Array.isArray(currentArray)
                                ? currentArray.filter((id: string) => id !== t.id)
                                : [];
                            }
                            setValue(fieldName, newArray, { shouldValidate: true });
                          }}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium">
                          {t.title}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {t.status}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Select tasks that are related to this task (for reference, not dependency). Sibling tasks (tasks with the same parent) are automatically related.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? 'Saving...'
                : isEdit
                ? 'Save Task'
                : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



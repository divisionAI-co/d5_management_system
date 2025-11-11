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
  assignedToId?: string;
  customerId?: string;
  dueDate?: string;
  startDate?: string;
  tags?: string;
  estimatedHours?: string;
  actualHours?: string;
};

interface TaskFormProps {
  task?: Task | null;
  currentUserId: string;
  defaultStatus?: TaskStatus;
  onClose: () => void;
  onSuccess: (task: Task) => void;
}

export function TaskForm({
  task,
  currentUserId,
  defaultStatus,
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
        assignedToId: undefined,
        customerId: undefined,
        dueDate: undefined,
        startDate: undefined,
        tags: '',
        estimatedHours: '',
        actualHours: '',
      };
    }

    return {
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      assignedToId: task.assignedToId ?? undefined,
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
    };
  }, [task, defaultStatus]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const usersQuery = useQuery<UsersListResponse>({
    queryKey: ['users', 'options'],
    queryFn: () =>
      usersApi.list({ page: 1, pageSize: 100, sortBy: 'firstName', sortOrder: 'asc' }),
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
      assignedToId: values.assignedToId || undefined,
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

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Assignee
              </label>
              <select
                {...register('assignedToId')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {users.map((user: UserSummary) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.role})
                  </option>
                ))}
              </select>
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
                step="0.25"
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
            <textarea
              rows={4}
              {...register('description')}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="Provide context, goals and success criteria..."
            />
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



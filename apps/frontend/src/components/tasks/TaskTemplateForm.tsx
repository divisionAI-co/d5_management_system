import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { tasksApi } from '@/lib/api/tasks';
import { usersApi } from '@/lib/api/users';
import { customersApi } from '@/lib/api/crm';
import type {
  CreateTaskTemplatePayload,
  TaskTemplate,
  TaskPriority,
  TaskStatus,
  TaskRecurrenceType,
  UpdateTaskTemplatePayload,
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

const RECURRENCE_TYPES: Array<{ value: TaskRecurrenceType; label: string }> = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
  { value: 'YEARLY', label: 'Yearly' },
];

type FormValues = {
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  recurrenceType: TaskRecurrenceType;
  recurrenceInterval: number;
  isActive: boolean;
  startDate: string;
  endDate?: string;
  defaultAssigneeIds?: string[];
  defaultCustomerId?: string;
  defaultTags?: string;
  defaultEstimatedHours?: string;
};

interface TaskTemplateFormProps {
  template?: TaskTemplate | null;
  currentUserId: string;
  onClose: () => void;
  onSuccess: (template: TaskTemplate) => void;
}

export function TaskTemplateForm({
  template,
  currentUserId,
  onClose,
  onSuccess,
}: TaskTemplateFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(template);

  const defaultValues = useMemo<FormValues>(() => {
    if (!template) {
      const today = new Date().toISOString().split('T')[0];
      return {
        title: '',
        description: '',
        status: 'TODO',
        priority: 'MEDIUM',
        recurrenceType: 'DAILY',
        recurrenceInterval: 1,
        isActive: true,
        startDate: today,
        endDate: undefined,
        defaultAssigneeIds: [currentUserId],
        defaultCustomerId: undefined,
        defaultTags: '',
        defaultEstimatedHours: '',
      };
    }

    return {
      title: template.title,
      description: template.description ?? '',
      status: template.status,
      priority: template.priority,
      recurrenceType: template.recurrenceType,
      recurrenceInterval: template.recurrenceInterval,
      isActive: template.isActive,
      startDate: template.startDate.substring(0, 10),
      endDate: template.endDate ? template.endDate.substring(0, 10) : undefined,
      defaultAssigneeIds: template.defaultAssigneeIds ?? [],
      defaultCustomerId: template.defaultCustomerId ?? undefined,
      defaultTags: template.defaultTags?.join(', ') ?? '',
      defaultEstimatedHours:
        template.defaultEstimatedHours !== undefined && template.defaultEstimatedHours !== null
          ? String(template.defaultEstimatedHours)
          : '',
    };
  }, [template, currentUserId]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
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
    queryFn: () => customersApi.list({ page: 1, pageSize: 100 } as CustomerFilters),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateTaskTemplatePayload) => tasksApi.templates.create(payload),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateTaskTemplatePayload) =>
      tasksApi.templates.update(template!.id, payload),
  });

  const onSubmit = (values: FormValues) => {
    const payloadBase = {
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      priority: values.priority,
      recurrenceType: values.recurrenceType,
      recurrenceInterval: values.recurrenceInterval || 1,
      isActive: values.isActive,
      startDate: `${values.startDate}T00:00:00.000Z`,
      endDate: values.endDate ? `${values.endDate}T00:00:00.000Z` : null,
      defaultAssigneeIds: values.defaultAssigneeIds && values.defaultAssigneeIds.length > 0 ? values.defaultAssigneeIds : undefined,
      defaultCustomerId: values.defaultCustomerId || undefined,
      defaultTags: values.defaultTags
        ? values.defaultTags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean)
        : undefined,
      defaultEstimatedHours:
        values.defaultEstimatedHours && values.defaultEstimatedHours !== ''
          ? Number(values.defaultEstimatedHours)
          : undefined,
    };

    if (isEdit) {
      updateMutation.mutate(payloadBase, {
        onSuccess: (updated) => {
          queryClient.invalidateQueries({ queryKey: ['task-templates'] });
          onSuccess(updated);
        },
      });
    } else {
      const payload: CreateTaskTemplatePayload = {
        ...payloadBase,
        createdById: currentUserId,
      };

      createMutation.mutate(payload, {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: ['task-templates'] });
          onSuccess(created);
        },
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const users = usersQuery.data?.data ?? [];
  const customers = customersQuery.data?.data ?? [];

  // Ensure current user is selected by default when creating a template
  useEffect(() => {
    if (!template && currentUserId && users.length > 0) {
      const currentUserInList = users.find((u: UserSummary) => u.id === currentUserId);
      if (currentUserInList) {
        setValue('defaultAssigneeIds', [currentUserId]);
      }
    }
  }, [template, currentUserId, users, setValue]);

  const descriptionValue = watch('description') || '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Update Recurring Task Template' : 'Create Recurring Task Template'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Edit template details and recurrence settings.'
                : 'Define a task template that will generate recurring tasks automatically.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            aria-label="Close template form"
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
                {...register('title', { required: 'Template title is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <MentionInput
                value={descriptionValue}
                onChange={(value) => setValue('description', value)}
                placeholder="Task description (supports @mentions)..."
                className="min-h-[100px] w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default Status
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
                Default Priority
              </label>
              <select
                {...register('priority', { required: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {PRIORITY_OPTIONS.map((priorityOption) => (
                  <option key={priorityOption} value={priorityOption}>
                    {priorityOption.charAt(0) + priorityOption.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Recurrence Type *
              </label>
              <select
                {...register('recurrenceType', { required: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {RECURRENCE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Recurrence Interval *
              </label>
              <input
                type="number"
                min={1}
                {...register('recurrenceInterval', { required: true, valueAsNumber: true, min: 1 })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Every N {watch('recurrenceType')?.toLowerCase()} (e.g., 2 = every 2 days/weeks/months/years)
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Start Date *
              </label>
              <input
                type="date"
                {...register('startDate', { required: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                End Date (optional)
              </label>
              <input
                type="date"
                {...register('endDate')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Leave empty for no end date
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Active
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-muted-foreground">
                  Generate tasks from this template (uncheck to pause)
                </span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Default Assignees (select all that apply)
              </label>
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 md:grid-cols-3 lg:grid-cols-4">
                {users.map((user: UserSummary) => {
                  const fieldName = 'defaultAssigneeIds' as const;
                  const currentValues = watch(fieldName) || [];
                  const isChecked = Array.isArray(currentValues) && currentValues.includes(user.id);
                  
                  return (
                    <label
                      key={user.id}
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
                              ? [...currentArray, user.id]
                              : [user.id];
                          } else {
                            newArray = Array.isArray(currentArray)
                              ? currentArray.filter((id: string) => id !== user.id)
                              : [];
                          }
                          setValue(fieldName, newArray, { shouldValidate: true });
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default Customer
              </label>
              <select
                {...register('defaultCustomerId')}
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
                Default Estimated Hours
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                {...register('defaultEstimatedHours', { valueAsNumber: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default Tags
              </label>
              <input
                type="text"
                {...register('defaultTags')}
                placeholder="Comma-separated tags (e.g., frontend, urgent)"
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {createMutation.isError || updateMutation.isError ? (
            <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'An error occurred while saving the template'}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


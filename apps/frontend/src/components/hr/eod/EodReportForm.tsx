import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eodReportsApi } from '@/lib/api/hr';
import type { CreateEodReportDto, EodReport, EodReportTask, UpdateEodReportDto } from '@/types/hr';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@/types/enums';

interface EodReportFormProps {
  report?: EodReport;
  onClose: () => void;
  onSuccess: () => void;
  employeeId?: string;
}

type TaskFormValue = {
  clientDetails: string;
  ticket: string;
  typeOfWorkDone: EodReportTask['typeOfWorkDone'];
  taskEstimatedTime?: number;
  timeSpentOnTicket: number;
  taskLifecycle: EodReportTask['taskLifecycle'];
  taskStatus: EodReportTask['taskStatus'];
};

type FormValues = {
  date: string;
  summary: string;
  tasks: TaskFormValue[];
  hoursWorked?: number;
  submittedAt?: string;
};

const DEFAULT_TASK: TaskFormValue = {
  clientDetails: '',
  ticket: '',
  typeOfWorkDone: 'PLANNING',
  taskEstimatedTime: undefined,
  timeSpentOnTicket: 0,
  taskLifecycle: 'NEW',
  taskStatus: 'IN_PROGRESS',
};

export function EodReportForm({ report, onClose, onSuccess, employeeId }: EodReportFormProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const isEdit = !!report;
  const [mutationError, setMutationError] = useState<string | null>(null);
  
  // Check if user is privileged (ADMIN or HR)
  const isPrivileged = user?.role === UserRole.ADMIN || user?.role === UserRole.HR;

  const initialValues = useMemo<FormValues>(() => {
    if (!report) {
      return {
        date: today,
        summary: '',
        tasks: [{ ...DEFAULT_TASK }],
        hoursWorked: undefined,
      };
    }

    const normalizedTasks: TaskFormValue[] =
      report.tasksWorkedOn && report.tasksWorkedOn.length > 0
        ? report.tasksWorkedOn.map((task) => {
            if (typeof task === 'string') {
              return {
                ...DEFAULT_TASK,
                clientDetails: task,
              };
            }

            return {
              clientDetails: task.clientDetails ?? '',
              ticket: task.ticket ?? '',
              typeOfWorkDone: (task.typeOfWorkDone ?? 'PLANNING') as TaskFormValue['typeOfWorkDone'],
              taskEstimatedTime:
                task.taskEstimatedTime !== undefined && task.taskEstimatedTime !== null
                  ? Number(task.taskEstimatedTime)
                  : undefined,
              timeSpentOnTicket:
                task.timeSpentOnTicket !== undefined && task.timeSpentOnTicket !== null
                  ? Number(task.timeSpentOnTicket)
                  : 0,
              taskLifecycle: (task.taskLifecycle ?? 'NEW') as TaskFormValue['taskLifecycle'],
              taskStatus: (task.taskStatus ?? 'IN_PROGRESS') as TaskFormValue['taskStatus'],
            };
          })
        : [{ ...DEFAULT_TASK }];

    return {
      date: report.date ? report.date.split('T')[0] : today,
      summary: report.summary ?? '',
      tasks: normalizedTasks,
      hoursWorked:
        report.hoursWorked !== undefined && report.hoursWorked !== null
          ? Number(report.hoursWorked)
          : undefined,
      submittedAt: report.submittedAt 
        ? new Date(report.submittedAt).toISOString().slice(0, 16)
        : undefined,
    };
  }, [report, today]);

  const {
    register,
    handleSubmit,
    setError,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: initialValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tasks',
  });

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const createMutation = useMutation({
    mutationFn: ({
      payload,
      submit,
    }: {
      payload: CreateEodReportDto;
      submit: boolean;
    }) => eodReportsApi.create({ ...payload, submit }),
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        (error instanceof Error ? error.message : null) ??
        'Unable to save the EOD report right now.';
      setMutationError(typeof message === 'string' ? message : 'Unable to save the EOD report right now.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      payload,
      submit,
    }: {
      payload: UpdateEodReportDto;
      submit: boolean;
    }) => {
      if (!report) {
        throw new Error('No report provided for update');
      }
      return eodReportsApi.update(report.id, { ...payload, submit });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        (error instanceof Error ? error.message : null) ??
        'Unable to update the EOD report right now.';
      setMutationError(typeof message === 'string' ? message : 'Unable to update the EOD report right now.');
    },
  });

  const onSubmit = (data: FormValues, submit: boolean) => {
    setMutationError(null);
    if (!data.tasks.length) {
      setError('tasks', {
        type: 'manual',
        message: 'Add at least one task',
      });
      return;
    }

    const normalizedTasks = data.tasks.map((task) => ({
      ...task,
      taskEstimatedTime:
        task.taskEstimatedTime !== undefined && task.taskEstimatedTime !== null
          ? Number(task.taskEstimatedTime)
          : undefined,
      timeSpentOnTicket: Number(task.timeSpentOnTicket),
    }));

    if (isEdit) {
      const payload: UpdateEodReportDto = {
        summary: data.summary,
        tasks: normalizedTasks,
        hoursWorked: data.hoursWorked !== undefined ? data.hoursWorked : undefined,
        // Include date and submittedAt for privileged users
        ...(isPrivileged && data.date && { date: data.date }),
        ...(isPrivileged && data.submittedAt !== undefined && { 
          submittedAt: data.submittedAt ? new Date(data.submittedAt).toISOString() : null 
        }),
      };

      updateMutation.mutate(
        { payload, submit },
        {
          onSuccess: () => {
            setMutationError(null);
            queryClient.invalidateQueries({ queryKey: ['eod-reports'] });
            const targetUserId = employeeId ?? report.userId;
            if (targetUserId) {
              queryClient.invalidateQueries({ queryKey: ['eod-reports', targetUserId] });
            }
            onSuccess();
            onClose();
          },
        },
      );

      return;
    }

    const payload: CreateEodReportDto = {
      employeeId,
      date: data.date,
      summary: data.summary,
      tasks: normalizedTasks,
      hoursWorked: data.hoursWorked !== undefined ? data.hoursWorked : undefined,
    };

    createMutation.mutate(
      { payload, submit },
      {
        onSuccess: () => {
          setMutationError(null);
          queryClient.invalidateQueries({ queryKey: ['eod-reports'] });
          if (employeeId) {
            queryClient.invalidateQueries({ queryKey: ['eod-reports', employeeId] });
          }
          onSuccess();
          onClose();
        },
      },
    );
  };

  const isSubmitting = isEdit ? updateMutation.isPending : createMutation.isPending;
  const isSubmitted = Boolean(report?.submittedAt);
  
  // Disable editing only if submitted AND user is not privileged
  const isDisabled = isSubmitted && !isPrivileged;

  const handleSave = handleSubmit((data) => onSubmit(data, false));
  const handleSubmitFinal = handleSubmit((data) => onSubmit(data, true));

  return (
    <>
      {mutationError && (
        <FeedbackToast
          message={mutationError}
          onDismiss={() => setMutationError(null)}
          tone="error"
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Edit EOD Report' : 'New EOD Report'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Update the details of your submitted report.'
                : 'Summarize the work completed for the selected day.'}
            </p>
            <span
              className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                isSubmitted ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {isSubmitted
                ? `Submitted ${report?.submittedAt ? format(new Date(report.submittedAt), 'MMM dd, yyyy HH:mm') : ''}`
                : 'Draft'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6 px-6 py-6">
          <div className={isEdit && isPrivileged ? "grid gap-4 md:grid-cols-2" : ""}>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Report Date *</label>
              <input
                type="date"
                {...register('date', { required: 'Report date is required' })}
                disabled={isEdit && !isPrivileged}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:bg-muted disabled:cursor-not-allowed"
              />
              {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>}
            </div>

            {isEdit && isPrivileged && (
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Submitted At {isSubmitted && '*'}
                  <span className="ml-1 text-xs text-muted-foreground/70">(ADMIN/HR only)</span>
                </label>
                <input
                  type="datetime-local"
                  {...register('submittedAt')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Leave empty for draft"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave empty to mark as draft, or set a timestamp to mark as submitted
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Summary *</label>
            <textarea
              rows={4}
              {...register('summary', { required: 'Summary is required' })}
              placeholder="What were the highlights of your day?"
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              disabled={isDisabled}
            />
            {errors.summary && (
              <p className="mt-1 text-sm text-red-600">{errors.summary.message}</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-muted-foreground">
                Tasks *
              </label>
              <button
                type="button"
                onClick={() =>
                  append({
                    ...DEFAULT_TASK,
                  })
                }
                  className="inline-flex items-center gap-1 rounded-md border border-blue-200 px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                  disabled={isDisabled}
              >
                Add Task
              </button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Client / Project *
                    </label>
                    <input
                      type="text"
                      {...register(`tasks.${index}.clientDetails`, { required: true })}
                        className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        disabled={isDisabled}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Ticket Reference *
                    </label>
                    <input
                      type="text"
                      {...register(`tasks.${index}.ticket`, { required: true })}
                        className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        disabled={isDisabled}
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Type of Work *
                    </label>
                    <select
                      {...register(`tasks.${index}.typeOfWorkDone`, { required: true })}
                        className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        disabled={isDisabled}
                    >
                      <option value="PLANNING">Planning</option>
                      <option value="RESEARCH">Research</option>
                      <option value="IMPLEMENTATION">Implementation</option>
                      <option value="TESTING">Testing</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Lifecycle *
                    </label>
                    <select
                      {...register(`tasks.${index}.taskLifecycle`, { required: true })}
                        className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        disabled={isDisabled}
                    >
                      <option value="NEW">New</option>
                      <option value="RETURNED">Returned</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Status *
                    </label>
                    <select
                      {...register(`tasks.${index}.taskStatus`, { required: true })}
                        className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        disabled={isDisabled}
                    >
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Estimated Time (h)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      {...register(`tasks.${index}.taskEstimatedTime`)}
                        className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        disabled={isDisabled}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Time Spent Today (h) *
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      {...register(`tasks.${index}.timeSpentOnTicket`, { required: true })}
                        className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                        disabled={isDisabled}
                    />
                  </div>
                </div>

                {fields.length > 1 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                        className="text-xs font-medium text-red-600 hover:underline"
                        disabled={isDisabled}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}

            {errors.tasks && (
              <p className="text-sm text-red-600">{errors.tasks.message as string}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Hours Worked</label>
            <input
              type="number"
              step="0.25"
              min="0"
              {...register('hoursWorked')}
              placeholder="8"
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              disabled={isDisabled}
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
              disabled={isSubmitting || isDisabled}
              className="rounded-lg bg-muted px-4 py-2 text-muted-foreground transition hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              type="button"
              onClick={handleSubmitFinal}
              disabled={isSubmitting || isDisabled}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitted ? 'Submitted' : isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}



import { useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { eodReportsApi } from '@/lib/api/hr';
import type { CreateEodReportDto, EodReport, EodReportTask, UpdateEodReportDto } from '@/types/hr';
import { X } from 'lucide-react';
import { format } from 'date-fns';

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
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const isEdit = !!report;

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
    mutationFn: (payload: CreateEodReportDto) => eodReportsApi.create(payload),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateEodReportDto) => {
      if (!report) {
        throw new Error('No report provided for update');
      }
      return eodReportsApi.update(report.id, payload);
    },
  });

  const onSubmit = (data: FormValues) => {
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
      };

      updateMutation.mutate(payload, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['eod-reports'] });
          const targetUserId = employeeId ?? report.userId;
          if (targetUserId) {
            queryClient.invalidateQueries({ queryKey: ['eod-reports', targetUserId] });
          }
          onSuccess();
          onClose();
        },
      });

      return;
    }

    const payload: CreateEodReportDto = {
      employeeId,
      date: data.date,
      summary: data.summary,
      tasks: normalizedTasks,
      hoursWorked: data.hoursWorked !== undefined ? data.hoursWorked : undefined,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['eod-reports'] });
        if (employeeId) {
          queryClient.invalidateQueries({ queryKey: ['eod-reports', employeeId] });
        }
        onSuccess();
        onClose();
      },
    });
  };

  const isSubmitting = isEdit ? updateMutation.isPending : createMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEdit ? 'Edit EOD Report' : 'New EOD Report'}
            </h2>
            <p className="text-sm text-gray-500">
              {isEdit
                ? 'Update the details of your submitted report.'
                : 'Summarize the work completed for the selected day.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Report Date *</label>
            <input
              type="date"
              {...register('date', { required: 'Report date is required' })}
              disabled={isEdit}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Summary *</label>
            <textarea
              rows={4}
              {...register('summary', { required: 'Summary is required' })}
              placeholder="What were the highlights of your day?"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            {errors.summary && (
              <p className="mt-1 text-sm text-red-600">{errors.summary.message}</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
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
              >
                Add Task
              </button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-gray-200 p-4 space-y-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                      Client / Project *
                    </label>
                    <input
                      type="text"
                      {...register(`tasks.${index}.clientDetails`, { required: true })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                      Ticket Reference *
                    </label>
                    <input
                      type="text"
                      {...register(`tasks.${index}.ticket`, { required: true })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                      Type of Work *
                    </label>
                    <select
                      {...register(`tasks.${index}.typeOfWorkDone`, { required: true })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PLANNING">Planning</option>
                      <option value="RESEARCH">Research</option>
                      <option value="IMPLEMENTATION">Implementation</option>
                      <option value="TESTING">Testing</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                      Lifecycle *
                    </label>
                    <select
                      {...register(`tasks.${index}.taskLifecycle`, { required: true })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="NEW">New</option>
                      <option value="RETURNED">Returned</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                      Status *
                    </label>
                    <select
                      {...register(`tasks.${index}.taskStatus`, { required: true })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="DONE">Done</option>
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                      Estimated Time (h)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      {...register(`tasks.${index}.taskEstimatedTime`)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-gray-500">
                      Time Spent Today (h) *
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      {...register(`tasks.${index}.timeSpentOnTicket`, { required: true })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {fields.length > 1 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="text-xs font-medium text-red-600 hover:underline"
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Hours Worked</label>
            <input
              type="number"
              step="0.25"
              min="0"
              {...register('hoursWorked')}
              placeholder="8"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



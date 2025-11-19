import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { eodReportsApi } from '@/lib/api/hr';
import { settingsApi } from '@/lib/api/settings';
import type { CreateEodReportDto, EodReport, EodReportTask, UpdateEodReportDto } from '@/types/hr';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTimerStore } from '@/lib/stores/timer-store';
import { UserRole } from '@/types/enums';
import { MentionInput } from '@/components/shared/MentionInput';

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

const WORK_TYPE_OPTIONS: Array<{ value: EodReportTask['typeOfWorkDone'][0]; label: string }> = [
  { value: 'PLANNING', label: 'Planning' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'IMPLEMENTATION', label: 'Implementation' },
  { value: 'TESTING', label: 'Testing' },
];

const DEFAULT_TASK: TaskFormValue = {
  clientDetails: '',
  ticket: '',
  typeOfWorkDone: ['PLANNING'],
  taskEstimatedTime: undefined,
  timeSpentOnTicket: 0,
  taskLifecycle: 'NEW',
  taskStatus: 'IN_PROGRESS',
};

export function EodReportForm({ report, onClose, onSuccess, employeeId }: EodReportFormProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { runningTimer } = useTimerStore();
  const today = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  const isEdit = !!report;
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [timerWarning, setTimerWarning] = useState<string | null>(null);
  
  // Check if user is privileged (ADMIN or HR)
  const isPrivileged = user?.role === UserRole.ADMIN || user?.role === UserRole.HR;

  const initialValues = useMemo<FormValues>(() => {
    if (!report) {
      const defaultTasks = [{ ...DEFAULT_TASK }];
      const initialHours = defaultTasks.reduce((sum, task) => sum + (task.timeSpentOnTicket || 0), 0);
      return {
        date: today,
        summary: '',
        tasks: defaultTasks,
        hoursWorked: initialHours, // Auto-calculated from tasks (initially 0)
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

            // Handle backward compatibility: if typeOfWorkDone is a string, convert to array
            let typeOfWorkDone: EodReportTask['typeOfWorkDone'];
            if (Array.isArray(task.typeOfWorkDone)) {
              typeOfWorkDone = task.typeOfWorkDone;
            } else if (task.typeOfWorkDone) {
              // Legacy format: single string value
              typeOfWorkDone = [task.typeOfWorkDone as EodReportTask['typeOfWorkDone'][0]];
            } else {
              typeOfWorkDone = ['PLANNING'];
            }

            return {
              clientDetails: task.clientDetails ?? '',
              ticket: task.ticket ?? '',
              typeOfWorkDone,
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

    // Calculate hours worked from tasks if not explicitly set
    const taskHoursSum = normalizedTasks.reduce((sum, task) => {
      const timeSpent = task?.timeSpentOnTicket ?? 0;
      return sum + (typeof timeSpent === 'number' ? timeSpent : 0);
    }, 0);

    return {
      date: report.date ? report.date.split('T')[0] : today,
      summary: report.summary ?? '',
      tasks: normalizedTasks,
      hoursWorked:
        report.hoursWorked !== undefined && report.hoursWorked !== null
          ? Number(report.hoursWorked)
          : taskHoursSum > 0 
            ? taskHoursSum 
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
    clearErrors,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: initialValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'tasks',
  });

  // Watch tasks to calculate hours worked - watch all task fields to ensure we catch changes
  const watchedTasks = watch('tasks');
  const watchedFormValues = watch(); // Watch entire form to catch all changes
  
  // Calculate total hours worked from tasks
  const calculatedHoursWorked = useMemo(() => {
    // Use watchedFormValues.tasks if available, otherwise fall back to watchedTasks
    const tasks = watchedFormValues?.tasks || watchedTasks;
    if (!tasks || tasks.length === 0) {
      return 0;
    }
    return tasks.reduce((sum: number, task: TaskFormValue) => {
      const timeSpent = task?.timeSpentOnTicket ?? 0;
      const numValue = typeof timeSpent === 'number' ? timeSpent : parseFloat(String(timeSpent)) || 0;
      return sum + (isNaN(numValue) ? 0 : numValue);
    }, 0);
  }, [watchedTasks, watchedFormValues]);

  // Track if hoursWorked was manually edited (to prevent auto-update after manual edit)
  const [hoursWorkedManuallyEdited, setHoursWorkedManuallyEdited] = useState(false);

  // Reset manual edit flag when initial values change (e.g., when editing a different report)
  useEffect(() => {
    setHoursWorkedManuallyEdited(false);
  }, [report?.id]);

  // Get register props for hoursWorked to combine onChange handlers
  const hoursWorkedRegister = register('hoursWorked');
  
  // Handle manual changes to hoursWorked field
  const handleHoursWorkedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Call react-hook-form's onChange first
    hoursWorkedRegister.onChange(e);
    // Mark as manually edited only for existing reports
    if (isEdit) {
      setHoursWorkedManuallyEdited(true);
    }
  };

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  // Watch hoursWorked to compare with calculated value
  const watchedHoursWorked = watch('hoursWorked');

  // Auto-update hoursWorked when tasks change
  useEffect(() => {
    // Skip if form hasn't been initialized yet
    const currentTasks = watchedFormValues?.tasks || watchedTasks;
    if (!currentTasks || currentTasks.length === 0) return;

    // Always auto-update for new reports, or if user hasn't manually edited it for existing reports
    if (!isEdit || !hoursWorkedManuallyEdited) {
      // For new reports, always set the calculated value (even if 0)
      // For existing reports, only update if > 0 to avoid overriding with 0
      const valueToSet = !isEdit 
        ? calculatedHoursWorked // For new reports, always use calculated value
        : (calculatedHoursWorked > 0 ? calculatedHoursWorked : undefined); // For existing reports, only if > 0
      
      // Only update if the value has actually changed to avoid unnecessary updates
      if (watchedHoursWorked !== valueToSet) {
        setValue('hoursWorked', valueToSet, { shouldDirty: false, shouldValidate: false });
      }
    }
  }, [calculatedHoursWorked, isEdit, hoursWorkedManuallyEdited, setValue, watchedTasks, watchedFormValues, watchedHoursWorked, fields.length]);

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
    setTimerWarning(null);
    
    // Clear all typeOfWorkDone errors before validation
    data.tasks.forEach((_, index) => {
      clearErrors(`tasks.${index}.typeOfWorkDone`);
    });
    
    // Check for active timer before submitting
    if (submit && runningTimer) {
      const timeSpentMs = Date.now() - runningTimer.startTime;
      const timeSpentHours = Math.round((timeSpentMs / (1000 * 60 * 60)) * 100) / 100;
      setTimerWarning(
        `Warning: You have an active timer for task "${runningTimer.taskTitle || 'Unknown'}" (${timeSpentHours.toFixed(2)} hours). The timer will continue running after submission. Please stop the timer if you want to log this time.`
      );
    }
    
    if (!data.tasks.length) {
      setError('tasks', {
        type: 'manual',
        message: 'Add at least one task',
      });
      return;
    }

    // Validate that each task has at least one type of work selected
    let hasErrors = false;
    for (let i = 0; i < data.tasks.length; i++) {
      const task = data.tasks[i];
      if (!task.typeOfWorkDone || !Array.isArray(task.typeOfWorkDone) || task.typeOfWorkDone.length === 0) {
        setError(`tasks.${i}.typeOfWorkDone`, {
          type: 'manual',
          message: 'At least one type of work must be selected',
        });
        hasErrors = true;
      }
    }
    
    if (hasErrors) {
      return;
    }

    const normalizedTasks = data.tasks.map((task) => ({
      ...task,
      // Ensure typeOfWorkDone is always an array
      typeOfWorkDone: Array.isArray(task.typeOfWorkDone) ? task.typeOfWorkDone : [task.typeOfWorkDone as string],
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

  // Fetch company settings for grace period
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings'],
    queryFn: settingsApi.getCompanySettings,
    enabled: !!report && !!report.submittedAt && !isPrivileged, // Only fetch if needed
  });

  // Calculate if editing is allowed within grace period
  // Grace period is configured in company settings (eodGraceDays)
  const canEditWithinGracePeriod = useMemo(() => {
    if (!report || !report.submittedAt || isPrivileged) {
      return true; // Not submitted or user is privileged
    }

    const reportDate = new Date(report.date);
    const graceDays = companySettings?.eodGraceDays ?? 1; // Default to 1 day if not loaded yet
    
    // Calculate the grace period end (graceDays after the report date)
    const gracePeriodEnd = new Date(reportDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);
    gracePeriodEnd.setHours(23, 59, 59, 999); // End of the grace period day

    const now = new Date();
    return now <= gracePeriodEnd;
  }, [report, isPrivileged, companySettings?.eodGraceDays]);
  
  // Disable editing if submitted AND user is not privileged AND grace period has expired
  const isDisabled = isSubmitted && !isPrivileged && !canEditWithinGracePeriod;
  
  // If report can be edited within grace period, treat it as draft for UI purposes
  const isEffectivelyDraft = isSubmitted && !isPrivileged && canEditWithinGracePeriod;

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

      {timerWarning && (
        <FeedbackToast
          message={timerWarning}
          onDismiss={() => setTimerWarning(null)}
          tone="warning"
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
                isSubmitted && !isEffectivelyDraft ? 'bg-emerald-100 text-emerald-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {isSubmitted && !isEffectivelyDraft
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
            <MentionInput
              value={watch('summary') || ''}
              onChange={(value) => setValue('summary', value)}
              rows={4}
              placeholder="What were the highlights of your day? Type @ to mention someone"
              multiline={true}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:bg-muted disabled:cursor-not-allowed"
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

                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase text-muted-foreground">
                    Type of Work * (select all that apply)
                  </label>
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 md:grid-cols-4">
                    {WORK_TYPE_OPTIONS.map((option) => {
                      const fieldName = `tasks.${index}.typeOfWorkDone` as const;
                      const currentValues = watch(fieldName) || [];
                      const isChecked = Array.isArray(currentValues) && currentValues.includes(option.value);
                      
                      return (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition ${
                            isChecked
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-border bg-card hover:bg-muted'
                          } ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const currentArray = watch(fieldName) || [];
                              let newArray: string[];
                              
                              if (e.target.checked) {
                                // Checking a checkbox - always valid
                                newArray = Array.isArray(currentArray) 
                                  ? [...currentArray, option.value]
                                  : [option.value];
                                clearErrors(fieldName);
                                setValue(fieldName, newArray, { shouldValidate: true });
                              } else {
                                // Unchecking a checkbox
                                newArray = Array.isArray(currentArray)
                                  ? currentArray.filter((val: string) => val !== option.value)
                                  : [];
                                
                                // Ensure at least one is selected
                                if (newArray.length > 0) {
                                  // Valid - allow unchecking
                                  clearErrors(fieldName);
                                  setValue(fieldName, newArray, { shouldValidate: true });
                                } else {
                                  // Trying to uncheck the last option - prevent it
                                  // Don't update the value (keeps checkbox checked)
                                  // Don't set an error (form is still valid)
                                  // Clear any existing errors
                                  clearErrors(fieldName);
                                  // Reset checkbox to checked state immediately to prevent visual flash
                                  e.target.checked = true;
                                }
                              }
                            }}
                            disabled={isDisabled}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium">{option.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  {errors.tasks?.[index]?.typeOfWorkDone && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.tasks[index]?.typeOfWorkDone?.message as string || 'At least one type of work must be selected'}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
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
                      step="0.01"
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
                      step="0.01"
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
              step="0.01"
              min="0"
              {...hoursWorkedRegister}
              onChange={handleHoursWorkedChange}
              placeholder={calculatedHoursWorked > 0 ? calculatedHoursWorked.toString() : "8"}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              disabled={isDisabled}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Automatically calculated from tasks: {calculatedHoursWorked.toFixed(2)} hours
              {hoursWorkedManuallyEdited && isEdit && (
                <span className="ml-2 text-amber-600">(manually edited)</span>
              )}
            </p>
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
              {isSubmitted && !isEffectivelyDraft ? 'Submitted' : isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}



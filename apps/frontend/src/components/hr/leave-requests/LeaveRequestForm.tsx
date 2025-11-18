import { useEffect, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { parseISO, isValid, isWeekend, format } from 'date-fns';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveRequestsApi } from '@/lib/api/hr';
import { holidaysApi } from '@/lib/api/hr/holidays';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import type {
  LeaveRequest,
  CreateLeaveRequestDto,
  UpdateLeaveRequestDto,
} from '@/types/hr';
import { LeaveType, LeaveRequestStatus } from '@/types/hr';
import { X } from 'lucide-react';
import { MentionInput } from '@/components/shared/MentionInput';

interface LeaveRequestFormProps {
  request?: LeaveRequest;
  onClose: () => void;
  onSuccess: () => void;
  employeeId?: string;
}

type FormValues = CreateLeaveRequestDto | UpdateLeaveRequestDto;

const LEAVE_TYPES: Array<{ label: string; value: LeaveType }> = [
  { label: 'Annual Leave', value: LeaveType.ANNUAL },
  { label: 'Sick Leave', value: LeaveType.SICK },
  { label: 'Personal Leave', value: LeaveType.PERSONAL },
  { label: 'Unpaid Leave', value: LeaveType.UNPAID },
  { label: 'Maternity Leave', value: LeaveType.MATERNITY },
  { label: 'Paternity Leave', value: LeaveType.PATERNITY },
  { label: 'Bereavement Leave', value: LeaveType.BEREAVEMENT },
];

const LEAVE_STATUS: Array<{ label: string; value: LeaveRequestStatus }> = [
  { label: 'Pending', value: LeaveRequestStatus.PENDING },
  { label: 'Approved', value: LeaveRequestStatus.APPROVED },
  { label: 'Rejected', value: LeaveRequestStatus.REJECTED },
  { label: 'Cancelled', value: LeaveRequestStatus.CANCELLED },
];

export function LeaveRequestForm({ request, onClose, onSuccess, employeeId }: LeaveRequestFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!request;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: request
      ? {
          startDate: request.startDate.split('T')[0],
          endDate: request.endDate.split('T')[0],
          type: request.type,
          totalDays: request.totalDays,
          reason: request.reason || '',
          status: request.status,
        }
      : {
          type: LeaveType.ANNUAL,
          status: LeaveRequestStatus.PENDING,
          totalDays: 1,
        },
  });

  const startDate = watch('startDate');
  const endDate = watch('endDate');

  // Fetch holidays for the year(s) that might be in the date range
  const startYear = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
  const endYear = endDate ? new Date(endDate).getFullYear() : new Date().getFullYear();
  const yearsToFetch = useMemo(() => {
    const years = new Set<number>();
    for (let year = startYear; year <= endYear; year++) {
      years.add(year);
    }
    return Array.from(years);
  }, [startYear, endYear]);

  const holidaysQueries = useQuery({
    queryKey: ['holidays', yearsToFetch],
    queryFn: async () => {
      const allHolidays = await Promise.all(
        yearsToFetch.map((year) => holidaysApi.getAll(year)),
      );
      return allHolidays.flat();
    },
    enabled: yearsToFetch.length > 0,
  });

  const holidays = holidaysQueries.data ?? [];

  // Calculate working days (excluding weekends and holidays)
  const calculateWorkingDays = useMemo(() => {
    return (start: Date, end: Date): number => {
      if (start > end) {
        return 0;
      }

      const holidayDates = new Set(
        holidays.map((h) => format(new Date(h.date), 'yyyy-MM-dd')),
      );

      let workingDays = 0;
      const current = new Date(start);

      while (current <= end) {
        const dateKey = format(current, 'yyyy-MM-dd');
        const isWeekendDay = isWeekend(current);
        const isHoliday = holidayDates.has(dateKey);

        if (!isWeekendDay && !isHoliday) {
          workingDays++;
        }

        current.setDate(current.getDate() + 1);
      }

      return workingDays;
    };
  }, [holidays]);

  useEffect(() => {
    if (startDate && endDate) {
      const start = parseISO(startDate);
      const end = parseISO(endDate);

      if (isValid(start) && isValid(end)) {
        // Only calculate if holidays are loaded (or if there are no holidays to load)
        if (holidaysQueries.isSuccess || holidaysQueries.isError || yearsToFetch.length === 0) {
          const workingDays = calculateWorkingDays(start, end);
          setValue('totalDays', workingDays > 0 ? workingDays : 1, { shouldValidate: true });
        }
      }
    }
  }, [startDate, endDate, setValue, calculateWorkingDays, holidaysQueries.isSuccess, holidaysQueries.isError, yearsToFetch.length]);

  const createMutation = useMutation({
    mutationFn: (data: CreateLeaveRequestDto) => leaveRequestsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      onSuccess();
      onClose();
      setErrorMessage(null);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Unable to submit leave request right now.';
      setErrorMessage(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateLeaveRequestDto) => leaveRequestsApi.update(request!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-request', request!.id] });
      onSuccess();
      onClose();
      setErrorMessage(null);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Unable to update leave request right now.';
      setErrorMessage(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const onSubmit = (data: FormValues) => {
    const payload: FormValues = {
      ...data,
      ...(employeeId ? { employeeId } : {}),
    };

    if (isEdit) {
      updateMutation.mutate(payload as UpdateLeaveRequestDto);
    } else {
      createMutation.mutate(payload as CreateLeaveRequestDto);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card-elevated shadow-xl">
        {errorMessage && (
          <FeedbackToast
            message={errorMessage}
            onDismiss={() => setErrorMessage(null)}
            tone="error"
          />
        )}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Update Leave Request' : 'New Leave Request'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Modify the details of the leave request.'
                : 'Submit a new leave request.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Start Date *</label>
              <input
                type="date"
                {...register('startDate', { required: 'Start date is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">End Date *</label>
              <input
                type="date"
                {...register('endDate', { required: 'End date is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.endDate && (
                <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Leave Type *</label>
              <select
                {...register('type', { required: 'Leave type is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {LEAVE_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Status *</label>
              <select
                {...register('status')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                disabled={!isEdit}
              >
                {LEAVE_STATUS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {!isEdit && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Status will be set to Pending for new requests.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Reason</label>
            <MentionInput
              value={watch('reason') || ''}
              onChange={(value) => setValue('reason', value)}
              rows={3}
              placeholder="Brief explanation for the leave request. Type @ to mention someone"
              multiline={true}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

         <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Total Days</label>
            <input
              type="number"
              {...register('totalDays', {
                required: true,
                valueAsNumber: true,
                min: { value: 1, message: 'Total days must be at least 1' },
              })}
              readOnly
              className="w-full cursor-not-allowed rounded-lg border border-border bg-muted px-3 py-2 text-muted-foreground"
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
              disabled={createMutation.isPending || updateMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEdit
                ? 'Update Request'
                : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



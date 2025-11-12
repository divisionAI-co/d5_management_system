import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import { format, addHours } from 'date-fns';

import type { CreateEventPayload } from '@/lib/api/google-calendar';

interface GoogleCalendarCreateEventModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateEventPayload) => Promise<void>;
  isSubmitting: boolean;
}

interface FormValues {
  summary: string;
  description: string;
  location: string;
  allDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  attendees: string;
}

function resolveDefaultTimes() {
  const now = new Date();
  const rounded = new Date(now);
  rounded.setMinutes(0, 0, 0);
  const start = addHours(rounded, 1);
  const end = addHours(start, 1);

  return {
    startDate: format(start, 'yyyy-MM-dd'),
    startTime: format(start, 'HH:mm'),
    endDate: format(end, 'yyyy-MM-dd'),
    endTime: format(end, 'HH:mm'),
  };
}

function combineDateAndTime(date: string, time: string) {
  return new Date(`${date}T${time}`);
}

export function GoogleCalendarCreateEventModal({
  open,
  onClose,
  onSubmit,
  isSubmitting,
}: GoogleCalendarCreateEventModalProps) {
  const defaults = resolveDefaultTimes();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      summary: '',
      description: '',
      location: '',
      allDay: false,
      startDate: defaults.startDate,
      startTime: defaults.startTime,
      endDate: defaults.endDate,
      endTime: defaults.endTime,
      attendees: '',
    },
  });

  const allDay = watch('allDay');
  const startDate = watch('startDate');
  const endDate = watch('endDate');

  useEffect(() => {
    if (allDay && !endDate) {
      setValue('endDate', startDate);
    }
  }, [allDay, endDate, setValue, startDate]);

  if (!open) {
    return null;
  }

  const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const onFormSubmit = async (values: FormValues) => {
    clearErrors(['startDate', 'startTime', 'endDate', 'endTime']);

    if (!values.startDate) {
      setError('startDate', { type: 'manual', message: 'Start date is required' });
      return;
    }

    if (!values.endDate) {
      setError('endDate', { type: 'manual', message: 'End date is required' });
      return;
    }

    let start;
    let end;

    if (values.allDay) {
      start = { date: values.startDate };
      end = { date: values.endDate || values.startDate };
    } else {
      if (!values.startTime) {
        setError('startTime', { type: 'manual', message: 'Start time is required' });
        return;
      }

      if (!values.endTime) {
        setError('endTime', { type: 'manual', message: 'End time is required' });
        return;
      }

      const startTime = values.startTime || '09:00';
      const endTime = values.endTime || startTime;

      const startDateTime = combineDateAndTime(values.startDate, startTime);
      const endDateTime = combineDateAndTime(values.endDate || values.startDate, endTime);

      if (endDateTime <= startDateTime) {
        setError('endTime', {
          type: 'manual',
          message: 'End time must be after start time',
        });
        return;
      }

      start = {
        dateTime: startDateTime.toISOString(),
        timeZone: localTimeZone,
      };

      end = {
        dateTime: endDateTime.toISOString(),
        timeZone: localTimeZone,
      };
    }

    const attendees =
      values.attendees
        ?.split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((email) => ({ email })) ?? undefined;

    const payload: CreateEventPayload = {
      summary: values.summary,
      description: values.description || undefined,
      location: values.location || undefined,
      start,
      end,
      attendees,
    };

    try {
      await onSubmit(payload);
    } catch (error) {
      // Error feedback is handled by the caller (toast/mutation).
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Create Google Calendar Event</h2>
            <p className="text-sm text-muted-foreground">
              Fill in the details below to add a new event to your Google Calendar.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 px-6 py-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Title *
              </label>
              <input
                type="text"
                {...register('summary', { required: 'Title is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Team sync"
              />
              {errors.summary && (
                <p className="mt-1 text-xs text-red-500">{errors.summary.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                rows={3}
                {...register('description')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Add meeting agenda or notes."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Location</label>
              <input
                type="text"
                {...register('location')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Google Meet, Office, ..."
              />
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                id="google-calendar-all-day"
                type="checkbox"
                {...register('allDay')}
                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="google-calendar-all-day"
                className="text-sm font-medium text-muted-foreground"
              >
                All-day event
              </label>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Start date *
              </label>
              <input
                type="date"
                {...register('startDate', { required: 'Start date is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              {errors.startDate && (
                <p className="mt-1 text-xs text-red-500">{errors.startDate.message}</p>
              )}
            </div>

            {!allDay && (
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Start time *
                </label>
                <input
                  type="time"
                  {...register('startTime', { required: 'Start time is required' })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                {errors.startTime && (
                  <p className="mt-1 text-xs text-red-500">{errors.startTime.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                End date *
              </label>
              <input
                type="date"
                {...register('endDate', { required: 'End date is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              {errors.endDate && (
                <p className="mt-1 text-xs text-red-500">{errors.endDate.message}</p>
              )}
            </div>

            {!allDay && (
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  End time *
                </label>
                <input
                  type="time"
                  {...register('endTime', { required: 'End time is required' })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                {errors.endTime && (
                  <p className="mt-1 text-xs text-red-500">{errors.endTime.message}</p>
                )}
              </div>
            )}

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Attendees (comma separated emails)
              </label>
              <input
                type="text"
                {...register('attendees')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="alex@example.com, taylor@example.com"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              Create event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



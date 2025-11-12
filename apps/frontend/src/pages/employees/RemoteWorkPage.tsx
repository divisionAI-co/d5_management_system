import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, eachDayOfInterval } from 'date-fns';

import { remoteWorkApi, employeesApi } from '@/lib/api/hr';
import type {
  RemoteWorkLog,
  RemoteWorkWindowState,
  SetRemotePreferencesPayload,
  OpenRemoteWindowPayload,
  Employee,
} from '@/types/hr';
import { useAuthStore } from '@/lib/stores/auth-store';
import { FeedbackToast } from '@/components/ui/feedback-toast';

interface DateFilters {
  startDate?: string;
  endDate?: string;
}

interface ManagerFilters extends DateFilters {
  employeeId?: string;
}

const MAX_REMOTE_DAYS = 3;

function normalizeDateInput(value?: string) {
  return value && value.trim().length > 0 ? value : undefined;
}

function isDateWithinWindow(date: string, window: RemoteWorkWindowState) {
  if (!window.startDate || !window.endDate) return false;
  const target = parseISO(date);
  const start = parseISO(window.startDate);
  const end = parseISO(window.endDate);
  return target >= start && target <= end;
}

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day >= 1 && day <= 5; // Monday (1) to Friday (5)
}

function validateBusinessDay(dateString: string | null | undefined): string | null {
  if (!dateString) return null;
  const date = parseISO(dateString);
  if (!isBusinessDay(date)) {
    return 'Please select a business day (Monday-Friday).';
  }
  return null;
}

export default function RemoteWorkPage() {
  const { user } = useAuthStore();
  const role = user?.role;
  const isManager = role === 'ADMIN' || role === 'HR';
  const queryClient = useQueryClient();

  const [feedback, setFeedback] = useState<string | null>(null);
  const [filters, setFilters] = useState<ManagerFilters>({});
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>(undefined);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([]);
  const [startDateError, setStartDateError] = useState<string | null>(null);
  const [endDateError, setEndDateError] = useState<string | null>(null);

  const windowQuery = useQuery<RemoteWorkWindowState>({
    queryKey: ['remote-work', 'window'],
    queryFn: remoteWorkApi.getWindow,
    refetchInterval: 60_000,
  });

  const activeWindow = windowQuery.data;
  const windowLimit = activeWindow
    ? Math.min(activeWindow.limit ?? MAX_REMOTE_DAYS, MAX_REMOTE_DAYS)
    : MAX_REMOTE_DAYS;

  const employeeFilter = isManager ? { ...filters, employeeId: selectedEmployeeId } : filters;
  const logsQuery = useQuery<RemoteWorkLog[]>({
    queryKey: [
      'remote-work',
      isManager ? 'logs' : 'my-logs',
      employeeFilter.startDate ?? null,
      employeeFilter.endDate ?? null,
      isManager ? employeeFilter.employeeId ?? null : null,
    ],
    queryFn: () =>
      isManager
        ? remoteWorkApi.listLogs({
            employeeId: normalizeDateInput(employeeFilter.employeeId),
            startDate: normalizeDateInput(employeeFilter.startDate),
            endDate: normalizeDateInput(employeeFilter.endDate),
          })
        : remoteWorkApi.listMyLogs({
            startDate: normalizeDateInput(employeeFilter.startDate),
            endDate: normalizeDateInput(employeeFilter.endDate),
          }),
  });

  useEffect(() => {
    if (!isManager) {
      setSelectedEmployeeId(undefined);
    }
  }, [isManager]);

  useEffect(() => {
    if (!isManager || employeeSearchTerm.trim().length === 0) {
      setEmployeeOptions([]);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await employeesApi.getAll({
          search: employeeSearchTerm.trim(),
          page: 1,
          pageSize: 10,
        });
        setEmployeeOptions(response.data);
      } catch (error: unknown) {
        console.error('Failed to load employees', error);
      }
    }, 300);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [employeeSearchTerm, isManager]);

  useEffect(() => {
    if (!activeWindow) {
      setSelectedDates([]);
      return;
    }

    if (!logsQuery.data) return;
    const windowDates =
      logsQuery.data
        ?.filter((log) => isDateWithinWindow(log.date, activeWindow))
        .map((log) => log.date.slice(0, 10)) ?? [];

    setSelectedDates(windowDates);
  }, [activeWindow, logsQuery.data]);

  const openWindowMutation = useMutation({
    mutationFn: (payload: OpenRemoteWindowPayload) => remoteWorkApi.openWindow(payload),
    onSuccess: () => {
      setFeedback('Remote work window opened successfully.');
      queryClient.invalidateQueries({ queryKey: ['remote-work', 'window'] });
      queryClient.invalidateQueries({ queryKey: ['remote-work', 'logs'] });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Unable to open remote window right now.';
      setFeedback(String(message));
    },
  });

  const closeWindowMutation = useMutation({
    mutationFn: () => remoteWorkApi.closeWindow(),
    onSuccess: () => {
      setFeedback('Remote work window closed.');
      queryClient.invalidateQueries({ queryKey: ['remote-work', 'window'] });
      queryClient.invalidateQueries({ queryKey: ['remote-work', 'logs'] });
      setSelectedDates([]);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Unable to close remote window right now.';
      setFeedback(String(message));
    },
  });

  const preferencesMutation = useMutation({
    mutationFn: (payload: SetRemotePreferencesPayload) => remoteWorkApi.setPreferences(payload),
    onSuccess: () => {
      setFeedback('Remote work preferences saved.');
      queryClient.invalidateQueries({ queryKey: ['remote-work', 'logs'] });
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Unable to save preferences right now.';
      setFeedback(String(message));
    },
  });

  const weekDates = useMemo(() => {
    if (!activeWindow?.isOpen || !activeWindow.startDate || !activeWindow.endDate) {
      return [];
    }

    const start = parseISO(activeWindow.startDate);
    const end = parseISO(activeWindow.endDate);

    return eachDayOfInterval({ start, end }).map((date) => ({
      full: date,
      value: format(date, 'yyyy-MM-dd'),
      label: format(date, 'EEE, MMM d'),
    }));
  }, [activeWindow]);

  const displayedLogs = logsQuery.data ?? [];

  const handleDateToggle = (dateValue: string) => {
    setSelectedDates((prev) => {
      if (prev.includes(dateValue)) {
        return prev.filter((value) => value !== dateValue);
      }

      if (prev.length >= windowLimit) {
        return prev;
      }

      return [...prev, dateValue];
    });
  };

  const handleSavePreferences = () => {
    preferencesMutation.mutate({
      dates: selectedDates,
      reason: notes.trim() || undefined,
    });
  };

  const handleFilterSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startDate = formData.get('startDate')?.toString();
    const endDate = formData.get('endDate')?.toString();
    setFilters({
      startDate: normalizeDateInput(startDate),
      endDate: normalizeDateInput(endDate),
      employeeId: isManager ? selectedEmployeeId : undefined,
    });
  };

  const renderWindowStatus = () => {
    if (windowQuery.isLoading) {
      return <p className="text-sm text-muted-foreground">Loading window status…</p>;
    }

    if (windowQuery.isError || !activeWindow) {
      return (
        <p className="text-sm text-red-500">Could not load remote window status at this time.</p>
      );
    }

    if (!activeWindow.isOpen) {
      return (
        <p className="text-sm text-muted-foreground">
          The remote work window is currently closed. HR or Admin can open a new window when the
          next weekly plan is ready.
        </p>
      );
    }

    const rangeLabel =
      activeWindow.startDate && activeWindow.endDate
        ? `${format(parseISO(activeWindow.startDate), 'MMM d')} – ${format(
            parseISO(activeWindow.endDate),
            'MMM d',
          )}`
        : 'Unknown window range';

    return (
      <p className="text-sm text-muted-foreground">
        Remote work window is open for <span className="font-medium">{rangeLabel}</span>. Select up
        to <span className="font-semibold">{windowLimit}</span> remote day(s) for this period.
      </p>
    );
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <FeedbackToast message={feedback} onDismiss={() => setFeedback(null)} tone="info" />
      )}

      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-foreground">Remote Work Management</h1>
        <p className="text-sm text-muted-foreground">
          Submit and review remote work plans. HR and Admin can open or close the weekly submission
          window and review responses across the team.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Window Status</h2>
            {renderWindowStatus()}
          </div>

          {isManager && (
            <div className="flex flex-wrap items-center gap-2">
              {activeWindow?.isOpen ? (
                <button
                  type="button"
                  disabled={closeWindowMutation.isPending}
                  onClick={() => closeWindowMutation.mutate()}
                  className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {closeWindowMutation.isPending ? 'Closing…' : 'Close Window'}
                </button>
              ) : (
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const formData = new FormData(event.currentTarget);
                    const startDate = formData.get('windowStart')?.toString();
                    const endDate = formData.get('windowEnd')?.toString();

                    if (!startDate) {
                      setFeedback('Select a start date to open the window.');
                      return;
                    }

                    const startError = validateBusinessDay(startDate);
                    const endError = endDate ? validateBusinessDay(endDate) : null;

                    if (startError || endError) {
                      setStartDateError(startError);
                      setEndDateError(endError);
                      setFeedback(startError || endError || 'Please select business days only.');
                      return;
                    }

                    setStartDateError(null);
                    setEndDateError(null);
                    openWindowMutation.mutate({
                      startDate,
                      endDate: normalizeDateInput(endDate),
                    });
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                      Week start
                    </label>
                    <input
                      type="date"
                      name="windowStart"
                      className={`rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 ${
                        startDateError
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-border'
                      }`}
                      required
                      onChange={(e) => {
                        const error = validateBusinessDay(e.target.value);
                        setStartDateError(error);
                        if (error) {
                          setFeedback(error);
                        } else {
                          setFeedback(null);
                        }
                      }}
                    />
                    {startDateError && (
                      <span className="text-xs text-red-500">{startDateError}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold uppercase text-muted-foreground">
                      Week end (optional)
                    </label>
                    <input
                      type="date"
                      name="windowEnd"
                      className={`rounded-lg border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 ${
                        endDateError
                          ? 'border-red-500 focus:ring-red-500'
                          : 'border-border'
                      }`}
                      placeholder="Optional end"
                      onChange={(e) => {
                        const error = validateBusinessDay(e.target.value);
                        setEndDateError(error);
                        if (error) {
                          setFeedback(error);
                        } else {
                          setFeedback(null);
                        }
                      }}
                    />
                    {endDateError && (
                      <span className="text-xs text-red-500">{endDateError}</span>
                    )}
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={openWindowMutation.isPending || !!startDateError || !!endDateError}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {openWindowMutation.isPending ? 'Opening…' : 'Open Window'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {!isManager && activeWindow?.isOpen && (
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">
                Select remote days for this window
              </h3>
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {weekDates.map((day) => {
                  const isChecked = selectedDates.includes(day.value);
                  const isDisabled = !isChecked && selectedDates.length >= windowLimit;
                  return (
                    <label
                      key={day.value}
                      className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                        isChecked
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                          : 'border-border bg-background hover:border-blue-500 hover:text-blue-600'
                      } ${isDisabled ? 'opacity-50' : ''}`}
                    >
                      <span>{day.label}</span>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={() => handleDateToggle(day.value)}
                      />
                    </label>
                  );
                })}
                {weekDates.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Select the week start to open a window.
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Notes (optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Share any context your manager should know."
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDates([]);
                    setNotes('');
                  }}
                  className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Clear
                </button>
                <button
                  type="button"
                  disabled={preferencesMutation.isPending}
                  onClick={handleSavePreferences}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {preferencesMutation.isPending ? 'Saving…' : 'Save Selection'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">Remote Work History</h2>
          <form
            className="grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(180px,1fr))]"
            onSubmit={handleFilterSubmit}
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Start date
              </label>
              <input
                type="date"
                name="startDate"
                defaultValue={filters.startDate}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                End date
              </label>
              <input
                type="date"
                name="endDate"
                defaultValue={filters.endDate}
                className="rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {isManager && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Employee
                </label>
                <input
                  type="text"
                  placeholder="Search employee name or email"
                  value={employeeSearchTerm}
                  onChange={(event) => setEmployeeSearchTerm(event.target.value)}
                  className="rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                {employeeOptions.length > 0 && (
                  <select
                    value={selectedEmployeeId ?? ''}
                    onChange={(event) =>
                      setSelectedEmployeeId(event.target.value || undefined)
                    }
                    className="rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All employees</option>
                    {employeeOptions.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.user?.firstName} {employee.user?.lastName} ({employee.user?.email})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="flex items-end gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Apply filters
              </button>
              <button
                type="button"
                onClick={() => {
                  setFilters({});
                  setSelectedEmployeeId(undefined);
                  setEmployeeSearchTerm('');
                  queryClient.invalidateQueries({
                    queryKey: ['remote-work', isManager ? 'logs' : 'my-logs'],
                  });
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="overflow-hidden rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                {isManager && <th className="px-4 py-3 text-left font-semibold">Employee</th>}
                <th className="px-4 py-3 text-left font-semibold">Reason</th>
                <th className="px-4 py-3 text-left font-semibold">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card text-muted-foreground">
              {logsQuery.isLoading ? (
                <tr>
                  <td colSpan={isManager ? 4 : 3} className="px-4 py-6 text-center">
                    Loading remote work logs…
                  </td>
                </tr>
              ) : displayedLogs.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 4 : 3} className="px-4 py-6 text-center">
                    No remote work entries found for the selected filters.
                  </td>
                </tr>
              ) : (
                displayedLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3 text-foreground">
                      {format(parseISO(log.date), 'EEE, MMM d, yyyy')}
                    </td>
                    {isManager && (
                      <td className="px-4 py-3">
                        {log.employee?.user
                          ? `${log.employee.user.firstName} ${log.employee.user.lastName}`
                          : '—'}
                        <div className="text-xs text-muted-foreground">
                          {log.employee?.user?.email ?? ''}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3">{log.reason ?? '—'}</td>
                    <td className="px-4 py-3">
                      {format(parseISO(log.createdAt), 'MMM d, yyyy • HH:mm')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}


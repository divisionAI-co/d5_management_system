import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eodReportsApi } from '@/lib/api/hr';
import type { EodReport } from '@/types/hr';
import { addDays, endOfDay, format, startOfMonth } from 'date-fns';
import { ChevronDown, ChevronRight, ClipboardList, Edit3, Plus, UploadCloud } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@/types/enums';

interface EodReportsListProps {
  onCreateNew?: () => void;
  onEdit?: (report: EodReport) => void;
  filterUserId?: string;
  contextLabel?: string;
  onImport?: () => void;
  canImport?: boolean;
}

export function EodReportsList({
  onCreateNew,
  onEdit,
  filterUserId,
  contextLabel,
  onImport,
  canImport,
}: EodReportsListProps) {
  const { user } = useAuthStore();
  const isPrivileged =
    user?.role === UserRole.ADMIN || user?.role === UserRole.HR;
  
  // Default dates: beginning of current month to today
  const getDefaultStartDate = () => format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const getDefaultEndDate = () => format(new Date(), 'yyyy-MM-dd');
  
  const [startDate, setStartDate] = useState<string>(getDefaultStartDate());
  const [endDate, setEndDate] = useState<string>(getDefaultEndDate());
  const [selectedEmployee, setSelectedEmployee] = useState<string>(filterUserId ?? '');
  const [page, setPage] = useState(1);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const pageSize = 10;

  useEffect(() => {
    if (filterUserId) {
      setSelectedEmployee(filterUserId);
    } else {
      setSelectedEmployee('');
    }
  }, [filterUserId]);

  const { data: reportsResponse, isLoading } = useQuery({
    queryKey: [
      'eod-reports',
      filterUserId || selectedEmployee,
      startDate,
      endDate,
      page,
      pageSize,
      isPrivileged,
      user?.id,
    ],
    queryFn: async () => {
      const filters = {
        page,
        pageSize,
        startDate,
        endDate,
        userId: filterUserId || selectedEmployee || undefined,
      };

      console.log('EOD: Fetching with filters:', filters);

      const result = isPrivileged
        ? await eodReportsApi.getAll(filters)
        : await eodReportsApi.getMine(filters);

      console.log('EOD: Received response:', {
        isArray: Array.isArray(result),
        hasData: !Array.isArray(result) && !!result.data,
        dataLength: Array.isArray(result) ? result.length : result.data?.length,
        hasMeta: !Array.isArray(result) && !!result.meta,
        meta: !Array.isArray(result) ? result.meta : undefined,
      });

      return result;
    },
  });

  // Handle both old format (array) and new format (paginated object)
  const reports = useMemo(() => {
    if (!reportsResponse) {
      return [];
    }
    // If it's an array (old format), return it directly
    if (Array.isArray(reportsResponse)) {
      console.warn('EOD: Received array format instead of paginated format. Backend may not be paginating correctly.');
      return reportsResponse;
    }
    // If it's the new paginated format, return the data array
    const data = reportsResponse.data ?? [];
    console.log('EOD: Paginated response - data length:', data.length, 'meta:', reportsResponse.meta);
    if (data.length > pageSize) {
      console.warn(`EOD: Received ${data.length} items but pageSize is ${pageSize}. Backend pagination may not be working.`);
    }
    return data;
  }, [reportsResponse, pageSize]);

  const meta = useMemo(() => {
    if (!reportsResponse || Array.isArray(reportsResponse)) {
      return undefined;
    }
    return reportsResponse.meta;
  }, [reportsResponse]);

  // For employee dropdown, we need to fetch all unique employees
  // This is a separate query that doesn't need pagination
  const { data: allReportsForEmployees } = useQuery({
    queryKey: ['eod-reports', 'employees-list', filterUserId || selectedEmployee, startDate, endDate],
    queryFn: async () => {
      const filters = {
        page: 1,
        pageSize: 100, // Get first 100 to extract employee list
        startDate,
        endDate,
        userId: filterUserId || selectedEmployee || undefined,
      };

      if (isPrivileged) {
        return eodReportsApi.getAll(filters);
      }
      return eodReportsApi.getMine(filters);
    },
    enabled: !filterUserId, // Only fetch if we need to show employee filter
  });

  const employeeOptions = useMemo(() => {
    const reportsForEmployees = allReportsForEmployees?.data ?? [];
    if (reportsForEmployees.length === 0) {
      return [];
    }

    const map = new Map<string, { id: string; label: string }>();
    reportsForEmployees.forEach((report) => {
      if (report.user) {
        const label = `${report.user.firstName ?? ''} ${report.user.lastName ?? ''}`.trim() || report.user.email;
        map.set(report.userId, { id: report.userId, label });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allReportsForEmployees]);

  const handleFilterChange = (updater: () => void) => {
    updater();
    setPage(1);
  };

  const toggleExpand = (reportId: string) => {
    setExpandedReports((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) {
        next.delete(reportId);
      } else {
        next.add(reportId);
      }
      return next;
    });
  };

  const isReportExpanded = (reportId: string) => expandedReports.has(reportId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">EOD Reports</h1>
            <p className="text-sm text-muted-foreground">
              {contextLabel
                ? `Viewing reports for ${contextLabel}`
                : 'Track daily end-of-day submissions'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {canImport && onImport && (
            <button
              onClick={onImport}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <UploadCloud className="h-4 w-4" />
              Import Reports
            </button>
          )}
          {onCreateNew && (
            <button
              onClick={onCreateNew}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
            >
              <Plus className="h-5 w-5" />
              New Report
            </button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => handleFilterChange(() => setStartDate(event.target.value))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) => handleFilterChange(() => setEndDate(event.target.value))}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </label>

          {isPrivileged && !filterUserId && (
            <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
              Employee
              <select
                value={selectedEmployee}
                onChange={(event) => handleFilterChange(() => setSelectedEmployee(event.target.value))}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All employees</option>
                {employeeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : reports && Array.isArray(reports) && reports.length > 0 ? (
        <div className="space-y-4">
          {reports.map((report: EodReport) => {
            const now = new Date();
            const reportDate = new Date(report.date);
            const editDeadline = endOfDay(addDays(reportDate, 1));
            const isOwner = !!user?.id && user.id === report.userId;
            const isDraft = !report.submittedAt;
            const withinWindow = now.getTime() <= editDeadline.getTime();
            const canEdit =
              !!onEdit &&
              (isPrivileged || (isOwner && (isDraft || withinWindow)));

            const hours =
              report.hoursWorked !== undefined && report.hoursWorked !== null
                ? Number(report.hoursWorked)
                : null;
            const safeHours = hours !== null && !Number.isNaN(hours) ? hours : null;
            const expanded = isReportExpanded(report.id);

            return (
              <div
                key={report.id}
                className="space-y-3 rounded-lg border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => toggleExpand(report.id)}
                    className="flex flex-1 items-start gap-3 text-left"
                  >
                    <span className="mt-0.5 rounded-full border border-border bg-muted p-1 text-muted-foreground">
                      {expanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {format(new Date(report.date), 'EEEE, MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.submittedAt
                          ? `Submitted ${format(new Date(report.submittedAt), 'MMM dd, yyyy HH:mm')}`
                          : 'Draft'}
                      </p>
                      {!filterUserId && report.user && (
                        <p className="text-xs text-muted-foreground">
                          {report.user.firstName} {report.user.lastName}
                        </p>
                      )}
                      {!expanded && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {report.summary}
                        </p>
                      )}
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                        report.submittedAt
                          ? report.isLate
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {report.submittedAt ? (report.isLate ? 'Late' : 'On time') : 'Draft'}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit?.(report)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground">Summary</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{report.summary}</p>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground">Tasks</h3>
                      <div className="mt-2 overflow-hidden rounded-md border border-border">
                        <table className="min-w-full divide-y divide-border text-xs">
                          <thead className="bg-muted text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Client / Ticket</th>
                              <th className="px-3 py-2 text-left font-semibold">Type</th>
                              <th className="px-3 py-2 text-left font-semibold">Lifecycle</th>
                              <th className="px-3 py-2 text-left font-semibold">Status</th>
                              <th className="px-3 py-2 text-right font-semibold">Est. (h)</th>
                              <th className="px-3 py-2 text-right font-semibold">Spent (h)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border bg-card text-muted-foreground">
                            {report.tasksWorkedOn.map((task, index) => {
                              if (typeof task === 'string') {
                                return (
                                  <tr key={index}>
                                    <td className="px-3 py-2" colSpan={6}>
                                      {task}
                                    </td>
                                  </tr>
                                );
                              }

                              const estimated =
                                task.taskEstimatedTime !== undefined && task.taskEstimatedTime !== null
                                  ? Number(task.taskEstimatedTime)
                                  : null;
                              const spent =
                                task.timeSpentOnTicket !== undefined ? Number(task.timeSpentOnTicket) : null;
                              const typeLabel = task.typeOfWorkDone ? task.typeOfWorkDone.replace('_', ' ') : '—';
                              const lifecycleLabel = task.taskLifecycle ?? '—';
                              const statusLabel = task.taskStatus ? task.taskStatus.replace('_', ' ') : '—';

                              return (
                                <tr key={index}>
                                  <td className="px-3 py-2">
                                    <p className="font-medium text-foreground">{task.clientDetails ?? '—'}</p>
                                    <p className="text-muted-foreground">{task.ticket ?? '—'}</p>
                                  </td>
                                  <td className="px-3 py-2">{typeLabel}</td>
                                  <td className="px-3 py-2">{lifecycleLabel}</td>
                                  <td className="px-3 py-2">{statusLabel}</td>
                                  <td className="px-3 py-2 text-right">
                                    {estimated !== null && !Number.isNaN(estimated) ? estimated : '—'}
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    {spent !== null && !Number.isNaN(spent) ? spent : '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {safeHours !== null && (
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Hours worked: {safeHours}
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {(meta || (reports && reports.length > 0)) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              {meta ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Showing {(meta.page - 1) * meta.pageSize + 1}-
                    {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} reports
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={meta.page === 1}
                      className="inline-flex items-center rounded-md border border-border px-3 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-medium text-muted-foreground">
                      Page {meta.page} of {meta.pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage((prev) => Math.min(meta.pageCount, prev + 1))}
                      disabled={meta.page === meta.pageCount}
                      className="inline-flex items-center rounded-md border border-border px-3 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Showing {reports.length} report{reports.length !== 1 ? 's' : ''}
                    {reports.length > pageSize && ` (backend pagination not working - showing all ${reports.length} results)`}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Pagination controls unavailable - backend may not be returning paginated response
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : reportsResponse && (!reports || reports.length === 0) ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {contextLabel
            ? `No EOD reports recorded for ${contextLabel} in the selected date range.`
            : 'No EOD reports found in the selected date range.'}
        </div>
      ) : null}
    </div>
  );
}



import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eodReportsApi } from '@/lib/api/hr';
import type { EodReport } from '@/types/hr';
import { addDays, endOfDay, format } from 'date-fns';
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
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>(filterUserId ?? '');
  const [selectedProject, setSelectedProject] = useState<string>('');
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

  const { data: reports, isLoading } = useQuery({
    queryKey: ['eod-reports', filterUserId, isPrivileged, user?.id],
    queryFn: async () => {
      if (isPrivileged) {
        if (filterUserId) {
          return eodReportsApi.getAll({ userId: filterUserId });
        }
        return eodReportsApi.getAll();
      }

      // Non-privileged users can only view their own submissions.
      return eodReportsApi.getMine();
    },
  });

  const employeeOptions = useMemo(() => {
    if (!reports) {
      return [];
    }

    const map = new Map<string, { id: string; label: string }>();
    reports.forEach((report) => {
      if (report.user) {
        const label = `${report.user.firstName ?? ''} ${report.user.lastName ?? ''}`.trim() || report.user.email;
        map.set(report.userId, { id: report.userId, label });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [reports]);

  const projectOptions = useMemo(() => {
    if (!reports) {
      return [];
    }

    const set = new Set<string>();

    reports.forEach((report) => {
      if (Array.isArray(report.tasksWorkedOn)) {
        report.tasksWorkedOn.forEach((task) => {
          if (typeof task === 'string') {
            set.add(task);
          } else if (task && typeof task === 'object' && 'clientDetails' in task) {
            const clientDetails = String(task.clientDetails || '').trim();
            if (clientDetails) {
              set.add(clientDetails);
            }
          }
        });
      }
    });

    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const filteredReports = useMemo(() => {
    if (!reports || reports.length === 0) {
      return [];
    }

    return reports.filter((report) => {
      if (filterUserId && report.userId !== filterUserId) {
        return false;
      }

      if (!filterUserId && selectedEmployee && report.userId !== selectedEmployee) {
        return false;
      }

      if (startDate) {
        const filterStart = new Date(startDate);
        if (new Date(report.date) < filterStart) {
          return false;
        }
      }

      if (endDate) {
        const filterEnd = new Date(endDate);
        const reportDate = new Date(report.date);
        if (reportDate > filterEnd) {
          return false;
        }
      }

      if (selectedProject) {
        const matchProject =
          Array.isArray(report.tasksWorkedOn) &&
          report.tasksWorkedOn.some((task) => {
            if (typeof task === 'string') {
              return task.toLowerCase().includes(selectedProject.toLowerCase());
            }

            if (task && typeof task === 'object' && 'clientDetails' in task) {
              const clientDetails = String(task.clientDetails || '').toLowerCase();
              return clientDetails.includes(selectedProject.toLowerCase());
            }

            return false;
          });

        if (!matchProject) {
          return false;
        }
      }

      return true;
    });
  }, [reports, filterUserId, selectedEmployee, startDate, endDate, selectedProject]);

  const totalPages = useMemo(() => {
    if (!filteredReports.length) {
      return 1;
    }
    return Math.max(1, Math.ceil(filteredReports.length / pageSize));
  }, [filteredReports, pageSize]);

  const currentPage = Math.min(page, totalPages);

  const paginatedReports = useMemo(() => {
    if (!filteredReports.length) {
      return [];
    }

    const startIndex = (currentPage - 1) * pageSize;
    return filteredReports.slice(startIndex, startIndex + pageSize);
  }, [filteredReports, currentPage, pageSize]);

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

          {isPrivileged && (
            <label className="flex flex-col gap-1 text-sm font-medium text-muted-foreground">
              Project
              <select
                value={selectedProject}
                onChange={(event) => handleFilterChange(() => setSelectedProject(event.target.value))}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">All projects</option>
                {projectOptions.map((project) => (
                  <option key={project} value={project}>
                    {project}
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
      ) : paginatedReports && paginatedReports.length > 0 ? (
        <div className="space-y-4">
          {paginatedReports.map((report: EodReport) => {
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

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1}-
              {Math.min(currentPage * pageSize, filteredReports.length)} of {filteredReports.length} reports
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center rounded-md border border-border px-3 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm font-medium text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center rounded-md border border-border px-3 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {contextLabel
            ? `No EOD reports recorded for ${contextLabel}.`
            : 'No EOD reports submitted yet.'}
        </div>
      )}
    </div>
  );
}



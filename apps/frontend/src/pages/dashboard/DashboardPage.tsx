import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { dashboardApi } from '@/lib/api/dashboard';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { DashboardResponse } from '@/types/dashboard';

const formatDate = (value: string | null | undefined, fallback = '—') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return format(date, 'MMM dd, yyyy');
};

const formatDateTime = (value: string | null | undefined, fallback = '—') => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return format(date, 'MMM dd, yyyy HH:mm');
};

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);

  const dashboardQuery = useQuery<DashboardResponse>({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.getMy(),
    enabled: !!user,
  });

  const isAdmin = useMemo(() => user?.role === 'ADMIN', [user?.role]);

  if (!user) {
    return null;
  }

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <div className="mx-auto max-w-3xl rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <h2 className="text-lg font-semibold">Unable to load dashboard</h2>
        <p className="mt-2 text-sm">
          Please refresh the page or try again later. If the problem persists, contact an
          administrator.
        </p>
      </div>
    );
  }

  const data = dashboardQuery.data;

  if (isAdmin || data?.isAdminView) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Welcome back, {user.firstName}! Admin analytics will be available soon.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm">
          Use the navigation above to access CRM, HR, and Operations tools while this overview is
          under construction.
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="space-y-8 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-600">
            Welcome back, {user.firstName}! Track your daily reports, tasks and reminders below.
          </p>
        </div>
        {data.timeframe?.start && data.timeframe?.end && (
          <p className="text-sm uppercase tracking-wide text-gray-500">
            Monitoring period:{' '}
            <span className="font-semibold text-gray-700">
              {formatDate(data.timeframe.start)} – {formatDate(data.timeframe.end)}
            </span>
          </p>
        )}
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-10 w-10 rounded-full bg-red-50 p-2 text-red-500" />
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Missing EOD Reports</p>
              <p className="text-3xl font-bold text-gray-900">{data.stats.missingReports}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="h-10 w-10 rounded-full bg-amber-50 p-2 text-amber-500" />
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Late Submissions</p>
              <p className="text-3xl font-bold text-gray-900">{data.stats.lateReports}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-10 w-10 rounded-full bg-blue-50 p-2 text-blue-500" />
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Total Reports Submitted</p>
              <p className="text-3xl font-bold text-gray-900">{data.stats.totalReports}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-10 w-10 rounded-full bg-emerald-50 p-2 text-emerald-500" />
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">On-Time Streak</p>
              <p className="text-3xl font-bold text-gray-900">
                {Math.max(data.stats.totalReports - data.stats.lateReports, 0)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
              <BookOpen className="h-5 w-5 text-blue-500" />
              Recent EOD Reports
            </h2>
            <span className="text-xs font-semibold uppercase text-gray-400">
              Last {data.recentReports.length} entries
            </span>
          </div>

          {data.recentReports.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
              You have not submitted any EOD reports yet.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.recentReports.map((report) => (
                <li
                  key={report.id}
                  className="rounded-md border border-gray-100 bg-gray-50 p-4 transition hover:bg-gray-100"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDate(report.date)}
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-gray-600">{report.summary}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase">
                      <span
                        className={`rounded-full px-2.5 py-1 ${
                          report.isLate
                            ? 'bg-red-100 text-red-600'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {report.isLate ? 'Late' : 'On Time'}
                      </span>
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-600">
                        {report.hoursWorked !== null ? `${report.hoursWorked} hrs` : '— hrs'}
                      </span>
                      <span className="rounded-full bg-gray-200 px-2.5 py-1 text-gray-700">
                        Submitted {formatDateTime(report.submittedAt)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <FileText className="h-5 w-5 text-purple-500" />
                Tasks Due Soon
              </h2>
              <span className="text-xs uppercase text-gray-400">
                Next {data.tasksDueSoon.length} tasks
              </span>
            </div>

            {data.tasksDueSoon.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                You have no assigned tasks due in the next few days.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.tasksDueSoon.map((task) => (
                  <li
                    key={task.id}
                    className="rounded-md border border-gray-100 bg-gray-50 p-4 transition hover:bg-gray-100"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                        <p className="text-xs uppercase text-gray-500">
                          {task.status.replace('_', ' ')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase">
                        <span
                          className={`rounded-full px-2.5 py-1 ${
                            task.priority === 'URGENT'
                              ? 'bg-red-100 text-red-600'
                              : task.priority === 'HIGH'
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-blue-100 text-blue-600'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-1 ${
                            task.isOverdue
                              ? 'bg-red-100 text-red-600'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {task.isOverdue ? 'Overdue' : 'Due Soon'}
                        </span>
                        <span className="rounded-full bg-gray-200 px-2.5 py-1 text-gray-700">
                          {formatDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
                <CalendarClock className="h-5 w-5 text-teal-500" />
                Upcoming Reminders
              </h2>
              <span className="text-xs uppercase text-gray-400">
                {data.activitiesDueSoon.length} scheduled
              </span>
            </div>

            {data.activitiesDueSoon.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">
                You have no upcoming reminders in the next few days.
              </p>
            ) : (
              <ul className="space-y-3">
                {data.activitiesDueSoon.map((activity) => (
                  <li
                    key={activity.id}
                    className="rounded-md border border-gray-100 bg-gray-50 p-4 transition hover:bg-gray-100"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {activity.title || 'Untitled Reminder'}
                        </p>
                        <p className="text-xs uppercase text-gray-500">
                          {activity.type.replace('_', ' ')}
                        </p>
                        <div className="mt-1 text-xs text-gray-500">
                          {activity.related.customer && (
                            <span className="mr-2 inline-flex items-center gap-1">
                              <span className="font-semibold text-gray-700">Customer:</span>
                              {activity.related.customer.name}
                            </span>
                          )}
                          {activity.related.lead && (
                            <span className="mr-2 inline-flex items-center gap-1">
                              <span className="font-semibold text-gray-700">Lead:</span>
                              {activity.related.lead.title}
                            </span>
                          )}
                          {activity.related.opportunity && (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-semibold text-gray-700">Opportunity:</span>
                              {activity.related.opportunity.title}
                            </span>
                          )}
                          {activity.related.task && (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-semibold text-gray-700">Task:</span>
                              {activity.related.task.title}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase">
                        <span className="rounded-full bg-gray-200 px-2.5 py-1 text-gray-700">
                          Due {formatDate(activity.dueDate)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}


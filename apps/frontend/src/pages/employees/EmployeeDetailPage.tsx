import { useEffect, useMemo, useState } from 'react';
import { Navigate, Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { format, differenceInMonths } from 'date-fns';
import {
  ArrowLeft,
  Edit2,
  Mail,
  PenSquare,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  DollarSign,
} from 'lucide-react';

import { employeesApi } from '@/lib/api/hr';
import type { Employee, LeaveRequest, PerformanceReview, EodReport } from '@/types/hr';
import { EmployeeForm } from '@/components/hr/employees/EmployeeForm';
import { ActivitySidebar } from '@/components/activities/ActivitySidebar';

const employeeStatusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  ON_LEAVE: 'bg-yellow-100 text-yellow-800',
  TERMINATED: 'bg-red-100 text-red-800',
  RESIGNED: 'bg-muted/70 text-foreground',
};

const leaveStatusStyles: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-muted/70 text-foreground',
};

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || 'USD'} ${amount.toLocaleString()}`;
  }
}

function formatDisplayDate(date?: string | null) {
  if (!date) {
    return '—';
  }

  try {
    return format(new Date(date), 'MMM dd, yyyy');
  } catch {
    return date;
  }
}

function formatTenure(hireDate?: string) {
  if (!hireDate) return null;

  try {
    const months = differenceInMonths(new Date(), new Date(hireDate));
    if (months < 0) return null;

    if (months < 12) {
      return `${months} month${months === 1 ? '' : 's'}`;
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (remainingMonths === 0) {
      return `${years} year${years === 1 ? '' : 's'}`;
    }

    return `${years}y ${remainingMonths}m`;
  } catch {
    return null;
  }
}

export default function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEdit, setShowEdit] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showActivitySidebar, setShowActivitySidebar] = useState(
    (location.state as any)?.openActivitySidebar ?? searchParams.get('openActivitySidebar') === 'true' ?? false,
  );

  // Open activity sidebar if navigating from notification or email link
  useEffect(() => {
    if ((location.state as any)?.openActivitySidebar) {
      setShowActivitySidebar(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (searchParams.get('openActivitySidebar') === 'true') {
      setShowActivitySidebar(true);
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('openActivitySidebar');
      newSearchParams.delete('activityId');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [location.state, searchParams, navigate, location.pathname, setSearchParams]);

  const {
    data: employee,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeesApi.getById(id as string),
    enabled: Boolean(id),
  });

  const { data: stats } = useQuery({
    queryKey: ['employee', id, 'stats'],
    queryFn: () => employeesApi.getStats(id as string),
    enabled: Boolean(id),
  });

  const displayEmployee = useMemo<Employee | null>(() => {
    if (!employee) return null;
    return employee;
  }, [employee]);

  const recentLeaveRequests = useMemo<LeaveRequest[]>(() => {
    return displayEmployee?.leaveRequests ?? [];
  }, [displayEmployee]);

  const recentPerformanceReviews = useMemo<PerformanceReview[]>(() => {
    return displayEmployee?.performanceReviews ?? [];
  }, [displayEmployee]);

  const recentEodReports = useMemo<EodReport[]>(() => {
    return displayEmployee?.eodReports ?? [];
  }, [displayEmployee]);

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['employee', id] });
    queryClient.invalidateQueries({ queryKey: ['employee', id, 'stats'] });
  };

  if (!id) {
    return <Navigate to="/employees" replace />;
  }

  if (isLoading) {
    return (
      <div className="py-10">
        <div className="flex h-24 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
          <div className="flex items-center gap-3 text-muted-foreground">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            Loading employee profile...
          </div>
        </div>
      </div>
    );
  }

  if (isError || !displayEmployee) {
    const serverMessage =
      (error as any)?.response?.data?.message ||
      (error as Error)?.message ||
      'Employee not found';

    return (
      <div className="py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="text-lg font-semibold">Unable to load employee</h2>
          <p className="mt-1 text-sm">
            {Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage}
          </p>
          <Link
            to="/employees"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Employees
          </Link>
        </div>
      </div>
    );
  }

  const { user } = displayEmployee;
  const tenure = formatTenure(displayEmployee.hireDate);
  const statsSummary = stats?.stats;
  const employeeDisplayName =
    `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() ||
    `Employee #${displayEmployee.employeeNumber}`;

  return (
    <div className="py-10 space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <Link
            to="/employees"
            className="text-muted-foreground transition hover:text-muted-foreground"
            aria-label="Back to employees"
          >
            <ArrowLeft className="h-6 w-6" />
          </Link>

          <div>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <h1 className="text-2xl font-bold text-foreground">{employeeDisplayName}</h1>
              {displayEmployee.status && (
                <span
                  className={clsx(
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
                    employeeStatusStyles[displayEmployee.status] ??
                      'bg-muted/70 text-foreground',
                  )}
                >
                  {displayEmployee.status.replace('_', ' ')}
                </span>
              )}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              {displayEmployee.jobTitle} · {displayEmployee.department || 'Unassigned department'}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Employee #{displayEmployee.employeeNumber}
              {tenure && (
                <span className="ml-2 inline-flex items-center gap-1 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Tenure: {tenure}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowActivitySidebar(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <PenSquare className="h-4 w-4" />
            Activities
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Edit2 className="h-4 w-4" />
            Edit Employee
          </button>
        </div>
      </header>

      {statsSummary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <StatsCard label="Total Leave Requests" value={statsSummary.totalLeaveRequests} />
          <StatsCard label="Approved Leaves" value={statsSummary.approvedLeaves} />
          <StatsCard label="Pending Leaves" value={statsSummary.pendingLeaves} />
          <StatsCard label="Performance Reviews" value={statsSummary.performanceReviews} />
          <StatsCard label="EOD Reports Submitted" value={statsSummary.eodReports ?? 0} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 rounded-lg border border-border bg-card p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold text-foreground">Employment Details</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoRow
              icon={Briefcase}
              label="Contract Type"
              value={displayEmployee.contractType.replace('_', ' ')}
            />
            <InfoRow icon={Calendar} label="Hire Date" value={formatDisplayDate(displayEmployee.hireDate)} />
            <InfoRow icon={Calendar} label="Termination Date" value={formatDisplayDate(displayEmployee.terminationDate)} />
            <InfoRow
              icon={DollarSign}
              label="Salary"
              value={formatCurrency(displayEmployee.salary, displayEmployee.salaryCurrency)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InfoRow icon={Mail} label="Email" value={user?.email || '—'} />
            <InfoRow
              icon={MapPin}
              label="Emergency Contact"
              value={displayEmployee.emergencyContactName || '—'}
              secondary={displayEmployee.emergencyContactRelation || undefined}
            />
            <InfoRow
              icon={Phone}
              label="Emergency Phone"
              value={displayEmployee.emergencyContactPhone || '—'}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Quick Links</h2>
          <div className="space-y-3">
            <Link
              to="/employees/leave-requests"
              state={{
                employeeId: displayEmployee.id,
                employeeName: employeeDisplayName,
              }}
              className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
            >
              View Leave Requests
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>
            <Link
              to="/employees/performance-reviews"
              state={{
                employeeId: displayEmployee.id,
                employeeName: employeeDisplayName,
              }}
              className="flex items-center justify-between rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
            >
              View Performance Reviews
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>
            <Link
              to="/employees/eod-reports"
              state={{
                employeeId: displayEmployee.id,
                employeeName: employeeDisplayName,
                userId: displayEmployee.user?.id,
              }}
              className="flex items-center justify-between rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
            >
              View EOD Reports
              <ArrowLeft className="h-4 w-4 rotate-180" />
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Leave Requests</h2>
            <Link
              to="/employees/leave-requests"
              state={{
                employeeId: displayEmployee.id,
                employeeName: employeeDisplayName,
              }}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          {recentLeaveRequests.length === 0 ? (
            <EmptyState message="No leave requests recorded yet." />
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Type</th>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Dates</th>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {recentLeaveRequests.map((request) => (
                    <tr key={request.id} className="hover:bg-muted">
                      <td className="px-4 py-3 text-muted-foreground">{request.type.replace('_', ' ')}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDisplayDate(request.startDate)} – {formatDisplayDate(request.endDate)}
                        <span className="ml-2 text-xs text-muted-foreground">({request.totalDays} days)</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                            leaveStatusStyles[request.status] ?? 'bg-muted/70 text-foreground',
                          )}
                        >
                          {request.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Performance Reviews</h2>
            <Link
              to="/employees/performance-reviews"
              state={{
                employeeId: displayEmployee.id,
                employeeName: employeeDisplayName,
              }}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          {recentPerformanceReviews.length === 0 ? (
            <EmptyState message="No performance reviews recorded yet." />
          ) : (
            <div className="mt-4 space-y-3">
              {recentPerformanceReviews.map((review) => {
                const overall =
                  review.overallRating !== undefined && review.overallRating !== null
                    ? Number(review.overallRating)
                    : null;

                return (
                  <div key={review.id} className="rounded-lg border border-border p-4 hover:border-border">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {formatDisplayDate(review.reviewPeriodStart)} –{' '}
                          {formatDisplayDate(review.reviewPeriodEnd)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reviewer: {review.reviewerName || 'Not specified'}
                        </p>
                      </div>
                      <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {overall !== null && !Number.isNaN(overall) ? overall.toFixed(1) : 'No rating'}
                      </span>
                    </div>
                    {review.strengths && (
                      <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{review.strengths}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">Recent EOD Reports</h2>
          <Link
            to="/employees/eod-reports"
            state={{
              employeeId: displayEmployee.id,
              employeeName: employeeDisplayName,
              userId: displayEmployee.user?.id,
            }}
            className="text-sm font-medium text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>

        {recentEodReports.length === 0 ? (
          <EmptyState message="No EOD reports submitted yet." />
        ) : (
          <div className="mt-4 space-y-3">
            {recentEodReports.map((report) => {
              const hours =
                report.hoursWorked !== undefined && report.hoursWorked !== null
                  ? Number(report.hoursWorked)
                  : null;
              const safeHours = hours !== null && !Number.isNaN(hours) ? hours : null;

              return (
                <div key={report.id} className="rounded-lg border border-border p-4 hover:border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{formatDisplayDate(report.date)}</p>
                      <p className="text-xs text-muted-foreground">
                        {report.submittedAt
                          ? `Submitted ${format(new Date(report.submittedAt), 'MMM dd, yyyy HH:mm')}`
                          : 'Draft'}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                        report.isLate ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {report.isLate ? 'Late' : 'On time'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{report.summary}</p>
                  {safeHours !== null && (
                    <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Hours worked: {safeHours}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {showEdit && (
        <EmployeeForm
          employee={displayEmployee}
          onClose={() => setShowEdit(false)}
          onSuccess={handleEditSuccess}
        />
      )}

      <ActivitySidebar
        open={showActivitySidebar}
        onClose={() => setShowActivitySidebar(false)}
        entityId={displayEmployee.id}
        entityType="employee"
        title="Employee Activities"
      />
    </div>
  );
}

function StatsCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  secondary,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
      <Icon className="mt-1 h-5 w-5 text-muted-foreground" />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground">{value || '—'}</p>
        {secondary && <p className="text-xs text-muted-foreground">{secondary}</p>}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="mt-6 rounded-lg border border-border bg-muted p-6 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { leaveRequestsApi } from '@/lib/api/hr';
import { LeaveRequest, LeaveRequestStatus, LeaveType } from '@/types/hr';
import { format } from 'date-fns';
import { Ban, Calendar, Plus, CheckCircle, XCircle, Pencil } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';

interface LeaveRequestsListProps {
  onCreateNew?: () => void;
  onApprove?: (request: LeaveRequest) => void;
  onReject?: (request: LeaveRequest) => void;
  onEdit?: (request: LeaveRequest) => void;
  onCancel?: (request: LeaveRequest) => void;
  cancellingId?: string | null;
  contextLabel?: string;
  filterEmployeeId?: string;
}

export function LeaveRequestsList({
  onCreateNew,
  onApprove,
  onReject,
  onEdit,
  onCancel,
  cancellingId,
  contextLabel,
  filterEmployeeId,
}: LeaveRequestsListProps) {
  const currentUser = useAuthStore((state) => state.user);
  const userRole = currentUser?.role;
  const canManage = userRole === 'ADMIN' || userRole === 'HR';
  const queryKey = ['leave-requests', filterEmployeeId ?? (canManage ? 'all' : 'mine')];

  const { data: leaveRequests, isLoading } = useQuery({
    queryKey,
    queryFn: () => {
      if (!canManage && !filterEmployeeId) {
        return leaveRequestsApi.getMyRequests();
      }
      return leaveRequestsApi.getAll(
        filterEmployeeId ? { employeeId: filterEmployeeId } : undefined,
      );
    },
  });

  const getStatusColor = (status: LeaveRequestStatus) => {
    const colors = {
      PENDING:
        'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200',
      APPROVED:
        'bg-green-100 text-green-800 dark:bg-emerald-500/20 dark:text-emerald-200',
      REJECTED:
        'bg-red-100 text-red-800 dark:bg-rose-500/20 dark:text-rose-200',
      CANCELLED:
        'bg-gray-100 text-gray-800 dark:bg-slate-500/20 dark:text-slate-200',
    };
    return colors[status];
  };

  const getLeaveTypeColor = (type: LeaveType) => {
    const colors = {
      ANNUAL: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
      SICK: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
      PERSONAL:
        'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200',
      UNPAID:
        'bg-gray-100 text-gray-800 dark:bg-slate-500/20 dark:text-slate-200',
      MATERNITY:
        'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200',
      PATERNITY:
        'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
      BEREAVEMENT:
        'bg-gray-100 text-gray-800 dark:bg-slate-500/20 dark:text-slate-200',
    };
    return colors[type];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Leave Requests</h1>
            <p className="text-sm text-muted-foreground">
              {contextLabel ? `Viewing requests for ${contextLabel}` : 'Manage time-off requests'}
            </p>
          </div>
        </div>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <Plus className="w-5 h-5" />
            New Request
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="py-12 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600 dark:border-blue-400"></div>
        </div>
      ) : leaveRequests && leaveRequests.length > 0 ? (
        <div className="grid gap-4">
          {leaveRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-lg border border-border bg-card p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      {request.employee?.user.firstName} {request.employee?.user.lastName}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getLeaveTypeColor(request.type)}`}>
                      {request.type}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(request.startDate), 'MMM dd, yyyy')} - {format(new Date(request.endDate), 'MMM dd, yyyy')}
                    <span className="ml-2 font-medium text-foreground">({request.totalDays} days)</span>
                  </p>
                  {request.reason && (
                    <p className="mt-2 text-sm text-foreground/80 dark:text-muted-foreground">{request.reason}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  {request.status === 'PENDING' &&
                    onEdit &&
                    currentUser?.id === request.employee?.user.id && (
                      <button
                        onClick={() => onEdit(request)}
                        className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-500/10 dark:text-blue-300"
                        title="Edit request"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                    )}

                  {request.status === 'PENDING' &&
                    onCancel &&
                    currentUser?.id === request.employee?.user.id && (
                      <button
                        onClick={() => onCancel(request)}
                        disabled={cancellingId === request.id}
                        className="rounded-lg p-2 text-amber-500 transition hover:bg-amber-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:text-amber-300"
                        title="Cancel request"
                      >
                        <Ban className="w-5 h-5" />
                      </button>
                    )}

                  {request.status === 'PENDING' && canManage && onApprove && onReject && (
                    <>
                      <button
                        onClick={() => onApprove(request)}
                        className="rounded-lg p-2 text-green-600 transition hover:bg-green-500/10 dark:text-emerald-300"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => onReject(request)}
                        className="rounded-lg p-2 text-red-600 transition hover:bg-red-500/10 dark:text-rose-300"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {contextLabel
            ? `No leave requests found for ${contextLabel}.`
            : 'No leave requests have been submitted yet.'}
        </div>
      )}
    </div>
  );
}


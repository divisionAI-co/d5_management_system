import { useQuery } from '@tanstack/react-query';
import { leaveRequestsApi } from '@/lib/api/hr';
import { LeaveRequest, LeaveRequestStatus, LeaveType } from '@/types/hr';
import { format } from 'date-fns';
import { Calendar, Plus, CheckCircle, XCircle } from 'lucide-react';
import { useAuthStore } from '@/lib/stores/auth-store';

interface LeaveRequestsListProps {
  onCreateNew?: () => void;
  onApprove?: (request: LeaveRequest) => void;
  onReject?: (request: LeaveRequest) => void;
  contextLabel?: string;
  filterEmployeeId?: string;
}

export function LeaveRequestsList({
  onCreateNew,
  onApprove,
  onReject,
  contextLabel,
  filterEmployeeId,
}: LeaveRequestsListProps) {
  const userRole = useAuthStore((state) => state.user?.role);
  const canManage =
    userRole === 'ADMIN' || userRole === 'HR';
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
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      CANCELLED: 'bg-gray-100 text-gray-800',
    };
    return colors[status];
  };

  const getLeaveTypeColor = (type: LeaveType) => {
    const colors = {
      ANNUAL: 'bg-blue-100 text-blue-800',
      SICK: 'bg-red-100 text-red-800',
      PERSONAL: 'bg-purple-100 text-purple-800',
      UNPAID: 'bg-gray-100 text-gray-800',
      MATERNITY: 'bg-pink-100 text-pink-800',
      PATERNITY: 'bg-indigo-100 text-indigo-800',
      BEREAVEMENT: 'bg-gray-100 text-gray-800',
    };
    return colors[type];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
            <p className="text-sm text-gray-500">
              {contextLabel ? `Viewing requests for ${contextLabel}` : 'Manage time-off requests'}
            </p>
          </div>
        </div>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            New Request
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : leaveRequests && leaveRequests.length > 0 ? (
        <div className="grid gap-4">
          {leaveRequests.map((request) => (
            <div key={request.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">
                      {request.employee?.user.firstName} {request.employee?.user.lastName}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getLeaveTypeColor(request.type)}`}>
                      {request.type}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status)}`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {format(new Date(request.startDate), 'MMM dd, yyyy')} - {format(new Date(request.endDate), 'MMM dd, yyyy')}
                    <span className="ml-2 font-medium">({request.totalDays} days)</span>
                  </p>
                  {request.reason && (
                    <p className="text-sm text-gray-700 mt-2">{request.reason}</p>
                  )}
                </div>
                {request.status === 'PENDING' && canManage && onApprove && onReject && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => onApprove(request)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => onReject(request)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-500">
          {contextLabel
            ? `No leave requests found for ${contextLabel}.`
            : 'No leave requests have been submitted yet.'}
        </div>
      )}
    </div>
  );
}


import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { LeaveRequestsList } from '@/components/hr/leave-requests/LeaveRequestsList';
import { LeaveRequestForm } from '@/components/hr/leave-requests/LeaveRequestForm';
import { LeaveApprovalModal } from '@/components/hr/leave-requests/LeaveApprovalModal';
import type { LeaveRequest } from '@/types/hr';
import { useAuthStore } from '@/lib/stores/auth-store';

type ApprovalMode = 'approve' | 'reject';

export default function LeaveRequestsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { employeeId?: string; employeeName?: string } | null;
  const employeeIdFilter = state?.employeeId;
  const employeeName = state?.employeeName;
  const [showForm, setShowForm] = useState(false);
  const [approvalRequest, setApprovalRequest] = useState<LeaveRequest | null>(null);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('approve');
  const queryClient = useQueryClient();
  const userRole = useAuthStore((store) => store.user?.role);

  const canManage = useMemo(
    () => userRole === 'ADMIN' || userRole === 'HR',
    [userRole],
  );

  const handleCreate = () => {
    setShowForm(true);
  };

  const handleApprove = (request: LeaveRequest) => {
    setApprovalRequest(request);
    setApprovalMode('approve');
  };

  const handleReject = (request: LeaveRequest) => {
    setApprovalRequest(request);
    setApprovalMode('reject');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {employeeIdFilter && (
        <div className="mb-4">
          <button
            onClick={() => navigate(`/employees/${employeeIdFilter}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Back to {employeeName || 'Employee'}
          </button>
        </div>
      )}

      <LeaveRequestsList
        onCreateNew={handleCreate}
        onApprove={canManage ? handleApprove : undefined}
        onReject={canManage ? handleReject : undefined}
        contextLabel={employeeName}
        filterEmployeeId={employeeIdFilter}
      />

      {showForm && (
        <LeaveRequestForm
          employeeId={employeeIdFilter}
          onClose={() => {
            setShowForm(false);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
            if (employeeIdFilter) {
              queryClient.invalidateQueries({ queryKey: ['leave-requests', employeeIdFilter] });
            }
          }}
        />
      )}

      {canManage && approvalRequest && (
        <LeaveApprovalModal
          request={approvalRequest}
          mode={approvalMode}
          onClose={() => setApprovalRequest(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
            if (employeeIdFilter) {
              queryClient.invalidateQueries({ queryKey: ['leave-requests', employeeIdFilter] });
            }
          }}
        />
      )}
    </div>
  );
}


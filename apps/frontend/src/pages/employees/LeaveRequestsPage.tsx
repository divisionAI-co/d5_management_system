import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LeaveRequestsList } from '@/components/hr/leave-requests/LeaveRequestsList';
import { LeaveRequestForm } from '@/components/hr/leave-requests/LeaveRequestForm';
import { LeaveApprovalModal } from '@/components/hr/leave-requests/LeaveApprovalModal';
import type { LeaveRequest } from '@/types/hr';
import { useAuthStore } from '@/lib/stores/auth-store';
import { leaveRequestsApi } from '@/lib/api/hr';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

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
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelConfirmRequest, setCancelConfirmRequest] = useState<LeaveRequest | null>(null);
  const queryClient = useQueryClient();
  const userRole = useAuthStore((store) => store.user?.role);

  const canManage = useMemo(
    () => userRole === 'ADMIN' || userRole === 'HR',
    [userRole],
  );

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cancelMutation = useMutation({
    mutationFn: (id: string) => leaveRequestsApi.cancel(id),
    onMutate: (id: string) => {
      setCancellingId(id);
    },
    onSettled: () => {
      setCancellingId(null);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      if (employeeIdFilter) {
        queryClient.invalidateQueries({ queryKey: ['leave-requests', employeeIdFilter] });
      }
      setSuccessMessage('Leave request cancelled successfully');
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || 'Failed to cancel leave request');
    },
  });

  const handleCreate = () => {
    setEditingRequest(null);
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

  const handleEdit = (request: LeaveRequest) => {
    setEditingRequest(request);
    setShowForm(true);
  };

  const handleCancelRequest = (request: LeaveRequest) => {
    if (cancelMutation.isPending) {
      return;
    }
    setCancelConfirmRequest(request);
  };

  const confirmCancelRequest = () => {
    if (cancelConfirmRequest) {
      cancelMutation.mutate(cancelConfirmRequest.id);
      setCancelConfirmRequest(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {employeeIdFilter && (
        <div className="mb-4">
          <button
            onClick={() => navigate(`/employees/${employeeIdFilter}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Back to {employeeName || 'Employee'}
          </button>
        </div>
      )}

      <LeaveRequestsList
        onCreateNew={handleCreate}
        onApprove={canManage ? handleApprove : undefined}
        onReject={canManage ? handleReject : undefined}
        onEdit={handleEdit}
        onCancel={handleCancelRequest}
        cancellingId={cancellingId}
        contextLabel={employeeName}
        filterEmployeeId={employeeIdFilter}
      />

      {showForm && (
        <LeaveRequestForm
          request={editingRequest ?? undefined}
          employeeId={employeeIdFilter}
          onClose={() => {
            setShowForm(false);
            setEditingRequest(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
            if (employeeIdFilter) {
              queryClient.invalidateQueries({ queryKey: ['leave-requests', employeeIdFilter] });
            }
            setEditingRequest(null);
            setShowForm(false);
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
      {successMessage && (
        <FeedbackToast
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          tone="success"
        />
      )}
      {errorMessage && (
        <FeedbackToast
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
          tone="error"
        />
      )}
      <ConfirmationDialog
        open={!!cancelConfirmRequest}
        title="Cancel Leave Request"
        message="Are you sure you want to cancel this leave request?"
        confirmLabel="Cancel Request"
        variant="warning"
        onConfirm={confirmCancelRequest}
        onCancel={() => setCancelConfirmRequest(null)}
        isPending={cancelMutation.isPending}
      />
    </div>
  );
}


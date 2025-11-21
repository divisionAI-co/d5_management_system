import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveRequestsApi } from '@/lib/api/hr';
import type { LeaveRequest } from '@/types/hr';
import { LeaveRequestStatus } from '@/types/hr';
import { XCircle, CheckCircle, X } from 'lucide-react';
import { MentionInput } from '@/components/shared/MentionInput';
import { FeedbackToast } from '@/components/ui/feedback-toast';

interface LeaveApprovalModalProps {
  request: LeaveRequest;
  mode: 'approve' | 'reject';
  onClose: () => void;
  onSuccess: () => void;
}

export function LeaveApprovalModal({ request, mode, onClose, onSuccess }: LeaveApprovalModalProps) {
  const [reason, setReason] = useState(request.rejectionReason || '');
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      leaveRequestsApi.approve(request.id, {
        status: mode === 'approve'
          ? LeaveRequestStatus.APPROVED
          : LeaveRequestStatus.REJECTED,
        rejectionReason: mode === 'reject' ? reason.trim() : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-request', request.id] });
      setSuccessMessage(mode === 'approve' ? 'Leave request approved successfully' : 'Leave request rejected successfully');
      onSuccess();
      setTimeout(() => {
      onClose();
      }, 1000);
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || `Failed to ${mode} leave request`);
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'reject' && reason.trim().length === 0) {
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            {mode === 'approve' ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                {mode === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === 'approve'
                  ? 'Confirm approval for this leave request.'
                  : 'Provide a reason for rejecting this leave request.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">
              {request.employee?.user.firstName} {request.employee?.user.lastName}
            </p>
            <p className="mt-1">
              {request.type} • {request.totalDays} day(s)
            </p>
            <p className="mt-1 text-muted-foreground">{request.reason || 'No reason provided.'}</p>
          </div>

          {mode === 'reject' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Rejection Reason *</label>
              <MentionInput
                value={reason}
                onChange={(value) => setReason(value)}
                rows={4}
                placeholder="Explain the reason for rejection... Type @ to mention someone"
                multiline={true}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-red-500"
              />
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-border pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || (mode === 'reject' && reason.trim().length === 0)}
              className={`rounded-lg px-4 py-2 text-white transition ${
                mode === 'approve'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {mutation.isPending
                ? mode === 'approve'
                  ? 'Approving...'
                  : 'Rejecting...'
                : mode === 'approve'
                ? 'Approve'
                : 'Reject'}
            </button>
          </div>
        </form>
      </div>
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
    </div>
  );
}



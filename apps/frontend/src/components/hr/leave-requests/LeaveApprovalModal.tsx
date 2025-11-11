import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveRequestsApi } from '@/lib/api/hr';
import type { LeaveRequest } from '@/types/hr';
import { LeaveRequestStatus } from '@/types/hr';
import { XCircle, CheckCircle, X } from 'lucide-react';

interface LeaveApprovalModalProps {
  request: LeaveRequest;
  mode: 'approve' | 'reject';
  onClose: () => void;
  onSuccess: () => void;
}

export function LeaveApprovalModal({ request, mode, onClose, onSuccess }: LeaveApprovalModalProps) {
  const [reason, setReason] = useState(request.rejectionReason || '');
  const queryClient = useQueryClient();

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
      onSuccess();
      onClose();
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
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            {mode === 'approve' ? (
              <CheckCircle className="h-6 w-6 text-green-600" />
            ) : (
              <XCircle className="h-6 w-6 text-red-600" />
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {mode === 'approve' ? 'Approve Leave Request' : 'Reject Leave Request'}
              </h2>
              <p className="text-sm text-gray-500">
                {mode === 'approve'
                  ? 'Confirm approval for this leave request.'
                  : 'Provide a reason for rejecting this leave request.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 px-6 py-6">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            <p className="font-medium text-gray-800">
              {request.employee?.user.firstName} {request.employee?.user.lastName}
            </p>
            <p className="mt-1">
              {request.type} • {request.totalDays} day(s)
            </p>
            <p className="mt-1 text-gray-500">{request.reason || 'No reason provided.'}</p>
          </div>

          {mode === 'reject' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Rejection Reason *</label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={4}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-red-500"
                placeholder="Explain the reason for rejection..."
              />
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
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
    </div>
  );
}



import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { positionsApi } from '@/lib/api/recruitment';
import { candidatesApi } from '@/lib/api/recruitment/candidates';
import type { Candidate, LinkCandidatePositionDto, OpenPositionSummary } from '@/types/recruitment';

interface LinkCandidatePositionModalProps {
  candidate: Candidate;
  onClose: () => void;
  onSuccess?: (candidate: Candidate) => void;
}

export function LinkCandidatePositionModal({
  candidate,
  onClose,
  onSuccess,
}: LinkCandidatePositionModalProps) {
  const { data: positionsResponse, isLoading: isLoadingPositions } = useQuery({
    queryKey: ['positions', { pageSize: 100, status: 'Open' }],
    queryFn: () =>
      positionsApi.list({
        status: 'Open',
        pageSize: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  });

  const linkedIds = new Set(candidate.positions?.map((link) => link.positionId));
  const availablePositions =
    positionsResponse?.data.filter((position) => !linkedIds.has(position.id)) ?? [];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LinkCandidatePositionDto>({
    defaultValues: {
      status: 'Under Review',
      appliedAt: new Date().toISOString().split('T')[0],
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: LinkCandidatePositionDto) =>
      candidatesApi.linkPosition(candidate.id, payload),
    onSuccess: (updated) => {
      onSuccess?.(updated);
      onClose();
    },
  });

  const onSubmit = (payload: LinkCandidatePositionDto) => {
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Link Position</h2>
            <p className="text-sm text-gray-500">
              Connect {candidate.firstName} {candidate.lastName} to an open role and
              track application progress.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Select Position *
            </label>
            {isLoadingPositions ? (
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                Loading positions...
              </div>
            ) : availablePositions.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
                All open positions are already linked to this candidate, or none are
                available. Create a new position first.
              </div>
            ) : (
              <select
                {...register('positionId', { required: 'Position is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select a position</option>
                    {availablePositions.map((position: OpenPositionSummary) => (
                      <option key={position.id} value={position.id}>
                        {position.title}
                        {position.opportunity?.customer
                          ? ` — ${position.opportunity.customer.name}`
                          : ''}
                      </option>
                    ))}
              </select>
            )}
            {errors.positionId && (
              <p className="mt-1 text-xs text-red-500">{errors.positionId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Applied At
              </label>
              <input
                type="date"
                {...register('appliedAt')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Status
              </label>
              <input
                type="text"
                {...register('status')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              rows={3}
              {...register('notes')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Add context about this application..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || availablePositions.length === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? 'Linking...' : 'Link Position'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
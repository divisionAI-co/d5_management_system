import { useDeferredValue, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { positionsApi } from '@/lib/api/recruitment';
import { candidatesApi } from '@/lib/api/recruitment/candidates';
import type {
  Candidate,
  LinkCandidatePositionDto,
  OpenPositionSummary,
  PositionStatus,
} from '@/types/recruitment';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<PositionStatus | 'ALL'>('Open');
  const deferredSearch = useDeferredValue(searchTerm.trim());

  const { data: positionsResponse, isLoading: isLoadingPositions } = useQuery({
    queryKey: ['positions', 'candidate-link', { statusFilter, search: deferredSearch }],
    queryFn: () =>
      positionsApi.list({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        page: 1,
        pageSize: 250,
        sortBy: 'title',
        sortOrder: 'asc',
        search: deferredSearch || undefined,
      }),
  });

  const linkedIds = useMemo(
    () => new Set(candidate.positions?.map((link) => link.positionId)),
    [candidate.positions],
  );

  const availablePositions = useMemo(
    () =>
      positionsResponse?.data.filter((position) => !linkedIds.has(position.id)) ?? [],
    [linkedIds, positionsResponse?.data],
  );

  const filteredPositions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (!normalizedSearch) {
      return availablePositions;
    }
    return availablePositions.filter((position) => {
      const haystack = `${position.title} ${position.opportunity?.title ?? ''} ${
        position.opportunity?.customer?.name ?? ''
      }`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [availablePositions, searchTerm]);

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
      <div className="w-full max-w-lg rounded-2xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Link Position</h2>
            <p className="text-sm text-muted-foreground">
              Connect {candidate.firstName} {candidate.lastName} to an open role and
              track application progress.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted/70 hover:text-muted-foreground transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-6">
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Search Positions
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search by title, opportunity, or client"
                    className="w-full rounded-lg border border-border px-9 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Status Filter
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as PositionStatus | 'ALL')}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="Open">Open only</option>
                  <option value="ALL">All statuses</option>
                  <option value="Filled">Filled</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Select Position *
              </label>
              {isLoadingPositions ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Loading positions...
                </div>
              ) : filteredPositions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card px-4 py-3 text-sm text-muted-foreground">
                  {availablePositions.length === 0
                    ? 'All positions returned by this search are already linked. Adjust filters or create a new position.'
                    : 'No positions match your search. Try a different keyword or expand the filter.'}
                </div>
              ) : (
                <select
                  {...register('positionId', { required: 'Position is required' })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Select a position</option>
                  {filteredPositions.map((position: OpenPositionSummary) => (
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
              <p className="mt-2 text-xs text-muted-foreground">
                Positions already linked to this candidate are hidden from the picker to
                prevent duplicates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Applied At
              </label>
              <input
                type="date"
                {...register('appliedAt')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Status
              </label>
              <input
                type="text"
                {...register('status')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Notes
            </label>
            <textarea
              rows={3}
              {...register('notes')}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              placeholder="Add context about this application..."
            />
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition"
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
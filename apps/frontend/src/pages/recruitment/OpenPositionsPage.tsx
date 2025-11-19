import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { positionsApi } from '@/lib/api/recruitment';
import type {
  ClosePositionDto,
  OpenPosition,
  OpenPositionSummary,
  PositionFilters,
  PositionStatus,
} from '@/types/recruitment';
import { OpenPositionsTable } from '@/components/recruitment/OpenPositionsTable';
import { CreatePositionModal } from '@/components/recruitment/CreatePositionModal';
import { FeedbackToast } from '@/components/ui/feedback-toast';

const STATUS_OPTIONS: Array<{ value: PositionStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'Open', label: 'Open' },
  { value: 'Filled', label: 'Filled' },
  { value: 'Cancelled', label: 'Cancelled' },
];

interface LocalFilters {
  search?: string;
  status?: PositionStatus | 'ALL';
  isArchived?: boolean;
}

export default function OpenPositionsPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const highlightId = searchParams.get('highlight');

  const [filters, setFilters] = useState<LocalFilters>({
    search: '',
    status: 'Open',
    isArchived: false,
  });
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<OpenPosition | null>(null);

  useEffect(() => {
    if (highlightId) {
      navigate(`/recruitment/positions/${highlightId}`);
    }
  }, [highlightId, navigate]);

  const sanitizedFilters = useMemo<PositionFilters>(() => {
    const payload: PositionFilters = {
      page: 1,
      pageSize: 100,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    };

    if (filters.search && filters.search.trim().length > 0) {
      payload.search = filters.search.trim();
    }

    if (filters.status && filters.status !== 'ALL') {
      payload.status = filters.status;
    }

    if (filters.isArchived !== undefined) {
      payload.isArchived = filters.isArchived;
    }

    return payload;
  }, [filters]);

  const positionsQuery = useQuery({
    queryKey: ['positions', sanitizedFilters],
    queryFn: () => positionsApi.list(sanitizedFilters),
  });


  const closeMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ClosePositionDto;
    }) => positionsApi.close(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position', updated.id] });
      setFeedback(`Position "${updated.title}" marked as filled.`);
    },
  });

  const editPositionLoader = useMutation({
    mutationFn: positionsApi.getById,
    onSuccess: (position) => {
      setEditingPosition(position);
    },
    onError: () => {
      setFeedback('Unable to load position for editing.');
    },
  });


  const deleteMutation = useMutation({
    mutationFn: positionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      setFeedback(`Position deleted successfully.`);
    },
    onError: (error: any) => {
      setFeedback(
        error?.response?.data?.message ||
          'Failed to delete position. Please ensure no candidates are linked to this position.',
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: positionsApi.archive,
    onSuccess: (archived) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position', archived.id] });
      setFeedback(`Position "${archived.title}" archived successfully.`);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: positionsApi.unarchive,
    onSuccess: (unarchived) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position', unarchived.id] });
      setFeedback(`Position "${unarchived.title}" unarchived successfully.`);
    },
  });

  const positions = positionsQuery.data?.data ?? [];

  const handleSelectPosition = (position: OpenPositionSummary) => {
    navigate(`/recruitment/positions/${position.id}`);
  };

  const handleClosePosition = (position: OpenPositionSummary) => {
    const confirmClose = window.confirm(
      `Mark "${position.title}" as filled? This will close the associated opportunity.`,
    );

    if (!confirmClose) {
      return;
    }

    closeMutation.mutate({
      id: position.id,
      payload: {
        filledAt: new Date().toISOString(),
      },
    });
  };

  const handleEditPositionFromSummary = (position: OpenPositionSummary) => {
    editPositionLoader.mutate(position.id);
  };

  const handlePositionUpdated = (position: OpenPosition) => {
    setEditingPosition(null);
    setFeedback(`Position "${position.title}" saved successfully.`);
    queryClient.invalidateQueries({ queryKey: ['positions'] });
    queryClient.invalidateQueries({ queryKey: ['position', position.id] });
    positionsQuery.refetch();
    navigate(`/recruitment/positions/${position.id}`);
  };

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Open Positions</h1>
          <p className="text-sm text-muted-foreground">
            Overview of delivery commitments sourced from opportunities. Track candidate
            coverage, hiring progress and timeline to fulfil staffing needs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => positionsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Refresh
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            New Position
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-5 md:items-end">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Search
            </label>
            <input
              type="text"
              value={filters.search ?? ''}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  search: event.target.value,
                }))
              }
              placeholder="Search by title, opportunity or client..."
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </label>
            <select
              value={filters.status ?? 'ALL'}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value as PositionStatus | 'ALL',
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Archived
            </label>
            <select
              value={filters.isArchived ? 'archived' : 'active'}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  isArchived: event.target.value === 'archived',
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {feedback && (
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
          tone="success"
        />
      )}

      <OpenPositionsTable
        positions={positions}
        isLoading={positionsQuery.isFetching}
        onSelect={handleSelectPosition}
        onClosePosition={handleClosePosition}
        onEdit={handleEditPositionFromSummary}
        onArchive={(position) => {
          const confirmArchive = window.confirm(
            `Archive "${position.title}"? Archived positions are hidden from the default view but can be restored later.`,
          );
          if (confirmArchive) {
            archiveMutation.mutate(position.id);
          }
        }}
        onUnarchive={(position) => {
          unarchiveMutation.mutate(position.id);
        }}
        onDelete={(position) => {
          const confirmDelete = window.confirm(
            `Are you sure you want to delete "${position.title}"? This action cannot be undone.\n\nNote: Positions with linked candidates cannot be deleted.`,
          );
          if (confirmDelete) {
            deleteMutation.mutate(position.id);
          }
        }}
      />


      {isCreateModalOpen && (
        <CreatePositionModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(position) => {
            setIsCreateModalOpen(false);
            positionsQuery.refetch();
            navigate(`/recruitment/positions/${position.id}`);
            setFeedback(`Position "${position.title}" created successfully.`);
          }}
        />
      )}
      {editingPosition && (
        <CreatePositionModal
          position={editingPosition}
          onClose={() => setEditingPosition(null)}
          onUpdated={handlePositionUpdated}
        />
      )}
    </div>
  );
}


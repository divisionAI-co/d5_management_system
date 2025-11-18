import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, UserRound, X } from 'lucide-react';
import { positionsApi } from '@/lib/api/recruitment';
import type {
  ClosePositionDto,
  OpenPosition,
  OpenPositionSummary,
  PositionFilters,
  PositionStatus,
} from '@/types/recruitment';
import {
  CANDIDATE_STAGE_COLORS,
  CANDIDATE_STAGE_LABELS,
} from '@/components/recruitment/CandidateBoard';
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
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<OpenPosition | null>(null);

  useEffect(() => {
    if (highlightId) {
      setSelectedPositionId(highlightId);
    }
  }, [highlightId]);

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

  const selectedPositionQuery = useQuery({
    queryKey: ['position', selectedPositionId],
    enabled: Boolean(selectedPositionId),
    queryFn: () => positionsApi.getById(selectedPositionId!),
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

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: PositionStatus;
    }) => positionsApi.update(id, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position', updated.id] });
      setFeedback(`Position "${updated.title}" updated to ${updated.status}.`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: positionsApi.delete,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      if (selectedPositionId === result.id) {
        setSelectedPositionId(null);
      }
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
  const selectedPosition = selectedPositionQuery.data ?? null;

  const handleSelectPosition = (position: OpenPositionSummary) => {
    setSelectedPositionId(position.id);
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

  const handleStatusChange = (position: OpenPosition, nextStatus: PositionStatus) => {
    if (nextStatus === position.status) {
      return;
    }

    if (nextStatus === 'Filled') {
      closeMutation.mutate({
        id: position.id,
        payload: {
          filledAt: new Date().toISOString(),
        },
      });
      return;
    }

    updateStatusMutation.mutate({ id: position.id, status: nextStatus });
  };

  const handleEditPositionFromSummary = (position: OpenPositionSummary) => {
    editPositionLoader.mutate(position.id);
  };

  const handleEditPositionFromDetail = (position: OpenPosition) => {
    setEditingPosition(position);
  };

  const handlePositionUpdated = (position: OpenPosition) => {
    setEditingPosition(null);
    setFeedback(`Position "${position.title}" saved successfully.`);
    queryClient.invalidateQueries({ queryKey: ['positions'] });
    queryClient.invalidateQueries({ queryKey: ['position', position.id] });
    positionsQuery.refetch();
    setSelectedPositionId(position.id);
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

      {selectedPositionId && (
        <PositionDetailDrawer
          position={selectedPosition}
          isLoading={selectedPositionQuery.isLoading}
          onClose={() => setSelectedPositionId(null)}
          onChangeStatus={handleStatusChange}
          statusUpdating={updateStatusMutation.isPending || closeMutation.isPending}
          onEdit={handleEditPositionFromDetail}
          onArchive={(position) => {
            archiveMutation.mutate(position.id);
          }}
          onUnarchive={(position) => {
            unarchiveMutation.mutate(position.id);
          }}
          isArchiving={archiveMutation.isPending || unarchiveMutation.isPending}
          onDelete={(position) => {
            const confirmDelete = window.confirm(
              `Are you sure you want to delete "${position.title}"? This action cannot be undone.\n\nNote: Positions with linked candidates cannot be deleted.`,
            );
            if (confirmDelete) {
              deleteMutation.mutate(position.id);
            }
          }}
        />
      )}

      {isCreateModalOpen && (
        <CreatePositionModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={(position) => {
            setIsCreateModalOpen(false);
            positionsQuery.refetch();
            setSelectedPositionId(position.id);
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

interface PositionDetailDrawerProps {
  position: OpenPosition | null;
  isLoading: boolean;
  onClose: () => void;
  onChangeStatus: (position: OpenPosition, status: PositionStatus) => void;
  statusUpdating?: boolean;
  onEdit?: (position: OpenPosition) => void;
  onDelete?: (position: OpenPosition) => void;
  onArchive?: (position: OpenPosition) => void;
  onUnarchive?: (position: OpenPosition) => void;
  isArchiving?: boolean;
}

function PositionDetailDrawer({
  position,
  isLoading,
  onClose,
  onChangeStatus,
  statusUpdating,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  isArchiving,
}: PositionDetailDrawerProps) {
  const navigate = useNavigate();
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Position Details</h2>
            <p className="text-sm text-muted-foreground">
              Review role requirements and candidate pipeline health.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {position && onEdit && (
              <button
                onClick={() => onEdit(position)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted"
              >
                Edit Position
              </button>
            )}
            {position && onArchive && !position.isArchived && (
              <button
                onClick={() => {
                  const confirmArchive = window.confirm(
                    `Archive "${position.title}"? Archived positions are hidden from the default view but can be restored later.`,
                  );
                  if (confirmArchive && onArchive) {
                    onArchive(position);
                  }
                }}
                disabled={isArchiving}
                className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-50 disabled:opacity-60"
              >
                {isArchiving ? 'Archiving...' : 'Archive'}
              </button>
            )}
            {position && onUnarchive && position.isArchived && (
              <button
                onClick={() => onUnarchive && onUnarchive(position)}
                disabled={isArchiving}
                className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-600 transition hover:bg-amber-50 disabled:opacity-60"
              >
                {isArchiving ? 'Unarchiving...' : 'Unarchive'}
              </button>
            )}
            {position && onDelete && (
              <button
                onClick={() => onDelete(position)}
                className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Delete
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex h-60 items-center justify-center">
            <div className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
              Loading position...
            </div>
          </div>
        ) : position ? (
          <div className="max-h-[70vh] overflow-y-auto px-6 py-6 space-y-6">
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-2xl font-semibold text-foreground">{position.title}</h3>
                <select
                  value={position.status}
                  onChange={(event) => onChangeStatus(position, event.target.value as PositionStatus)}
                  disabled={statusUpdating}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="Open">Open</option>
                  <option value="Filled">Filled</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
              <div className="text-sm text-muted-foreground">
                {position.description || 'No description provided.'}
              </div>
              {position.requirements && (
                <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Requirements
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{position.requirements}</p>
                </div>
              )}
              {position.opportunity && (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Opportunity
                  </p>
                  <p className="mt-1 text-foreground">{position.opportunity.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      {position.opportunity.customer?.name ?? 'Unassigned client'}
                    </span>
                    {position.opportunity.value !== undefined && position.opportunity.value !== null && (
                      <span>Value: ${Number(position.opportunity.value).toLocaleString()}</span>
                    )}
                    {position.opportunity.lead?.leadType && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {position.opportunity.lead.leadType === 'END_CUSTOMER' ? 'End Customer' : 'Intermediary'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
                <div className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Created {new Date(position.createdAt).toLocaleDateString()}
                </div>
                <div className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Updated {new Date(position.updatedAt).toLocaleDateString()}
                </div>
                {position.filledAt && (
                  <div className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Filled {new Date(position.filledAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-lg font-semibold text-foreground">Candidate Pipeline</h3>
              <p className="text-sm text-muted-foreground">
                Candidates linked to this position via recruitment workflow.
              </p>
              <div className="mt-4 space-y-3">
                {position.candidates && position.candidates.length > 0 ? (
                  position.candidates.map((link) => (
                    <div
                      key={link.id}
                      className="rounded-xl border border-border bg-muted p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md cursor-pointer"
                      onClick={() => navigate(`/recruitment/candidates/${link.candidate.id}`)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {link.candidate.firstName} {link.candidate.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{link.candidate.email}</p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${CANDIDATE_STAGE_COLORS[link.candidate.stage]}`}
                        >
                          {CANDIDATE_STAGE_LABELS[link.candidate.stage]}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Applied{' '}
                          {new Date(link.appliedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                        <span>Status: {link.status}</span>
                        {link.candidate.expectedSalary !== undefined &&
                          link.candidate.expectedSalary !== null && (
                            <span>
                              Salary Expectation: $
                              {link.candidate.expectedSalary.toLocaleString()}
                            </span>
                          )}
                      </div>
                      {link.notes && (
                        <div className="mt-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                          <p className="font-semibold text-muted-foreground">Notes</p>
                          <p className="mt-1 whitespace-pre-wrap">{link.notes}</p>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                    No candidates linked yet. Link candidates from the recruitment board.
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          <div className="flex h-60 items-center justify-center text-sm text-muted-foreground">
            Position not found or was removed.
          </div>
        )}
      </div>
    </div>
  );
}

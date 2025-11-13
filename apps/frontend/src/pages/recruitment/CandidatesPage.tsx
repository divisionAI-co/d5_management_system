import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DropResult } from '@hello-pangea/dnd';
import { Columns, Kanban, MoveRight, Plus, UploadCloud } from 'lucide-react';
import { candidatesApi } from '@/lib/api/recruitment';
import type {
  Candidate,
  CandidateFilters,
  CandidateStage,
  ConvertCandidateToEmployeeResponse,
  PaginatedResponse,
} from '@/types/recruitment';
import { CandidateBoard, CANDIDATE_STAGE_LABELS } from '@/components/recruitment/CandidateBoard';
import { CandidateTable } from '@/components/recruitment/CandidateTable';
import { CandidateForm } from '@/components/recruitment/CandidateForm';
import { LinkCandidatePositionModal } from '@/components/recruitment/LinkCandidatePositionModal';
import { CandidateConvertToEmployeeModal } from '@/components/recruitment/CandidateConvertToEmployeeModal';
import { CandidateImportDialog } from '@/components/recruitment/CandidateImportDialog';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@/types/enums';
import { FeedbackToast } from '@/components/ui/feedback-toast';

interface LocalFilters {
  search?: string;
  stage?: CandidateStage | 'ALL';
  hasOpenPosition?: boolean;
}

export default function CandidatesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<LocalFilters>({
    search: '',
    stage: 'ALL',
    hasOpenPosition: false,
  });

  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | undefined>();
  const [linkCandidate, setLinkCandidate] = useState<Candidate | null>(null);
  const [convertCandidate, setConvertCandidate] = useState<Candidate | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { user } = useAuthStore();
  const canImport = user?.role === UserRole.ADMIN || user?.role === UserRole.HR || user?.role === UserRole.RECRUITER;
  const canDelete = user?.role === UserRole.ADMIN || user?.role === UserRole.HR;

  const sanitizedFilters = useMemo<CandidateFilters>(() => {
    const payload: CandidateFilters = {
      page,
      pageSize,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    if (filters.search && filters.search.trim().length > 0) {
      payload.search = filters.search.trim();
    }

    if (filters.stage && filters.stage !== 'ALL') {
      payload.stage = filters.stage;
    }

    if (filters.hasOpenPosition) {
      payload.hasOpenPosition = true;
    }

    return payload;
  }, [filters, page, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.stage, filters.hasOpenPosition]);

  const candidatesQuery = useQuery({
    queryKey: ['candidates', sanitizedFilters],
    queryFn: () => candidatesApi.list(sanitizedFilters),
  });

  const stageMutation = useMutation({
    mutationFn: ({
      id,
      stage,
    }: {
      id: string;
      stage: CandidateStage;
      note?: string;
    }) => candidatesApi.updateStage(id, { stage }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setFeedback(
        `${updated.firstName} ${updated.lastName} moved to ${CANDIDATE_STAGE_LABELS[updated.stage]}.`,
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.archive(id),
    onSuccess: (archived) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setFeedback(
        `${archived.firstName} ${archived.lastName} has been archived.`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => candidatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setFeedback('Candidate deleted successfully.');
    },
  });

  const handleOpenCreate = () => {
    setEditingCandidate(undefined);
    setIsFormOpen(true);
  };

  const handleEditCandidate = (candidate: Candidate) => {
    setEditingCandidate(candidate);
    setIsFormOpen(true);
  };

  const handleViewCandidate = (candidate: Candidate) => {
    navigate(`/recruitment/candidates/${candidate.id}`);
  };

  const handleLinkPosition = (candidate: Candidate) => {
    setLinkCandidate(candidate);
  };

  const handleConvertCandidate = (candidate: Candidate) => {
    setConvertCandidate(candidate);
  };

  const handleArchiveCandidate = (candidate: Candidate) => {
    if (
      window.confirm(
        `Archive "${candidate.firstName} ${candidate.lastName}"? They will be hidden from the candidate list but can be restored later.`,
      )
    ) {
      archiveMutation.mutate(candidate.id);
    }
  };

  const handleDeleteCandidate = (candidate: Candidate) => {
    if (
      window.confirm(
        `Permanently delete "${candidate.firstName} ${candidate.lastName}"? This action cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(candidate.id);
    }
  };

  const handleConversionSuccess = (result: ConvertCandidateToEmployeeResponse) => {
    const baseMessage = `${result.candidate.firstName} ${result.candidate.lastName} is now an employee (#${result.employee.employeeNumber}).`;
    const passwordMessage = result.temporaryPassword
      ? ` Temporary password: ${result.temporaryPassword}`
      : '';

    setFeedback(`${baseMessage}${passwordMessage}`);
    queryClient.invalidateQueries({ queryKey: ['employees'] });
  };

  const handleMoveStage = (candidate: Candidate, stage: CandidateStage) => {
    if (candidate.stage === stage) {
      return;
    }
    stageMutation.mutate({ id: candidate.id, stage });
  };

  const handleCandidateMoveOptimistic = useMemo(() => {
    return (result: DropResult, candidate: Candidate) => {
      const { destination } = result;

      if (!destination) {
        return;
      }

      const destinationStage = destination.droppableId as CandidateStage;

      queryClient.setQueryData<PaginatedResponse<Candidate>>(
        ['candidates', sanitizedFilters],
        (previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            data: previous.data.map((item) =>
              item.id === candidate.id ? { ...item, stage: destinationStage } : item,
            ),
          };
        },
      );

      if (candidate.stage !== destinationStage) {
        stageMutation.mutate({ id: candidate.id, stage: destinationStage });
      }
    };
  }, [queryClient, sanitizedFilters, stageMutation]);

  const candidates = candidatesQuery.data?.data ?? [];
  const meta = candidatesQuery.data?.meta;
  const total = meta?.total ?? 0;
  const pageCount = meta?.pageCount ?? 1;
  const currentPage = meta?.page ?? page;
  const currentPageSize = meta?.pageSize ?? pageSize;
  const startIndex = total > 0 ? (currentPage - 1) * currentPageSize + 1 : 0;
  const endIndex = Math.min(currentPage * currentPageSize, total);

  return (
    <div className="py-8 space-y-6">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4 md:items-end">
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
              placeholder="Search by name, email, city or skill..."
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stage
            </label>
            <select
              value={filters.stage ?? 'ALL'}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  stage: event.target.value as CandidateStage | 'ALL',
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="ALL">All Stages</option>
              {Object.entries(CANDIDATE_STAGE_LABELS).map(([stage, label]) => (
                <option key={stage} value={stage}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5">
            <input
              id="filter-has-position"
              type="checkbox"
              checked={Boolean(filters.hasOpenPosition)}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  hasOpenPosition: event.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
            />
            <label
              htmlFor="filter-has-position"
              className="flex-1 text-sm font-medium text-muted-foreground"
            >
              Linked to open position
            </label>
          </div>
          {/* Actions moved to board header to avoid duplication */}
        </div>
      </div>

      {feedback && (
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
          tone="success"
        />
      )}

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recruitment Board</h1>
            <p className="text-sm text-muted-foreground">
              Track candidates as they progress from screening to contract signing.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-lg border border-border bg-card p-1 text-sm font-medium text-muted-foreground">
            <button
              onClick={() => setViewMode('board')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 transition ${
                viewMode === 'board'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-muted/70'
              }`}
            >
              <Kanban className="h-4 w-4" /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 transition ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:bg-muted/70'
              }`}
            >
              <Columns className="h-4 w-4" /> List
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => candidatesQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition"
            >
              <MoveRight
                className={`h-4 w-4 ${
                  candidatesQuery.isFetching ? 'animate-pulse' : ''
                }`}
              />
              Refresh
            </button>
            {canImport && (
              <button
                onClick={() => setImportOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition disabled:opacity-60"
                disabled={candidatesQuery.isFetching}
                type="button"
              >
                <UploadCloud className="h-4 w-4" />
                Import Candidates
              </button>
            )}
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-60"
              disabled={candidatesQuery.isFetching}
            >
              <Plus className="h-4 w-4" />
              New Candidate
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'board' ? (
        <CandidateBoard
          candidates={candidates}
          isLoading={candidatesQuery.isFetching}
          onCreateCandidate={handleOpenCreate}
          onImportCandidates={canImport ? () => setImportOpen(true) : undefined}
          onRefresh={() => candidatesQuery.refetch()}
          onView={handleViewCandidate}
          onEdit={handleEditCandidate}
          onLinkPosition={handleLinkPosition}
          onMoveStage={handleMoveStage}
          onCandidateMove={handleCandidateMoveOptimistic}
          onConvertToEmployee={handleConvertCandidate}
          onArchive={handleArchiveCandidate}
          onDelete={canDelete ? handleDeleteCandidate : undefined}
          canDelete={canDelete}
        />
      ) : (
        <CandidateTable
          candidates={candidates}
          onView={handleViewCandidate}
          onEdit={handleEditCandidate}
          onMoveStage={handleMoveStage}
          onLinkPosition={handleLinkPosition}
          onConvertToEmployee={handleConvertCandidate}
          onArchive={handleArchiveCandidate}
          onDelete={canDelete ? handleDeleteCandidate : undefined}
          disableStageChange={stageMutation.isPending}
          canDelete={canDelete}
        />
      )}

      {meta && total > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span>
              Showing {startIndex.toLocaleString()}–{endIndex.toLocaleString()} of {total.toLocaleString()} candidates
            </span>
            <div className="flex items-center gap-2">
              <label htmlFor="page-size-select" className="text-xs">
                Per page:
              </label>
              <select
                id="page-size-select"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-border bg-card px-2 py-1 text-xs focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1 || candidatesQuery.isFetching}
              className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {currentPage} of {Math.max(pageCount, 1)}
            </span>
            <button
              onClick={() => setPage((prev) => (pageCount ? Math.min(prev + 1, pageCount) : prev + 1))}
              disabled={pageCount ? currentPage >= pageCount || candidatesQuery.isFetching : candidates.length < currentPageSize}
              className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {isFormOpen && (
        <CandidateForm
          candidate={editingCandidate}
          onClose={() => setIsFormOpen(false)}
          onSuccess={(candidate) => {
            setFeedback(
              `${candidate.firstName} ${candidate.lastName} saved successfully.`,
            );
          }}
        />
      )}

      {linkCandidate && (
        <LinkCandidatePositionModal
          candidate={linkCandidate}
          onClose={() => setLinkCandidate(null)}
          onSuccess={(candidate) => {
            setFeedback(
              `${candidate.firstName} ${candidate.lastName} linked to new position.`,
            );
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
          }}
        />
      )}

      {convertCandidate && (
        <CandidateConvertToEmployeeModal
          candidate={convertCandidate}
          onClose={() => setConvertCandidate(null)}
          onSuccess={handleConversionSuccess}
        />
      )}

      {canImport && importOpen && (
        <CandidateImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      )}
    </div>
  );
}


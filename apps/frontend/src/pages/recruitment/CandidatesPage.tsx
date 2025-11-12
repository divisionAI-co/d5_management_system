import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DropResult } from '@hello-pangea/dnd';
import { candidatesApi } from '@/lib/api/recruitment';
import type {
  Candidate,
  CandidateFilters,
  CandidateStage,
  ConvertCandidateToEmployeeResponse,
  PaginatedResponse,
} from '@/types/recruitment';
import { CandidateBoard, CANDIDATE_STAGE_LABELS } from '@/components/recruitment/CandidateBoard';
import { CandidateForm } from '@/components/recruitment/CandidateForm';
import { LinkCandidatePositionModal } from '@/components/recruitment/LinkCandidatePositionModal';
import { CandidateConvertToEmployeeModal } from '@/components/recruitment/CandidateConvertToEmployeeModal';
import { CandidateImportDialog } from '@/components/recruitment/CandidateImportDialog';
import { useAuthStore } from '@/lib/stores/auth-store';
import { UserRole } from '@prisma/client';

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

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | undefined>();
  const [linkCandidate, setLinkCandidate] = useState<Candidate | null>(null);
  const [convertCandidate, setConvertCandidate] = useState<Candidate | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { user } = useAuthStore();
  const canImport = user?.role === UserRole.ADMIN || user?.role === UserRole.HR || user?.role === UserRole.RECRUITER;

  const sanitizedFilters = useMemo<CandidateFilters>(() => {
    const payload: CandidateFilters = {
      page: 1,
      pageSize: 200,
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
  }, [filters]);

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
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{feedback}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold uppercase tracking-wide"
          >
            Dismiss
          </button>
        </div>
      )}

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
      />

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


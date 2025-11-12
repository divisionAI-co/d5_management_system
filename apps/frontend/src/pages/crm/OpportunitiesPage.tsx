import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DropResult } from '@hello-pangea/dnd';
import { Filter, Plus, UploadCloud } from 'lucide-react';
import { customersApi, opportunitiesApi } from '@/lib/api/crm';
import { usersApi } from '@/lib/api/users';
import type {
  CustomerType,
  CustomerSummary,
  Opportunity,
  OpportunityFilters,
  OpportunitiesListResponse,
  UpdateOpportunityPayload,
} from '@/types/crm';
import type { UserSummary } from '@/types/users';
import { OpportunitiesImportDialog } from '@/components/crm/opportunities/OpportunitiesImportDialog';
import { OpportunitiesTable } from '@/components/crm/opportunities/OpportunitiesTable';
import { OpportunityForm } from '@/components/crm/opportunities/OpportunityForm';
import { OpportunityCloseDialog } from '@/components/crm/opportunities/OpportunityCloseDialog';
import { OpportunitiesBoard } from '@/components/crm/opportunities/OpportunitiesBoard';
import { useAuthStore } from '@/lib/stores/auth-store';

const TYPE_FILTERS: Array<{ label: string; value?: CustomerType }> = [
  { label: 'All types', value: undefined },
  { label: 'Staff Augmentation', value: 'STAFF_AUGMENTATION' },
  { label: 'Software Subscription', value: 'SOFTWARE_SUBSCRIPTION' },
  { label: 'Hybrid', value: 'BOTH' },
];

const STAGE_OPTIONS = [
  'All stages',
  'Prospecting',
  'Discovery',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Contract',
  'Closed Won',
  'Closed Lost',
];

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: 'all' | 'open' | 'closed' }> = [
  { label: 'All statuses', value: 'all' },
  { label: 'Open', value: 'open' },
  { label: 'Closed', value: 'closed' },
];

const RESULT_FILTER_OPTIONS: Array<{ label: string; value: 'all' | 'won' | 'lost' }> = [
  { label: 'All results', value: 'all' },
  { label: 'Won', value: 'won' },
  { label: 'Lost', value: 'lost' },
];

const SORT_OPTIONS: Array<{ label: string; value: NonNullable<OpportunityFilters['sortBy']> }> = [
  { label: 'Created', value: 'createdAt' },
  { label: 'Updated', value: 'updatedAt' },
  { label: 'Value', value: 'value' },
  { label: 'Stage', value: 'stage' },
  { label: 'Title', value: 'title' },
];

const PAGE_SIZE = 10;
const BOARD_PAGE_SIZE = 200;
const PIPELINE_STAGE_ORDER = [
  'Prospecting',
  'Discovery',
  'Qualification',
  'Proposal',
  'Negotiation',
  'Contract',
  'Closed Won',
  'Closed Lost',
] as const;

export default function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<'table' | 'board'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<CustomerType | undefined>(undefined);
  const [stageFilter, setStageFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [resultFilter, setResultFilter] = useState<'all' | 'won' | 'lost'>('all');
  const [assignedFilter, setAssignedFilter] = useState<string | undefined>(undefined);
  const [sortBy, setSortBy] = useState<NonNullable<OpportunityFilters['sortBy']>>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [closingOpportunity, setClosingOpportunity] = useState<Opportunity | undefined>(undefined);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const usersQuery = useQuery({
    queryKey: ['users', 'options'],
    queryFn: () => usersApi.list({ page: 1, pageSize: 100 }),
    placeholderData: keepPreviousData,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'opportunity-import-options'],
    queryFn: () =>
      customersApi.list({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
    enabled: isAdmin,
  });

  const effectivePage = viewMode === 'board' ? 1 : page;
  const effectivePageSize = viewMode === 'board' ? BOARD_PAGE_SIZE : PAGE_SIZE;

  const sanitizedFilters = useMemo<OpportunityFilters>(() => {
    const payload: OpportunityFilters = {
      page: effectivePage,
      pageSize: effectivePageSize,
      sortBy,
      sortOrder,
    };

    if (searchTerm.trim()) {
      payload.search = searchTerm.trim();
    }
    if (typeFilter) {
      payload.type = typeFilter;
    }
    if (stageFilter && stageFilter !== 'All stages') {
      payload.stage = stageFilter;
    }
    if (assignedFilter) {
      payload.assignedToId = assignedFilter;
    }
    if (statusFilter === 'open') {
      payload.isClosed = false;
    } else if (statusFilter === 'closed') {
      payload.isClosed = true;
    }
    if (resultFilter === 'won') {
      payload.isWon = true;
    } else if (resultFilter === 'lost') {
      payload.isWon = false;
    }

    return payload;
  }, [
    assignedFilter,
    effectivePage,
    effectivePageSize,
    resultFilter,
    searchTerm,
    sortBy,
    sortOrder,
    stageFilter,
    statusFilter,
    typeFilter,
  ]);

  const opportunitiesQuery = useQuery<OpportunitiesListResponse>({
    queryKey: ['opportunities', sanitizedFilters],
    queryFn: () => opportunitiesApi.list(sanitizedFilters),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => opportunitiesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setFeedback('Opportunity deleted successfully.');
    },
  });

  const moveMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateOpportunityPayload;
    }) => opportunitiesApi.update(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ['opportunities'] });

      const previousData = queryClient.getQueryData<OpportunitiesListResponse>([
        'opportunities',
        sanitizedFilters,
      ]);

      if (previousData) {
        queryClient.setQueryData<OpportunitiesListResponse>(
          ['opportunities', sanitizedFilters],
          {
            ...previousData,
            data: previousData.data.map((item) =>
              item.id === id
                ? {
                    ...item,
                    stage: payload.stage ?? item.stage,
                    isClosed:
                      payload.isClosed !== undefined ? payload.isClosed : item.isClosed,
                    isWon: payload.isWon !== undefined ? payload.isWon : item.isWon,
                  }
                : item,
            ),
          },
        );
      }

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(['opportunities', sanitizedFilters], context.previousData);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    },
    onSuccess: (updated) => {
      setFeedback(`Opportunity "${updated.title}" moved to ${updated.stage}.`);
    },
  });

  const users = (usersQuery.data?.data ?? []) as UserSummary[];
  const customers = (customersQuery.data?.data ?? []) as CustomerSummary[];
  const opportunities = opportunitiesQuery.data?.data ?? [];
  const meta = opportunitiesQuery.data?.meta;

  const paginationInfo = useMemo(() => {
    if (!meta) return '0 opportunities';
    const start = (meta.page - 1) * meta.pageSize + 1;
    const end = Math.min(meta.page * meta.pageSize, meta.total);
    return `${start}-${end} of ${meta.total}`;
  }, [meta]);

  const handleApplySearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setTypeFilter(undefined);
    setStageFilter(undefined);
    setStatusFilter('all');
    setResultFilter('all');
    setAssignedFilter(undefined);
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
    setViewMode('table');
  };

  const handlePageChange = (newPage: number) => {
    if (!meta) return;
    if (newPage < 1 || newPage > (meta.pageCount || 1)) return;
    setPage(newPage);
  };

  const handleCreate = () => {
    setEditingId(undefined);
    setFormOpen(true);
  };

  const handleEdit = (opportunity: Opportunity) => {
    setEditingId(opportunity.id);
    setFormOpen(true);
  };

  const handleCloseOpportunity = (opportunity: Opportunity) => {
    setClosingOpportunity(opportunity);
  };

  const handleDelete = (opportunity: Opportunity) => {
    if (
      window.confirm(
        `Are you sure you want to delete the opportunity "${opportunity.title}"? This action cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(opportunity.id);
    }
  };

  const handleViewOpportunity = (opportunity: Opportunity) => {
    navigate(`/crm/opportunities/${opportunity.id}`);
  };

  const handleMove = useCallback((opportunity: Opportunity, newStage: string) => {
    const payload: UpdateOpportunityPayload = { stage: newStage };

    if (newStage === 'Closed Won') {
      payload.isClosed = true;
      payload.isWon = true;
    } else if (newStage === 'Closed Lost') {
      payload.isClosed = true;
      payload.isWon = false;
    } else {
      payload.isClosed = false;
      payload.isWon = false;
    }

    moveMutation.mutate({
      id: opportunity.id,
      payload,
    });
  }, [moveMutation]);

  const handleOpportunityMoveOptimistic = useMemo(() => {
    return (result: DropResult, opportunity: Opportunity) => {
      const { destination } = result;

      if (!destination) {
        return;
      }

      const destinationStage = destination.droppableId;

      queryClient.setQueryData<OpportunitiesListResponse>(
        ['opportunities', sanitizedFilters],
        (previous) => {
          if (!previous) {
            return previous;
          }

          return {
            ...previous,
            data: previous.data.map((item) =>
              item.id === opportunity.id
                ? {
                    ...item,
                    stage: destinationStage,
                  }
                : item,
            ),
          };
        },
      );

      handleMove(opportunity, destinationStage);
    };
  }, [handleMove, queryClient, sanitizedFilters]);

  const boardStages = useMemo(() => {
    const stageSet = new Set<string>(PIPELINE_STAGE_ORDER);
    opportunities.forEach((opportunity) => {
      if (opportunity.stage) {
        stageSet.add(opportunity.stage);
      }
    });

    const ordered = PIPELINE_STAGE_ORDER.filter((stage) => stageSet.has(stage));
    const extras = Array.from(stageSet).filter(
      (stage) => !PIPELINE_STAGE_ORDER.includes(stage as typeof PIPELINE_STAGE_ORDER[number]),
    );

    extras.sort((a, b) => a.localeCompare(b));

    return [...ordered, ...extras];
  }, [opportunities]);

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Keep your pipeline organised, monitor ownership, and close deals faster.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {isAdmin && (
            <button
              onClick={() => setImportOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <UploadCloud className="h-4 w-4" />
              Import Opportunities
            </button>
          )}
          <div className="rounded-lg border border-border bg-card p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                viewMode === 'table' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Table
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('board');
                setPage(1);
              }}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                viewMode === 'board' ? 'bg-blue-600 text-white shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Board
            </button>
          </div>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Opportunity
          </button>
        </div>
      </div>

      <form onSubmit={handleApplySearch} className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by title, customer or notes"
                className="w-full rounded-lg border border-border px-3 py-2 pl-9 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <Filter className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Advanced filters
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Type
                </label>
                <select
                  value={typeFilter ?? ''}
                  onChange={(event) =>
                    setTypeFilter((event.target.value || undefined) as CustomerType | undefined)
                  }
                  className="w-full rounded-lg border border-border px-3 py-2 focus-border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {TYPE_FILTERS.map((option) => (
                    <option key={option.label} value={option.value ?? ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Stage
                </label>
                <select
                  value={stageFilter ?? 'All stages'}
                  onChange={(event) => {
                    const value = event.target.value;
                    setStageFilter(value === 'All stages' ? undefined : value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 focus-border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {STAGE_OPTIONS.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as 'all' | 'open' | 'closed');
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 focus-border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Result
                </label>
                <select
                  value={resultFilter}
                  onChange={(event) => {
                    setResultFilter(event.target.value as 'all' | 'won' | 'lost');
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 focus-border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {RESULT_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Owner
                </label>
                <select
                  value={assignedFilter ?? ''}
                  onChange={(event) => {
                    setAssignedFilter(event.target.value || undefined);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 focus-border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All owners</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(event) => {
                    setSortBy(event.target.value as NonNullable<OpportunityFilters['sortBy']>);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 focus-border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Direction
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3 border-t border-border pt-3">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Apply Filters
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-sm font-medium text-muted-foreground hover:text-muted-foreground"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </form>

      {viewMode === 'table' ? (
        <div className="flex flex-col gap-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>{paginationInfo}</span>
          {meta && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(meta.page - 1)}
                disabled={meta.page === 1}
                className="rounded-lg border border-border px-3 py-1 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span>
                Page{' '}
                <span className="font-semibold text-foreground">{meta.page}</span> of{' '}
                <span className="font-semibold text-foreground">{meta.pageCount || 1}</span>
              </span>
              <button
                onClick={() => handlePageChange(meta.page + 1)}
                disabled={meta.page >= (meta.pageCount || 1)}
                className="rounded-lg border border-border px-3 py-1 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : null}

      {feedback ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
          <button
            className="ml-3 text-xs font-semibold uppercase tracking-wide text-emerald-800"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {viewMode === 'table' ? (
        <OpportunitiesTable
          opportunities={opportunities}
          isLoading={opportunitiesQuery.isLoading || opportunitiesQuery.isFetching}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onClose={handleCloseOpportunity}
          onDelete={handleDelete}
          onView={handleViewOpportunity}
        />
      ) : (
        <OpportunitiesBoard
          stages={boardStages}
          opportunities={opportunities}
          isLoading={opportunitiesQuery.isFetching && viewMode === 'board'}
          onCreate={handleCreate}
          onEdit={handleEdit}
          onClose={handleCloseOpportunity}
          onDelete={handleDelete}
          onMove={handleMove}
          onOpportunityMove={handleOpportunityMoveOptimistic}
          onView={handleViewOpportunity}
        />
      )}

      {formOpen ? (
        <OpportunityForm
          opportunityId={editingId}
          onClose={() => setFormOpen(false)}
          onSuccess={(opportunity) => {
            setFormOpen(false);
            setEditingId(undefined);
            setFeedback(`Opportunity "${opportunity.title}" saved.`);
          }}
        />
      ) : null}

      {closingOpportunity ? (
        <OpportunityCloseDialog
          opportunity={closingOpportunity}
          onClose={() => setClosingOpportunity(undefined)}
          onSuccess={(opportunity) => {
            setClosingOpportunity(undefined);
            setFeedback(`Opportunity "${opportunity.title}" closed successfully.`);
          }}
        />
      ) : null}

      <OpportunitiesImportDialog
        open={importOpen}
        customers={customers}
        onClose={() => setImportOpen(false)}
      />
    </div>
  );
}

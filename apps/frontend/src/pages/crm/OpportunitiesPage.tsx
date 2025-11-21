import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { CreatePositionModal } from '@/components/recruitment/CreatePositionModal';
import { SendEmailModal } from '@/components/shared/SendEmailModal';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useOpportunityStagesStore } from '@/lib/stores/opportunity-stages-store';
import { OPPORTUNITY_STAGES } from '@/constants/opportunities';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

const TYPE_FILTERS: Array<{ label: string; value?: CustomerType }> = [
  { label: 'All types', value: undefined },
  { label: 'Staff Augmentation', value: 'STAFF_AUGMENTATION' },
  { label: 'Software Subscription', value: 'SOFTWARE_SUBSCRIPTION' },
  { label: 'Hybrid', value: 'BOTH' },
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
export default function OpportunitiesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const stages = useOpportunityStagesStore((state) => state.stages);
  const addStage = useOpportunityStagesStore((state) => state.addStage);
  const registerStages = useOpportunityStagesStore((state) => state.registerStages);
  const removeStage = useOpportunityStagesStore((state) => state.removeStage);
  const moveStage = useOpportunityStagesStore((state) => state.moveStage);

  const [viewMode, setViewMode] = useState<'table' | 'board'>('board');
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
  const [deleteConfirmOpportunity, setDeleteConfirmOpportunity] = useState<Opportunity | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [positionModalOpportunity, setPositionModalOpportunity] = useState<Opportunity | null>(null);
  const [emailModalOpportunity, setEmailModalOpportunity] = useState<Opportunity | null>(null);
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

  // Per-column pagination for board view
  const [columnLimits, setColumnLimits] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    stages.forEach((stage) => {
      initial[stage] = 10; // Initial limit per column
    });
    return initial;
  });
  const [isLoadingMore, setIsLoadingMore] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    stages.forEach((stage) => {
      initial[stage] = false;
    });
    return initial;
  });

  const effectivePage = viewMode === 'board' ? 1 : page;
  const effectivePageSize = viewMode === 'board' ? 1000 : PAGE_SIZE; // Fetch all for board view

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
    // Don't filter by stage in board view - we'll show all stages
    if (viewMode === 'table' && stageFilter && stageFilter !== 'All stages') {
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
    viewMode,
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

  // Filter users to only show ADMIN and SALESPERSON roles for opportunity assignment
  const users = useMemo(() => {
    const allUsers = (usersQuery.data?.data ?? []) as UserSummary[];
    return allUsers.filter((user) => user.role === 'ADMIN' || user.role === 'SALESPERSON');
  }, [usersQuery.data?.data]);
  const customers = (customersQuery.data?.data ?? []) as CustomerSummary[];
  const opportunities = opportunitiesQuery.data?.data ?? [];
  useEffect(() => {
    if (stages.length === 0) {
      registerStages([...OPPORTUNITY_STAGES]);
    }
  }, [stages.length, registerStages]);

  useEffect(() => {
    if (opportunities.length > 0) {
      registerStages(
        opportunities
          .map((opportunity) => opportunity.stage)
          .filter((stage): stage is string => Boolean(stage)),
      );
    }
  }, [opportunities, registerStages]);

  useEffect(() => {
    setColumnLimits((prev) => {
      const next = { ...prev };
      let changed = false;
      stages.forEach((stage) => {
        if (next[stage] === undefined) {
          next[stage] = 10;
          changed = true;
        }
      });
      Object.keys(next).forEach((stage) => {
        if (!stages.includes(stage)) {
          delete next[stage];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setIsLoadingMore((prev) => {
      const next = { ...prev };
      let changed = false;
      stages.forEach((stage) => {
        if (next[stage] === undefined) {
          next[stage] = false;
          changed = true;
        }
      });
      Object.keys(next).forEach((stage) => {
        if (!stages.includes(stage)) {
          delete next[stage];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [stages]);

  useEffect(() => {
    if (stageFilter && !stages.includes(stageFilter)) {
      setStageFilter(undefined);
    }
  }, [stageFilter, stages]);
  const meta = opportunitiesQuery.data?.meta;

  // Calculate column totals and visible opportunities for board view
  const columnTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    stages.forEach((stage) => {
      totals[stage] = opportunities.filter((o) => o.stage === stage).length;
    });
    return totals;
  }, [opportunities, stages]);

  const visibleOpportunities = useMemo(() => {
    if (viewMode === 'table') {
      return opportunities;
    }
    // In board view, limit opportunities per column
    // Group by stage first, then apply limits
    const opportunitiesByStage = opportunities.reduce<Record<string, Opportunity[]>>((acc, opportunity) => {
      const stage = opportunity.stage || 'Unspecified';
      if (!acc[stage]) {
        acc[stage] = [];
      }
      acc[stage].push(opportunity);
      return acc;
    }, {});

    // Apply column limits and flatten back to array
    // When searching, show all results (no limit) to ensure search results are visible
    const hasSearch = Boolean(searchTerm.trim());
    const visible: Opportunity[] = [];
    Object.entries(opportunitiesByStage).forEach(([stage, stageOpportunities]) => {
      if (hasSearch) {
        // Show all results when searching
        visible.push(...stageOpportunities);
      } else {
        // Apply column limits when not searching
        const limit = columnLimits[stage] || 10;
        visible.push(...stageOpportunities.slice(0, limit));
      }
    });

    return visible;
  }, [opportunities, viewMode, columnLimits, searchTerm]);

  const handleLoadMore = (stage: string) => {
    setIsLoadingMore((prev) => ({ ...prev, [stage]: true }));
    // Increase limit by 10
    setColumnLimits((prev) => ({
      ...prev,
      [stage]: (prev[stage] || 10) + 10,
    }));
    // Simulate loading delay for better UX
    setTimeout(() => {
      setIsLoadingMore((prev) => ({ ...prev, [stage]: false }));
    }, 300);
  };

  const paginationInfo = useMemo(() => {
    if (!meta) return '0 opportunities';
    const start = (meta.page - 1) * meta.pageSize + 1;
    const end = Math.min(meta.page * meta.pageSize, meta.total);
    return `${start}-${end} of ${meta.total}`;
  }, [meta]);

  // Reset column limits when filters change in board view
  // But don't reset when searchTerm changes - allow search to show all results
  useEffect(() => {
    if (viewMode === 'board') {
      setColumnLimits(() => {
        const initial: Record<string, number> = {};
        stages.forEach((stage) => {
          // When filters change (not search), reset to 10
          // This allows search to show all matching results
          initial[stage] = 10;
        });
        return initial;
      });
    }
  }, [
    typeFilter,
    stageFilter,
    statusFilter,
    resultFilter,
    assignedFilter,
    viewMode,
    stages,
    // Note: searchTerm is intentionally excluded so search results aren't limited
  ]);

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
    setViewMode('board');
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
    setDeleteConfirmOpportunity(opportunity);
  };

  const confirmDelete = () => {
    if (deleteConfirmOpportunity) {
      deleteMutation.mutate(deleteConfirmOpportunity.id);
      setDeleteConfirmOpportunity(null);
    }
  };

  const handleCreatePositionFromOpportunity = (opportunity: Opportunity) => {
    setPositionModalOpportunity(opportunity);
  };

  const handleSendEmail = (opportunity: Opportunity) => {
    setEmailModalOpportunity(opportunity);
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

  const stageFilterOptions = useMemo(() => ['All stages', ...stages], [stages]);
  const boardStages = stages;
  const handleRemoveStage = useCallback(
    (stage: string) => {
      const hasDeals = opportunities.some(
        (opportunity) => opportunity.stage === stage,
      );
      if (hasDeals) {
        window.alert(
          'Please move or close all opportunities in this stage before removing it.',
        );
        return;
      }
      removeStage(stage);
    },
    [opportunities, removeStage],
  );

  const handleReorderStage = useCallback(
    (stage: string, direction: 'left' | 'right') => {
      moveStage(stage, direction);
    },
    [moveStage],
  );

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
                  {stageFilterOptions.map((stage) => (
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
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
          tone="success"
        />
      ) : null}

      {viewMode === 'table' ? (
        <OpportunitiesTable
          opportunities={opportunities}
          isLoading={opportunitiesQuery.isLoading || opportunitiesQuery.isFetching}
          onEdit={handleEdit}
          onClose={handleCloseOpportunity}
          onDelete={handleDelete}
          onView={handleViewOpportunity}
          onCreatePosition={handleCreatePositionFromOpportunity}
          onSendEmail={handleSendEmail}
        />
      ) : (
        <OpportunitiesBoard
          stages={boardStages}
          opportunities={visibleOpportunities}
          isLoading={opportunitiesQuery.isFetching && viewMode === 'board'}
          onEdit={handleEdit}
          onClose={handleCloseOpportunity}
          onDelete={handleDelete}
          onMove={handleMove}
          onOpportunityMove={handleOpportunityMoveOptimistic}
          onView={handleViewOpportunity}
          onCreatePosition={handleCreatePositionFromOpportunity}
          onSendEmail={handleSendEmail}
          onAddStage={addStage}
          onRemoveStage={handleRemoveStage}
          onMoveStageLeft={(stage) => handleReorderStage(stage, 'left')}
          onMoveStageRight={(stage) => handleReorderStage(stage, 'right')}
          columnLimits={columnLimits}
          columnTotals={columnTotals}
          onLoadMore={handleLoadMore}
          isLoadingMore={isLoadingMore}
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

      {positionModalOpportunity ? (
        <CreatePositionModal
          defaultOpportunity={{
            id: positionModalOpportunity.id,
            title: positionModalOpportunity.title,
            customerName: positionModalOpportunity.customer?.name ?? undefined,
          }}
          onClose={() => setPositionModalOpportunity(null)}
          onCreated={(position) => {
            setPositionModalOpportunity(null);
            setFeedback(`Job position "${position.title}" created from opportunity.`);
            queryClient.invalidateQueries({ queryKey: ['opportunities'] });
            queryClient.invalidateQueries({ queryKey: ['positions'] });
          }}
        />
      ) : null}

      {emailModalOpportunity ? (
        <SendEmailModal
          title={`Send Email - ${emailModalOpportunity.title}`}
          defaultTo={emailModalOpportunity.lead?.contact?.email || emailModalOpportunity.customer?.email || ''}
          defaultSubject={`Update on ${emailModalOpportunity.title}`}
          onClose={() => setEmailModalOpportunity(null)}
          onSend={async (payload) => {
            await opportunitiesApi.sendEmail(emailModalOpportunity.id, payload);
            setFeedback(`Email sent successfully to ${payload.to}`);
          }}
        />
      ) : null}
      <ConfirmationDialog
        open={!!deleteConfirmOpportunity}
        title="Delete Opportunity"
        message={`Are you sure you want to delete "${deleteConfirmOpportunity?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpportunity(null)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

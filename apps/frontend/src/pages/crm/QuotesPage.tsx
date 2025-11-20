import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '@/lib/api/crm';
import type { Quote, QuoteFilters, QuoteStatus, QuotesListResponse } from '@/types/crm';
import { QuotesTable } from '@/components/crm/quotes/QuotesTable';
import { QuoteForm } from '@/components/crm/quotes/QuoteForm';
import { Filter, Plus } from 'lucide-react';

const STATUS_FILTER_OPTIONS: Array<{ label: string; value?: QuoteStatus }> = [
  { label: 'All statuses', value: undefined },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Accepted', value: 'ACCEPTED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Expired', value: 'EXPIRED' },
];

const SORT_OPTIONS: Array<{ label: string; value: QuoteFilters['sortBy'] }> = [
  { label: 'Created', value: 'createdAt' },
  { label: 'Updated', value: 'updatedAt' },
  { label: 'Quote Number', value: 'quoteNumber' },
  { label: 'Title', value: 'title' },
  { label: 'Total Value', value: 'totalValue' },
];

export default function QuotesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL params
  const initialFilters: QuoteFilters = {
    page: 1,
    pageSize: 10,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  };

  const leadIdParam = searchParams.get('leadId');
  const opportunityIdParam = searchParams.get('opportunityId');
  const shouldOpenForm = searchParams.get('new') === 'true' || location.pathname === '/crm/quotes/new';
  
  if (leadIdParam) {
    initialFilters.leadId = leadIdParam;
  }
  if (opportunityIdParam) {
    initialFilters.opportunityId = opportunityIdParam;
  }

  const [filters, setFilters] = useState<QuoteFilters>(initialFilters);
  const [searchTerm, setSearchTerm] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<Quote | undefined>();
  const [showFilters, setShowFilters] = useState(false);

  // Open form if on "/quotes/new" route or "new=true" query param is present
  useEffect(() => {
    if (shouldOpenForm) {
      setEditingQuote(undefined);
      setFormOpen(true);
      // Redirect to /quotes if on /quotes/new route
      if (location.pathname === '/crm/quotes/new') {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('new');
        navigate(`/crm/quotes?${newSearchParams.toString()}`, { replace: true });
      } else {
        // Remove the "new" query param from URL
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('new');
        setSearchParams(newSearchParams, { replace: true });
      }
    }
  }, [shouldOpenForm, location.pathname, searchParams, navigate, setSearchParams]);

  const quotesQuery = useQuery<QuotesListResponse>({
    queryKey: ['quotes', filters],
    queryFn: () => quotesApi.list(filters),
    placeholderData: keepPreviousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
  });

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchTerm, page: 1 }));
  };

  const handleStatusChange = (value?: QuoteStatus) => {
    setFilters((prev) => ({ ...prev, status: value, page: 1 }));
  };

  const handleSortChange = (value: QuoteFilters['sortBy']) => {
    setFilters((prev) => ({ ...prev, sortBy: value, page: 1 }));
  };

  const handleSortOrderToggle = () => {
    setFilters((prev) => ({ ...prev, sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 }));
  };

  const handlePageChange = (page: number) => {
    if (page < 1) return;
    setFilters((prev) => ({ ...prev, page }));
  };

  const handleOpenCreate = () => {
    setEditingQuote(undefined);
    setFormOpen(true);
  };

  const handleEdit = (quote: Quote) => {
    setEditingQuote(quote);
    setFormOpen(true);
  };

  const handleDelete = (quote: Quote) => {
    if (window.confirm(`Delete quote "${quote.title}"?`)) {
      deleteMutation.mutate(quote.id);
    }
  };

  const handleView = (quote: Quote) => {
    navigate(`/crm/quotes/${quote.id}`);
  };

  const meta = quotesQuery.data?.meta;
  const quotes = quotesQuery.data?.data ?? [];

  const paginationInfo = useMemo(() => {
    if (!meta) return '0 quotes';
    const start = (meta.page - 1) * meta.pageSize + 1;
    const end = Math.min(meta.page * meta.pageSize, meta.total);
    return `${start}-${end} of ${meta.total}`;
  }, [meta]);

  return (
    <div className="space-y-6 py-8 text-foreground">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Quotes</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage quotes for your leads. Send professional quotes to customers via email.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Quote
          </button>
        </div>
      </div>

      <form onSubmit={handleSearchSubmit} className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search by quote number, title, or description"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
                  Status
                </label>
                <select
                  value={filters.status ?? ''}
                  onChange={(event) => handleStatusChange(event.target.value ? (event.target.value as QuoteStatus) : undefined)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_FILTER_OPTIONS.map((option) => (
                    <option key={option.label} value={option.value ?? ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Sort By
                </label>
                <select
                  value={filters.sortBy ?? 'createdAt'}
                  onChange={(event) => handleSortChange(event.target.value as QuoteFilters['sortBy'])}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
                  onClick={handleSortOrderToggle}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground hover:text-foreground"
                >
                  {filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
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
                onClick={() => {
                  setSearchTerm('');
                  setFilters({ page: 1, pageSize: 10, sortBy: 'createdAt', sortOrder: 'desc' });
                }}
                className="text-sm font-medium text-muted-foreground transition hover:text-foreground"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{paginationInfo}</span>
        {meta && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={meta.page === 1}
              className="rounded-lg border border-border px-3 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span>
              Page <span className="font-semibold text-foreground">{meta.page}</span> of{' '}
              <span className="font-semibold text-foreground">{meta.pageCount || 1}</span>
            </span>
            <button
              onClick={() => handlePageChange(meta.page + 1)}
              disabled={meta.page >= (meta.pageCount || 1)}
              className="rounded-lg border border-border px-3 py-1 text-muted-foreground transition hover:bg-muted hover:text-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      <QuotesTable
        quotes={quotes}
        isLoading={quotesQuery.isLoading || quotesQuery.isFetching}
        onCreate={handleOpenCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={handleView}
      />

      {formOpen && (
        <QuoteForm
          quote={editingQuote}
          onClose={() => setFormOpen(false)}
          onSuccess={() => {
            setFormOpen(false);
            setEditingQuote(undefined);
          }}
        />
      )}
    </div>
  );
}


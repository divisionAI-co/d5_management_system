import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/crm';
import type {
  CustomerDetail,
  CustomerFilters,
  CustomerSentiment,
  CustomerStatus,
  CustomerSummary,
  CustomerType,
  CustomersListResponse,
} from '@/types/crm';
import { CustomerForm } from '@/components/crm/customers/CustomerForm';
import { CustomersTable } from '@/components/crm/customers/CustomersTable';
import { CustomerStatusForm } from '@/components/crm/customers/CustomerStatusForm';
import { Filter, Plus, RefreshCw } from 'lucide-react';

type SortField = 'name' | 'createdAt' | 'updatedAt' | 'monthlyValue';

const TYPE_FILTERS: { label: string; value?: CustomerType }[] = [
  { label: 'All Types', value: undefined },
  { label: 'Staff Augmentation', value: 'STAFF_AUGMENTATION' },
  { label: 'Software Subscription', value: 'SOFTWARE_SUBSCRIPTION' },
  { label: 'Both', value: 'BOTH' },
];

const STATUS_FILTERS: { label: string; value?: CustomerStatus }[] = [
  { label: 'All Statuses', value: undefined },
  { label: 'Onboarding', value: 'ONBOARDING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'At Risk', value: 'AT_RISK' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Churned', value: 'CHURNED' },
];

const SENTIMENT_FILTERS: { label: string; value?: CustomerSentiment }[] = [
  { label: 'All Sentiments', value: undefined },
  { label: 'Happy', value: 'HAPPY' },
  { label: 'Neutral', value: 'NEUTRAL' },
  { label: 'Unhappy', value: 'UNHAPPY' },
];

export default function CustomersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<CustomerFilters>({
    search: '',
    type: undefined,
    status: undefined,
    sentiment: undefined,
    page: 1,
    pageSize: 10,
  });
  const [sort, setSort] = useState<{ sortBy: SortField; sortOrder: 'asc' | 'desc' }>({
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerDetail | null>(null);
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [statusCustomer, setStatusCustomer] = useState<CustomerDetail | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const sanitizedFilters = useMemo(() => {
    const payload = {
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.sentiment ? { sentiment: filters.sentiment } : {}),
      ...(filters.country ? { country: filters.country } : {}),
      ...(filters.tags && filters.tags.length ? { tags: filters.tags } : {}),
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 10,
      sortBy: sort.sortBy,
      sortOrder: sort.sortOrder,
    } satisfies CustomerFilters & { sortBy: SortField; sortOrder: 'asc' | 'desc' };

    return payload;
  }, [filters, sort]);

  const customersQuery = useQuery<CustomersListResponse>({
    queryKey: ['customers', sanitizedFilters],
    queryFn: () => customersApi.list(sanitizedFilters),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setFeedback('Customer deleted successfully.');
    },
  });

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      search: value,
      page: 1,
    }));
  };

  const handleFilterChange = <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }));
  };

  const handleSortChange = (field: SortField) => {
    setSort((prev) => ({
      sortBy: field,
      sortOrder: prev.sortBy === field && prev.sortOrder === 'asc' ? 'desc' : 'asc',
    }));
  };

  const handlePageChange = (page: number) => {
    if (page < 1) return;
    setFilters((prev) => ({
      ...prev,
      page,
    }));
  };

  const handleCreate = () => {
    setEditingCustomer(null);
    setShowForm(true);
  };

  const handleEdit = async (customerSummary: CustomerSummary) => {
    const detail = await customersApi.getById(customerSummary.id);
    setEditingCustomer(detail);
    setShowForm(true);
  };

  const handleView = (customerSummary: CustomerSummary) => {
    navigate(`/crm/customers/${customerSummary.id}`);
  };

  const handleUpdateStatus = async (customerSummary: CustomerSummary) => {
    const detail = await customersApi.getById(customerSummary.id);
    setStatusCustomer(detail);
    setShowStatusForm(true);
  };

  const handleDelete = (customerSummary: CustomerSummary) => {
    if (
      window.confirm(
        `Are you sure you want to delete ${customerSummary.name}? This will remove associated contacts, opportunities and invoices.`,
      )
    ) {
      deleteMutation.mutate(customerSummary.id);
    }
  };

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Track customer accounts, lifecycle health and opportunities across business models.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => customersQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            title="Refresh data"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Customer
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="relative flex-1">
            <input
              type="text"
              value={filters.search ?? ''}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Search by name, email, industry..."
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
        {showFilters && (
          <div className="space-y-4 px-4 py-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Type
                </label>
                <select
                  value={filters.type ?? ''}
                  onChange={(event) =>
                    handleFilterChange('type', (event.target.value || undefined) as CustomerType | undefined)
                  }
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
                  Status
                </label>
                <select
                  value={filters.status ?? ''}
                  onChange={(event) =>
                    handleFilterChange('status', (event.target.value || undefined) as CustomerStatus | undefined)
                  }
                  className="w-full rounded-lg border border-border px-3 py-2 focus-border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.label} value={option.value ?? ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Sentiment
                </label>
                <select
                  value={filters.sentiment ?? ''}
                  onChange={(event) =>
                    handleFilterChange(
                      'sentiment',
                      (event.target.value || undefined) as CustomerSentiment | undefined,
                    )
                  }
                  className="w-full rounded-lg border border-border px-3 py-2 focus-border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {SENTIMENT_FILTERS.map((option) => (
                    <option key={option.label} value={option.value ?? ''}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}
          <button
            className="ml-3 text-xs font-semibold uppercase tracking-wide text-emerald-800"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <CustomersTable
        response={customersQuery.data}
        isLoading={customersQuery.isLoading || customersQuery.isFetching}
        sortBy={sort.sortBy}
        onSortChange={handleSortChange}
        onChangePage={handlePageChange}
        onView={handleView}
        onEdit={handleEdit}
        onUpdateStatus={handleUpdateStatus}
        onDelete={handleDelete}
      />

      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onClose={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
          onSuccess={(customer) => {
            setFeedback(`Customer ${customer.name} saved successfully.`);
            setShowForm(false);
            setEditingCustomer(null);
          }}
        />
      )}

      {showStatusForm && statusCustomer && (
        <CustomerStatusForm
          customer={statusCustomer}
          onClose={() => {
            setShowStatusForm(false);
            setStatusCustomer(null);
          }}
          onSuccess={(updated) => {
            setFeedback(`Customer ${updated.name} status updated.`);
            setShowStatusForm(false);
            setStatusCustomer(null);
          }}
        />
      )}
    </div>
  );
}


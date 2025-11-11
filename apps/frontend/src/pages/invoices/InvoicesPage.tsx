import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Filter,
  Plus,
  RefreshCw,
  CalendarIcon,
  ArrowUpRight,
} from 'lucide-react';
import { invoicesApi } from '@/lib/api/invoices';
import { customersApi } from '@/lib/api/crm';
import { InvoicesTable } from '@/components/invoices/InvoicesTable';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { InvoiceSendDialog } from '@/components/invoices/InvoiceSendDialog';
import { InvoiceMarkPaidDialog } from '@/components/invoices/InvoiceMarkPaidDialog';
import type {
  InvoiceDetail,
  InvoiceFilters,
  InvoiceSortField,
  InvoiceSummary,
  InvoiceStatus,
} from '@/types/invoices';
import type { CustomerSummary } from '@/types/crm';

type SortOption = {
  label: string;
  value: InvoiceSortField;
};

const STATUS_FILTERS: { label: string; value?: InvoiceStatus }[] = [
  { label: 'All statuses', value: undefined },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const SORT_OPTIONS: SortOption[] = [
  { label: 'Issue Date', value: 'issueDate' },
  { label: 'Due Date', value: 'dueDate' },
  { label: 'Total Amount', value: 'total' },
  { label: 'Invoice Number', value: 'invoiceNumber' },
  { label: 'Created At', value: 'createdAt' },
  { label: 'Status', value: 'status' },
];

const DEFAULT_FILTERS: InvoiceFilters = {
  page: 1,
  pageSize: 10,
  sortBy: 'issueDate',
  sortOrder: 'desc',
};

export default function InvoicesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<InvoiceFilters>(DEFAULT_FILTERS);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formInvoiceId, setFormInvoiceId] = useState<string | null>(null);

  const [sendInvoiceId, setSendInvoiceId] = useState<string | null>(null);
  const [markInvoiceId, setMarkInvoiceId] = useState<string | null>(null);

  const sanitizedFilters = useMemo(() => {
    const payload: InvoiceFilters = {
      page: filters.page ?? 1,
      pageSize: filters.pageSize ?? 10,
      sortBy: filters.sortBy ?? 'issueDate',
      sortOrder: filters.sortOrder ?? 'desc',
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.isRecurring !== undefined ? { isRecurring: filters.isRecurring } : {}),
      ...(filters.overdue !== undefined ? { overdue: filters.overdue } : {}),
      ...(filters.issueDateFrom ? { issueDateFrom: filters.issueDateFrom } : {}),
      ...(filters.issueDateTo ? { issueDateTo: filters.issueDateTo } : {}),
      ...(filters.dueDateFrom ? { dueDateFrom: filters.dueDateFrom } : {}),
      ...(filters.dueDateTo ? { dueDateTo: filters.dueDateTo } : {}),
    };
    return payload;
  }, [filters]);

  const invoicesQuery = useQuery({
    queryKey: ['invoices', sanitizedFilters],
    queryFn: () => invoicesApi.list(sanitizedFilters),
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'invoice-filter'],
    queryFn: () =>
      customersApi.list({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  });

  const formInvoiceQuery = useQuery({
    queryKey: ['invoice', formInvoiceId],
    queryFn: () => invoicesApi.getById(formInvoiceId!),
    enabled: Boolean(formInvoiceId) && isFormOpen,
  });

  const sendInvoiceQuery = useQuery({
    queryKey: ['invoice', sendInvoiceId],
    queryFn: () => invoicesApi.getById(sendInvoiceId!),
    enabled: Boolean(sendInvoiceId),
  });

  const markInvoiceQuery = useQuery({
    queryKey: ['invoice', markInvoiceId],
    queryFn: () => invoicesApi.getById(markInvoiceId!),
    enabled: Boolean(markInvoiceId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => invoicesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setFeedback('Invoice deleted successfully.');
    },
  });

  const handleSearchChange = (value: string) => {
    setFilters((prev) => ({
      ...prev,
      search: value || undefined,
      page: 1,
    }));
  };

  const handleStatusChange = (value?: InvoiceStatus) => {
    setFilters((prev) => ({
      ...prev,
      status: value,
      page: 1,
    }));
  };

  const handleCustomerFilter = (value?: string) => {
    setFilters((prev) => ({
      ...prev,
      customerId: value || undefined,
      page: 1,
    }));
  };

  const handleToggle = (key: 'isRecurring' | 'overdue', value: boolean) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value ? true : undefined,
      page: 1,
    }));
  };

  const handleDateFilter = (key: 'issueDateFrom' | 'issueDateTo' | 'dueDateFrom' | 'dueDateTo', value?: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }));
  };

  const handleSortFieldChange = (value: InvoiceSortField) => {
    setFilters((prev) => ({
      ...prev,
      sortBy: value,
      page: 1,
    }));
  };

  const handleSortOrderToggle = () => {
    setFilters((prev) => ({
      ...prev,
      sortOrder: prev.sortOrder === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  };

  const handlePageChange = (page: number) => {
    if (page < 1) return;
    setFilters((prev) => ({
      ...prev,
      page,
    }));
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const handleCreate = () => {
    setFormInvoiceId(null);
    setIsFormOpen(true);
  };

  const handleEdit = (invoice: InvoiceSummary) => {
    setFormInvoiceId(invoice.id);
    setIsFormOpen(true);
  };

  const handleView = (invoice: InvoiceSummary) => {
    navigate(`/invoices/${invoice.id}`);
  };

  const handleSend = (invoice: InvoiceSummary) => {
    setSendInvoiceId(invoice.id);
  };

  const handleMarkPaid = (invoice: InvoiceSummary) => {
    setMarkInvoiceId(invoice.id);
  };

  const handleDelete = (invoice: InvoiceSummary) => {
    if (
      window.confirm(
        `Are you sure you want to delete invoice ${invoice.invoiceNumber}? This action cannot be undone.`,
      )
    ) {
      deleteMutation.mutate(invoice.id);
    }
  };

  const invoices = invoicesQuery.data?.data ?? [];
  const pagination = invoicesQuery.data?.meta;
  const customers: CustomerSummary[] = customersQuery.data?.data ?? [];

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Manage billing, track payment status and send invoices to customers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => invoicesQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase text-muted-foreground">
          <Filter className="h-4 w-4" />
          Filters
        </div>

        <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-6">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Search
            </label>
            <input
              type="text"
              value={filters.search ?? ''}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Invoice number, customer name, email..."
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Status
            </label>
            <select
              value={filters.status ?? ''}
              onChange={(event) =>
                handleStatusChange(
                  event.target.value ? (event.target.value as InvoiceStatus) : undefined,
                )
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
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
              Customer
            </label>
            <select
              value={filters.customerId ?? ''}
              onChange={(event) => handleCustomerFilter(event.target.value || undefined)}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Recurring Only
            </label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(filters.isRecurring)}
                onChange={(event) => handleToggle('isRecurring', event.target.checked)}
                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-muted-foreground">Show recurring invoices</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Overdue Only
            </label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(filters.overdue)}
                onChange={(event) => handleToggle('overdue', event.target.checked)}
                className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-muted-foreground">Require follow-up</span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Issue Date From
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.issueDateFrom ?? ''}
                onChange={(event) => handleDateFilter('issueDateFrom', event.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <CalendarIcon className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Issue Date To
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.issueDateTo ?? ''}
                onChange={(event) => handleDateFilter('issueDateTo', event.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <CalendarIcon className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Due Date From
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.dueDateFrom ?? ''}
                onChange={(event) => handleDateFilter('dueDateFrom', event.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <CalendarIcon className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Due Date To
            </label>
            <div className="relative">
              <input
                type="date"
                value={filters.dueDateTo ?? ''}
                onChange={(event) => handleDateFilter('dueDateTo', event.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <CalendarIcon className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">Sort</label>
            <select
              value={filters.sortBy}
              onChange={(event) => handleSortFieldChange(event.target.value as InvoiceSortField)}
              className="rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleSortOrderToggle}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <ArrowUpRight
                className={`h-3.5 w-3.5 transition-transform ${
                  filters.sortOrder === 'asc' ? 'rotate-180' : ''
                }`}
              />
              {filters.sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          </div>

          <div className="flex-1" />

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {feedback}
        </div>
      )}

      <InvoicesTable
        invoices={invoices}
        isLoading={invoicesQuery.isLoading}
        onView={handleView}
        onEdit={handleEdit}
        onSend={handleSend}
        onMarkPaid={handleMarkPaid}
        onDelete={handleDelete}
      />

      {pagination && (
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-4 text-sm text-muted-foreground md:flex-row">
          <div>
            Showing{' '}
            <span className="font-semibold">
              {(pagination.page - 1) * pagination.pageSize + 1}
            </span>{' '}
            to{' '}
            <span className="font-semibold">
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>{' '}
            of <span className="font-semibold">{pagination.total}</span> invoices
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange((filters.page ?? 1) - 1)}
              disabled={(filters.page ?? 1) === 1}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Previous
            </button>
            <span className="px-2">
              Page <span className="font-semibold">{filters.page ?? 1}</span> of {pagination.pageCount}
            </span>
            <button
              onClick={() => handlePageChange((filters.page ?? 1) + 1)}
              disabled={(filters.page ?? 1) >= pagination.pageCount}
              className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {isFormOpen && (
        <>
          {formInvoiceId && formInvoiceQuery.isLoading && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
              <div className="rounded-lg bg-card px-6 py-4 text-sm text-muted-foreground shadow-lg">
                Loading invoice details...
              </div>
            </div>
          )}
          {(!formInvoiceId || formInvoiceQuery.data) && (
            <InvoiceForm
              invoice={formInvoiceQuery.data ?? null}
              onClose={() => {
                setIsFormOpen(false);
                setFormInvoiceId(null);
              }}
              onSuccess={(invoiceResult: InvoiceDetail) => {
                setFeedback(
                  `Invoice ${invoiceResult.invoiceNumber} ${
                    formInvoiceId ? 'updated' : 'created'
                  } successfully.`,
                );
                setIsFormOpen(false);
                setFormInvoiceId(null);
              }}
            />
          )}
        </>
      )}

      {sendInvoiceId && sendInvoiceQuery.data && (
        <InvoiceSendDialog
          invoice={sendInvoiceQuery.data}
          onClose={() => setSendInvoiceId(null)}
          onSent={(updated) => {
            setFeedback(`Invoice ${updated.invoiceNumber} sent successfully.`);
            setSendInvoiceId(null);
          }}
        />
      )}

      {markInvoiceId && markInvoiceQuery.data && (
        <InvoiceMarkPaidDialog
          invoice={markInvoiceQuery.data}
          onClose={() => setMarkInvoiceId(null)}
          onMarked={(updated) => {
            setFeedback(`Invoice ${updated.invoiceNumber} marked as paid.`);
            setMarkInvoiceId(null);
          }}
        />
      )}
    </div>
  );
}

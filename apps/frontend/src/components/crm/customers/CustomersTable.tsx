import type { CustomerSummary, CustomersListResponse } from '@/types/crm';
import { format } from 'date-fns';
import {
  ArrowUpDown,
  Edit3,
  Eye,
  FileBarChart2,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';

interface CustomersTableProps {
  response?: CustomersListResponse;
  isLoading: boolean;
  sortBy: string;
  onSortChange: (field: 'name' | 'createdAt' | 'updatedAt' | 'monthlyValue') => void;
  onChangePage: (page: number) => void;
  onView: (customer: CustomerSummary) => void;
  onEdit: (customer: CustomerSummary) => void;
  onUpdateStatus: (customer: CustomerSummary) => void;
  onDelete: (customer: CustomerSummary) => void;
}

const sentimentClass = {
  HAPPY: 'bg-green-100 text-green-700',
  NEUTRAL: 'bg-muted/70 text-muted-foreground',
  UNHAPPY: 'bg-red-100 text-red-700',
};

const statusClass = {
  ONBOARDING: 'bg-blue-100 text-blue-700',
  ACTIVE: 'bg-emerald-100 text-emerald-700',
  AT_RISK: 'bg-orange-100 text-orange-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  CHURNED: 'bg-red-100 text-red-700',
};

export function CustomersTable({
  response,
  isLoading,
  sortBy,
  onSortChange,
  onChangePage,
  onView,
  onEdit,
  onUpdateStatus,
  onDelete,
}: CustomersTableProps) {
  const handleSort = (field: 'name' | 'createdAt' | 'updatedAt' | 'monthlyValue') => {
    onSortChange(field);
  };

  const renderSortIcon = (field: string) => {
    const isActive = sortBy === field;
    return (
      <ArrowUpDown
        className={clsx('h-4 w-4 transition', {
          'text-blue-600': isActive,
          'text-muted-foreground': !isActive,
        })}
      />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!response || response.data.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        No customers found. Try adjusting your filters or add a new customer.
      </div>
    );
  }

  const { data, meta } = response;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <button
                  type="button"
                  onClick={() => handleSort('name')}
                  className="inline-flex items-center gap-2"
                >
                  Name
                  {renderSortIcon('name')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Sentiment
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Monthly Value
                <button
                  type="button"
                  onClick={() => handleSort('monthlyValue')}
                  className="ml-2 inline-flex items-center"
                >
                  {renderSortIcon('monthlyValue')}
                </button>
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Contacts / Opps
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Updated
                <button
                  type="button"
                  onClick={() => handleSort('updatedAt')}
                  className="ml-2 inline-flex items-center"
                >
                  {renderSortIcon('updatedAt')}
                </button>
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {data.map((customer) => (
              <tr key={customer.id} className="transition hover:bg-muted">
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <div className="font-semibold text-foreground">{customer.name}</div>
                  <div className="text-xs text-muted-foreground">{customer.email}</div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {customer.type.replace('_', ' ')}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span
                    className={clsx(
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                      statusClass[customer.status],
                    )}
                  >
                    {customer.status.replace('_', ' ')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span
                    className={clsx(
                      'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                      sentimentClass[customer.sentiment],
                    )}
                  >
                    {customer.sentiment}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {customer.monthlyValue !== null && customer.monthlyValue !== undefined
                    ? `${(customer.currency ?? 'USD')} ${customer.monthlyValue.toLocaleString()}`
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700">
                      C: {customer._count?.contacts ?? 0}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 font-medium text-indigo-700">
                      O: {customer._count?.opportunities ?? 0}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {format(new Date(customer.updatedAt), 'MMM dd, yyyy')}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-blue-200 hover:text-blue-600"
                      title="View details"
                      onClick={() => onView(customer)}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-emerald-200 hover:text-emerald-600"
                      title="Update status"
                      onClick={() => onUpdateStatus(customer)}
                    >
                      <FileBarChart2 className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-blue-200 hover:text-blue-600"
                      title="Edit"
                      onClick={() => onEdit(customer)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-red-200 hover:text-red-600"
                      title="Delete"
                      onClick={() => onDelete(customer)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm md:flex-row">
        <div>
          Showing{' '}
          <span className="font-semibold text-foreground">
            {(meta.page - 1) * meta.pageSize + 1}-
            {Math.min(meta.page * meta.pageSize, meta.total)}
          </span>{' '}
          of <span className="font-semibold text-foreground">{meta.total}</span> customers
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChangePage(meta.page - 1)}
            disabled={meta.page === 1}
            className="rounded-lg border border-border px-3 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm">
            Page <span className="font-semibold text-foreground">{meta.page}</span> of{' '}
            <span className="font-semibold text-foreground">{meta.pageCount || 1}</span>
          </span>
          <button
            onClick={() => onChangePage(meta.page + 1)}
            disabled={meta.page >= (meta.pageCount || 1)}
            className="rounded-lg border border-border px-3 py-1 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}



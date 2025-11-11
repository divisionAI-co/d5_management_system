import { Eye, Pencil, Send, CheckCircle, Trash2 } from 'lucide-react';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import type { InvoiceSummary } from '@/types/invoices';

interface InvoicesTableProps {
  invoices: InvoiceSummary[];
  isLoading?: boolean;
  onView: (invoice: InvoiceSummary) => void;
  onEdit: (invoice: InvoiceSummary) => void;
  onSend: (invoice: InvoiceSummary) => void;
  onMarkPaid: (invoice: InvoiceSummary) => void;
  onDelete: (invoice: InvoiceSummary) => void;
}

const formatCurrency = (amount: number, currency: string) =>
  amount.toLocaleString(undefined, {
    style: 'currency',
    currency: currency ?? 'USD',
  });

const formatDate = (date: string) => new Date(date).toLocaleDateString();

export function InvoicesTable({
  invoices,
  isLoading,
  onView,
  onEdit,
  onSend,
  onMarkPaid,
  onDelete,
}: InvoicesTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card py-12 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading invoices...</p>
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-muted py-16">
        <div className="text-center">
          <p className="text-base font-medium text-muted-foreground">No invoices found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Adjust your filters or create a new invoice to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Invoice
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Customer
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Issue Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Due Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-muted">
              <td className="whitespace-nowrap px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    Recurring:{' '}
                    {invoice.isRecurring
                      ? `Yes (day ${invoice.recurringDay ?? '—'})`
                      : 'No'}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    {invoice.customer?.name ?? '—'}
                  </p>
                  <p className="text-xs text-muted-foreground">{invoice.customer?.email ?? ''}</p>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                {formatDate(invoice.issueDate)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                {formatDate(invoice.dueDate)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-foreground">
                {formatCurrency(invoice.total, invoice.currency)}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col gap-1">
                  <InvoiceStatusBadge status={invoice.status} />
                  {invoice.status === 'OVERDUE' && invoice.remindersSent > 0 && (
                    <span className="text-xs text-red-600">
                      {invoice.remindersSent} reminder{invoice.remindersSent === 1 ? '' : 's'} sent
                    </span>
                  )}
                  {invoice.status === 'PAID' && invoice.paidDate && (
                    <span className="text-xs text-green-600">
                      Paid {formatDate(invoice.paidDate)}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onView(invoice)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button
                    onClick={() => onEdit(invoice)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => onSend(invoice)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </button>
                  </div>
                  {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                    <button
                      onClick={() => onMarkPaid(invoice)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Mark Paid
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(invoice)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}



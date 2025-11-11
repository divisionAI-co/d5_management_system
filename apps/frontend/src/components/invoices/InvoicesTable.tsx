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
      <div className="flex items-center justify-center rounded-lg border border-gray-200 bg-white py-12 shadow-sm">
        <p className="text-sm text-gray-500">Loading invoices...</p>
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 py-16">
        <div className="text-center">
          <p className="text-base font-medium text-gray-700">No invoices found</p>
          <p className="mt-1 text-sm text-gray-500">
            Adjust your filters or create a new invoice to get started.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Invoice
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Customer
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Issue Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Due Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">{invoice.invoiceNumber}</p>
                  <p className="text-xs text-gray-500">
                    Recurring:{' '}
                    {invoice.isRecurring
                      ? `Yes (day ${invoice.recurringDay ?? '—'})`
                      : 'No'}
                  </p>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">
                    {invoice.customer?.name ?? '—'}
                  </p>
                  <p className="text-xs text-gray-500">{invoice.customer?.email ?? ''}</p>
                </div>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                {formatDate(invoice.issueDate)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                {formatDate(invoice.dueDate)}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-gray-900">
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
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View
                  </button>
                  <button
                    onClick={() => onEdit(invoice)}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <div className="relative">
                    <button
                      onClick={() => onSend(invoice)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </button>
                  </div>
                  {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
                    <button
                      onClick={() => onMarkPaid(invoice)}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
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



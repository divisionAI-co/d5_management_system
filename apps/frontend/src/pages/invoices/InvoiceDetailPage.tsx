import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Download,
  Pencil,
  Send,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { invoicesApi } from '@/lib/api/invoices';
import { InvoiceStatusBadge } from '@/components/invoices/InvoiceStatusBadge';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import { InvoiceSendDialog } from '@/components/invoices/InvoiceSendDialog';
import { InvoiceMarkPaidDialog } from '@/components/invoices/InvoiceMarkPaidDialog';
import type { InvoiceDetail } from '@/types/invoices';
import { FeedbackToast } from '@/components/ui/feedback-toast';

const formatCurrency = (amount: number, currency: string) =>
  amount.toLocaleString(undefined, {
    style: 'currency',
    currency: currency ?? 'USD',
  });

const formatDate = (isoDate?: string | null) => {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
};

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isMarkPaidOpen, setIsMarkPaidOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const invoiceQuery = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => invoicesApi.getById(id!),
    enabled: Boolean(id),
  });

  const invoice: InvoiceDetail | undefined = invoiceQuery.data;

  const totals = useMemo(() => {
    if (!invoice) {
      return {
        subtotal: 0,
        taxAmount: 0,
        total: 0,
      };
    }
    return {
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxAmount,
      total: invoice.total,
    };
  }, [invoice]);

  const handleDownload = async () => {
    if (!id || !invoice) return;
    try {
      setIsDownloading(true);
      const blob = await invoicesApi.downloadPdf(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setFeedback(`PDF downloaded for invoice ${invoice.invoiceNumber}.`);
    } catch (error) {
      console.error(error);
      setFeedback('Unable to download invoice PDF. Please try again later.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!id) {
    return (
      <div className="py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Invoice identifier is missing.
        </div>
      </div>
    );
  }

  if (invoiceQuery.isLoading) {
    return (
      <div className="py-12">
        <div className="flex items-center justify-center rounded-lg border border-border bg-card py-12 shadow-sm">
          <p className="text-sm text-muted-foreground">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (invoiceQuery.isError || !invoice) {
    return (
      <div className="py-12">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">
            We couldn&apos;t find this invoice. It may have been deleted or you may not have access.
          </p>
          <button
            onClick={() => navigate('/invoices')}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to invoices
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{invoice.invoiceNumber}</h1>
            <p className="text-sm text-muted-foreground">
              Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusBadge status={invoice.status} />
          <button
            onClick={() => invoiceQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => setIsSendOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
          {(invoice.status !== 'PAID' && invoice.status !== 'CANCELLED') && (
            <button
              onClick={() => setIsMarkPaidOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <CheckCircle className="h-4 w-4" />
              Mark Paid
            </button>
          )}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download PDF'}
          </button>
        </div>
      </div>

      {feedback && (
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
          tone="info"
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Billing Details
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Customer</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {invoice.customer?.name ?? '—'}
                </p>
                <p className="text-sm text-muted-foreground">{invoice.customer?.email ?? ''}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Account Manager</p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  {invoice.createdBy
                    ? `${invoice.createdBy.firstName} ${invoice.createdBy.lastName}`
                    : '—'}
                </p>
                <p className="text-sm text-muted-foreground">{invoice.createdBy?.email ?? ''}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Issue Date</p>
                <p className="mt-1 text-sm text-foreground">{formatDate(invoice.issueDate)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Due Date</p>
                <p className="mt-1 text-sm text-foreground">{formatDate(invoice.dueDate)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Currency</p>
                <p className="mt-1 text-sm text-foreground">{invoice.currency}</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Line Items
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Description
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Quantity
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Unit Price
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Line Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoice.items.map((item, index) => {
                    const quantity = item.quantity ?? 0;
                    const unitPrice = item.unitPrice ?? 0;
                    const lineTotal =
                      item.lineTotal ?? Number(quantity) * Number(unitPrice);
                    return (
                      <tr key={`${item.description}-${index}`} className="bg-card">
                        <td className="px-4 py-2 text-sm text-muted-foreground">{item.description}</td>
                        <td className="px-4 py-2 text-right text-sm text-muted-foreground">
                          {quantity}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-muted-foreground">
                          {formatCurrency(unitPrice, invoice.currency)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-medium text-foreground">
                          {formatCurrency(lineTotal, invoice.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end">
              <dl className="w-full max-w-sm space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <dt>Subtotal</dt>
                  <dd className="font-medium">
                    {formatCurrency(totals.subtotal, invoice.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>
                    Tax ({invoice.taxRate ?? 0}
                    %)
                  </dt>
                  <dd className="font-medium">
                    {formatCurrency(totals.taxAmount, invoice.currency)}
                  </dd>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2 text-base">
                  <dt>Total</dt>
                  <dd className="font-semibold">
                    {formatCurrency(totals.total, invoice.currency)}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Notes & History
            </h2>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Internal Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {invoice.notes?.trim() ? invoice.notes : '—'}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Reminders Sent</p>
                  <p className="mt-1 text-muted-foreground">{invoice.remindersSent}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Last Reminder</p>
                  <p className="mt-1 text-muted-foreground">{formatDate(invoice.lastReminderAt)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Paid Date</p>
                  <p className="mt-1 text-muted-foreground">{formatDate(invoice.paidDate)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Last Updated</p>
                  <p className="mt-1 text-muted-foreground">{formatDate(invoice.updatedAt)}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recurrence
            </h2>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold">Recurring:</span>{' '}
                {invoice.isRecurring ? 'Yes' : 'No'}
              </p>
              {invoice.isRecurring && (
                <p>
                  <span className="font-semibold">Billing Day:</span>{' '}
                  {invoice.recurringDay ?? 'N/A'}
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Summary
            </h2>
            <dl className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <dt>Status</dt>
                <dd>
                  <InvoiceStatusBadge status={invoice.status} />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Total</dt>
                <dd className="font-semibold">
                  {formatCurrency(invoice.total, invoice.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Outstanding</dt>
                <dd className="font-semibold">
                  {invoice.status === 'PAID'
                    ? formatCurrency(0, invoice.currency)
                    : formatCurrency(invoice.total, invoice.currency)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </h2>
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <button
                onClick={() => setIsSendOpen(true)}
                className="w-full rounded-lg border border-border px-3 py-2 text-left transition hover:bg-muted"
              >
                Email invoice to customer
              </button>
              {(invoice.status !== 'PAID' && invoice.status !== 'CANCELLED') && (
                <button
                  onClick={() => setIsMarkPaidOpen(true)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-left transition hover:bg-muted"
                >
                  Record payment
                </button>
              )}
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="w-full rounded-lg border border-border px-3 py-2 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
              </button>
            </div>
          </section>
        </div>
      </div>

      {isFormOpen && (
        <InvoiceForm
          invoice={invoice}
          onClose={() => setIsFormOpen(false)}
          onSuccess={(updated) => {
            setIsFormOpen(false);
            setFeedback(`Invoice ${updated.invoiceNumber} updated successfully.`);
            queryClient.invalidateQueries({ queryKey: ['invoice', id] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
          }}
        />
      )}

      {isSendOpen && (
        <InvoiceSendDialog
          invoice={invoice}
          onClose={() => setIsSendOpen(false)}
          onSent={(updated) => {
            setIsSendOpen(false);
            setFeedback(`Invoice ${updated.invoiceNumber} sent successfully.`);
            queryClient.invalidateQueries({ queryKey: ['invoice', id] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
          }}
        />
      )}

      {isMarkPaidOpen && (
        <InvoiceMarkPaidDialog
          invoice={invoice}
          onClose={() => setIsMarkPaidOpen(false)}
          onMarked={(updated) => {
            setIsMarkPaidOpen(false);
            setFeedback(`Invoice ${updated.invoiceNumber} marked as paid.`);
            queryClient.invalidateQueries({ queryKey: ['invoice', id] });
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
          }}
        />
      )}
    </div>
  );
}


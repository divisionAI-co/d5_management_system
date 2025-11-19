import type { Quote } from '@/types/crm';
import { format } from 'date-fns';
import { ClipboardList, Edit3, Eye, Trash2 } from 'lucide-react';
import clsx from 'clsx';

interface QuotesTableProps {
  quotes?: Quote[];
  isLoading: boolean;
  onCreate?: () => void;
  onEdit: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
  onView?: (quote: Quote) => void;
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-200',
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  ACCEPTED: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
  EXPIRED: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200',
};

export function QuotesTable({
  quotes,
  isLoading,
  onCreate,
  onEdit,
  onDelete,
  onView,
}: QuotesTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <ClipboardList className="h-10 w-10 text-border" />
          <p>No quotes found. Try adjusting your filters or create a new quote.</p>
          {onCreate && (
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              New Quote
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/70">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Quote Number
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Title
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Lead
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Value
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Created
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {quotes.map((quote) => (
            <tr key={quote.id} className="hover:bg-muted/50 transition-colors">
              <td className="whitespace-nowrap px-6 py-4">
                <div className="text-sm font-medium text-foreground">{quote.quoteNumber}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-foreground">{quote.title}</div>
                {quote.description && (
                  <div className="text-xs text-muted-foreground line-clamp-1">{quote.description}</div>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-foreground">{quote.lead.title}</div>
                {quote.lead.contacts && quote.lead.contacts.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {quote.lead.contacts[0].firstName} {quote.lead.contacts[0].lastName}
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                {quote.totalValue ? (
                  <div className="text-sm font-medium text-foreground">
                    {quote.currency || 'USD'} {quote.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">—</div>
                )}
              </td>
              <td className="whitespace-nowrap px-6 py-4">
                <span
                  className={clsx(
                    'inline-flex rounded-full px-2 py-1 text-xs font-semibold',
                    statusColors[quote.status] || statusColors.DRAFT,
                  )}
                >
                  {quote.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                {format(new Date(quote.createdAt), 'MMM d, yyyy')}
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                <div className="flex items-center justify-end gap-2">
                  {onView && (
                    <button
                      onClick={() => onView(quote)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      title="View"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(quote)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    title="Edit"
                  >
                    <Edit3 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => onDelete(quote)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
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


import type { Lead } from '@/types/crm';
import { format } from 'date-fns';
import { ClipboardList, Edit3, RefreshCcw, Star, Trash2, UserPlus } from 'lucide-react';
import clsx from 'clsx';

interface LeadsTableProps {
  leads?: Lead[];
  isLoading: boolean;
  onCreate?: () => void;
  onEdit: (lead: Lead) => void;
  onUpdateStatus: (lead: Lead) => void;
  onConvert: (lead: Lead) => void;
  onDelete: (lead: Lead) => void;
  onView?: (lead: Lead) => void;
}

const statusColors: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  CONTACTED: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200',
  QUALIFIED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  PROPOSAL: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  WON: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200',
  LOST: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
};

export function LeadsTable({
  leads,
  isLoading,
  onCreate,
  onEdit,
  onUpdateStatus,
  onConvert,
  onDelete,
  onView,
}: LeadsTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <ClipboardList className="h-10 w-10 text-border" />
          <p>No leads found. Try adjusting your filters or create a new lead.</p>
          {onCreate && (
            <button
              onClick={onCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              New Lead
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
              Lead
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Company
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Probability
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Value
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Assigned
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Updated
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className={`transition ${onView ? 'cursor-pointer hover:bg-muted/70' : 'hover:bg-muted/70'}`}
              onClick={() => onView?.(lead)}
            >
              <td className="px-6 py-4 text-sm">
                <div className="font-semibold text-foreground">{lead.title}</div>
                {lead.source && <div className="text-xs text-muted-foreground">Source: {lead.source}</div>}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">
                  {lead.contact.firstName} {lead.contact.lastName}
                </div>
                <div className="text-xs text-muted-foreground">{lead.contact.email}</div>
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {lead.contact.companyName || lead.prospectCompanyName || '—'}
              </td>
              <td className="px-6 py-4 text-sm">
                <span
                  className={clsx(
                    'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold',
                    statusColors[lead.status] ?? 'bg-muted/70 text-muted-foreground',
                  )}
                >
                  {lead.status}
                </span>
                {lead.convertedCustomer && (
                  <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-300">
                    Converted → {lead.convertedCustomer.name}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {lead.probability !== null && lead.probability !== undefined ? `${lead.probability}%` : '—'}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {lead.value !== null && lead.value !== undefined ? lead.value.toLocaleString() : '—'}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {lead.assignedTo
                  ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}`
                  : 'Unassigned'}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {format(new Date(lead.updatedAt), 'MMM dd, yyyy')}
              </td>
              <td className="px-6 py-4 text-right text-sm">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(lead);
                    }}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-blue-300 hover:text-blue-600 dark:hover:border-blue-400 dark:hover:text-blue-300"
                    title="Edit lead"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onUpdateStatus(lead);
                    }}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-indigo-300 hover:text-indigo-600 dark:hover:border-indigo-400 dark:hover:text-indigo-300"
                    title="Update status"
                  >
                    <RefreshCcw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onConvert(lead);
                    }}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-emerald-300 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:border-emerald-400 dark:hover:text-emerald-300"
                    title="Convert lead"
                    disabled={!!lead.convertedCustomerId}
                  >
                    <Star className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(lead);
                    }}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-red-300 hover:text-red-600 dark:hover:border-red-400 dark:hover:text-red-300"
                    title="Delete lead"
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
  );
}

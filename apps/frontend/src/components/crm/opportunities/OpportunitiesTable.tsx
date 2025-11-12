import type { Opportunity } from '@/types/crm';
import { Edit, Loader2, Lock, Trash2, Trophy } from 'lucide-react';

interface OpportunitiesTableProps {
  opportunities?: Opportunity[];
  isLoading: boolean;
  onCreate: () => void;
  onEdit: (opportunity: Opportunity) => void;
  onClose: (opportunity: Opportunity) => void;
  onDelete: (opportunity: Opportunity) => void;
  onView?: (opportunity: Opportunity) => void;
}

const TYPE_LABELS: Record<Opportunity['type'], string> = {
  STAFF_AUGMENTATION: 'Staff Aug',
  SOFTWARE_SUBSCRIPTION: 'SaaS',
  BOTH: 'Hybrid',
};

const VALUE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

export function OpportunitiesTable({
  opportunities,
  isLoading,
  onCreate,
  onEdit,
  onClose,
  onDelete,
  onView,
}: OpportunitiesTableProps) {
  const rows = opportunities ?? [];

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pipeline</h2>
          <p className="text-xs text-muted-foreground">Monitor opportunity stages, owners, and outcomes.</p>
        </div>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Create Opportunity
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3">Opportunity</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Stage</th>
              <th className="px-4 py-3 text-right">Value</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-card text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading opportunities...
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                  No opportunities found. Adjust your filters or create a new opportunity to get started.
                </td>
              </tr>
            ) : (
              rows.map((opportunity) => {
                const statusLabel = opportunity.isClosed
                  ? opportunity.isWon
                    ? 'Won'
                    : 'Lost'
                  : 'Open';
                const statusColor = opportunity.isClosed
                  ? opportunity.isWon
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200';

                return (
                  <tr
                    key={opportunity.id}
                    className={`text-muted-foreground transition ${
                      onView ? 'cursor-pointer hover:bg-muted/60' : 'hover:bg-muted/60'
                    }`}
                    onClick={() => onView?.(opportunity)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{opportunity.title}</span>
                        {opportunity.lead ? (
                          <span className="text-xs text-muted-foreground">
                            From lead: <span className="font-medium text-muted-foreground">{opportunity.lead.title}</span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {opportunity.customer ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">{opportunity.customer.name}</span>
                          <span className="text-xs text-muted-foreground">{opportunity.customer.email ?? '—'}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">No customer yet</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-muted/70 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {TYPE_LABELS[opportunity.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{opportunity.stage}</span>
                        {opportunity.openPosition ? (
                          <span className="text-xs text-muted-foreground">
                            Position: <span className="font-semibold text-muted-foreground">{opportunity.openPosition.status}</span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-foreground">
                      {opportunity.value !== null ? VALUE_FORMATTER.format(opportunity.value) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {opportunity.assignedTo ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {opportunity.assignedTo.firstName} {opportunity.assignedTo.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">{opportunity.assignedTo.email}</span>
                        </div>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${statusColor}`}>
                        {opportunity.isClosed ? (
                          opportunity.isWon ? (
                            <Trophy className="h-3.5 w-3.5" />
                          ) : (
                            <Lock className="h-3.5 w-3.5" />
                          )
                        ) : (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
                        )}
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col text-xs text-muted-foreground">
                        <span>
                          Updated {new Date(opportunity.updatedAt).toLocaleDateString()}
                        </span>
                        <span>
                          Created {new Date(opportunity.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onEdit(opportunity);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        >
                          <Edit className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onClose(opportunity);
                          }}
                          disabled={opportunity.isClosed}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Trophy className="h-3.5 w-3.5" />
                          {opportunity.isClosed ? 'Closed' : 'Close'}
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onDelete(opportunity);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



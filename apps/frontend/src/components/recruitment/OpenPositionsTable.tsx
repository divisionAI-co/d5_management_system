import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { UserRound, Users } from 'lucide-react';
import type { OpenPositionSummary, PositionStatus } from '@/types/recruitment';

const STATUS_COLORS: Record<PositionStatus, string> = {
  Open: 'bg-emerald-100 text-emerald-700',
  Filled: 'bg-blue-100 text-blue-700',
  Cancelled: 'bg-rose-100 text-rose-700',
};

interface OpenPositionsTableProps {
  positions: OpenPositionSummary[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onSelect?: (position: OpenPositionSummary) => void;
  onClosePosition?: (position: OpenPositionSummary) => void;
  onEdit?: (position: OpenPositionSummary) => void;
  onDelete?: (position: OpenPositionSummary) => void;
  onArchive?: (position: OpenPositionSummary) => void;
  onUnarchive?: (position: OpenPositionSummary) => void;
}

export function OpenPositionsTable({
  positions,
  isLoading,
  onSelect,
  onClosePosition,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
}: OpenPositionsTableProps) {
  const totalCandidates = useMemo(
    () =>
      positions.reduce((acc, position) => acc + (position.candidates?.length ?? 0), 0),
    [positions],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Open Positions</h2>
          <p className="text-sm text-muted-foreground">
            Active roles sourced from opportunities. Track delivery status and linked
            candidates.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-foreground">{positions.length}</p>
          <p className="text-xs text-muted-foreground">
            positions • {totalCandidates} candidate
            {totalCandidates === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Opportunity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Candidates
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Updated
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-card">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    Loading positions...
                  </div>
                </td>
              </tr>
            ) : positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-muted-foreground">
                  No positions found. Create a staff augmentation opportunity to
                  generate an open position automatically.
                </td>
              </tr>
            ) : (
              positions.map((position) => (
                <tr key={position.id} className="hover:bg-muted">
                  <td className="max-w-sm px-6 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {position.title}
                      </p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {position.description ?? 'No description provided'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {position.opportunity ? (
                      <div>
                        <p className="font-medium text-foreground">
                          {position.opportunity.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <UserRound className="h-3.5 w-3.5" />
                          <span>{position.opportunity.customer?.name ?? '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Unlinked</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        {position.candidates?.length ?? 0}
                      </span>
                      {position.candidates && position.candidates.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Latest:{' '}
                          <span className="font-medium">
                            {
                              [...position.candidates]
                                .sort(
                                  (a, b) =>
                                    new Date(b.appliedAt).getTime() -
                                    new Date(a.appliedAt).getTime(),
                                )[0]?.candidate.firstName
                            }
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[position.status]}`}
                    >
                      {position.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-foreground">
                        {new Date(position.updatedAt).toLocaleDateString()}
                      </p>
                      {position.filledAt && (
                        <p className="text-muted-foreground">
                          Filled:{' '}
                          {new Date(position.filledAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-end gap-2">
                      {onSelect && (
                        <Link
                          to="#"
                          onClick={(event) => {
                            event.preventDefault();
                            onSelect(position);
                          }}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/70"
                        >
                          View
                        </Link>
                      )}
                      {onEdit && (
                        <button
                          type="button"
                          onClick={() => onEdit(position)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/70"
                        >
                          Edit
                        </button>
                      )}
                      {onClosePosition && position.status === 'Open' && (
                        <button
                          onClick={() => onClosePosition(position)}
                          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                        >
                          Mark Filled
                        </button>
                      )}
                      {onArchive && !position.isArchived && (
                        <button
                          type="button"
                          onClick={() => onArchive(position)}
                          className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50"
                        >
                          Archive
                        </button>
                      )}
                      {onUnarchive && position.isArchived && (
                        <button
                          type="button"
                          onClick={() => onUnarchive(position)}
                          className="rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-600 hover:bg-amber-50"
                        >
                          Unarchive
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={() => onDelete(position)}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}



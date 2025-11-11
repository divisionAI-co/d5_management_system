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
}

export function OpenPositionsTable({
  positions,
  isLoading,
  onSelect,
  onClosePosition,
}: OpenPositionsTableProps) {
  const totalCandidates = useMemo(
    () =>
      positions.reduce((acc, position) => acc + (position.candidates?.length ?? 0), 0),
    [positions],
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Open Positions</h2>
          <p className="text-sm text-gray-500">
            Active roles sourced from opportunities. Track delivery status and linked
            candidates.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-900">{positions.length}</p>
          <p className="text-xs text-gray-500">
            positions • {totalCandidates} candidate
            {totalCandidates === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Opportunity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Candidates
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Updated
              </th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2">
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                    Loading positions...
                  </div>
                </td>
              </tr>
            ) : positions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                  No positions found. Create a staff augmentation opportunity to
                  generate an open position automatically.
                </td>
              </tr>
            ) : (
              positions.map((position) => (
                <tr key={position.id} className="hover:bg-gray-50">
                  <td className="max-w-sm px-6 py-4">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {position.title}
                      </p>
                      <p className="text-xs text-gray-500 line-clamp-2">
                        {position.description ?? 'No description provided'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {position.opportunity ? (
                      <div>
                        <p className="font-medium text-gray-900">
                          {position.opportunity.title}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <UserRound className="h-3.5 w-3.5" />
                          <span>{position.opportunity.customer?.name ?? '—'}</span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Unlinked</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                        <Users className="h-3.5 w-3.5" />
                        {position.candidates?.length ?? 0}
                      </span>
                      {position.candidates && position.candidates.length > 0 && (
                        <div className="text-xs text-gray-500">
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
                  <td className="px-6 py-4 text-sm text-gray-600">
                    <div className="space-y-1 text-xs">
                      <p className="font-medium text-gray-900">
                        {new Date(position.updatedAt).toLocaleDateString()}
                      </p>
                      {position.filledAt && (
                        <p className="text-gray-500">
                          Filled:{' '}
                          {new Date(position.filledAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-end gap-2">
                      {onSelect && (
                        <Link
                          to="#"
                          onClick={(event) => {
                            event.preventDefault();
                            onSelect(position);
                          }}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100"
                        >
                          View
                        </Link>
                      )}
                      {onClosePosition && position.status === 'Open' && (
                        <button
                          onClick={() => onClosePosition(position)}
                          className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                        >
                          Mark Filled
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



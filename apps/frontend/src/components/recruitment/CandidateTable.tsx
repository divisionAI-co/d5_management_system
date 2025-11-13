import { Archive, Edit2, Mail, MapPin, Phone, Star, Trash2, UserRound } from 'lucide-react';
import { format } from 'date-fns';
import type { Candidate, CandidateStage } from '@/types/recruitment';
import { CANDIDATE_STAGE_LABELS, CANDIDATE_STAGE_COLORS } from './CandidateBoard';

interface CandidateTableProps {
  candidates: Candidate[];
  onView?: (candidate: Candidate) => void;
  onEdit?: (candidate: Candidate) => void;
  onMoveStage?: (candidate: Candidate, stage: CandidateStage) => void;
  onLinkPosition?: (candidate: Candidate) => void;
  onConvertToEmployee?: (candidate: Candidate) => void;
  onArchive?: (candidate: Candidate) => void;
  onDelete?: (candidate: Candidate) => void;
  disableStageChange?: boolean;
  canDelete?: boolean;
}

export function CandidateTable({
  candidates,
  onView,
  onEdit,
  onMoveStage,
  onLinkPosition,
  onConvertToEmployee,
  onArchive,
  onDelete,
  disableStageChange,
  canDelete = false,
}: CandidateTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Candidate
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Contact
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Stage
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Skills
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Rating
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Created
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {candidates.map((candidate) => (
            <tr key={candidate.id} className="hover:bg-muted/50 transition-colors">
              <td className="px-6 py-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">
                    {candidate.firstName} {candidate.lastName}
                  </span>
                  {candidate.currentTitle && (
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      {candidate.currentTitle}
                    </span>
                  )}
                  {candidate.city || candidate.country ? (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      <span>
                        {[candidate.city, candidate.country].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  ) : null}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5" />
                    <a
                      href={`mailto:${candidate.email}`}
                      className="hover:underline truncate max-w-[200px]"
                      title={candidate.email}
                    >
                      {candidate.email}
                    </a>
                  </div>
                  {candidate.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[200px]" title={candidate.phone}>
                        {candidate.phone}
                      </span>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                {onMoveStage ? (
                  <select
                    value={candidate.stage}
                    onChange={(event) =>
                      onMoveStage(candidate, event.target.value as CandidateStage)
                    }
                    disabled={disableStageChange}
                    className={`rounded-full px-3 py-1 text-xs font-semibold border-0 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 ${CANDIDATE_STAGE_COLORS[candidate.stage]}`}
                  >
                    {Object.entries(CANDIDATE_STAGE_LABELS).map(([stage, label]) => (
                      <option key={stage} value={stage}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${CANDIDATE_STAGE_COLORS[candidate.stage]}`}
                  >
                    {CANDIDATE_STAGE_LABELS[candidate.stage]}
                  </span>
                )}
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {(candidate.skills ?? []).slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="rounded-full bg-muted/70 px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {skill}
                    </span>
                  ))}
                  {(candidate.skills ?? []).length > 3 && (
                    <span className="rounded-full bg-muted/70 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      +{(candidate.skills ?? []).length - 3}
                    </span>
                  )}
                  {(!candidate.skills || candidate.skills.length === 0) && (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                {candidate.rating ? (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium text-foreground">{candidate.rating}</span>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-muted-foreground">
                {candidate.createdAt
                  ? format(new Date(candidate.createdAt), 'MMM d, yyyy')
                  : '—'}
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center justify-end gap-2">
                  {onView && (
                    <button
                      onClick={() => onView(candidate)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                      aria-label="View candidate"
                      title="View details"
                    >
                      <UserRound className="h-4 w-4" />
                    </button>
                  )}
                  {onEdit && (
                    <button
                      onClick={() => onEdit(candidate)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
                      aria-label="Edit candidate"
                      title="Edit candidate"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {onArchive && (
                    <button
                      onClick={() => onArchive(candidate)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600"
                      aria-label="Archive candidate"
                      title="Archive candidate"
                    >
                      <Archive className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && onDelete && (
                    <button
                      onClick={() => onDelete(candidate)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                      aria-label="Delete candidate"
                      title="Permanently delete candidate"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {candidates.length === 0 && (
        <div className="border-t border-border bg-muted px-6 py-8 text-center text-sm text-muted-foreground">
          No candidates found. Adjust filters or create a new candidate to get started.
        </div>
      )}
    </div>
  );
}


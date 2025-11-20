import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserRound, ArrowLeft, Edit3, Trash2, ExternalLink, Building } from 'lucide-react';
import { positionsApi } from '@/lib/api/recruitment';
import type { OpenPosition, PositionStatus } from '@/types/recruitment';
import {
  CANDIDATE_STAGE_COLORS,
  CANDIDATE_STAGE_LABELS,
} from '@/components/recruitment/CandidateBoard';
import { CreatePositionModal } from '@/components/recruitment/CreatePositionModal';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { SafeHtml } from '@/components/ui/SafeHtml';

export default function PositionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editingPosition, setEditingPosition] = useState<OpenPosition | null>(null);

  const positionQuery = useQuery({
    queryKey: ['position', id],
    queryFn: () => positionsApi.getById(id!),
    enabled: Boolean(id),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({
      id,
      status,
    }: {
      id: string;
      status: PositionStatus;
    }) => positionsApi.update(id, { status }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position', updated.id] });
      setFeedback(`Position "${updated.title}" updated to ${updated.status}.`);
    },
  });

  const closeMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { filledAt: string };
    }) => positionsApi.close(id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position', updated.id] });
      setFeedback(`Position "${updated.title}" marked as filled.`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: positionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      setFeedback('Position deleted successfully.');
      navigate('/recruitment/positions');
    },
    onError: (error: any) => {
      setFeedback(
        error?.response?.data?.message ||
          'Failed to delete position. Please ensure no candidates are linked to this position.',
      );
    },
  });

  const archiveMutation = useMutation({
    mutationFn: positionsApi.archive,
    onSuccess: (archived) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position', archived.id] });
      setFeedback(`Position "${archived.title}" archived successfully.`);
    },
  });

  const unarchiveMutation = useMutation({
    mutationFn: positionsApi.unarchive,
    onSuccess: (unarchived) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position', unarchived.id] });
      setFeedback(`Position "${unarchived.title}" unarchived successfully.`);
    },
  });

  const position = positionQuery.data;

  const handleStatusChange = (nextStatus: PositionStatus) => {
    if (!position || nextStatus === position.status) {
      return;
    }

    if (nextStatus === 'Filled') {
      closeMutation.mutate({
        id: position.id,
        payload: {
          filledAt: new Date().toISOString(),
        },
      });
      return;
    }

    updateStatusMutation.mutate({ id: position.id, status: nextStatus });
  };

  const handlePositionUpdated = (updated: OpenPosition) => {
    setEditingPosition(null);
    setFeedback(`Position "${updated.title}" saved successfully.`);
    queryClient.invalidateQueries({ queryKey: ['positions'] });
    queryClient.invalidateQueries({ queryKey: ['position', updated.id] });
  };

  if (!id) {
    return (
      <div className="py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          Invalid position ID provided.
        </div>
      </div>
    );
  }

  if (positionQuery.isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (positionQuery.isError || !position) {
    return (
      <div className="py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          Unable to load position. It may have been removed or you do not have access.
        </div>
        <button
          onClick={() => navigate('/recruitment/positions')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Positions
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-8">
      <button
        onClick={() => navigate('/recruitment/positions')}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Positions
      </button>

      {feedback && (
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
          tone="success"
        />
      )}

      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{position.title}</h1>
            <select
              value={position.status}
              onChange={(event) => handleStatusChange(event.target.value as PositionStatus)}
              disabled={updateStatusMutation.isPending || closeMutation.isPending}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="Open">Open</option>
              <option value="Filled">Filled</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="text-sm text-muted-foreground">
            {position.description ? (
              <SafeHtml html={position.description} className="prose prose-sm max-w-none" />
            ) : (
              'No description provided.'
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setEditingPosition(position)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Edit3 className="h-4 w-4" /> Edit
          </button>
          {!position.isArchived && (
            <button
              onClick={() => {
                const confirmArchive = window.confirm(
                  `Archive "${position.title}"? Archived positions are hidden from the default view but can be restored later.`,
                );
                if (confirmArchive) {
                  archiveMutation.mutate(position.id);
                }
              }}
              disabled={archiveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-600 transition hover:bg-amber-50 disabled:opacity-60"
            >
              {archiveMutation.isPending ? 'Archiving...' : 'Archive'}
            </button>
          )}
          {position.isArchived && (
            <button
              onClick={() => unarchiveMutation.mutate(position.id)}
              disabled={unarchiveMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-3 py-2 text-sm font-medium text-amber-600 transition hover:bg-amber-50 disabled:opacity-60"
            >
              {unarchiveMutation.isPending ? 'Unarchiving...' : 'Unarchive'}
            </button>
          )}
          <button
            onClick={() => {
              const confirmDelete = window.confirm(
                `Are you sure you want to delete "${position.title}"? This action cannot be undone.\n\nNote: Positions with linked candidates cannot be deleted.`,
              );
              if (confirmDelete) {
                deleteMutation.mutate(position.id);
              }
            }}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {position.requirements && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4">Requirements</h2>
              <div className="rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                <SafeHtml html={position.requirements} className="prose prose-sm max-w-none" />
              </div>
            </div>
          )}

          {position.opportunity && (
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <Building className="h-5 w-5" />
                Opportunity
              </h2>
              <div className="space-y-4">
                <div>
                  <Link
                    to={`/crm/opportunities/${position.opportunity.id}`}
                    className="text-lg font-semibold text-blue-600 hover:underline inline-flex items-center gap-2"
                  >
                    {position.opportunity.title}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {position.opportunity.customer && (
                    <div className="flex items-center gap-2">
                      <UserRound className="h-4 w-4" />
                      <Link
                        to={`/crm/customers/${position.opportunity.customer.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {position.opportunity.customer.name}
                      </Link>
                    </div>
                  )}
                  {position.opportunity.value !== undefined &&
                    position.opportunity.value !== null && (
                      <span>Value: ${Number(position.opportunity.value).toLocaleString()}</span>
                    )}
                  {position.opportunity.lead?.leadType && (
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {position.opportunity.lead.leadType === 'END_CUSTOMER'
                        ? 'End Customer'
                        : 'Intermediary'}
                    </span>
                  )}
                </div>
                {position.opportunity.lead && (
                  <div className="rounded-lg border border-border bg-muted/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Related Lead
                    </p>
                    <Link
                      to={`/crm/leads/${position.opportunity.lead.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline inline-flex items-center gap-2"
                    >
                      {position.opportunity.lead.title}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">Key Dates</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Created</span>
                <span className="text-sm text-foreground">
                  {new Date(position.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  Last Updated
                </span>
                <span className="text-sm text-foreground">
                  {new Date(position.updatedAt).toLocaleDateString()}
                </span>
              </div>
              {position.filledAt && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Filled</span>
                  <span className="text-sm text-foreground">
                    {new Date(position.filledAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Candidate Pipeline</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Candidates linked to this position via recruitment workflow.
            </p>
            <div className="mt-4 space-y-3">
              {position.candidates && position.candidates.length > 0 ? (
                position.candidates.map((link) => (
                  <div
                    key={link.id}
                    className="rounded-xl border border-border bg-muted p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md cursor-pointer"
                    onClick={() => navigate(`/recruitment/candidates/${link.candidate.id}`)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {link.candidate.firstName} {link.candidate.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{link.candidate.email}</p>
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${CANDIDATE_STAGE_COLORS[link.candidate.stage]}`}
                      >
                        {CANDIDATE_STAGE_LABELS[link.candidate.stage]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Applied{' '}
                        {new Date(link.appliedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                      <span>Status: {link.status}</span>
                      {link.candidate.expectedSalary !== undefined &&
                        link.candidate.expectedSalary !== null && (
                          <span>
                            Salary Expectation: ${link.candidate.expectedSalary.toLocaleString()}
                          </span>
                        )}
                    </div>
                    {link.notes && (
                      <div className="mt-2 rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground">
                        <p className="font-semibold text-muted-foreground">Notes</p>
                        <p className="mt-1 whitespace-pre-wrap">{link.notes}</p>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                  No candidates linked yet. Link candidates from the recruitment board.
                </div>
              )}
            </div>
          </div>
        </aside>
      </section>

      {editingPosition && (
        <CreatePositionModal
          position={editingPosition}
          onClose={() => setEditingPosition(null)}
          onUpdated={handlePositionUpdated}
        />
      )}
    </div>
  );
}


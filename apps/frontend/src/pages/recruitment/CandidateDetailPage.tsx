import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Folder, Link2, Mail, MapPin, PenSquare, Pencil, Star, Trash2, UserRound } from 'lucide-react';
import { candidatesApi } from '@/lib/api/recruitment/candidates';
import type { CandidateStage, CandidatePositionsResponse } from '@/types/recruitment';
import {
  CANDIDATE_STAGE_COLORS,
  CANDIDATE_STAGE_LABELS,
  CANDIDATE_STAGE_ORDER,
} from '@/components/recruitment/CandidateBoard';
import { CandidateForm } from '@/components/recruitment/CandidateForm';
import { LinkCandidatePositionModal } from '@/components/recruitment/LinkCandidatePositionModal';
import { SendEmailModal } from '@/components/shared/SendEmailModal';
import { ActivitySidebar } from '@/components/activities/ActivitySidebar';
import { CandidateDrivePreview } from '@/components/recruitment/CandidateDrivePreview';
import { FeedbackToast } from '@/components/ui/feedback-toast';

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const location = useLocation();
  const [showForm, setShowForm] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showActivitySidebar, setShowActivitySidebar] = useState(
    (location.state as any)?.openActivitySidebar ?? (searchParams.get('openActivitySidebar') === 'true'),
  );

  // Open activity sidebar if navigating from notification or email link
  useEffect(() => {
    if ((location.state as any)?.openActivitySidebar) {
      setShowActivitySidebar(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (searchParams.get('openActivitySidebar') === 'true') {
      setShowActivitySidebar(true);
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('openActivitySidebar');
      newSearchParams.delete('activityId');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [location.state, searchParams, navigate, location.pathname, setSearchParams]);

  const candidateQuery = useQuery({
    queryKey: ['candidate', id],
    enabled: Boolean(id),
    queryFn: () => candidatesApi.getById(id!),
  });

  const positionsQuery = useQuery({
    queryKey: ['candidate', id, 'positions'],
    enabled: Boolean(id),
    queryFn: () => candidatesApi.getPositions(id!),
  });

  const stageMutation = useMutation({
    mutationFn: ({
      id: candidateId,
      stage,
    }: {
      id: string;
      stage: CandidateStage;
      note?: string;
    }) => candidatesApi.updateStage(candidateId, { stage }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['candidate', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setFeedback(
        `${updated.firstName} ${updated.lastName} moved to ${CANDIDATE_STAGE_LABELS[updated.stage]}.`,
      );
    },
  });

  const unlinkPositionMutation = useMutation({
    mutationFn: ({
      candidateId,
      positionId,
    }: {
      candidateId: string;
      positionId: string;
      positionTitle?: string;
    }) => candidatesApi.unlinkPosition(candidateId, positionId),
    onSuccess: (updated, variables) => {
      queryClient.invalidateQueries({ queryKey: ['candidate', updated.id] });
      queryClient.invalidateQueries({
        queryKey: ['candidate', updated.id, 'positions'],
      });
      setFeedback(
        variables.positionTitle
          ? `Removed ${updated.firstName} ${updated.lastName} from ${variables.positionTitle}.`
          : 'Position link removed.',
      );
    },
    onError: (_error, variables) => {
      setFeedback(
        variables?.positionTitle
          ? `Unable to remove link to ${variables.positionTitle}.`
          : 'Unable to remove link.',
      );
    },
  });

  const candidate = candidateQuery.data;
  const linkedPositions = positionsQuery.data ?? [];

  const skills = useMemo(() => candidate?.skills ?? [], [candidate]);

  if (candidateQuery.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          Loading candidate profile...
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="py-10 space-y-6">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm text-red-600">
          Candidate not found. They may have been deleted or you do not have access.
        </div>
        <div className="text-center">
          <button
            onClick={() => navigate('/recruitment/candidates')}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Candidates
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition hover:text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {candidate.firstName} {candidate.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {candidate.currentTitle ?? 'Role pending'} •{' '}
              {candidate.yearsOfExperience ?? 0} yrs experience
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center rounded-full px-4 py-1 text-xs font-semibold ${CANDIDATE_STAGE_COLORS[candidate.stage]}`}
            >
              {CANDIDATE_STAGE_LABELS[candidate.stage]}
            </span>
            {candidate.rating ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-4 py-1 text-xs font-semibold text-yellow-700">
                <Star className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500" />
                {candidate.rating}/5 rating
              </span>
            ) : null}
            {candidate.expectedSalary !== undefined &&
              candidate.expectedSalary !== null && (
                <span className="inline-flex items-center rounded-full bg-muted/70 px-4 py-1 text-xs font-semibold text-muted-foreground">
                  Expected {candidate.salaryCurrency ?? 'USD'}{' '}
                  {candidate.expectedSalary.toLocaleString()}
                </span>
              )}
            {candidate.availableFrom && (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-1 text-xs font-semibold text-emerald-700">
                Available from {new Date(candidate.availableFrom).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value={candidate.stage}
            onChange={(event) =>
              stageMutation.mutate({
                id: candidate.id,
                stage: event.target.value as CandidateStage,
              })
            }
          >
            {CANDIDATE_STAGE_ORDER.map((stage) => (
              <option key={stage} value={stage}>
                {CANDIDATE_STAGE_LABELS[stage]}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowLinkModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
          >
            <Link2 className="h-4 w-4" />
            Link Position
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
          >
            <Mail className="h-4 w-4" />
            Send Email
          </button>
          <button
            onClick={() => setShowActivitySidebar(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
          >
            <PenSquare className="h-4 w-4" />
            Activities
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {feedback && (
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
          tone="success"
        />
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Profile Overview</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Contact
                  </p>
                  <div className="mt-1 text-sm text-muted-foreground">
                    <p>
                      <a
                        href={`mailto:${candidate.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {candidate.email}
                      </a>
                    </p>
                    {candidate.phone && <p>{candidate.phone}</p>}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Recruiter
                  </p>
                  {candidate.recruiter ? (
                    <div className="mt-2 flex items-center gap-3">
                      <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold text-foreground">
                          {candidate.recruiter.firstName} {candidate.recruiter.lastName}
                        </p>
                        <a
                          href={`mailto:${candidate.recruiter.email}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {candidate.recruiter.email}
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No recruiter assigned.</p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {candidate.city || 'City TBD'}, {candidate.country || 'Country TBD'}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Experience
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {candidate.yearsOfExperience ?? 0} years overall experience
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Assets
                  </p>
                  <ul className="mt-2 space-y-2 text-sm text-blue-600">
                    {candidate.resume && (
                      <li>
                        <a
                          href={candidate.resume}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <FileText className="h-4 w-4" />
                          Resume
                        </a>
                      </li>
                    )}
                    {candidate.driveFolderUrl && (
                      <li>
                        <a
                          href={candidate.driveFolderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 hover:underline"
                        >
                          <Folder className="h-4 w-4" />
                          Drive Folder
                        </a>
                      </li>
                    )}
                    {candidate.linkedinUrl && (
                      <li>
                        <a
                          href={candidate.linkedinUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          LinkedIn Profile
                        </a>
                      </li>
                    )}
                    {candidate.githubUrl && (
                      <li>
                        <a
                          href={candidate.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          GitHub
                        </a>
                      </li>
                    )}
                    {candidate.portfolioUrl && (
                      <li>
                        <a
                          href={candidate.portfolioUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline"
                        >
                          Portfolio
                        </a>
                      </li>
                    )}
                  </ul>
                  {!candidate.resume &&
                    !candidate.linkedinUrl &&
                    !candidate.githubUrl &&
                    !candidate.portfolioUrl && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        No external resources attached yet.
                      </p>
                    )}
                </div>
              </div>
            </div>

            {candidate.notes && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Recruiter Notes
                </p>
                <div className="mt-2 whitespace-pre-wrap rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
                  {candidate.notes}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Skills & Strengths</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.length ? (
                skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center rounded-full bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Skills not captured. Update the candidate profile to add core skills.
                </p>
              )}
            </div>
          </div>

        </section>

        <aside className="space-y-6">
          <CandidateDrivePreview
            folderId={candidate.driveFolderId ?? undefined}
            folderUrl={candidate.driveFolderUrl ?? undefined}
            candidateName={`${candidate.firstName} ${candidate.lastName}`}
          />
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Linked Positions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              See which opportunities this candidate is being considered for.
            </p>
            <div className="mt-4 space-y-4">
              {linkedPositions.length > 0 ? (
                linkedPositions.map((link: CandidatePositionsResponse) => (
                  <div key={link.id} className="rounded-xl border border-border bg-muted p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {link.position.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {link.position.opportunity?.customer?.name ?? '—'}
                        </p>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {link.status}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                      <p>
                        Applied{' '}
                        {new Date(link.appliedAt).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p>Position status: {link.position.status}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <button
                        onClick={() =>
                          navigate(
                            `/recruitment/positions?highlight=${link.positionId}`,
                          )
                        }
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        View position
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          unlinkPositionMutation.mutate({
                            candidateId: candidate.id,
                            positionId: link.positionId,
                            positionTitle: link.position.title,
                          })
                        }
                        disabled={
                          unlinkPositionMutation.isPending &&
                          unlinkPositionMutation.variables?.positionId === link.positionId
                        }
                        className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {unlinkPositionMutation.isPending &&
                        unlinkPositionMutation.variables?.positionId === link.positionId
                          ? 'Removing...'
                          : 'Remove link'}
                      </button>
                    </div>
                    {link.notes && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Note: {link.notes.slice(0, 80)}
                        {link.notes.length > 80 ? '…' : ''}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                  No positions linked. Use &ldquo;Link Position&rdquo; above to connect
                  an opportunity.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {showForm && (
        <CandidateForm
          candidate={candidate}
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['candidate', candidate.id] });
            queryClient.invalidateQueries({ queryKey: ['candidates'] });
            setFeedback('Candidate profile updated successfully.');
          }}
        />
      )}

      {showLinkModal && (
        <LinkCandidatePositionModal
          candidate={candidate}
          onClose={() => setShowLinkModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['candidate', candidate.id] });
            queryClient.invalidateQueries({ queryKey: ['candidate', candidate.id, 'positions'] });
            setFeedback('Candidate linked to position successfully.');
          }}
        />
      )}

      <ActivitySidebar
        open={showActivitySidebar}
        onClose={() => setShowActivitySidebar(false)}
        entityId={id!}
        entityType="candidate"
        title="Activity Timeline"
      />

      {showEmailModal && candidate ? (
        <SendEmailModal
          title={`Send Email - ${candidate.firstName} ${candidate.lastName}`}
          defaultTo={candidate.email || ''}
          defaultSubject={`Update on Your Application - ${candidate.firstName} ${candidate.lastName}`}
          onClose={() => setShowEmailModal(false)}
          onSend={async (payload) => {
            await candidatesApi.sendEmail(candidate.id, payload);
            setFeedback(`Email sent successfully to ${payload.to}`);
            setShowEmailModal(false);
          }}
        />
      ) : null}
    </div>
  );
}


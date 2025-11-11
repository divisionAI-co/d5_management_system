import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, FileText, Link2, MapPin, Pencil, Star } from 'lucide-react';
import { candidatesApi } from '@/lib/api/recruitment';
import type { CandidateStage, CandidatePositionsResponse } from '@/types/recruitment';
import {
  CANDIDATE_STAGE_COLORS,
  CANDIDATE_STAGE_LABELS,
  CANDIDATE_STAGE_ORDER,
} from '@/components/recruitment/CandidateBoard';
import { CandidateForm } from '@/components/recruitment/CandidateForm';
import { LinkCandidatePositionModal } from '@/components/recruitment/LinkCandidatePositionModal';

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const candidate = candidateQuery.data;
  const linkedPositions = positionsQuery.data ?? [];

  const skills = useMemo(() => candidate?.skills ?? [], [candidate]);

  if (candidateQuery.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-500">
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
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
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
            className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 transition hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {candidate.firstName} {candidate.lastName}
            </h1>
            <p className="text-sm text-gray-500">
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
                <span className="inline-flex items-center rounded-full bg-gray-100 px-4 py-1 text-xs font-semibold text-gray-700">
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
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
          >
            <Link2 className="h-4 w-4" />
            Link Position
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
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <span>{feedback}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold uppercase tracking-wide"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Profile Overview</h2>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Contact
                  </p>
                  <div className="mt-1 text-sm text-gray-600">
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

                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span>
                    {candidate.city || 'City TBD'}, {candidate.country || 'Country TBD'}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Experience
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {candidate.yearsOfExperience ?? 0} years overall experience
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
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
                      <p className="mt-2 text-sm text-gray-500">
                        No external resources attached yet.
                      </p>
                    )}
                </div>
              </div>
            </div>

            {candidate.notes && (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Recruiter Notes
                </p>
                <div className="mt-2 whitespace-pre-wrap rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-700">
                  {candidate.notes}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Skills & Strengths</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.length ? (
                skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  Skills not captured. Update the candidate profile to add core skills.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
            <div className="mt-4 space-y-4">
              {candidate.activities && candidate.activities.length > 0 ? (
                candidate.activities.map((activity) => (
                  <div key={activity.id} className="relative pl-6">
                    <span className="absolute left-1 top-2 h-2 w-2 rounded-full bg-blue-500" />
                    <p className="text-sm font-semibold text-gray-900">
                      {activity.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.createdAt).toLocaleString()} by{' '}
                      {activity.createdBy
                        ? `${activity.createdBy.firstName} ${activity.createdBy.lastName}`
                        : 'System'}
                    </p>
                    {activity.description && (
                      <p className="mt-1 text-sm text-gray-600">{activity.description}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">
                  No activity logged yet. Notes from interviews and decisions will show
                  up here.
                </p>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Linked Positions</h2>
            <p className="mt-1 text-sm text-gray-500">
              See which opportunities this candidate is being considered for.
            </p>
            <div className="mt-4 space-y-4">
              {linkedPositions.length > 0 ? (
                linkedPositions.map((link: CandidatePositionsResponse) => (
                  <div key={link.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {link.position.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {link.position.opportunity?.customer?.name ?? '—'}
                        </p>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                        {link.status}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-gray-500">
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
                    <div className="mt-3 flex items-center justify-between">
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
                      {link.notes && (
                        <span className="text-xs text-gray-500">
                          Note: {link.notes.slice(0, 60)}
                          {link.notes.length > 60 ? '…' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center text-sm text-gray-500">
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
    </div>
  );
}


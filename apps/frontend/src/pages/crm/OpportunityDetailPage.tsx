import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { opportunitiesApi } from '@/lib/api/crm/opportunities';
import type { OpportunityDetail } from '@/types/crm';
import {
  Activity,
  ArrowLeft,
  Building,
  Calendar,
  ClipboardList,
  DollarSign,
  Edit3,
  ExternalLink,
  Layers,
  Link as LinkIcon,
  Mail,
  PenSquare,
  Target,
  Trash2,
  Trophy,
  User,
  FileText,
  Plus,
} from 'lucide-react';
import { OpportunityForm } from '@/components/crm/opportunities/OpportunityForm';
import { OpportunityCloseDialog } from '@/components/crm/opportunities/OpportunityCloseDialog';
import { SendEmailModal } from '@/components/shared/SendEmailModal';
import { ActivitySidebar } from '@/components/activities/ActivitySidebar';
import { SafeHtml } from '@/components/ui/SafeHtml';
import { FeedbackToast } from '@/components/ui/feedback-toast';

const VALUE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const TYPE_LABELS: Record<OpportunityDetail['type'], string> = {
  STAFF_AUGMENTATION: 'Staff Augmentation',
  SOFTWARE_SUBSCRIPTION: 'Software Subscription',
  BOTH: 'Hybrid',
};

export default function OpportunityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showEdit, setShowEdit] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showActivities, setShowActivities] = useState(
    (location.state as any)?.openActivitySidebar ?? (searchParams.get('openActivitySidebar') === 'true'),
  );
  const [feedback, setFeedback] = useState<string | null>(null);

  // Open activity sidebar if navigating from notification or email link
  useEffect(() => {
    if ((location.state as any)?.openActivitySidebar) {
      setShowActivities(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (searchParams.get('openActivitySidebar') === 'true') {
      setShowActivities(true);
      // Remove query params after opening
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('openActivitySidebar');
      newSearchParams.delete('activityId');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [location.state, searchParams, navigate, location.pathname, setSearchParams]);

  const opportunityQuery = useQuery({
    queryKey: ['opportunity', id],
    queryFn: () => opportunitiesApi.getById(id!),
    enabled: Boolean(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => opportunitiesApi.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      navigate('/crm/opportunities');
    },
  });

  const opportunity = opportunityQuery.data;

  const formattedValue = useMemo(() => {
    if (!opportunity || opportunity.value === null || opportunity.value === undefined) {
      return '—';
    }
    return VALUE_FORMATTER.format(opportunity.value);
  }, [opportunity]);

  const formattedCreated = useMemo(() =>
    opportunity ? format(new Date(opportunity.createdAt), 'MMM dd, yyyy') : null,
  [opportunity]);

  const formattedUpdated = useMemo(() =>
    opportunity ? format(new Date(opportunity.updatedAt), 'MMM dd, yyyy') : null,
  [opportunity]);

  const formattedClosed = useMemo(() =>
    opportunity?.closedAt ? format(new Date(opportunity.closedAt), 'MMM dd, yyyy') : null,
  [opportunity?.closedAt]);

  if (!id) {
    return (
      <div className="py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          Invalid opportunity ID provided.
        </div>
      </div>
    );
  }

  if (opportunityQuery.isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (opportunityQuery.isError || !opportunity) {
    return (
      <div className="py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          Unable to load opportunity. It may have been removed or you do not have access.
        </div>
        <button
          onClick={() => navigate('/crm/opportunities')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Opportunities
        </button>
      </div>
    );
  }

  const statusBadge = opportunity.isClosed
    ? opportunity.isWon
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-rose-100 text-rose-700'
    : 'bg-blue-100 text-blue-700';
  const statusLabel = opportunity.isClosed ? (opportunity.isWon ? 'Won' : 'Lost') : 'Open';

  const handleDelete = () => {
    if (window.confirm(`Delete opportunity "${opportunity.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const handleEditSuccess = (updated: OpportunityDetail) => {
    queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
    setShowEdit(false);
    setFeedback(`Opportunity "${updated.title}" saved.`);
  };

  const handleCloseSuccess = (updated: OpportunityDetail) => {
    queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    queryClient.invalidateQueries({ queryKey: ['opportunity', id] });
    setShowCloseDialog(false);
    setFeedback(`Opportunity set to ${updated.isWon ? 'Won' : 'Lost'}.`);
  };

  return (
    <div className="space-y-6 py-8">
      <button
        onClick={() => navigate('/crm/opportunities')}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Opportunities
      </button>

      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-xl font-semibold text-indigo-700">
              {opportunity.title[0] ?? 'O'}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-foreground">{opportunity.title}</h1>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{TYPE_LABELS[opportunity.type]}</span>
                <span>•</span>
                <span>Stage: {opportunity.stage}</span>
                {formattedValue !== '—' ? (
                  <>
                    <span>•</span>
                    <span>{formattedValue}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${statusBadge}`}>
              {statusLabel}
            </span>
            {opportunity.assignedTo ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 font-medium text-muted-foreground">
                <User className="h-3.5 w-3.5" /> Owner: {opportunity.assignedTo.firstName} {opportunity.assignedTo.lastName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 font-medium text-muted-foreground">
                <User className="h-3.5 w-3.5" /> Unassigned
              </span>
            )}
            {formattedClosed ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Closed {formattedClosed}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/crm/quotes?opportunityId=${opportunity.id}&leadId=${opportunity.lead.id}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <FileText className="h-4 w-4" /> View Quotes
          </button>
          <button
            onClick={() => navigate(`/crm/quotes/new?opportunityId=${opportunity.id}&leadId=${opportunity.lead.id}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-100"
          >
            <Plus className="h-4 w-4" /> Create Quote
          </button>
          <button
            onClick={() => setShowActivities(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <PenSquare className="h-4 w-4" /> Activities
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Mail className="h-4 w-4" /> Send Email
          </button>
          <button
            onClick={() => setShowCloseDialog(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100"
          >
            <Trophy className="h-4 w-4" /> {opportunity.isClosed ? 'Update Outcome' : 'Close Deal'}
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Edit3 className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            disabled={deleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      </header>

      {feedback ? (
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
          tone="success"
        />
      ) : null}

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Layers className="h-5 w-5 text-indigo-500" /> Deal Overview
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <ClipboardList className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Stage</p>
                  <p className="text-sm text-foreground">{opportunity.stage}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <DollarSign className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Deal Value</p>
                  <p className="text-sm text-foreground">{formattedValue}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Target className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Lead</p>
                  <Link
                    to={`/crm/leads/${opportunity.lead.id}`}
                    className="text-sm font-medium text-blue-600 hover:underline"
                  >
                    {opportunity.lead.title}
                  </Link>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Building className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Customer</p>
                  {opportunity.customer ? (
                    <Link
                      to={`/crm/customers/${opportunity.customer.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      {opportunity.customer.name}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not converted yet</span>
                  )}
                </div>
              </div>
              {opportunity.jobDescriptionUrl ? (
                <div className="flex items-start gap-3">
                  <LinkIcon className="mt-1 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Job Description</p>
                    <a
                      href={opportunity.jobDescriptionUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      Open Link <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
            {opportunity.description ? (
              <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                {opportunity.description}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Timeline</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2 text-sm text-muted-foreground">
              {formattedCreated ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase">Created</span>
                  <span className="text-foreground">{formattedCreated}</span>
                </div>
              ) : null}
              {formattedUpdated ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase">Updated</span>
                  <span className="text-foreground">{formattedUpdated}</span>
                </div>
              ) : null}
              {formattedClosed ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase">Closed</span>
                  <span className="text-foreground">{formattedClosed}</span>
                </div>
              ) : null}
            </div>
          </div>

          {opportunity.activities && opportunity.activities.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Recent Activities</h2>
                <button
                  onClick={() => setShowActivities(true)}
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  View all
                </button>
              </div>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                {opportunity.activities.slice(0, 5).map((activity) => (
                  <div key={activity.id} className="rounded-lg border border-border bg-muted/40 px-4 py-3">
                    <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                      <span>{activity.type}</span>
                      <span>{format(new Date(activity.createdAt), 'MMM dd, yyyy')}</span>
                    </div>
                    <p className="mt-2 font-semibold text-foreground">{activity.title}</p>
                    {activity.description ? (
                      <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <User className="h-5 w-5 text-blue-500" /> Team
            </h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              {opportunity.assignedTo ? (
                <div className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="font-semibold text-foreground">
                    {opportunity.assignedTo.firstName} {opportunity.assignedTo.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{opportunity.assignedTo.email}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm">
                  No owner assigned yet.
                </div>
              )}
            </div>
          </div>

          {opportunity.openPosition ? (
            <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Activity className="h-5 w-5 text-emerald-500" /> Open Position
              </h2>
              <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Title</p>
                  <p className="text-foreground">{opportunity.openPosition.title}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Status</p>
                  <p className="text-foreground">{opportunity.openPosition.status}</p>
                </div>
                {opportunity.openPosition.description ? (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Description</p>
                    <div className="prose prose-sm max-w-none">
                      <SafeHtml html={opportunity.openPosition.description} />
                    </div>
                  </div>
                ) : null}
                {opportunity.openPosition.requirements ? (
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Requirements</p>
                    <div className="prose prose-sm max-w-none">
                      <SafeHtml html={opportunity.openPosition.requirements} />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      </section>

      {showEdit ? (
        <OpportunityForm
          opportunityId={opportunity.id}
          onClose={() => setShowEdit(false)}
          onSuccess={handleEditSuccess}
        />
      ) : null}

      {showCloseDialog ? (
        <OpportunityCloseDialog
          opportunity={opportunity}
          onClose={() => setShowCloseDialog(false)}
          onSuccess={handleCloseSuccess}
        />
      ) : null}

      <ActivitySidebar
        open={showActivities}
        onClose={() => setShowActivities(false)}
        entityId={opportunity.id}
        entityType="opportunity"
        title="Opportunity Activities"
        emptyState="No activities yet. Log calls, emails, notes, and reminders to keep the deal moving."
      />

      {showEmailModal ? (
        <SendEmailModal
          title={`Send Email - ${opportunity.title}`}
          defaultTo={opportunity.lead?.contact?.email || opportunity.customer?.email || ''}
          defaultSubject={`Update on ${opportunity.title}`}
          onClose={() => setShowEmailModal(false)}
          onSend={async (payload) => {
            await opportunitiesApi.sendEmail(opportunity.id, payload);
            setFeedback(`Email sent successfully to ${payload.to}`);
            setShowEmailModal(false);
          }}
        />
      ) : null}
    </div>
  );
}








import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { leadsApi } from '@/lib/api/crm/leads';
// import type { Lead } from '@/types/crm';
import {
  Activity,
  ArrowLeft,
  Building,
  Calendar,
  DollarSign,
  Edit3,
  Fingerprint,
  PenSquare,
  Percent,
  Phone,
  Sparkles,
  Star,
  Trash2,
  User,
  Globe,
  Mail,
  FileText,
  Plus,
} from 'lucide-react';
import { LeadForm } from '@/components/crm/leads/LeadForm';
import { LeadStatusForm } from '@/components/crm/leads/LeadStatusForm';
import { LeadConvertModal } from '@/components/crm/leads/LeadConvertModal';
import { ActivitySidebar } from '@/components/activities/ActivitySidebar';
import { FeedbackToast } from '@/components/ui/feedback-toast';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  CONTACTED: 'bg-indigo-100 text-indigo-700',
  QUALIFIED: 'bg-emerald-100 text-emerald-700',
  PROPOSAL: 'bg-amber-100 text-amber-700',
  WON: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-700',
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const location = useLocation();
  const [showEdit, setShowEdit] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showConvert, setShowConvert] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
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
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.delete('openActivitySidebar');
      newSearchParams.delete('activityId');
      setSearchParams(newSearchParams, { replace: true });
    }
  }, [location.state, searchParams, navigate, location.pathname, setSearchParams]);

  const leadQuery = useQuery({
    queryKey: ['lead', id],
    queryFn: () => leadsApi.getById(id!),
    enabled: Boolean(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => leadsApi.remove(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      setFeedback(null);
      navigate('/crm/leads');
    },
  });

  const lead = leadQuery.data;

  // All hooks must be called before any conditional returns
  const formattedExpectedClose = useMemo(() => {
    if (!lead?.expectedCloseDate) return null;
    return format(new Date(lead.expectedCloseDate), 'MMM dd, yyyy');
  }, [lead?.expectedCloseDate]);

  const formattedActualClose = useMemo(() => {
    if (!lead?.actualCloseDate) return null;
    return format(new Date(lead.actualCloseDate), 'MMM dd, yyyy');
  }, [lead?.actualCloseDate]);

  // Get all contacts (from contacts array or fallback to legacy single contact)
  const allContacts = useMemo(() => {
    if (!lead) return [];
    if (lead.contacts && lead.contacts.length > 0) {
      // Extract contact objects from many-to-many structure
      return lead.contacts.map((lc: any) => lc.contact || lc).filter(Boolean);
    }
    return lead.contact ? [lead.contact] : [];
  }, [lead]);

  const handleDelete = () => {
    if (!leadQuery.data) return;
    if (window.confirm(`Delete lead "${leadQuery.data.title}"? This action cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  if (!id) {
    return (
      <div className="py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          Invalid lead ID provided.
        </div>
      </div>
    );
  }

  if (leadQuery.isLoading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (leadQuery.isError || !lead) {
    return (
      <div className="py-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
          Unable to load lead. It may have been removed or you do not have access.
        </div>
        <button
          onClick={() => navigate('/crm/leads')}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leads
        </button>
      </div>
    );
  }

  const statusChip = STATUS_COLORS[lead.status] ?? 'bg-muted/70 text-muted-foreground';
  const probabilityLabel = lead.probability !== null && lead.probability !== undefined ? `${lead.probability}%` : '—';
  const valueLabel = lead.value !== null && lead.value !== undefined ? lead.value.toLocaleString() : '—';

  // Get primary contact (first contact) for header display
  const primaryContact = allContacts[0];

  return (
    <div className="space-y-6 py-8">
      <button
        onClick={() => navigate('/crm/leads')}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Leads
      </button>

      <header className="flex flex-col gap-4 rounded-lg border border-border bg-card p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-xl font-semibold text-blue-700">
              {primaryContact?.firstName?.[0] ?? 'L'}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-foreground">{lead.title}</h1>
              {primaryContact ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{primaryContact.firstName} {primaryContact.lastName}</span>
                  <span>•</span>
                  <span>{primaryContact.email}</span>
                  {primaryContact.companyName ? (
                    <>
                      <span>•</span>
                      <span>{primaryContact.companyName}</span>
                    </>
                  ) : null}
                  {allContacts.length > 1 && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-blue-600">
                        +{allContacts.length - 1} more contact{allContacts.length - 1 !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No contacts</div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${statusChip}`}>
              {lead.status}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 font-medium text-muted-foreground">
              <Percent className="h-3.5 w-3.5" /> Probability: {probabilityLabel}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 font-medium text-muted-foreground">
              <DollarSign className="h-3.5 w-3.5" /> Value: {valueLabel}
            </span>
            {formattedExpectedClose ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted/70 px-2.5 py-1 font-medium text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" /> Expected Close: {formattedExpectedClose}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => navigate(`/crm/quotes?leadId=${lead.id}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <FileText className="h-4 w-4" /> View Quotes
          </button>
          <button
            onClick={() => navigate(`/crm/quotes/new?leadId=${lead.id}`)}
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
            onClick={() => setShowStatus(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" /> Update Status
          </button>
          <button
            onClick={() => setShowConvert(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-100"
            disabled={Boolean(lead.convertedCustomerId)}
          >
            <Star className="h-4 w-4" />
            {lead.convertedCustomerId ? 'Converted' : 'Convert to Customer'}
          </button>
          <button
            onClick={() => setShowEdit(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Edit3 className="h-4 w-4" /> Edit
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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
              <Activity className="h-5 w-5 text-blue-500" /> Lead Overview
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {primaryContact ? (
                <>
                  <div className="flex items-start gap-3">
                    <Mail className="mt-1 h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Primary Email</p>
                      <a className="text-sm text-blue-600 hover:underline" href={`mailto:${primaryContact.email}`}>
                        {primaryContact.email}
                      </a>
                    </div>
                  </div>
                  {primaryContact.phone ? (
                    <div className="flex items-start gap-3">
                      <Phone className="mt-1 h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Primary Phone</p>
                        <a className="text-sm text-blue-600 hover:underline" href={`tel:${primaryContact.phone}`}>
                          {primaryContact.phone}
                        </a>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="col-span-2 text-sm text-muted-foreground">No contacts available</div>
              )}
              {lead.prospectWebsite ? (
                <div className="flex items-start gap-3">
                  <Globe className="mt-1 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Website</p>
                    <a
                      className="text-sm text-blue-600 hover:underline"
                      href={lead.prospectWebsite}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {lead.prospectWebsite}
                    </a>
                  </div>
                </div>
              ) : null}
              {lead.source ? (
                <div className="flex items-start gap-3">
                  <Fingerprint className="mt-1 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Source</p>
                    <p className="text-sm text-foreground">{lead.source}</p>
                  </div>
                </div>
              ) : null}
              {lead.assignedTo ? (
                <div className="flex items-start gap-3">
                  <User className="mt-1 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Owner</p>
                    <p className="text-sm text-foreground">
                      {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{lead.assignedTo.email}</p>
                  </div>
                </div>
              ) : null}
              {lead.prospectIndustry ? (
                <div className="flex items-start gap-3">
                  <Building className="mt-1 h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-muted-foreground">Industry</p>
                    <p className="text-sm text-foreground">{lead.prospectIndustry}</p>
                  </div>
                </div>
              ) : null}
            </div>
            {lead.description ? (
              <div className="mt-6 rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                {lead.description}
              </div>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Key Dates</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Created</span>
                <span className="text-sm text-foreground">{format(new Date(lead.createdAt), 'MMM dd, yyyy')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase text-muted-foreground">Last Updated</span>
                <span className="text-sm text-foreground">{format(new Date(lead.updatedAt), 'MMM dd, yyyy')}</span>
              </div>
              {formattedExpectedClose ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Expected Close</span>
                  <span className="text-sm text-foreground">{formattedExpectedClose}</span>
                </div>
              ) : null}
              {formattedActualClose ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase text-muted-foreground">Actual Close</span>
                  <span className="text-sm text-foreground">{formattedActualClose}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">
              Contact{allContacts.length > 1 ? `s (${allContacts.length})` : ''}
            </h2>
            <div className="mt-4 space-y-4 text-sm text-muted-foreground">
              {allContacts.length === 0 ? (
                <div className="text-muted-foreground">No contacts</div>
              ) : (
                allContacts.map((contact, index) => (
                  <div
                    key={contact.id}
                    className={`rounded-lg border border-border p-3 ${index === 0 ? 'bg-blue-50 dark:bg-blue-950/20' : 'bg-muted/30'}`}
                  >
                    {index === 0 && (
                      <div className="mb-2 text-xs font-semibold uppercase text-blue-700 dark:text-blue-300">
                        Primary Contact
                      </div>
                    )}
                    <div className="flex items-center gap-3 mb-2">
                      <User className="h-4 w-4" />
                      <span className="font-medium text-foreground">
                        {contact.firstName} {contact.lastName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <Mail className="h-4 w-4" />
                      <a className="text-blue-600 hover:underline" href={`mailto:${contact.email}`}>
                        {contact.email}
                      </a>
                    </div>
                    {contact.phone && (
                      <div className="flex items-center gap-3 mb-2">
                        <Phone className="h-4 w-4" />
                        <a className="text-blue-600 hover:underline" href={`tel:${contact.phone}`}>
                          {contact.phone}
                        </a>
                      </div>
                    )}
                    {contact.companyName && (
                      <div className="flex items-center gap-3">
                        <Building className="h-4 w-4" />
                        <span>{contact.companyName}</span>
                      </div>
                    )}
                    {contact.role && (
                      <div className="mt-2 text-xs text-muted-foreground">Role: {contact.role}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground">Forecast</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="h-4 w-4" /> Potential Value
                </span>
                <span className="font-semibold text-foreground">{valueLabel}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Percent className="h-4 w-4" /> Win Probability
                </span>
                <span className="font-semibold text-foreground">{probabilityLabel}</span>
              </div>
              {lead.lostReason ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/50 p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">Lost Reason:</span> {lead.lostReason}
                </div>
              ) : null}
              {lead.convertedCustomer ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                  Converted to customer{' '}
                  <Link
                    to={`/crm/customers/${lead.convertedCustomer.id}`}
                    className="font-semibold text-emerald-800 hover:underline"
                  >
                    {lead.convertedCustomer.name}
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </section>

      {showEdit ? (
        <LeadForm
          lead={lead}
          onClose={() => setShowEdit(false)}
          onSuccess={(updated) => {
            queryClient.invalidateQueries({ queryKey: ['lead', id] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setShowEdit(false);
            setFeedback(`Lead "${updated.title}" updated.`);
          }}
        />
      ) : null}

      {showStatus ? (
        <LeadStatusForm
          lead={lead}
          onClose={() => setShowStatus(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['lead', id] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setShowStatus(false);
            setFeedback('Lead status updated.');
          }}
        />
      ) : null}

      {showConvert ? (
        <LeadConvertModal
          lead={lead}
          onClose={() => setShowConvert(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['lead', id] });
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            setShowConvert(false);
            setFeedback('Lead converted to customer.');
          }}
        />
      ) : null}

      <ActivitySidebar
        open={showActivities}
        onClose={() => setShowActivities(false)}
        entityId={lead.id}
        entityType="lead"
        title="Lead Activities"
        emptyState="No activities yet. Capture emails, calls, notes, and reminders to keep momentum."
      />
    </div>
  );
}







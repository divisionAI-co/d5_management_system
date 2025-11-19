import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '@/lib/api/crm';
import { format } from 'date-fns';
import { ArrowLeft, Edit, Mail, Trash2, Download, Eye, X, PenSquare } from 'lucide-react';
import { QuoteForm } from '@/components/crm/quotes/QuoteForm';
import { SendQuoteModal } from '@/components/crm/quotes/SendQuoteModal';
import { ActivitySidebar } from '@/components/activities/ActivitySidebar';
import { SafeHtml } from '@/components/ui/SafeHtml';
import clsx from 'clsx';

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-200',
  SENT: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200',
  ACCEPTED: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
  EXPIRED: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-200',
};

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showActivities, setShowActivities] = useState(false);

  const quoteQuery = useQuery({
    queryKey: ['quotes', id],
    queryFn: () => quotesApi.getById(id!),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => quotesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      navigate('/crm/quotes');
    },
  });

  const handleDelete = () => {
    if (!id) return;
    if (window.confirm('Are you sure you want to delete this quote?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleDownloadPdf = async () => {
    if (!id) return;
    try {
      const blob = await quotesApi.generatePdf(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${quoteQuery.data?.quoteNumber || id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF. Please try again.');
    }
  };

  const handlePreview = async () => {
    if (!id) return;
    setShowPreview(true);
    try {
      const preview = await quotesApi.preview(id);
      setPreviewHtml(preview.html);
    } catch (error) {
      console.error('Failed to load preview:', error);
      alert('Failed to load preview. Please try again.');
    }
  };

  if (quoteQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
      </div>
    );
  }

  if (quoteQuery.isError || !quoteQuery.data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
        <p>Failed to load quote. Please try again.</p>
      </div>
    );
  }

  const quote = quoteQuery.data;
  const lead = quote.lead;
  const primaryContact = lead.contacts && lead.contacts.length > 0 ? lead.contacts[0] : null;

  return (
    <div className="space-y-6 py-8 text-foreground">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/crm/quotes')}
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{quote.title}</h1>
            <p className="text-sm text-muted-foreground">Quote #{quote.quoteNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowActivities(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <PenSquare className="h-4 w-4" /> Activities
          </button>
          <button
            onClick={handlePreview}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Eye className="h-4 w-4" />
            Preview
          </button>
          <button
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
          {quote.status === 'DRAFT' && (
            <button
              onClick={() => setShowSendModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Mail className="h-4 w-4" />
              Send Quote
            </button>
          )}
          <button
            onClick={() => setShowEditForm(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Quote Details</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Status</label>
                <div className="mt-1">
                  <span
                    className={clsx(
                      'inline-flex rounded-full px-3 py-1 text-sm font-semibold',
                      statusColors[quote.status] || statusColors.DRAFT,
                    )}
                  >
                    {quote.status}
                  </span>
                </div>
              </div>
              {quote.description && (
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Description</label>
                  <div className="mt-1 text-sm text-foreground">
                    <SafeHtml html={quote.description} className="prose prose-sm max-w-none" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {quote.overview && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Overview</h2>
              <div className="prose prose-sm max-w-none text-foreground">
                <SafeHtml html={quote.overview} />
              </div>
            </div>
          )}

          {quote.functionalProposal && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Functional Proposal</h2>
              <div className="prose prose-sm max-w-none text-foreground">
                <SafeHtml html={quote.functionalProposal} />
              </div>
            </div>
          )}

          {quote.technicalProposal && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Technical Proposal</h2>
              <div className="prose prose-sm max-w-none text-foreground">
                <SafeHtml html={quote.technicalProposal} />
              </div>
            </div>
          )}

          {quote.teamComposition && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Team Composition</h2>
              <div className="prose prose-sm max-w-none text-foreground">
                <SafeHtml html={quote.teamComposition} />
              </div>
            </div>
          )}

          {quote.milestones && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Milestones</h2>
              <div className="prose prose-sm max-w-none text-foreground">
                <SafeHtml html={quote.milestones} />
              </div>
            </div>
          )}

          {quote.paymentTerms && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Payment Terms</h2>
              <div className="prose prose-sm max-w-none text-foreground">
                <SafeHtml html={quote.paymentTerms} />
              </div>
            </div>
          )}

          {quote.warrantyPeriod && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Warranty Period</h2>
              <p className="text-sm text-foreground">{quote.warrantyPeriod}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Summary</h2>
            <div className="space-y-3">
              {quote.totalValue && (
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Total Value</label>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {quote.currency || 'USD'}{' '}
                    {quote.totalValue.toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Created</label>
                <p className="mt-1 text-sm text-foreground">
                  {format(new Date(quote.createdAt), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
              {quote.sentAt && (
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Sent At</label>
                  <p className="mt-1 text-sm text-foreground">
                    {format(new Date(quote.sentAt), 'MMM d, yyyy HH:mm')}
                  </p>
                </div>
              )}
              {quote.sentTo && (
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Sent To</label>
                  <p className="mt-1 text-sm text-foreground">{quote.sentTo}</p>
                </div>
              )}
            </div>
          </div>

          {quote.opportunity && (
            <div className="rounded-lg border border-border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Linked Opportunity</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Opportunity Title</label>
                  <p className="mt-1 text-sm text-foreground">{quote.opportunity.title}</p>
                </div>
                {quote.opportunity.description && (
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Description</label>
                    <p className="mt-1 text-sm text-foreground">{quote.opportunity.description}</p>
                  </div>
                )}
                {quote.opportunity.value && (
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Value</label>
                    <p className="mt-1 text-sm text-foreground">
                      {quote.opportunity.value.toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-semibold uppercase text-muted-foreground">Stage</label>
                  <p className="mt-1 text-sm text-foreground">{quote.opportunity.stage}</p>
                </div>
                {quote.opportunity.customer && (
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Customer</label>
                    <p className="mt-1 text-sm text-foreground">{quote.opportunity.customer.name}</p>
                    <p className="text-xs text-muted-foreground">{quote.opportunity.customer.email}</p>
                  </div>
                )}
                <button
                  onClick={() => navigate(`/crm/opportunities/${quote.opportunity!.id}`)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  View Opportunity →
                </button>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Lead Information</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">Lead Title</label>
                <p className="mt-1 text-sm text-foreground">{lead.title}</p>
              </div>
              {primaryContact && (
                <>
                  <div>
                    <label className="text-xs font-semibold uppercase text-muted-foreground">Contact</label>
                    <p className="mt-1 text-sm text-foreground">
                      {primaryContact.firstName} {primaryContact.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">{primaryContact.email}</p>
                  </div>
                </>
              )}
              <button
                onClick={() => navigate(`/crm/leads/${lead.id}`)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                View Lead →
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEditForm && (
        <QuoteForm
          quote={quote}
          onClose={() => setShowEditForm(false)}
          onSuccess={() => {
            setShowEditForm(false);
            quoteQuery.refetch();
          }}
        />
      )}

      {showSendModal && (
        <SendQuoteModal
          quote={quote}
          onClose={() => setShowSendModal(false)}
          onSuccess={() => {
            setShowSendModal(false);
            quoteQuery.refetch();
          }}
        />
      )}

      {showPreview && previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <h2 className="text-xl font-semibold text-foreground">Quote Preview</h2>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewHtml('');
                }}
                className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
          </div>
        </div>
      )}

      <ActivitySidebar
        open={showActivities}
        onClose={() => setShowActivities(false)}
        entityId={id!}
        entityType="quote"
        title="Quote Activities"
        emptyState="No activities yet. Capture emails, calls, notes, and reminders to track quote progress."
      />
    </div>
  );
}


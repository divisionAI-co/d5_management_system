import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '@/lib/api/crm';
import { format } from 'date-fns';
import { ArrowLeft, Edit, Mail, Trash2, Download, Eye, X, PenSquare } from 'lucide-react';
import { QuoteForm } from '@/components/crm/quotes/QuoteForm';
import { SendEmailModal } from '@/components/shared/SendEmailModal';
import { ActivitySidebar } from '@/components/activities/ActivitySidebar';
import { SafeHtml } from '@/components/ui/SafeHtml';
import clsx from 'clsx';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

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
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showActivities, setShowActivities] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Redirect to quotes page with query params if id is "new"
  // Do this immediately before any queries run
  useEffect(() => {
    if (id === 'new') {
      const newSearchParams = new URLSearchParams(searchParams);
      newSearchParams.set('new', 'true');
      navigate(`/crm/quotes?${newSearchParams.toString()}`, { replace: true });
      return;
    }
  }, [id, navigate, searchParams]);

  // Return null early if id is "new" to prevent any queries or rendering
  if (id === 'new') {
    return null;
  }

  const quoteQuery = useQuery({
    queryKey: ['quotes', id],
    queryFn: () => quotesApi.getById(id!),
    enabled: !!id && id !== 'new',
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
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!id) return;
    deleteMutation.mutate(id);
    setShowDeleteConfirm(false);
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
      // Convert relative API URLs to absolute URLs for iframe compatibility
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      // API_URL already includes /api/v1, so remove it from the path
      const processedHtml = preview.html.replace(
        /src=["'](\/api\/v1\/[^"']+)["']/gi,
        (_match, path) => `src="${apiUrl}${path.replace(/^\/api\/v1/, '')}"`
      );
      setPreviewHtml(processedHtml);
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

      {showSendModal && quote && (
        <SendEmailModal
          title={`Send Quote - ${quote.title || quote.quoteNumber}`}
          defaultTo={quote.lead?.contacts?.[0]?.email || ''}
          defaultSubject={`Quote: ${quote.title || quote.quoteNumber} - ${quote.quoteNumber}`}
          onClose={() => setShowSendModal(false)}
          onSend={async (payload) => {
            await quotesApi.send(quote.id, payload);
            setShowSendModal(false);
            quoteQuery.refetch();
          }}
          previewEmail={async (payload) => {
            return await quotesApi.previewEmail(quote.id, payload);
          }}
        />
      )}

      {showPreview && previewHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex w-full max-w-5xl max-h-[95vh] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-card px-6 py-4">
              <h2 className="text-xl font-semibold text-foreground">Quote Preview (A4 Format)</h2>
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
            <div className="flex-1 min-h-0 overflow-auto rounded-b-lg border-t border-border bg-gray-100 p-4 md:p-6">
              {/* A4 Container - 210mm × 297mm (794px × 1123px at 96 DPI) matching Puppeteer PDF output */}
              <div 
                className="mx-auto bg-white shadow-lg"
                style={{ 
                  width: '794px', 
                  minHeight: '1123px',
                  maxWidth: 'calc(100% - 32px)'
                }}
              >
                <iframe
                  title="Quote preview"
                  className="border-0 bg-white"
                  style={{ 
                    width: '794px', 
                    minHeight: '1123px',
                    display: 'block'
                  }}
                  srcDoc={`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=794"><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https: http://localhost:* drive.google.com; connect-src 'self' http://localhost:* https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';"><style>html, body { margin: 0; padding: 0; width: 794px; box-sizing: border-box; font-family: Arial, sans-serif; } body { padding: 20px; width: 794px; min-height: calc(1123px - 40px); } * { box-sizing: border-box; }</style></head><body>${previewHtml}</body></html>`}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                />
              </div>
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
      <ConfirmationDialog
        open={showDeleteConfirm}
        title="Delete Quote"
        message="Are you sure you want to delete this quote?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}


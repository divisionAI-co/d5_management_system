import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recruiterPerformanceReportsApi } from '@/lib/api/hr/recruiter-performance-reports';
import { templatesApi } from '@/lib/api/templates';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { ArrowLeft, Edit, Download, FileText, Send, Eye, X } from 'lucide-react';
import { format } from 'date-fns';
import type { TemplateModel } from '@/types/templates';

export default function RecruiterPerformanceReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPreview, setShowPreview] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewType, setPreviewType] = useState<'internal' | 'customer'>('customer');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [sendMessage, setSendMessage] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  // Fetch report
  const { data: report, isLoading } = useQuery({
    queryKey: ['recruiter-performance-report', id],
    queryFn: () => recruiterPerformanceReportsApi.getById(id!),
    enabled: !!id,
  });

  // Fetch customer templates
  const { data: templates = [] } = useQuery({
    queryKey: ['templates', 'RECRUITER_PERFORMANCE_REPORT_CUSTOMER'],
    queryFn: () => templatesApi.list({ type: 'RECRUITER_PERFORMANCE_REPORT_CUSTOMER' }),
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: (type: 'internal' | 'customer') => recruiterPerformanceReportsApi.preview(id!, type, undefined),
    onSuccess: (data) => {
      // Convert relative API URLs to absolute URLs for iframe compatibility
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const processedHtml = data.html.replace(
        /src=["'](\/api\/v1\/[^"']+)["']/gi,
        (_match, path) => `src="${apiUrl}${path.replace(/^\/api\/v1/, '')}"`,
      );
      setPreviewHtml(processedHtml);
      setShowPreview(true);
    },
    onError: (error: any) => {
      setFeedback({
        message: error.response?.data?.message || 'Failed to load preview',
        tone: 'error',
      });
    },
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: (payload: { recipientEmail: string; message?: string; templateId?: string }) =>
      recruiterPerformanceReportsApi.sendToCustomer(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-performance-report', id] });
      setShowSendModal(false);
      setRecipientEmail('');
      setSendMessage('');
      setSelectedTemplateId('');
      setFeedback({
        message: 'Report sent to customer successfully',
        tone: 'success',
      });
    },
    onError: (error: any) => {
      setFeedback({
        message: error.response?.data?.message || 'Failed to send report',
        tone: 'error',
      });
    },
  });

  // Download PDF mutations
  const downloadInternalMutation = useMutation({
    mutationFn: () => recruiterPerformanceReportsApi.downloadInternalPdf(id!),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `recruiter-performance-report-internal-${id}-${report ? format(new Date(report.weekEnding), 'yyyy-MM-dd') : ''}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setFeedback({
        message: 'PDF downloaded successfully',
        tone: 'success',
      });
    },
    onError: (error: any) => {
      setFeedback({
        message: error.response?.data?.message || 'Failed to download PDF',
        tone: 'error',
      });
    },
  });

  const downloadCustomerMutation = useMutation({
    mutationFn: () => recruiterPerformanceReportsApi.downloadCustomerPdf(id!),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `recruiter-performance-report-customer-${id}-${report ? format(new Date(report.weekEnding), 'yyyy-MM-dd') : ''}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setFeedback({
        message: 'PDF downloaded successfully',
        tone: 'success',
      });
    },
    onError: (error: any) => {
      setFeedback({
        message: error.response?.data?.message || 'Failed to download PDF',
        tone: 'error',
      });
    },
  });

  const handlePreview = (type: 'internal' | 'customer') => {
    setPreviewType(type);
    previewMutation.mutate(type);
  };

  const handleSend = () => {
    if (!recipientEmail) {
      setFeedback({
        message: 'Please enter recipient email',
        tone: 'error',
      });
      return;
    }
    sendMutation.mutate({
      recipientEmail,
      message: sendMessage || undefined,
      templateId: selectedTemplateId || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="py-8">
        <div className="text-center text-red-600">Report not found</div>
      </div>
    );
  }

  return (
    <div className="py-8 space-y-6">
      {feedback && (
        <FeedbackToast
          message={feedback.message}
          tone={feedback.tone}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/reports/recruiter-performance')}
            className="p-2 rounded-lg border border-border hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Recruiter Performance Report</h1>
            <p className="text-muted-foreground mt-1">
              {report.recruiter
                ? `${report.recruiter.firstName} ${report.recruiter.lastName}`
                : 'N/A'}{' '}
              - Week Ending {format(new Date(report.weekEnding), 'dd/MM/yyyy')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              navigate('/reports/recruiter-performance', {
                state: { editReportId: id },
              });
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Edit className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => handlePreview('internal')}
            disabled={previewMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Eye className="h-4 w-4" />
            Preview Internal
          </button>
          <button
            onClick={() => handlePreview('customer')}
            disabled={previewMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Eye className="h-4 w-4" />
            Preview Customer
          </button>
          <button
            onClick={() => setShowSendModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Send className="h-4 w-4" />
            Send
          </button>
          <button
            onClick={() => downloadInternalMutation.mutate()}
            disabled={downloadInternalMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <FileText className="h-4 w-4" />
            Download Internal PDF
          </button>
          <button
            onClick={() => downloadCustomerMutation.mutate()}
            disabled={downloadCustomerMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <Download className="h-4 w-4" />
            Download Customer PDF
          </button>
        </div>
      </div>

      {/* Report Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Basic Information */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">Basic Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Position</label>
              <p className="text-foreground">{report.positionTitle}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Recruiter</label>
              <p className="text-foreground">
                {report.recruiter
                  ? `${report.recruiter.firstName} ${report.recruiter.lastName}`
                  : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Week Ending</label>
              <p className="text-foreground">
                {format(new Date(report.weekEnding), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">Performance Metrics</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Candidates Contacted</span>
              <span className="text-sm font-medium text-foreground">
                {report.candidatesContactedActual} / {report.candidatesContactedTarget}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Cultural Calls</span>
              <span className="text-sm font-medium text-foreground">
                {report.culturalCallsActual} / {report.culturalCallsTarget}
                {report.culturalCallsEfficiencyRatio && (
                  <span className="ml-2 text-muted-foreground">
                    ({Number(report.culturalCallsEfficiencyRatio).toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Technical Calls</span>
              <span className="text-sm font-medium text-foreground">
                {report.technicalCallsActual} / {report.technicalCallsTarget}
                {report.technicalCallsEfficiencyRatio && (
                  <span className="ml-2 text-muted-foreground">
                    ({Number(report.technicalCallsEfficiencyRatio).toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Client Interviews</span>
              <span className="text-sm font-medium text-foreground">
                {report.clientInterviewsScheduledActual} / {report.clientInterviewsScheduledTarget}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Placements</span>
              <span className="text-sm font-medium text-foreground">
                {report.placementsThisWeek}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Wins, Challenges, Priorities */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {report.wins && report.wins.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">Key Wins</h2>
            <ul className="space-y-2">
              {report.wins.map((win: any, index: number) => (
                <li key={index} className="text-sm text-foreground">
                  {index + 1}. {win.description}
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.challenges && report.challenges.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">Challenges</h2>
            <ul className="space-y-3">
              {report.challenges.map((challenge: any, index: number) => (
                <li key={index} className="text-sm">
                  <p className="font-medium text-foreground">{challenge.challenge}</p>
                  <p className="text-muted-foreground mt-1">{challenge.proposedSolution}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.priorities && report.priorities.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-foreground mb-4">Priorities</h2>
            <ul className="space-y-2">
              {report.priorities.map((priority: any, index: number) => (
                <li key={index} className="text-sm text-foreground">
                  {index + 1}. {priority.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Pipeline Status */}
      {report.pipelineStatus && (
        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">Pipeline Status</h2>
          <div className="space-y-2">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Role</label>
              <p className="text-foreground">{report.pipelineStatus.role}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Pipeline</label>
              <p className="text-foreground">{report.pipelineStatus.pipeline}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Confidence Level</label>
              <p className="text-foreground">{report.pipelineStatus.confidenceLevel}</p>
            </div>
            {report.pipelineStatus.notes && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <p className="text-foreground">{report.pipelineStatus.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-5xl max-h-[90vh] overflow-hidden m-4 flex flex-col">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                Report Preview ({previewType === 'internal' ? 'Internal' : 'Customer'})
              </h2>
              <button
                onClick={() => {
                  setShowPreview(false);
                  setPreviewHtml('');
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {previewMutation.isPending ? (
                <div className="flex items-center justify-center min-h-[600px]">
                  <div className="text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                    <p className="mt-4 text-sm text-muted-foreground">Generating preview...</p>
                  </div>
                </div>
              ) : (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full min-h-[600px] border border-border rounded"
                  title="Report Preview"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-md m-4">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Send Report to Customer</h2>
              <button
                onClick={() => {
                  setShowSendModal(false);
                  setRecipientEmail('');
                  setSendMessage('');
                  setSelectedTemplateId('');
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Recipient Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="customer@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Template (Optional)
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Default Template</option>
                  {templates.map((template: TemplateModel) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Message (Optional)
                </label>
                <textarea
                  value={sendMessage}
                  onChange={(e) => setSendMessage(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Additional message to include in the email..."
                  rows={4}
                />
              </div>
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <button
                  onClick={() => {
                    setShowSendModal(false);
                    setRecipientEmail('');
                    setSendMessage('');
                    setSelectedTemplateId('');
                  }}
                  className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSend}
                  disabled={sendMutation.isPending}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {sendMutation.isPending ? 'Sending...' : 'Send Report'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesPerformanceReportsApi } from '@/lib/api/crm/sales-performance-reports';
import { useAuthStore } from '@/lib/stores/auth-store';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { Plus, Edit, Trash2, Download, FileText, X, Eye, Send } from 'lucide-react';
import type {
  SalesPerformanceReport,
  CreateSalesPerformanceReportDto,
  UpdateSalesPerformanceReportDto,
} from '@/types/sales-performance-reports';
import { format } from 'date-fns';
import { SalesPerformanceReportForm } from '@/components/crm/sales-performance-reports/SalesPerformanceReportForm';
import { SalesPerformanceReportPreviewDialog } from '@/components/crm/sales-performance-reports/SalesPerformanceReportPreviewDialog';
import { SalesPerformanceReportSendDialog } from '@/components/crm/sales-performance-reports/SalesPerformanceReportSendDialog';

export default function SalesPerformanceReportsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SalesPerformanceReport | null>(null);
  const [previewReport, setPreviewReport] = useState<SalesPerformanceReport | null>(null);
  const [sendReport, setSendReport] = useState<SalesPerformanceReport | null>(null);
  const [filterWeekEndingFrom, setFilterWeekEndingFrom] = useState<string>('');
  const [filterWeekEndingTo, setFilterWeekEndingTo] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const isSalesperson = user?.role === 'SALESPERSON';
  const isAdmin = user?.role === 'ADMIN';

  // Fetch reports
  const { data: reportsResponse, isLoading } = useQuery({
    queryKey: [
      'sales-performance-reports',
      filterWeekEndingFrom,
      filterWeekEndingTo,
      isSalesperson ? user?.id : undefined,
    ],
    queryFn: () =>
      salesPerformanceReportsApi.getAll({
        salespersonId: isSalesperson ? user?.id : undefined,
        weekEndingFrom: filterWeekEndingFrom || undefined,
        weekEndingTo: filterWeekEndingTo || undefined,
        page: 1,
        pageSize: 50,
      }),
  });

  const reports = reportsResponse?.data || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => salesPerformanceReportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-performance-reports'] });
      setFeedback({
        message: 'Report deleted successfully',
        tone: 'success',
      });
    },
    onError: (error: any) => {
      setFeedback({
        message: error.response?.data?.message || 'Failed to delete report',
        tone: 'error',
      });
    },
  });

  const handleCreate = () => {
    setSelectedReport(null);
    setShowForm(true);
  };

  const handleEdit = (report: SalesPerformanceReport) => {
    setSelectedReport(report);
    setShowForm(true);
  };

  const handleDelete = (report: SalesPerformanceReport) => {
    if (confirm('Are you sure you want to delete this report?')) {
      deleteMutation.mutate(report.id);
    }
  };

  const handleDownload = async (report: SalesPerformanceReport) => {
    try {
      const blob = await salesPerformanceReportsApi.downloadPdf(report.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `sales-performance-report-${report.id}-${format(new Date(report.weekEnding), 'yyyy-MM-dd')}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setFeedback({
        message: 'PDF downloaded successfully',
        tone: 'success',
      });
    } catch (error: any) {
      setFeedback({
        message: error.response?.data?.message || 'Failed to download PDF',
        tone: 'error',
      });
    }
  };

  const handlePreview = (report: SalesPerformanceReport) => {
    setPreviewReport(report);
  };

  const handleSend = (report: SalesPerformanceReport) => {
    setSendReport(report);
  };

  return (
    <div className="py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Performance Reports</h1>
          <p className="text-muted-foreground mt-1">
            Weekly performance reports for sales activities
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Report
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Week Ending From</label>
            <input
              type="date"
              value={filterWeekEndingFrom}
              onChange={(e) => setFilterWeekEndingFrom(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Week Ending To</label>
            <input
              type="date"
              value={filterWeekEndingTo}
              onChange={(e) => setFilterWeekEndingTo(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No reports found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Salesperson</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Week Ending</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">LinkedIn Requests</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">LinkedIn Accepted</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">InMails Sent</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">InMail Replies</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm text-foreground">
                    {report.salesperson
                      ? `${report.salesperson.firstName} ${report.salesperson.lastName}`
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {format(new Date(report.weekEnding), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {report.linkedinConnectionRequests}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {report.linkedinAccepted}
                    {report.linkedinAcceptedPercentage !== null && (
                      <span className="text-muted-foreground ml-1">
                        ({Number(report.linkedinAcceptedPercentage).toFixed(1)}%)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{report.inmailSent}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {report.inmailReplies}
                    {report.inmailRepliesPercentage !== null && (
                      <span className="text-muted-foreground ml-1">
                        ({Number(report.inmailRepliesPercentage).toFixed(1)}%)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePreview(report)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </button>
                      <button
                        onClick={() => handleSend(report)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                        title="Send"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Send
                      </button>
                      <button
                        onClick={() => handleEdit(report)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(report)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {(isAdmin || (isSalesperson && report.salespersonId === user?.id)) && (
                        <button
                          onClick={() => handleDelete(report)}
                          className="p-1.5 rounded hover:bg-muted text-red-600 hover:text-red-700"
                          title="Delete"
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
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedReport ? 'Edit Report' : 'Create Report'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedReport(null);
                }}
                className="p-1 rounded hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <SalesPerformanceReportForm
                report={selectedReport || undefined}
                onClose={() => {
                  setShowForm(false);
                  setSelectedReport(null);
                }}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['sales-performance-reports'] });
                  setShowForm(false);
                  setSelectedReport(null);
                }}
                onFeedback={(message, tone) => {
                  setFeedback({ message, tone });
                }}
              />
            </div>
          </div>
        </div>
      )}

      {feedback && (
        <FeedbackToast
          message={feedback.message}
          tone={feedback.tone}
          onClose={() => setFeedback(null)}
        />
      )}

      {previewReport && (
        <SalesPerformanceReportPreviewDialog
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
      )}

      {sendReport && (
        <SalesPerformanceReportSendDialog
          report={sendReport}
          onClose={() => setSendReport(null)}
          onSent={(updated) => {
            setSendReport(null);
            setFeedback({
              message: 'Report sent successfully',
              tone: 'success',
            });
            queryClient.invalidateQueries({ queryKey: ['sales-performance-reports'] });
          }}
        />
      )}
    </div>
  );
}


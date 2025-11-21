import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { recruiterPerformanceReportsApi } from '@/lib/api/hr/recruiter-performance-reports';
import { positionsApi } from '@/lib/api/recruitment/positions';
import { useAuthStore } from '@/lib/stores/auth-store';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { Plus, Edit, Trash2, Download, FileText, X, Eye } from 'lucide-react';
import type {
  RecruiterPerformanceReport,
} from '@/types/recruiter-performance-reports';
import { format } from 'date-fns';
import { RecruiterPerformanceReportForm } from '@/components/hr/recruiter-performance-reports/RecruiterPerformanceReportForm';

export default function RecruiterPerformanceReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const state = location.state as { positionId?: string; positionTitle?: string } | null;
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState<RecruiterPerformanceReport | null>(null);
  const [initialPositionId, setInitialPositionId] = useState<string | undefined>(state?.positionId);
  const [initialPositionTitle, setInitialPositionTitle] = useState<string | undefined>(state?.positionTitle);
  const [filterPositionId, setFilterPositionId] = useState<string>('');
  const [filterWeekEndingFrom, setFilterWeekEndingFrom] = useState<string>('');
  const [filterWeekEndingTo, setFilterWeekEndingTo] = useState<string>('');
  const [feedback, setFeedback] = useState<{ message: string; tone: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [hasProcessedInitialState, setHasProcessedInitialState] = useState(false);

  // Auto-open form if positionId is provided in state (only once)
  useEffect(() => {
    if (state?.positionId && !showForm && !hasProcessedInitialState) {
      setShowForm(true);
      setInitialPositionId(state.positionId);
      setInitialPositionTitle(state.positionTitle);
      setHasProcessedInitialState(true);
      // Clear the state from location to prevent reopening
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [state?.positionId, state?.positionTitle, showForm, hasProcessedInitialState, navigate, location.pathname]);

  // Auto-open form in edit mode if editReportId is provided in state
  useEffect(() => {
    const editReportId = (state as any)?.editReportId;
    if (editReportId && !showForm && !selectedReport) {
      // Fetch the report and open form in edit mode
      recruiterPerformanceReportsApi
        .getById(editReportId)
        .then((report) => {
          setSelectedReport(report);
          setShowForm(true);
        })
        .catch(() => {
          setFeedback({
            message: 'Failed to load report for editing',
            tone: 'error',
          });
        })
        .finally(() => {
          // Clear the editReportId from state to prevent reopening
          navigate(location.pathname, { replace: true, state: {} });
        });
    }
  }, [(state as any)?.editReportId, showForm, selectedReport, navigate, location.pathname]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showForm) {
        setShowForm(false);
        setSelectedReport(null);
        setInitialPositionId(undefined);
        setInitialPositionTitle(undefined);
        setHasProcessedInitialState(false);
        // Clear location state
        navigate(location.pathname, { replace: true, state: {} });
      }
    };

    if (showForm) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [showForm, navigate, location.pathname]);

  const isRecruiter = user?.role === 'RECRUITER';
  const isAdminOrHR = user?.role === 'ADMIN' || user?.role === 'HR';

  // Fetch reports
  const { data: reportsResponse, isLoading } = useQuery({
    queryKey: [
      'recruiter-performance-reports',
      filterPositionId,
      filterWeekEndingFrom,
      filterWeekEndingTo,
      isRecruiter ? user?.id : undefined,
    ],
    queryFn: () =>
      recruiterPerformanceReportsApi.getAll({
        positionId: filterPositionId || undefined,
        recruiterId: isRecruiter ? user?.id : undefined,
        weekEndingFrom: filterWeekEndingFrom || undefined,
        weekEndingTo: filterWeekEndingTo || undefined,
        page: 1,
        pageSize: 50,
      }),
  });

  const reports = reportsResponse?.data || [];

  // Fetch positions for filter
  const { data: positionsData } = useQuery({
    queryKey: ['positions'],
    queryFn: () => positionsApi.list({ page: 1, pageSize: 100 }),
  });

  const positions = positionsData?.data || [];

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => recruiterPerformanceReportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recruiter-performance-reports'] });
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
    setInitialPositionId(undefined);
    setInitialPositionTitle(undefined);
    setShowForm(true);
    // Clear any location state
    navigate(location.pathname, { replace: true, state: {} });
  };

  const handleEdit = (report: RecruiterPerformanceReport) => {
    setSelectedReport(report);
    setShowForm(true);
  };

  const handleView = (report: RecruiterPerformanceReport) => {
    navigate(`/reports/recruiter-performance/${report.id}`);
  };

  const handleDelete = (report: RecruiterPerformanceReport) => {
    if (confirm('Are you sure you want to delete this report?')) {
      deleteMutation.mutate(report.id);
    }
  };

  const handleDownloadInternal = async (report: RecruiterPerformanceReport) => {
    try {
      const blob = await recruiterPerformanceReportsApi.downloadInternalPdf(report.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `recruiter-performance-report-internal-${report.id}-${format(new Date(report.weekEnding), 'yyyy-MM-dd')}.pdf`,
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

  const handleDownloadCustomer = async (report: RecruiterPerformanceReport) => {
    try {
      const blob = await recruiterPerformanceReportsApi.downloadCustomerPdf(report.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `recruiter-performance-report-customer-${report.id}-${format(new Date(report.weekEnding), 'yyyy-MM-dd')}.pdf`,
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

  return (
    <div className="py-8 space-y-6">
      {feedback && (
        <FeedbackToast
          message={feedback.message}
          tone={feedback.tone}
          onDismiss={() => setFeedback(null)}
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Recruiter Performance Reports</h1>
          <p className="text-muted-foreground mt-1">
            Weekly performance reports for recruiters by position
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Position</label>
            <select
              value={filterPositionId}
              onChange={(e) => setFilterPositionId(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">All Positions</option>
              {positions.map((pos) => (
                <option key={pos.id} value={pos.id}>
                  {pos.title}
                </option>
              ))}
            </select>
          </div>
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
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Recruiter</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Position</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Week Ending</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Candidates Contacted</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-foreground">Placements</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm text-foreground">
                    {report.recruiter
                      ? `${report.recruiter.firstName} ${report.recruiter.lastName}`
                      : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{report.positionTitle}</td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {format(new Date(report.weekEnding), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">
                    {report.candidatesContactedActual} / {report.candidatesContactedTarget}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{report.placementsThisWeek}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleView(report)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(report)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadInternal(report)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Download Internal PDF"
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDownloadCustomer(report)}
                        className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Download Customer PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      {(isAdminOrHR || (isRecruiter && report.recruiterId === user?.id)) && (
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
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedReport ? 'Edit Report' : 'Create Report'}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setSelectedReport(null);
                  setInitialPositionId(undefined);
                  setInitialPositionTitle(undefined);
                  setHasProcessedInitialState(false);
                  // Clear location state
                  navigate(location.pathname, { replace: true, state: {} });
                }}
                className="p-1 rounded hover:bg-muted"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              <RecruiterPerformanceReportForm
                report={selectedReport || undefined}
                initialPositionId={initialPositionId}
                initialPositionTitle={initialPositionTitle}
                onClose={() => {
                  setShowForm(false);
                  setSelectedReport(null);
                  setInitialPositionId(undefined);
                  setInitialPositionTitle(undefined);
                  setHasProcessedInitialState(false);
                  // Clear location state
                  navigate(location.pathname, { replace: true, state: {} });
                }}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['recruiter-performance-reports'] });
                  setShowForm(false);
                  setSelectedReport(null);
                  setInitialPositionId(undefined);
                  setInitialPositionTitle(undefined);
                  setHasProcessedInitialState(false);
                  // Clear location state
                  navigate(location.pathname, { replace: true, state: {} });
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


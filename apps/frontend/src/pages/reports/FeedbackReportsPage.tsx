import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { feedbackReportsApi, downloadFeedbackReportPdf } from '@/lib/api/feedback-reports';
import { employeesApi } from '@/lib/api/hr/employees';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Plus, Eye, Download, Send, RefreshCw, Trash2, FileText, X } from 'lucide-react';
import type { FeedbackReport, CreateFeedbackReportDto } from '@/types/feedback-reports';
import { formatReportPeriod, getStatusBadgeColor, getRatingLabel } from '@/lib/api/feedback-reports';

export default function FeedbackReportsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  
  const [selectedReport, setSelectedReport] = useState<FeedbackReport | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [filterMonth, setFilterMonth] = useState<number | undefined>();
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState<string>('');

  const isHR = user?.role === 'HR' || user?.role === 'ADMIN';
  const isAM = user?.role === 'ACCOUNT_MANAGER' || user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  // Fetch reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['feedback-reports', filterMonth, filterYear, filterStatus],
    queryFn: () => feedbackReportsApi.getAll({
      month: filterMonth,
      year: filterYear,
      status: filterStatus || undefined,
    }),
  });

  // Fetch employees for create form
  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeesApi.getAll(),
    enabled: isHR,
  });
  const employees = employeesData?.data || [];

  // Create report mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateFeedbackReportDto) => feedbackReportsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-reports'] });
      setShowCreateModal(false);
      alert('Feedback report created successfully');
    },
    onError: (error: any) => {
      alert(error.response?.data?.message || 'Failed to create report');
    },
  });

  // Update HR section mutation
  const updateHrMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      feedbackReportsApi.updateHrSection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-reports'] });
      setShowEditModal(false);
      setSelectedReport(null);
      alert('HR section updated successfully');
    },
  });

  // Update AM section mutation
  const updateAmMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      feedbackReportsApi.updateAmSection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-reports'] });
      setShowEditModal(false);
      setSelectedReport(null);
      alert('Account Manager section updated successfully');
    },
  });

  // Update Employee section mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      feedbackReportsApi.updateEmployeeSection(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-reports'] });
      setShowEditModal(false);
      setSelectedReport(null);
      alert('Employee section updated successfully');
    },
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (id: string) => feedbackReportsApi.submit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-reports'] });
      alert('Report submitted successfully');
    },
  });

  // Recompile mutation
  const recompileMutation = useMutation({
    mutationFn: (id: string) => feedbackReportsApi.recompile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-reports'] });
      alert('Report data recompiled successfully');
    },
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      feedbackReportsApi.sendToCustomer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-reports'] });
      setShowSendModal(false);
      alert('Report sent to customer successfully');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => feedbackReportsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback-reports'] });
      alert('Report deleted successfully');
    },
  });

  const handlePreview = async (report: FeedbackReport) => {
    try {
      const { html } = await feedbackReportsApi.preview(report.id);
      setPreviewHtml(html);
      setSelectedReport(report);
      setShowPreviewModal(true);
    } catch (error) {
      alert('Failed to load preview');
    }
  };

  const handleDownload = async (report: FeedbackReport) => {
    try {
      await downloadFeedbackReportPdf(
        report.id,
        `feedback-report-${report.employee?.user?.lastName || 'employee'}-${report.month}-${report.year}.pdf`
      );
      alert('PDF downloaded successfully');
    } catch (error) {
      alert('Failed to download PDF');
    }
  };

  const handleCreate = (data: CreateFeedbackReportDto) => {
    createMutation.mutate(data);
  };

  const handleSubmit = (report: FeedbackReport) => {
    if (window.confirm('Submit this report? It will be ready to send to the customer.')) {
      submitMutation.mutate(report.id);
    }
  };

  const handleRecompile = (report: FeedbackReport) => {
    if (window.confirm('Recompile auto-calculated data? This will update tasks count, days off, and bank holidays.')) {
      recompileMutation.mutate(report.id);
    }
  };

  const handleDelete = (report: FeedbackReport) => {
    if (window.confirm('Delete this report? This action cannot be undone.')) {
      deleteMutation.mutate(report.id);
    }
  };

  const handleSend = (report: FeedbackReport, recipientEmail: string, message?: string) => {
    sendMutation.mutate({
      id: report.id,
      data: { recipientEmail, message },
    });
  };

  const handleEdit = (report: FeedbackReport) => {
    setSelectedReport(report);
    setShowEditModal(true);
  };

  const canEdit = (report: FeedbackReport) => {
    if (report.status === 'SENT') return false;
    if (isHR) return true;
    if (isAM) return true;
    if (isEmployee && report.employee?.userId === user?.id) return true;
    return false;
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Feedback Reports</h1>
          <p className="text-muted-foreground mt-1">
            Monthly feedback reports for employees
          </p>
        </div>
        {isHR && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            <Plus className="w-5 h-5" />
            Create Report
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border border-border bg-card p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Month</label>
            <select
              value={filterMonth?.toString() || ''}
              onChange={(e) => setFilterMonth(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All months</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {new Date(2024, month - 1).toLocaleString('default', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Year</label>
            <input
              type="number"
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value) || new Date().getFullYear())}
              min={2020}
              max={2100}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="SENT">Sent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6">
          <h2 className="text-lg font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {reports.length} report{reports.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reports found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Employee</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Period</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Tasks</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Days Off</th>
                    <th className="text-left py-3 px-4 font-semibold text-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-4">
                        {report.employee?.user?.firstName} {report.employee?.user?.lastName}
                      </td>
                      <td className="py-3 px-4">{formatReportPeriod(report.month, report.year)}</td>
                      <td className="py-3 px-4">{report.tasksCount ?? 'N/A'}</td>
                      <td className="py-3 px-4">{report.totalDaysOffTaken ?? 'N/A'}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeColor(report.status)}`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handlePreview(report)}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownload(report)}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          {canEdit(report) && (
                            <button
                              onClick={() => handleEdit(report)}
                              className="p-2 rounded-lg hover:bg-muted transition-colors"
                              title="Edit"
                            >
                              <FileText className="h-4 w-4" />
                            </button>
                          )}
                          {isHR && report.status === 'DRAFT' && (
                            <>
                              <button
                                onClick={() => handleRecompile(report)}
                                disabled={recompileMutation.isPending}
                                className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                                title="Recompile"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleSubmit(report)}
                                disabled={submitMutation.isPending}
                                className="px-3 py-1 text-sm rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                              >
                                Submit
                              </button>
                              <button
                                onClick={() => handleDelete(report)}
                                disabled={deleteMutation.isPending}
                                className="p-2 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </button>
                            </>
                          )}
                          {(isHR || isAM) && report.status === 'SUBMITTED' && (
                            <button
                              onClick={() => {
                                setSelectedReport(report);
                                setShowSendModal(true);
                              }}
                              className="p-2 rounded-lg hover:bg-muted transition-colors"
                              title="Send"
                            >
                              <Send className="h-4 w-4" />
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
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateReportModal
          employees={employees}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Modal */}
      {showEditModal && selectedReport && (
        <EditReportModal
          report={selectedReport}
          onClose={() => {
            setShowEditModal(false);
            setSelectedReport(null);
          }}
          onUpdateHr={(data) => updateHrMutation.mutate({ id: selectedReport.id, data })}
          onUpdateAm={(data) => updateAmMutation.mutate({ id: selectedReport.id, data })}
          onUpdateEmployee={(data) => updateEmployeeMutation.mutate({ id: selectedReport.id, data })}
          isHR={isHR}
          isAM={isAM}
          isEmployee={isEmployee && selectedReport.employee?.userId === user?.id}
          isLoading={
            updateHrMutation.isPending ||
            updateAmMutation.isPending ||
            updateEmployeeMutation.isPending
          }
        />
      )}

      {/* Preview Modal */}
      {showPreviewModal && selectedReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="border-b border-border p-6 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Report Preview</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedReport.employee?.user?.firstName} {selectedReport.employee?.user?.lastName} - {formatReportPeriod(selectedReport.month, selectedReport.year)}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  setSelectedReport(null);
                }}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div
              className="p-6"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && selectedReport && (
        <SendReportModal
          report={selectedReport}
          onClose={() => {
            setShowSendModal(false);
            setSelectedReport(null);
          }}
          onSend={handleSend}
          isLoading={sendMutation.isPending}
        />
      )}
    </div>
  );
}

// Create Report Modal
function CreateReportModal({
  employees,
  onClose,
  onSubmit,
  isLoading,
}: {
  employees: any[];
  onClose: () => void;
  onSubmit: (data: CreateFeedbackReportDto) => void;
  isLoading: boolean;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return;
    onSubmit({ employeeId, month, year });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b border-border p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Create Feedback Report</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create a new monthly feedback report for an employee
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Employee</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.user?.firstName} {emp.user?.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {new Date(2024, m - 1).toLocaleString('default', { month: 'long' })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Year</label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                min={2020}
                max={2100}
                required
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !employeeId}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Report Modal
function EditReportModal({
  report,
  onClose,
  onUpdateHr,
  onUpdateAm,
  onUpdateEmployee,
  isHR,
  isAM,
  isEmployee,
  isLoading,
}: {
  report: FeedbackReport;
  onClose: () => void;
  onUpdateHr: (data: any) => void;
  onUpdateAm: (data: any) => void;
  onUpdateEmployee: (data: any) => void;
  isHR: boolean;
  isAM: boolean;
  isEmployee: boolean;
  isLoading: boolean;
}) {
  const [activeTab, setActiveTab] = useState(isHR ? 'hr' : isAM ? 'am' : 'employee');
  const [hrData, setHrData] = useState({
    tasksCount: report.tasksCount?.toString() || '',
    totalDaysOffTaken: report.totalDaysOffTaken?.toString() || '',
    totalRemainingDaysOff: report.totalRemainingDaysOff?.toString() || '',
  });
  const [amData, setAmData] = useState({
    amFeedback: report.amFeedback || '',
    amActionDescription: report.amActionDescription || '',
  });
  const [employeeData, setEmployeeData] = useState({
    communicationRating: report.communicationRating?.toString() || '',
    collaborationRating: report.collaborationRating?.toString() || '',
    taskEstimationRating: report.taskEstimationRating?.toString() || '',
    timelinessRating: report.timelinessRating?.toString() || '',
    employeeSummary: report.employeeSummary || '',
  });

  const handleHrSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateHr({
      ...hrData,
      tasksCount: hrData.tasksCount ? parseInt(hrData.tasksCount) : undefined,
      totalDaysOffTaken: hrData.totalDaysOffTaken ? parseInt(hrData.totalDaysOffTaken) : undefined,
      totalRemainingDaysOff: hrData.totalRemainingDaysOff ? parseInt(hrData.totalRemainingDaysOff) : undefined,
    });
  };

  const handleAmSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateAm(amData);
  };

  const handleEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateEmployee({
      ...employeeData,
      communicationRating: employeeData.communicationRating ? parseInt(employeeData.communicationRating) : undefined,
      collaborationRating: employeeData.collaborationRating ? parseInt(employeeData.collaborationRating) : undefined,
      taskEstimationRating: employeeData.taskEstimationRating ? parseInt(employeeData.taskEstimationRating) : undefined,
      timelinessRating: employeeData.timelinessRating ? parseInt(employeeData.timelinessRating) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="border-b border-border p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Edit Feedback Report</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {report.employee?.user?.firstName} {report.employee?.user?.lastName} - {formatReportPeriod(report.month, report.year)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">
          {/* Tabs */}
          <div className="border-b border-border mb-6">
            <div className="flex gap-4">
              {isHR && (
                <button
                  onClick={() => setActiveTab('hr')}
                  className={`px-4 py-2 border-b-2 transition-colors ${
                    activeTab === 'hr'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  HR Section
                </button>
              )}
              {isAM && (
                <button
                  onClick={() => setActiveTab('am')}
                  className={`px-4 py-2 border-b-2 transition-colors ${
                    activeTab === 'am'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Account Manager
                </button>
              )}
              {isEmployee && (
                <button
                  onClick={() => setActiveTab('employee')}
                  className={`px-4 py-2 border-b-2 transition-colors ${
                    activeTab === 'employee'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Employee
                </button>
              )}
            </div>
          </div>

          {/* HR Tab */}
          {isHR && activeTab === 'hr' && (
            <form onSubmit={handleHrSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Tasks Count</label>
                  <input
                    type="number"
                    value={hrData.tasksCount}
                    onChange={(e) => setHrData({ ...hrData, tasksCount: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Days Off Taken</label>
                  <input
                    type="number"
                    value={hrData.totalDaysOffTaken}
                    onChange={(e) => setHrData({ ...hrData, totalDaysOffTaken: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Remaining Days Off</label>
                  <input
                    type="number"
                    value={hrData.totalRemainingDaysOff}
                    onChange={(e) => setHrData({ ...hrData, totalRemainingDaysOff: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {/* AM Tab */}
          {isAM && activeTab === 'am' && (
            <form onSubmit={handleAmSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Account Manager Feedback</label>
                <textarea
                  value={amData.amFeedback}
                  onChange={(e) => setAmData({ ...amData, amFeedback: e.target.value })}
                  rows={6}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Action Description</label>
                <textarea
                  value={amData.amActionDescription}
                  onChange={(e) => setAmData({ ...amData, amActionDescription: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}

          {/* Employee Tab */}
          {isEmployee && activeTab === 'employee' && (
            <form onSubmit={handleEmployeeSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Communication (1-5)</label>
                  <select
                    value={employeeData.communicationRating}
                    onChange={(e) => setEmployeeData({ ...employeeData, communicationRating: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select rating</option>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r.toString()}>
                        {r} - {getRatingLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Collaboration (1-5)</label>
                  <select
                    value={employeeData.collaborationRating}
                    onChange={(e) => setEmployeeData({ ...employeeData, collaborationRating: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select rating</option>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r.toString()}>
                        {r} - {getRatingLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Task Estimation (1-5)</label>
                  <select
                    value={employeeData.taskEstimationRating}
                    onChange={(e) => setEmployeeData({ ...employeeData, taskEstimationRating: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select rating</option>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r.toString()}>
                        {r} - {getRatingLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Timeliness (1-5)</label>
                  <select
                    value={employeeData.timelinessRating}
                    onChange={(e) => setEmployeeData({ ...employeeData, timelinessRating: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select rating</option>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r.toString()}>
                        {r} - {getRatingLabel(r)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Summary Feedback</label>
                <textarea
                  value={employeeData.employeeSummary}
                  onChange={(e) => setEmployeeData({ ...employeeData, employeeSummary: e.target.value })}
                  rows={5}
                  placeholder="Describe your experience this month..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// Send Report Modal
function SendReportModal({
  report,
  onClose,
  onSend,
  isLoading,
}: {
  report: FeedbackReport;
  onClose: () => void;
  onSend: (report: FeedbackReport, email: string, message?: string) => void;
  isLoading: boolean;
}) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    onSend(report, email, message);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b border-border p-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold">Send Report to Customer</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Send the feedback report for {report.employee?.user?.firstName} {report.employee?.user?.lastName} to the customer
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Customer Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Additional Message (Optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Add a personal message to the email..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !email}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

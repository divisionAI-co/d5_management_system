import { apiClient } from './client';
import {
  FeedbackReport,
  CreateFeedbackReportDto,
  UpdateHrSectionDto,
  UpdateAmSectionDto,
  UpdateEmployeeSectionDto,
  FilterFeedbackReportsDto,
  SendReportDto,
  PreviewResponse,
} from '../../types/feedback-reports';

const BASE_URL = '/feedback-reports';

export const feedbackReportsApi = {
  /**
   * Create a new feedback report (HR only)
   */
  create: async (data: CreateFeedbackReportDto): Promise<FeedbackReport> => {
    const response = await apiClient.post<FeedbackReport>(BASE_URL, data);
    return response.data;
  },

  /**
   * Get all feedback reports with optional filters
   */
  getAll: async (filters?: FilterFeedbackReportsDto): Promise<FeedbackReport[]> => {
    // Filter out empty strings and undefined values
    const cleanFilters = filters
      ? Object.fromEntries(
          Object.entries(filters).filter(
            ([_, value]) => value !== undefined && value !== null && value !== ''
          )
        )
      : undefined;
    
    const response = await apiClient.get<FeedbackReport[]>(BASE_URL, {
      params: cleanFilters,
    });
    return response.data;
  },

  /**
   * Get a specific feedback report by ID
   */
  getById: async (id: string): Promise<FeedbackReport> => {
    const response = await apiClient.get<FeedbackReport>(`${BASE_URL}/${id}`);
    return response.data;
  },

  /**
   * Update HR section of a feedback report (HR only)
   */
  updateHrSection: async (
    id: string,
    data: UpdateHrSectionDto
  ): Promise<FeedbackReport> => {
    const response = await apiClient.patch<FeedbackReport>(
      `${BASE_URL}/${id}/hr-section`,
      data
    );
    return response.data;
  },

  /**
   * Update Account Manager section (AM only)
   */
  updateAmSection: async (
    id: string,
    data: UpdateAmSectionDto
  ): Promise<FeedbackReport> => {
    const response = await apiClient.patch<FeedbackReport>(
      `${BASE_URL}/${id}/am-section`,
      data
    );
    return response.data;
  },

  /**
   * Update Employee section (Employee only)
   */
  updateEmployeeSection: async (
    id: string,
    data: UpdateEmployeeSectionDto
  ): Promise<FeedbackReport> => {
    const response = await apiClient.patch<FeedbackReport>(
      `${BASE_URL}/${id}/employee-section`,
      data
    );
    return response.data;
  },

  /**
   * Submit a feedback report for review (HR only)
   */
  submit: async (id: string): Promise<FeedbackReport> => {
    const response = await apiClient.post<FeedbackReport>(`${BASE_URL}/${id}/submit`);
    return response.data;
  },

  /**
   * Recompile auto-calculated data (HR only)
   */
  recompile: async (id: string): Promise<FeedbackReport> => {
    const response = await apiClient.post<FeedbackReport>(`${BASE_URL}/${id}/recompile`);
    return response.data;
  },

  /**
   * Preview the feedback report as HTML
   */
  preview: async (id: string): Promise<PreviewResponse> => {
    const response = await apiClient.get<PreviewResponse>(`${BASE_URL}/${id}/preview`);
    return response.data;
  },

  /**
   * Download PDF of the feedback report
   */
  downloadPdf: async (id: string): Promise<Blob> => {
    const response = await apiClient.get(`${BASE_URL}/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Send the feedback report to customer via email (HR/AM only)
   */
  sendToCustomer: async (id: string, data: SendReportDto): Promise<FeedbackReport> => {
    const response = await apiClient.post<FeedbackReport>(`${BASE_URL}/${id}/send`, data);
    return response.data;
  },

  /**
   * Delete a feedback report (HR only)
   */
  delete: async (id: string): Promise<{ deleted: boolean }> => {
    const response = await apiClient.delete<{ deleted: boolean }>(`${BASE_URL}/${id}`);
    return response.data;
  },
};

// Helper function to download PDF
export const downloadFeedbackReportPdf = async (
  id: string,
  filename?: string
): Promise<void> => {
  const blob = await feedbackReportsApi.downloadPdf(id);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `feedback-report-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Helper function to format rating label
export const getRatingLabel = (rating: number | null): string => {
  if (!rating) return 'Not rated';
  const labels = [
    '',
    'Unacceptable',
    'Needs improvement',
    'Meets expectations',
    'Exceeds expectations',
    'Outstanding',
  ];
  return labels[rating] || 'Unknown';
};

// Helper function to get rating color class
export const getRatingColorClass = (rating: number | null): string => {
  if (!rating) return 'text-gray-500';
  if (rating === 5) return 'text-green-600';
  if (rating === 4) return 'text-blue-600';
  if (rating === 3) return 'text-yellow-600';
  if (rating === 2) return 'text-orange-600';
  return 'text-red-600';
};

// Helper function to format month/year
export const formatReportPeriod = (month: number, year: number): string => {
  const date = new Date(year, month - 1);
  return date.toLocaleDateString('default', { month: 'long', year: 'numeric' });
};

// Helper function to get status badge color
export const getStatusBadgeColor = (status: string): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-800';
    case 'SUBMITTED':
      return 'bg-blue-100 text-blue-800';
    case 'SENT':
      return 'bg-green-100 text-green-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};


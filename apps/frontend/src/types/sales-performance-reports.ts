import type { UserSummary } from '@/types/users';

export interface SalesPerformanceReport {
  id: string;
  salespersonId: string;
  weekEnding: string;
  linkedinConnectionRequests: number;
  linkedinAccepted: number;
  linkedinAcceptedPercentage?: number | null;
  linkedinMeetingsScheduled: number;
  linkedinMeetingsScheduledPercentage?: number | null;
  linkedinAccountsCount: number;
  linkedinMarketsTargeted?: string | null;
  inmailSent: number;
  inmailReplies: number;
  inmailRepliesPercentage?: number | null;
  inmailMeetingsScheduled: number;
  inmailMeetingsScheduledPercentage?: number | null;
  pdfUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  salesperson?: UserSummary;
}

export interface CreateSalesPerformanceReportDto {
  weekEnding: string;
  linkedinConnectionRequests: number;
  linkedinAccepted: number;
  linkedinMeetingsScheduled: number;
  linkedinAccountsCount: number;
  linkedinMarketsTargeted?: string;
  inmailSent: number;
  inmailReplies: number;
  inmailMeetingsScheduled: number;
}

export interface UpdateSalesPerformanceReportDto {
  weekEnding?: string;
  linkedinConnectionRequests?: number;
  linkedinAccepted?: number;
  linkedinMeetingsScheduled?: number;
  linkedinAccountsCount?: number;
  linkedinMarketsTargeted?: string;
  inmailSent?: number;
  inmailReplies?: number;
  inmailMeetingsScheduled?: number;
}

export interface SalesPerformanceReportFilters {
  salespersonId?: string;
  weekEndingFrom?: string;
  weekEndingTo?: string;
  page?: number;
  pageSize?: number;
}

export interface SalesPerformanceReportsListResponse {
  data: SalesPerformanceReport[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}


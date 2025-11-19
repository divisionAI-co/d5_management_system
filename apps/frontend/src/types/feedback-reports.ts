export enum FeedbackReportStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  SENT = 'SENT',
}

export interface FeedbackReport {
  id: string;
  employeeId: string;
  month: number;
  year: number;
  
  // Auto-compiled data
  tasksCount: number | null;
  totalDaysOffTaken: number | null;
  totalRemainingDaysOff: number | null;
  bankHolidays: BankHoliday[] | null;
  
  // HR Section
  hrFeedback: string | null;
  hrActionDescription: string | null;
  hrUpdatedAt: string | null;
  hrUpdatedBy: string | null;
  hrUpdatedByUser?: User;
  
  // Account Manager Section
  amFeedback: string | null;
  amActionDescription: string | null;
  amUpdatedAt: string | null;
  amUpdatedBy: string | null;
  amUpdatedByUser?: User;
  
  // Employee Section
  communicationRating: number | null;
  collaborationRating: number | null;
  taskEstimationRating: number | null;
  timelinessRating: number | null;
  employeeSummary: string | null;
  employeeUpdatedAt: string | null;
  
  // Status
  status: FeedbackReportStatus;
  submittedAt: string | null;
  sentAt: string | null;
  sentTo: string | null;
  
  // PDF
  pdfUrl: string | null;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  
  // Relations
  employee?: Employee;
}

export interface BankHoliday {
  name: string;
  date: string;
}

export interface Employee {
  id: string;
  userId: string;
  employeeNumber: string;
  department: string | null;
  jobTitle: string;
  user?: User;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface CreateFeedbackReportDto {
  employeeId: string;
  month: number;
  year: number;
}

export interface UpdateHrSectionDto {
  tasksCount?: number;
  totalDaysOffTaken?: number;
  totalRemainingDaysOff?: number;
  hrFeedback?: string;
  hrActionDescription?: string;
}

export interface UpdateAmSectionDto {
  amFeedback?: string;
}

export interface UpdateEmployeeSectionDto {
  communicationRating?: number;
  collaborationRating?: number;
  taskEstimationRating?: number;
  timelinessRating?: number;
  employeeSummary?: string;
}

export interface FilterFeedbackReportsDto {
  employeeId?: string;
  month?: number;
  year?: number;
  status?: FeedbackReportStatus;
}

export interface SendReportDto {
  recipientEmail: string;
  message?: string;
}

export interface PreviewResponse {
  html: string;
}


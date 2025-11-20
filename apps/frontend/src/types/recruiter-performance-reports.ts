import type { UserSummary } from '@/types/users';
import type { OpenPosition } from '@/types/recruitment';

export interface Win {
  description: string;
}

export interface Challenge {
  challenge: string;
  proposedSolution: string;
}

export interface Priority {
  description: string;
}

export interface TopPerformingSource {
  source: string;
  count: number;
}

export interface PipelineStatus {
  role: string;
  pipeline: string;
  confidenceLevel: string;
  notes?: string;
}

export interface RecruiterPerformanceReport {
  id: string;
  positionId: string;
  recruiterId: string;
  weekEnding: string;
  positionTitle: string;
  candidatesContactedActual: number;
  candidatesContactedTarget: number;
  culturalCallsActual: number;
  culturalCallsTarget: number;
  culturalCallsEfficiencyRatio?: number | null;
  technicalCallsActual: number;
  technicalCallsTarget: number;
  technicalCallsEfficiencyRatio?: number | null;
  clientInterviewsScheduledActual: number;
  clientInterviewsScheduledTarget: number;
  submissionToInterviewRatio?: number | null;
  placementsThisWeek: number;
  wins?: Win[] | null;
  challenges?: Challenge[] | null;
  priorities?: Priority[] | null;
  topPerformingSources?: TopPerformingSource[] | null;
  pipelineStatus?: PipelineStatus | null;
  internalPdfUrl?: string | null;
  customerPdfUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  position?: OpenPosition;
  recruiter?: UserSummary;
}

export interface CreateRecruiterPerformanceReportDto {
  positionId: string;
  weekEnding: string;
  positionTitle: string;
  candidatesContactedActual: number;
  candidatesContactedTarget: number;
  culturalCallsActual: number;
  culturalCallsTarget: number;
  culturalCallsEfficiencyRatio?: number;
  technicalCallsActual: number;
  technicalCallsTarget: number;
  technicalCallsEfficiencyRatio?: number;
  clientInterviewsScheduledActual: number;
  clientInterviewsScheduledTarget: number;
  submissionToInterviewRatio?: number;
  placementsThisWeek: number;
  wins?: Win[];
  challenges?: Challenge[];
  priorities?: Priority[];
  topPerformingSources?: TopPerformingSource[];
  pipelineStatus?: PipelineStatus;
}

export interface UpdateRecruiterPerformanceReportDto {
  weekEnding?: string;
  positionTitle?: string;
  candidatesContactedActual?: number;
  candidatesContactedTarget?: number;
  culturalCallsActual?: number;
  culturalCallsTarget?: number;
  culturalCallsEfficiencyRatio?: number;
  technicalCallsActual?: number;
  technicalCallsTarget?: number;
  technicalCallsEfficiencyRatio?: number;
  clientInterviewsScheduledActual?: number;
  clientInterviewsScheduledTarget?: number;
  submissionToInterviewRatio?: number;
  placementsThisWeek?: number;
  wins?: Win[];
  challenges?: Challenge[];
  priorities?: Priority[];
  topPerformingSources?: TopPerformingSource[];
  pipelineStatus?: PipelineStatus;
}

export interface RecruiterPerformanceReportFilters {
  positionId?: string;
  recruiterId?: string;
  weekEndingFrom?: string;
  weekEndingTo?: string;
  page?: number;
  pageSize?: number;
}

export interface RecruiterPerformanceReportsListResponse {
  data: RecruiterPerformanceReport[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}


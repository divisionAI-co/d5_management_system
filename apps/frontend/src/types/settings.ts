export type RemoteWorkFrequency = 'WEEKLY' | 'MONTHLY';

export interface CompanySettings {
  id: string;
  remoteWorkFrequency: RemoteWorkFrequency;
  remoteWorkLimit: number;
  eodGraceDays: number;
  eodLateReportsAllowed: number;
  eodReportDeadlineHour: number;
  eodReportDeadlineMin: number;
  reviewCycleDays: number;
  annualLeaveAllowanceDays: number;
  updatedAt: string;
}

export type UpdateCompanySettingsPayload = Partial<
  Pick<
    CompanySettings,
    | 'remoteWorkFrequency'
    | 'remoteWorkLimit'
    | 'eodGraceDays'
    | 'eodLateReportsAllowed'
    | 'eodReportDeadlineHour'
    | 'eodReportDeadlineMin'
    | 'reviewCycleDays'
    | 'annualLeaveAllowanceDays'
  >
>;

export interface NotificationSettings {
  id: string;
  userId: string;
  emailEnabled: boolean;
  inAppEnabled: boolean;
  taskAssigned: boolean;
  taskDueSoon: boolean;
  leaveApproved: boolean;
  performanceReview: boolean;
  newCandidate: boolean;
  newOpportunity: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UpdateNotificationSettingsPayload = Partial<
  Pick<
    NotificationSettings,
    | 'emailEnabled'
    | 'inAppEnabled'
    | 'taskAssigned'
    | 'taskDueSoon'
    | 'leaveApproved'
    | 'performanceReview'
    | 'newCandidate'
    | 'newOpportunity'
  >
>;

export interface IntegrationConfig {
  [key: string]: unknown;
}

export interface IntegrationSettings {
  id: string;
  name: string;
  isActive: boolean;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresAt?: string | null;
  config?: IntegrationConfig | null;
  createdAt: string;
  updatedAt: string;
  displayName: string;
  description?: string;
}

export interface UpdateIntegrationPayload {
  isActive?: boolean;
  config?: IntegrationConfig;
}



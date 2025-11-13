export type ActivityVisibility = 'PUBLIC' | 'TEAM' | 'PRIVATE';

export interface ActivityType {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  isSystem: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityUserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
}

export interface Activity {
  id: string;
  subject: string;
  title?: string; // backward compatibility alias
  body?: string | null;
  description?: string | null; // backward compatibility alias
  typeLabel?: string;
  typeColor?: string | null;
  activityDate?: string | null;
  reminderAt?: string | null;
  isReminderSent: boolean;
  isPinned: boolean;
  isCompleted: boolean;
  visibility: ActivityVisibility;
  metadata?: Record<string, unknown> | null;
  customerId?: string | null;
  leadId?: string | null;
  opportunityId?: string | null;
  candidateId?: string | null;
  employeeId?: string | null;
  contactId?: string | null;
  taskId?: string | null;
  assignedToId?: string | null;
  createdById: string;
  activityTypeId: string;
  activityType: ActivityType;
  createdBy: ActivityUserSummary;
  assignedTo?: ActivityUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityListResponse {
  data: Activity[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateActivityPayload {
  activityTypeId: string;
  subject: string;
  body?: string;
  activityDate?: string;
  reminderAt?: string;
  assignedToId?: string;
  visibility?: ActivityVisibility;
  metadata?: Record<string, unknown>;
  isCompleted?: boolean;
  notifyAssignee?: boolean;
  targets: {
    customerId?: string;
    leadId?: string;
    opportunityId?: string;
    candidateId?: string;
    employeeId?: string;
    contactId?: string;
    taskId?: string;
  };
}

export interface UpdateActivityPayload extends Partial<Omit<CreateActivityPayload, 'targets'>> {
  targets?: {
    customerId?: string;
    leadId?: string;
    opportunityId?: string;
    candidateId?: string;
    employeeId?: string;
    contactId?: string;
    taskId?: string;
  };
  isPinned?: boolean;
  isCompleted?: boolean;
}

export interface ActivityTypePayload {
  name: string;
  key: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive?: boolean;
  order?: number;
}

export interface ActivityTypeUpdatePayload extends Partial<ActivityTypePayload> {}



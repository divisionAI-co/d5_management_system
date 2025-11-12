export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_DUE_SOON'
  | 'LEAVE_REQUEST'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'PERFORMANCE_REVIEW'
  | 'NEW_CANDIDATE'
  | 'NEW_OPPORTUNITY'
  | 'INVOICE_OVERDUE'
  | 'MEETING_REMINDER'
  | 'SYSTEM';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}



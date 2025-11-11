import type { UserRole } from '@/types/users';
import type { TaskPriority, TaskStatus } from '@/types/tasks';

export interface DashboardStats {
  missingReports: number;
  lateReports: number;
  totalReports: number;
}

export interface DashboardTimeframe {
  start: string | null;
  end: string | null;
}

export interface DashboardEodReport {
  id: string;
  date: string;
  submittedAt?: string | null;
  summary: string;
  hoursWorked: number | null;
  isLate: boolean;
}

export interface DashboardTaskSummary {
  id: string;
  title: string;
  dueDate: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  customerId?: string | null;
  isOverdue: boolean;
}

export interface DashboardActivityReminder {
  id: string;
  subject: string;
  body?: string | null;
  type: {
    id: string;
    key: string;
    name: string;
    color: string | null;
  };
  dueDate: string;
  related: {
    customer?: { id: string; name: string } | null;
    lead?: { id: string; title: string } | null;
    opportunity?: { id: string; title: string } | null;
    task?: { id: string; title: string } | null;
  };
  metadata?: Record<string, unknown> | null;
}

export interface DashboardResponse {
  userRole: UserRole;
  isAdminView: boolean;
  stats: DashboardStats;
  timeframe: DashboardTimeframe | null;
  recentReports: DashboardEodReport[];
  tasksDueSoon: DashboardTaskSummary[];
  activitiesDueSoon: DashboardActivityReminder[];
}



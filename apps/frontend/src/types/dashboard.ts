import type { UserRole } from '@/types/users';
import type { TaskPriority, TaskStatus } from '@/types/tasks';

export interface DashboardStats {
  missingReports: number;
  lateReports: number;
  lateReportsBeyondThreshold: number;
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

// Admin Dashboard Types
export interface AdminDashboardKPIs {
  mrr: number;
  staffAugValue: number;
  outstandingInvoices: { count: number; value: number };
  overdueInvoices: { count: number; value: number };
  activeCustomers: number;
  customersAtRisk: number;
  activeEmployees: number;
  openPositions: number;
  activeCandidates: number;
  eodComplianceRate: number;
  missingEodReports: number;
  overdueTasks: number;
}

export interface AdminDashboardFinancial {
  revenueByType: {
    staffAug: number;
    subscription: number;
    both: number;
  };
  revenueBySalesperson: Array<{ name: string; revenue: number }>;
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  invoiceStatus: {
    draft: { count: number; value: number };
    sent: { count: number; value: number };
    paid: { count: number; value: number };
    overdue: { count: number; value: number };
  };
  topCustomers: Array<{ id: string; name: string; revenue: number }>;
}

export interface AdminDashboardCRM {
  leadsByStatus: Record<string, number>;
  opportunitiesByStage: Array<{ stage: string; count: number; value: number }>;
  winRate: number;
  customerStatus: Record<string, number>;
  customerSentiment: Record<string, number>;
  atRiskCustomers: Array<{ id: string; name: string; status: string; sentiment: string }>;
}

export interface AdminDashboardHR {
  employeesByStatus: Record<string, number>;
  employeesByDepartment: Record<string, number>;
  employeesByContractType: Record<string, number>;
  newHiresThisMonth: number;
  departuresThisMonth: number;
  eodCompliance: {
    overallRate: number;
    missingReports: number;
    lateReports: number;
    employeesWithIssues: Array<{ id: string; name: string; lateCount: number }>;
  };
  leaveManagement: {
    pending: number;
    approvedThisMonth: number;
    upcoming: Array<{ id: string; employeeName: string; startDate: string; endDate: string }>;
  };
  performanceReviews: {
    overdue: number;
    upcoming: number;
    completionRate: number;
  };
}

export interface AdminDashboardRecruitment {
  activeCandidates: number;
  candidatesByStage: Record<string, number>;
  hireRate: number;
  averageTimeToHire: number;
  openPositions: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  topRecruiters: Array<{ name: string; placements: number }>;
}

export interface AdminDashboardTasks {
  activeTasks: number;
  tasksByStatus: Record<string, number>;
  overdueTasks: number;
  tasksByPriority: Record<string, number>;
  completedThisWeek: number;
}

export interface AdminDashboardAlerts {
  accountLockouts: number;
  failedLogins: number;
  systemErrors: number;
  dataQualityIssues: number;
}

export interface AdminDashboardActivity {
  id: string;
  type: string;
  typeName: string;
  user: { id: string; name: string };
  entity: { type: string; id: string; name: string };
  subject: string;
  timestamp: string;
}

export interface AdminDashboardSystemHealth {
  activeUsers: number;
  totalUsers: number;
  usersByRole: Record<string, number>;
}

export interface AdminDashboardResponse {
  kpis: AdminDashboardKPIs;
  financial: AdminDashboardFinancial;
  crm: AdminDashboardCRM;
  hr: AdminDashboardHR;
  recruitment: AdminDashboardRecruitment;
  tasks: AdminDashboardTasks;
  alerts: AdminDashboardAlerts;
  recentActivities: AdminDashboardActivity[];
  systemHealth: AdminDashboardSystemHealth;
}



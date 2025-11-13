import type { UserSummary } from '@/types/users';

// Enums
export enum EmploymentStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  TERMINATED = 'TERMINATED',
  RESIGNED = 'RESIGNED',
}

export enum ContractType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERNSHIP = 'INTERNSHIP',
}

export enum LeaveType {
  ANNUAL = 'ANNUAL',
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
  UNPAID = 'UNPAID',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
  BEREAVEMENT = 'BEREAVEMENT',
}

export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export type User = UserSummary;

export interface EodReportTask {
  clientDetails: string;
  ticket: string;
  typeOfWorkDone: 'PLANNING' | 'RESEARCH' | 'IMPLEMENTATION' | 'TESTING';
  taskEstimatedTime?: number;
  timeSpentOnTicket: number;
  taskLifecycle: 'NEW' | 'RETURNED';
  taskStatus: 'IN_PROGRESS' | 'DONE';
}

export interface EodReport {
  id: string;
  userId: string;
  date: string;
  summary: string;
  tasksWorkedOn: Array<string | EodReportTask>;
  hoursWorked?: number | null;
  submittedAt: string;
  isLate: boolean;
  createdAt: string;
  updatedAt: string;
  user?: User;
}

// Employee
export interface Employee {
  id: string;
  userId: string;
  candidateId?: string | null;
  employeeNumber: string;
  department?: string | null;
  jobTitle: string;
  status: EmploymentStatus;
  contractType: ContractType;
  hireDate: string;
  terminationDate?: string | null;
  salary: number;
  salaryCurrency: string;
  managerId?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  documents?: any;
  createdAt: string;
  updatedAt: string;
  user?: User;
  leaveRequests?: LeaveRequest[];
  performanceReviews?: PerformanceReview[];
  eodReports?: EodReport[];
  _count?: {
    leaveRequests: number;
    performanceReviews: number;
    eodReports?: number;
  };
}

export interface EmployeeFilters {
  status?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface EmployeesListResponse {
  data: Employee[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

export interface CreateEmployeeDto {
  userId: string;
  candidateId?: string;
  employeeNumber: string;
  department?: string;
  jobTitle: string;
  status?: EmploymentStatus;
  contractType: ContractType;
  hireDate: string;
  terminationDate?: string;
  salary: number;
  salaryCurrency?: string;
  managerId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
}

export interface UpdateEmployeeDto extends Partial<CreateEmployeeDto> {}

export interface EmployeeStats {
  employee: Employee;
  stats: {
    totalLeaveRequests: number;
    approvedLeaves: number;
    pendingLeaves: number;
    performanceReviews: number;
    eodReports: number;
  };
}

// Performance Review
export interface PerformanceReview {
  id: string;
  employeeId: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  ratings: Record<string, any>;
  strengths?: string | null;
  improvements?: string | null;
  goals?: string | null;
  overallRating?: number | null;
  reviewedAt?: string | null;
  reviewerName?: string | null;
  pdfUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee & { user: User };
}

export interface CreatePerformanceReviewDto {
  employeeId: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  ratings: Record<string, any>;
  strengths?: string;
  improvements?: string;
  goals?: string;
  overallRating?: number;
  reviewedAt?: string;
  reviewerName?: string;
  pdfUrl?: string;
}

export interface UpdatePerformanceReviewDto extends Partial<CreatePerformanceReviewDto> {}

// Leave Request
export interface LeaveRequest {
  id: string;
  userId: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string | null;
  status: LeaveRequestStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee & { user: User };
  user?: User;
}

export interface CreateLeaveRequestDto {
  startDate: string;
  endDate: string;
  type: LeaveType;
  totalDays: number;
  reason?: string;
  status?: LeaveRequestStatus;
}

export interface UpdateLeaveRequestDto extends Partial<CreateLeaveRequestDto> {}

export interface ApproveLeaveDto {
  status: LeaveRequestStatus;
  rejectionReason?: string;
}

export interface LeaveBalance {
  year: number;
  totalAllowance: number;
  used: number;
  remaining: number;
  leaveRequests: LeaveRequest[];
}

export interface RemoteWorkLog {
  id: string;
  userId: string;
  employeeId: string;
  date: string;
  reason?: string | null;
  createdAt: string;
  employee?: Employee & { user: User };
  user?: User;
}

export interface RemoteWorkWindowState {
  isOpen: boolean;
  startDate?: string | null;
  endDate?: string | null;
  limit: number;
}

export interface SetRemotePreferencesPayload {
  dates: string[];
  reason?: string;
}

export interface OpenRemoteWindowPayload {
  startDate: string;
  endDate?: string;
}

export interface CreateEodReportDto {
  employeeId?: string;
  date: string;
  summary: string;
  tasks: EodReportTask[];
  hoursWorked?: number;
  submit?: boolean;
}

export interface UpdateEodReportDto extends Partial<CreateEodReportDto> {
  submit?: boolean;
  submittedAt?: string | null;
}

// National Holiday
export interface NationalHoliday {
  id: string;
  name: string;
  date: string;
  country: string;
  isRecurring: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHolidayDto {
  name: string;
  date: string;
  description?: string;
  isRecurring?: boolean;
}

export interface UpdateHolidayDto extends Partial<CreateHolidayDto> {}


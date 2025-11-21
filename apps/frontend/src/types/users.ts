export type UserRole =
  | 'ADMIN'
  | 'SALESPERSON'
  | 'ACCOUNT_MANAGER'
  | 'RECRUITER'
  | 'HR'
  | 'EMPLOYEE'
  | 'CONTENT_EDITOR';

export type UserSortField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'role'
  | 'createdAt'
  | 'lastLoginAt';

export interface UserCounts {
  assignedTasks: number;
  assignedLeads: number;
  assignedOpportunities: number;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  phone?: string | null;
  avatar?: string | null;
  dateOfBirth?: string | null;
  twoFactorEnabled: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    jobTitle?: string | null;
  } | null;
  _count?: UserCounts;
}

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

export interface UserDetail extends UserSummary {
  notificationSettings?: NotificationSettings | null;
  employee?: {
    id: string;
    jobTitle?: string | null;
  } | null;
}

export interface UserListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface UsersListResponse {
  data: UserSummary[];
  meta: UserListMeta;
}

export interface UserListFilters {
  search?: string;
  role?: UserRole;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: UserSortField;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateUserPayload {
  email: string;
  password?: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string | null;
  sendInvite?: boolean;
}

export interface UpdateUserPayload extends Partial<Omit<CreateUserPayload, 'password'>> {
  password?: string;
  isActive?: boolean;
}

export interface UpdateUserStatusPayload {
  isActive: boolean;
}

export interface ResetUserPasswordPayload {
  newPassword: string;
}

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  avatar?: string | null;
  dateOfBirth?: string | null;
  email?: string;
  currentPassword?: string;
  newPassword?: string;
}



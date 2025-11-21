import type { ContractType, EmploymentStatus, Employee } from '@/types/hr';
import type { UserRole } from '@/types/users';

// Recruitment types and DTOs

export enum CandidateStage {
  VALIDATION = 'VALIDATION',
  CULTURAL_INTERVIEW = 'CULTURAL_INTERVIEW',
  TECHNICAL_INTERVIEW = 'TECHNICAL_INTERVIEW',
  CUSTOMER_INTERVIEW = 'CUSTOMER_INTERVIEW',
  ON_HOLD = 'ON_HOLD',
  CUSTOMER_REVIEW = 'CUSTOMER_REVIEW',
  CONTRACT_PROPOSAL = 'CONTRACT_PROPOSAL',
  CONTRACT_SIGNING = 'CONTRACT_SIGNING',
  HIRED = 'HIRED',
  REJECTED = 'REJECTED',
}

export interface CandidateActivity {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  createdAt: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface CandidatePositionLink {
  id: string;
  candidateId: string;
  positionId: string;
  appliedAt: string;
  status: string;
  notes?: string | null;
  position?: OpenPositionSummary | null;
}

export interface CandidateRecruiter {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string | null;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  currentTitle?: string | null;
  yearsOfExperience?: number | null;
  skills: string[];
  resume?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  driveFolderId?: string | null;
  driveFolderUrl?: string | null;
  stage: CandidateStage;
  rating?: number | null;
  notes?: string | null;
  isActive: boolean;
  city?: string | null;
  country?: string | null;
  availableFrom?: string | null;
  expectedSalary?: number | null;
  salaryCurrency?: string | null;
  createdAt: string;
  updatedAt: string;
  positions?: CandidatePositionLink[];
  activities?: CandidateActivity[];
  employee?: Employee | null;
  recruiter?: CandidateRecruiter | null;
}

export interface CandidateFilters {
  search?: string;
  stage?: CandidateStage;
  positionId?: string;
  skills?: string[];
  hasOpenPosition?: boolean;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  recruiterId?: string;
}

export interface CreateCandidateDto {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  currentTitle?: string;
  yearsOfExperience?: number;
  skills?: string[];
  resume?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  stage?: CandidateStage;
  rating?: number;
  notes?: string;
  city?: string;
  country?: string;
  availableFrom?: string;
  expectedSalary?: number;
  salaryCurrency?: string;
  isActive?: boolean;
  recruiterId?: string;
}

export interface UpdateCandidateDto extends Partial<CreateCandidateDto> {}

export interface UpdateCandidateStageDto {
  stage: CandidateStage;
  note?: string;
}

export interface LinkCandidatePositionDto {
  positionId: string;
  appliedAt?: string;
  status?: string;
  notes?: string;
}

export interface CandidatePositionsResponse {
  id: string;
  candidateId: string;
  positionId: string;
  appliedAt: string;
  status: string;
  notes?: string | null;
  position: OpenPositionSummary;
}

export type PositionStatus = 'Open' | 'Filled' | 'Cancelled';
export type RecruitmentStatus = 'HEADHUNTING' | 'STANDARD';

export interface OpportunitySummary {
  id: string;
  title: string;
  value?: number | null;
  customer?: {
    id: string;
    name: string;
  };
  lead?: {
    id: string;
    title: string;
    leadType?: 'END_CUSTOMER' | 'INTERMEDIARY' | null;
  } | null;
}

export interface OpenPositionSummary {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  requirements?: string | null;
  status: PositionStatus;
  recruitmentStatus?: RecruitmentStatus | null;
  imageUrl?: string | null;
  isArchived?: boolean;
  createdAt: string;
  updatedAt: string;
  filledAt?: string | null;
  opportunity?: OpportunitySummary | null;
  candidates?: Array<{
    id: string;
    appliedAt: string;
    status: string;
    notes?: string | null;
    candidate: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      stage: CandidateStage;
      rating?: number | null;
      expectedSalary?: number | null;
    };
  }>;
}

export interface OpenPosition extends OpenPositionSummary {
  description: string;
  requirements?: string | null;
}

export interface PositionFilters {
  search?: string;
  status?: PositionStatus;
  customerId?: string;
  opportunityId?: string;
  candidateId?: string;
  keywords?: string[];
  isArchived?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreatePositionDto {
  title: string;
  slug?: string;
  description?: string;
  requirements?: string;
  status?: PositionStatus;
  recruitmentStatus?: RecruitmentStatus;
  opportunityId?: string;
  imageUrl?: string;
}

export interface UpdatePositionDto {
  title?: string;
  slug?: string;
  description?: string;
  requirements?: string;
  status?: PositionStatus;
  recruitmentStatus?: RecruitmentStatus;
  opportunityId?: string | null;
  imageUrl?: string;
}

export interface ClosePositionDto {
  filledAt?: string;
  note?: string;
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface ConvertCandidateUserOptions {
  password?: string;
  phone?: string;
  role?: UserRole;
}

export interface ConvertCandidateToEmployeePayload {
  userId?: string;
  autoGeneratePassword?: boolean;
  user?: ConvertCandidateUserOptions;
  employeeNumber: string;
  department?: string;
  jobTitle?: string;
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

export interface ConvertCandidateToEmployeeResponse {
  employee: Employee;
  candidate: Candidate;
  temporaryPassword?: string;
}

export interface MarkInactivePayload {
  reason?: string;
  sendEmail?: boolean;
  templateId?: string;
  emailSubject?: string;
  emailBody?: string;
  emailTo?: string;
}



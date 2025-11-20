import type { UserSummary } from '../users';

export enum CheckInOutStatus {
  IN = 'IN',
  OUT = 'OUT',
}

export interface CheckInOut {
  id: string;
  employeeId: string;
  dateTime: string;
  status: CheckInOutStatus;
  importedAt?: string | null;
  importedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    userId: string;
    employeeNumber: string;
    user?: UserSummary;
  };
  importedByUser?: UserSummary;
}

export interface CreateCheckInOutDto {
  employeeId: string;
  dateTime: string;
  status: CheckInOutStatus;
}

export interface UpdateCheckInOutDto {
  employeeId?: string;
  dateTime?: string;
  status?: CheckInOutStatus;
}

export interface FilterCheckInOutsDto {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: CheckInOutStatus;
  page?: number;
  pageSize?: number;
}

export interface CheckInOutsListResponse {
  data: CheckInOut[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}


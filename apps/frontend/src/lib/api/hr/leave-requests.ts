import { apiClient } from '../client';
import type {
  LeaveRequest,
  CreateLeaveRequestDto,
  UpdateLeaveRequestDto,
  ApproveLeaveDto,
  LeaveBalance,
} from '@/types/hr';

export const leaveRequestsApi = {
  // Get all leave requests
  getAll: async (params?: {
    employeeId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const { data } = await apiClient.get<LeaveRequest[]>('/hr/leave-requests', { params });
    return data;
  },

  // Get pending leave requests
  getPending: async () => {
    const { data } = await apiClient.get<LeaveRequest[]>('/hr/leave-requests/pending');
    return data;
  },

  // Get current user's leave requests
  getMyRequests: async () => {
    const { data } = await apiClient.get<LeaveRequest[]>('/hr/leave-requests/my-requests');
    return data;
  },

  // Get leave request by ID
  getById: async (id: string) => {
    const { data } = await apiClient.get<LeaveRequest>(`/hr/leave-requests/${id}`);
    return data;
  },

  // Get employee leave balance
  getBalance: async (employeeId: string, year?: number) => {
    const { data } = await apiClient.get<LeaveBalance>(`/hr/leave-requests/balance/${employeeId}`, {
      params: { year },
    });
    return data;
  },

  // Create leave request
  create: async (dto: CreateLeaveRequestDto) => {
    const { data } = await apiClient.post<LeaveRequest>('/hr/leave-requests', dto);
    return data;
  },

  // Update leave request
  update: async (id: string, dto: UpdateLeaveRequestDto) => {
    const { data } = await apiClient.patch<LeaveRequest>(`/hr/leave-requests/${id}`, dto);
    return data;
  },

  // Approve or reject leave request
  approve: async (id: string, dto: ApproveLeaveDto) => {
    const { data } = await apiClient.post<LeaveRequest>(`/hr/leave-requests/${id}/approve`, dto);
    return data;
  },

  // Cancel leave request
  cancel: async (id: string) => {
    const { data } = await apiClient.post<LeaveRequest>(`/hr/leave-requests/${id}/cancel`);
    return data;
  },
};


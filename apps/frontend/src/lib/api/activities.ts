import { apiClient } from './client';
import type {
  Activity,
  ActivityListResponse,
  ActivityType,
  ActivityTypePayload,
  ActivityTypeUpdatePayload,
  CreateActivityPayload,
  UpdateActivityPayload,
} from '@/types/activities';

export interface ActivityFilters {
  search?: string;
  activityTypeId?: string;
  visibility?: 'PUBLIC' | 'TEAM' | 'PRIVATE';
  customerId?: string;
  leadId?: string;
  opportunityId?: string;
  candidateId?: string;
  employeeId?: string;
  contactId?: string;
  taskId?: string;
  assignedToId?: string;
  isPinned?: boolean;
  isCompleted?: boolean;
  activityDateFrom?: string;
  activityDateTo?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: 'createdAt' | 'activityDate' | 'reminderAt' | 'subject';
  sortOrder?: 'asc' | 'desc';
}

export const activitiesApi = {
  list: async (filters: ActivityFilters = {}) => {
    const { data } = await apiClient.get<ActivityListResponse>('/activities', { params: filters });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<Activity>(`/activities/${id}`);
    return data;
  },

  create: async (payload: CreateActivityPayload) => {
    const { data } = await apiClient.post<Activity>('/activities', payload);
    return data;
  },

  update: async (id: string, payload: UpdateActivityPayload) => {
    const { data } = await apiClient.patch<Activity>(`/activities/${id}`, payload);
    return data;
  },

  remove: async (id: string) => {
    await apiClient.delete(`/activities/${id}`);
  },

  togglePin: async (id: string, isPinned: boolean) => {
    const { data } = await apiClient.patch<Activity>(`/activities/${id}/pin`, { isPinned });
    return data;
  },

  toggleComplete: async (id: string, isCompleted: boolean) => {
    const { data } = await apiClient.patch<Activity>(`/activities/${id}/complete`, { isCompleted });
    return data;
  },

  listTypes: async (includeInactive = false) => {
    const { data } = await apiClient.get<ActivityType[]>('/settings/activity-types', {
      params: includeInactive ? { includeInactive: true } : undefined,
    });
    return data;
  },

  createType: async (payload: ActivityTypePayload) => {
    const { data } = await apiClient.post<ActivityType>('/settings/activity-types', payload);
    return data;
  },

  updateType: async (id: string, payload: ActivityTypeUpdatePayload) => {
    const { data } = await apiClient.patch<ActivityType>(`/settings/activity-types/${id}`, payload);
    return data;
  },

  deleteType: async (id: string) => {
    await apiClient.delete(`/settings/activity-types/${id}`);
  },
};



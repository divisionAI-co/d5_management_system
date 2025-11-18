import { apiClient } from './client';
import type {
  CreateTaskPayload,
  Task,
  TaskEodLinkResponse,
  TaskFilters,
  TasksKanbanResponse,
  UpdateTaskPayload,
  UpdateTaskStatusPayload,
} from '@/types/tasks';

export const tasksApi = {
  list: async (filters: TaskFilters = {}) => {
    const { data } = await apiClient.get<TasksKanbanResponse>('/tasks', {
      params: filters,
    });
    return data;
  },

  getById: async (id: string) => {
    const { data } = await apiClient.get<Task>(`/tasks/${id}`);
    return data;
  },

  create: async (payload: CreateTaskPayload) => {
    const { data } = await apiClient.post<Task>('/tasks', payload);
    return data;
  },

  update: async (id: string, payload: UpdateTaskPayload) => {
    const { data } = await apiClient.patch<Task>(`/tasks/${id}`, payload);
    return data;
  },

  updateStatus: async (id: string, payload: UpdateTaskStatusPayload) => {
    const { data } = await apiClient.patch<Task>(
      `/tasks/${id}/status`,
      payload,
    );
    return data;
  },

  remove: async (id: string) => {
    const { data } = await apiClient.delete<{ deleted: boolean }>(
      `/tasks/${id}`,
    );
    return data;
  },

  addToEod: async (id: string) => {
    const { data } = await apiClient.post<TaskEodLinkResponse>(
      `/tasks/${id}/add-to-eod`,
    );
    return data;
  },

  logTime: async (id: string, hours: number, description?: string) => {
    const { data } = await apiClient.post<Task>(`/tasks/${id}/log-time`, {
      hours,
      description,
    });
    return data;
  },
};



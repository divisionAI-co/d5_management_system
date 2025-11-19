import { apiClient } from './client';
import type {
  CreateTaskPayload,
  Task,
  TaskEodLinkResponse,
  TaskFilters,
  TasksKanbanResponse,
  UpdateTaskPayload,
  UpdateTaskStatusPayload,
  TaskTemplate,
  CreateTaskTemplatePayload,
  UpdateTaskTemplatePayload,
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

  // Task Templates (Recurring Tasks)
  templates: {
    list: async () => {
      const { data } = await apiClient.get<TaskTemplate[]>('/tasks/templates');
      return data;
    },

    getById: async (id: string) => {
      const { data } = await apiClient.get<TaskTemplate>(`/tasks/templates/${id}`);
      return data;
    },

    create: async (payload: CreateTaskTemplatePayload) => {
      const { data } = await apiClient.post<TaskTemplate>('/tasks/templates', payload);
      return data;
    },

    update: async (id: string, payload: UpdateTaskTemplatePayload) => {
      const { data } = await apiClient.patch<TaskTemplate>(`/tasks/templates/${id}`, payload);
      return data;
    },

    remove: async (id: string) => {
      const { data } = await apiClient.delete<{ message: string }>(`/tasks/templates/${id}`);
      return data;
    },
  },
};



import { apiClient } from '../client';
import type {
  Employee,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  EmployeeStats,
  EmployeeFilters,
  EmployeesListResponse,
} from '@/types/hr';

export const employeesApi = {
  // Get all employees
  getAll: async (params: EmployeeFilters = {}) => {
    const { data } = await apiClient.get<EmployeesListResponse>('/hr/employees', {
      params,
    });
    return data;
  },

  // Get employee by ID
  getById: async (id: string) => {
    const { data } = await apiClient.get<Employee>(`/hr/employees/${id}`);
    return data;
  },

  // Get employee by user ID
  getByUserId: async (userId: string) => {
    const { data } = await apiClient.get<Employee>(`/hr/employees/user/${userId}`);
    return data;
  },

  // Get employee statistics
  getStats: async (id: string) => {
    const { data } = await apiClient.get<EmployeeStats>(`/hr/employees/${id}/stats`);
    return data;
  },

  // Get all departments
  getDepartments: async () => {
    const { data } = await apiClient.get<string[]>('/hr/employees/departments');
    return data;
  },

  // Create employee
  create: async (dto: CreateEmployeeDto) => {
    const { data } = await apiClient.post<Employee>('/hr/employees', dto);
    return data;
  },

  // Update employee
  update: async (id: string, dto: UpdateEmployeeDto) => {
    const { data } = await apiClient.patch<Employee>(`/hr/employees/${id}`, dto);
    return data;
  },

  // Delete employee
  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/hr/employees/${id}`);
    return data;
  },
};


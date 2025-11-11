import { apiClient } from '../client';
import type { NationalHoliday, CreateHolidayDto, UpdateHolidayDto } from '@/types/hr';

export const holidaysApi = {
  // Get all holidays
  getAll: async (year?: number) => {
    const params = typeof year === 'number' ? { year } : undefined;
    const { data } = await apiClient.get<NationalHoliday[]>('/hr/holidays', {
      params,
    });
    return data;
  },

  // Get upcoming holidays
  getUpcoming: async (daysAhead?: number) => {
    const { data } = await apiClient.get<NationalHoliday[]>('/hr/holidays/upcoming', {
      params: { daysAhead },
    });
    return data;
  },

  // Get holiday by ID
  getById: async (id: string) => {
    const { data } = await apiClient.get<NationalHoliday>(`/hr/holidays/${id}`);
    return data;
  },

  // Create holiday
  create: async (dto: CreateHolidayDto) => {
    const { data } = await apiClient.post<NationalHoliday>('/hr/holidays', dto);
    return data;
  },

  // Update holiday
  update: async (id: string, dto: UpdateHolidayDto) => {
    const { data} = await apiClient.patch<NationalHoliday>(`/hr/holidays/${id}`, dto);
    return data;
  },

  // Delete holiday
  delete: async (id: string) => {
    const { data } = await apiClient.delete(`/hr/holidays/${id}`);
    return data;
  },
};


import apiClient from '@/lib/api/client';
import type {
  ClosePositionDto,
  CreatePositionDto,
  OpenPosition,
  OpenPositionSummary,
  PaginatedResponse,
  PositionFilters,
  UpdatePositionDto,
} from '@/types/recruitment';

export const positionsApi = {
  async list(filters?: PositionFilters) {
    const { data } = await apiClient.get<PaginatedResponse<OpenPositionSummary>>(
      '/recruitment/positions',
      {
        params: filters,
      },
    );
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<OpenPosition>(
      `/recruitment/positions/${id}`,
    );
    return data;
  },

  async create(payload: CreatePositionDto) {
    const { data } = await apiClient.post<OpenPosition>(
      '/recruitment/positions',
      payload,
    );
    return data;
  },

  async update(id: string, payload: UpdatePositionDto) {
    const { data } = await apiClient.patch<OpenPosition>(
      `/recruitment/positions/${id}`,
      payload,
    );
    return data;
  },

  async close(id: string, payload: ClosePositionDto) {
    const { data } = await apiClient.post<OpenPosition>(
      `/recruitment/positions/${id}/close`,
      payload,
    );
    return data;
  },

  async getCandidates(id: string) {
    const { data } = await apiClient.get<
      Array<{
        id: string;
        candidateId: string;
        positionId: string;
        appliedAt: string;
        status: string;
        notes?: string | null;
        candidate: {
          id: string;
          firstName: string;
          lastName: string;
          email: string;
          stage: string;
          rating?: number | null;
          expectedSalary?: number | null;
        };
      }>
    >(`/recruitment/positions/${id}/candidates`);
    return data;
  },

  async delete(id: string) {
    const { data } = await apiClient.delete<{ message: string; id: string }>(
      `/recruitment/positions/${id}`,
    );
    return data;
  },

  async archive(id: string) {
    const { data } = await apiClient.patch<OpenPosition>(
      `/recruitment/positions/${id}/archive`,
    );
    return data;
  },

  async unarchive(id: string) {
    const { data } = await apiClient.patch<OpenPosition>(
      `/recruitment/positions/${id}/unarchive`,
    );
    return data;
  },
};



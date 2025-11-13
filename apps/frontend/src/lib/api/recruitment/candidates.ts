import apiClient from '@/lib/api/client';
import type {
  Candidate,
  CandidateFilters,
  CandidatePositionsResponse,
  ConvertCandidateToEmployeePayload,
  ConvertCandidateToEmployeeResponse,
  CreateCandidateDto,
  LinkCandidatePositionDto,
  MarkInactivePayload,
  PaginatedResponse,
  UpdateCandidateDto,
  UpdateCandidateStageDto,
} from '@/types/recruitment';

export const candidatesApi = {
  async list(filters?: CandidateFilters) {
    const { data } = await apiClient.get<PaginatedResponse<Candidate>>(
      '/recruitment/candidates',
      {
        params: filters,
      },
    );
    return data;
  },

  async create(payload: CreateCandidateDto) {
    const { data } = await apiClient.post<Candidate>(
      '/recruitment/candidates',
      payload,
    );
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get<Candidate>(
      `/recruitment/candidates/${id}`,
    );
    return data;
  },

  async update(id: string, payload: UpdateCandidateDto) {
    const { data } = await apiClient.patch<Candidate>(
      `/recruitment/candidates/${id}`,
      payload,
    );
    return data;
  },

  async updateStage(id: string, payload: UpdateCandidateStageDto) {
    const { data } = await apiClient.patch<Candidate>(
      `/recruitment/candidates/${id}/stage`,
      payload,
    );
    return data;
  },

  async linkPosition(id: string, payload: LinkCandidatePositionDto) {
    const { data } = await apiClient.post<Candidate>(
      `/recruitment/candidates/${id}/link-position`,
      payload,
    );
    return data;
  },

  async getPositions(id: string) {
    const { data } = await apiClient.get<CandidatePositionsResponse[]>(
      `/recruitment/candidates/${id}/positions`,
    );
    return data;
  },

  async convertToEmployee(id: string, payload: ConvertCandidateToEmployeePayload) {
    const { data } = await apiClient.post<ConvertCandidateToEmployeeResponse>(
      `/recruitment/candidates/${id}/convert-to-employee`,
      payload,
    );
    return data;
  },

  async archive(id: string) {
    const { data } = await apiClient.patch<Candidate>(
      `/recruitment/candidates/${id}/archive`,
    );
    return data;
  },

  async restore(id: string) {
    const { data } = await apiClient.patch<Candidate>(
      `/recruitment/candidates/${id}/restore`,
    );
    return data;
  },

  async delete(id: string) {
    const { data } = await apiClient.delete<{ success: boolean; message: string }>(
      `/recruitment/candidates/${id}`,
    );
    return data;
  },

  async markInactive(id: string, payload: MarkInactivePayload) {
    const { data } = await apiClient.patch<Candidate>(
      `/recruitment/candidates/${id}/mark-inactive`,
      payload,
    );
    return data;
  },
};



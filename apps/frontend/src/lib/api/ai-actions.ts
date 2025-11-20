import { apiClient } from './client';
import type {
  AiActionAttachment,
  AiActionExecution,
  AiActionPayload,
  AiActionSummary,
  AiActionUpdatePayload,
  AiCollectionDefinition,
  AiCollectionFieldDefinition,
  AiCollectionKey,
  AiEntityType,
  AiFieldDefinition,
  ListAiActionsParams,
} from '@/types/ai-actions';

export interface ExecuteSavedActionPayload {
  entityId?: string; // Optional: omit to run on all records
  fieldKeys?: string[];
  promptOverride?: string;
  extraInstructions?: string;
}

export interface ExecuteAdhocActionPayload {
  entityType: AiEntityType;
  entityId?: string; // Optional: omit to run on all records
  prompt: string;
  fieldKeys: string[];
  model?: string;
  extraInstructions?: string;
}

export const aiActionsApi = {
  async list(params: ListAiActionsParams = {}) {
    const { data } = await apiClient.get<AiActionSummary[]>('/ai/actions', {
      params,
    });
    return data;
  },

  async get(actionId: string) {
    const { data } = await apiClient.get<AiActionSummary>(`/ai/actions/${actionId}`);
    return data;
  },

  async create(payload: AiActionPayload) {
    const { data } = await apiClient.post<AiActionSummary>('/ai/actions', payload);
    return data;
  },

  async update(actionId: string, payload: AiActionUpdatePayload) {
    const { data } = await apiClient.patch<AiActionSummary>(`/ai/actions/${actionId}`, payload);
    return data;
  },

  async remove(actionId: string) {
    const { data } = await apiClient.delete<{ id: string }>(`/ai/actions/${actionId}`);
    return data;
  },

  async listFields(entityType: AiEntityType) {
    const { data } = await apiClient.get<AiFieldDefinition[]>(`/ai/actions/fields/${entityType}`);
    return data;
  },

  async listCollectionDefinitions(entityType: AiEntityType) {
    const { data } = await apiClient.get<AiCollectionDefinition[]>(`/ai/actions/collections/${entityType}`);
    return data;
  },

  async listCollectionFields(entityType: AiEntityType, collectionKey: AiCollectionKey) {
    const { data } = await apiClient.get<AiCollectionFieldDefinition[]>(
      `/ai/actions/collections/${entityType}/${collectionKey}/fields`,
    );
    return data;
  },

  async listAttachments(params: { entityType: AiEntityType; entityId: string }) {
    const { data } = await apiClient.get<AiActionAttachment[]>('/ai/actions/attachments', {
      params,
    });
    return data;
  },

  async attach(actionId: string, entityId: string) {
    const { data } = await apiClient.post<AiActionAttachment>(`/ai/actions/${actionId}/attachments`, {
      entityId,
    });
    return data;
  },

  async detach(attachmentId: string) {
    const { data } = await apiClient.delete<{ id: string; detachedBy: string }>(
      `/ai/actions/attachments/${attachmentId}`,
    );
    return data;
  },

  async executeSaved(actionId: string, payload: ExecuteSavedActionPayload) {
    const { data } = await apiClient.post<AiActionExecution>(`/ai/actions/${actionId}/execute`, payload);
    return data;
  },

  async executeAdhoc(payload: ExecuteAdhocActionPayload) {
    const { data } = await apiClient.post<AiActionExecution>('/ai/actions/execute', payload);
    return data;
  },

  async listExecutions(params: {
    entityType?: AiEntityType;
    entityId?: string;
    actionId?: string;
    limit?: number;
  } = {}) {
    const { data } = await apiClient.get<AiActionExecution[]>('/ai/actions/executions', {
      params,
    });
    return data;
  },

  async applyChanges(executionId: string) {
    const { data } = await apiClient.post<AiActionExecution>(`/ai/actions/executions/${executionId}/apply`);
    return data;
  },
};



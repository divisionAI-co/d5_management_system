export type AiEntityType =
  | 'CUSTOMER'
  | 'LEAD'
  | 'OPPORTUNITY'
  | 'CANDIDATE'
  | 'EMPLOYEE'
  | 'CONTACT'
  | 'TASK';

export type AiCollectionKey = 'EOD_REPORTS' | 'OPPORTUNITIES' | 'LEADS' | 'TASKS' | 'ACTIVITIES';
export type AiCollectionFormat = 'TABLE' | 'BULLET_LIST' | 'PLAIN_TEXT';

export interface AiActionField {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  order: number;
  metadata?: Record<string, unknown> | null;
}

export interface AiFieldDefinition {
  key: string;
  label: string;
  description?: string;
}

export interface AiCollectionFieldDefinition {
  key: string;
  label: string;
  description?: string;
}

export interface AiCollectionDefinition {
  collectionKey: AiCollectionKey;
  label: string;
  description?: string;
  defaultLimit: number;
  defaultFormat: AiCollectionFormat;
  supportedFormats: AiCollectionFormat[];
}

export interface AiActionCollectionSummary {
  id?: string;
  collectionKey: AiCollectionKey;
  label: string;
  description?: string | null;
  format: AiCollectionFormat;
  limit?: number;
  order: number;
  metadata?: Record<string, unknown> | null;
  fields: Array<{
    id?: string;
    fieldKey: string;
    fieldLabel: string;
    order: number;
    metadata?: Record<string, unknown> | null;
  }>;
}

export interface AiActionSummary {
  id: string;
  name: string;
  description?: string | null;
  promptTemplate: string;
  entityType: AiEntityType;
  model?: string | null;
  isActive: boolean;
  isSystem: boolean;
  fields: AiActionField[];
  collections: AiActionCollectionSummary[];
  createdAt: string;
  updatedAt: string;
  _count?: {
    attachments: number;
    executions: number;
  };
}

export interface AiActionAttachment {
  id: string;
  actionId: string;
  entityType: AiEntityType;
  entityId: string;
  attachedById?: string | null;
  createdAt: string;
  action: {
    id: string;
    name: string;
    description?: string | null;
    promptTemplate: string;
    model?: string | null;
    fields: AiActionField[];
    collections: AiActionCollectionSummary[];
    isActive: boolean;
  };
}

export type AiActionExecutionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';

export interface AiActionExecution {
  id: string;
  actionId?: string | null;
  attachmentId?: string | null;
  entityType: AiEntityType;
  entityId: string;
  prompt: string;
  inputs?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  rawOutput?: string | null;
  status: AiActionExecutionStatus;
  errorMessage?: string | null;
  triggeredById?: string | null;
  activityId?: string | null;
  createdAt: string;
  completedAt?: string | null;
  action?: {
    id: string;
    name: string;
    entityType: AiEntityType;
  } | null;
  attachment?: {
    id: string;
    entityType: AiEntityType;
    entityId: string;
  } | null;
}

export interface AiCollectionPayload {
  collectionKey: AiCollectionKey;
  format?: AiCollectionFormat;
  limit?: number;
  metadata?: Record<string, unknown>;
  fields: Array<{
    fieldKey: string;
    fieldLabel: string;
    metadata?: Record<string, unknown>;
    order?: number;
  }>;
}

export interface AiActionPayload {
  name: string;
  description?: string;
  promptTemplate: string;
  entityType: AiEntityType;
  model?: string;
  isActive?: boolean;
  fields: Array<{
    fieldKey: string;
    fieldLabel: string;
    metadata?: Record<string, unknown>;
    order?: number;
  }>;
  collections?: AiCollectionPayload[];
}

export interface ListAiActionsParams {
  entityType?: AiEntityType;
  includeInactive?: boolean;
}

export type AiActionUpdatePayload = Partial<AiActionPayload>;



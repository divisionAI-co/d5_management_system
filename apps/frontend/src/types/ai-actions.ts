export type AiEntityType =
  | 'CUSTOMER'
  | 'LEAD'
  | 'OPPORTUNITY'
  | 'CANDIDATE'
  | 'EMPLOYEE'
  | 'CONTACT'
  | 'TASK'
  | 'QUOTE'
  | 'RECRUITER_PERFORMANCE_REPORT'
  | 'SALES_PERFORMANCE_REPORT';

export type AiCollectionKey = 'EOD_REPORTS' | 'OPPORTUNITIES' | 'LEADS' | 'QUOTES' | 'TASKS' | 'ACTIVITIES' | 'FEEDBACK_REPORTS' | 'CHECK_IN_OUTS' | 'RECRUITER_PERFORMANCE_REPORTS' | 'SALES_PERFORMANCE_REPORTS';
export type AiCollectionFormat = 'TABLE' | 'BULLET_LIST' | 'PLAIN_TEXT';

export interface AiCollectionFilterDefinition {
  key: string;
  label: string;
  type: 'date' | 'text' | 'select' | 'boolean' | 'number';
  description?: string;
  options?: Array<{ value: string; label: string }>;
  multi?: boolean;
}

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
  filters?: AiCollectionFilterDefinition[];
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

export interface AiActionFieldMapping {
  id: string;
  sourceKey: string;
  targetField: string;
  transformRule?: string | null;
  order: number;
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
  operationType?: AiActionOperationType;
  fields: AiActionField[];
  collections: AiActionCollectionSummary[];
  fieldMappings?: AiActionFieldMapping[];
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
    operationType?: AiActionOperationType;
    fieldMappings?: AiActionFieldMapping[];
  };
}

export type AiActionExecutionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';
export type AiActionOperationType = 'READ_ONLY' | 'UPDATE' | 'CREATE';

export interface ProposedChanges {
  operation: 'UPDATE' | 'CREATE';
  entityType: AiEntityType;
  entityId: string | null;
  fields: Record<string, {
    oldValue: unknown;
    newValue: unknown;
    sourceKey: string;
  }>;
}

export interface AppliedChanges extends ProposedChanges {
  appliedAt: string;
  createdEntityId?: string;
}

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
  proposedChanges?: ProposedChanges | null;
  appliedChanges?: AppliedChanges | null;
  appliedAt?: string | null;
  createdAt: string;
  completedAt?: string | null;
  action?: {
    id: string;
    name: string;
    entityType: AiEntityType;
    operationType?: AiActionOperationType;
    fieldMappings?: AiActionFieldMapping[];
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

export interface AiActionFieldMappingPayload {
  sourceKey: string;
  targetField: string;
  transformRule?: string;
  order?: number;
}

export interface AiActionPayload {
  name: string;
  description?: string;
  promptTemplate: string;
  entityType: AiEntityType;
  model?: string;
  isActive?: boolean;
  operationType?: AiActionOperationType;
  fields: Array<{
    fieldKey: string;
    fieldLabel: string;
    metadata?: Record<string, unknown>;
    order?: number;
  }>;
  collections?: AiCollectionPayload[];
  fieldMappings?: AiActionFieldMappingPayload[];
}

export interface ListAiActionsParams {
  entityType?: AiEntityType;
  includeInactive?: boolean;
}

export type AiActionUpdatePayload = Partial<AiActionPayload>;



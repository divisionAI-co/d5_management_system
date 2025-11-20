export interface ImportFieldMetadata {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

export interface UploadBaseResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: ImportFieldMetadata[];
  suggestedMappings?: Array<{ sourceColumn: string; targetField: string }>;
}

export interface ImportSummaryBase {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

export interface MapPayloadBase {
  mappings: Array<{
    sourceColumn: string;
    targetField: string;
  }>;
  ignoredColumns?: string[];
}

export interface ExecutePayloadBase {
  updateExisting?: boolean;
}

export type UploadContactsResult = UploadBaseResult;
export type ContactImportSummary = ImportSummaryBase;
export interface ContactMapPayload extends MapPayloadBase {}
export interface ExecuteContactImportPayload extends ExecutePayloadBase {
  defaultCustomerId?: string;
}

export type UploadLeadsResult = UploadBaseResult;
export type LeadsImportSummary = ImportSummaryBase;
export interface LeadMapPayload extends MapPayloadBase {}
export interface ExecuteLeadImportPayload extends ExecutePayloadBase {
  defaultOwnerEmail?: string;
  defaultStatus?: string;
}

export type UploadOpportunitiesResult = UploadBaseResult;
export type OpportunitiesImportSummary = ImportSummaryBase;
export interface OpportunityMapPayload extends MapPayloadBase {}
export interface ExecuteOpportunityImportPayload extends ExecutePayloadBase {
  defaultOwnerEmail?: string;
  defaultCustomerId?: string;
  defaultStage?: string;
}

export type UploadEmployeesResult = UploadBaseResult;
export type EmployeeImportSummary = ImportSummaryBase;
export interface EmployeeMapPayload extends MapPayloadBase {}
export interface ExecuteEmployeeImportPayload extends ExecutePayloadBase {
  defaultRole?: string;
  defaultStatus?: string;
  defaultContractType?: string;
  defaultManagerEmail?: string;
  defaultSalaryCurrency?: string;
  defaultPassword?: string;
}

export type UploadEodResult = UploadBaseResult;
export type EodImportSummary = ImportSummaryBase;
export interface EodMapPayload extends MapPayloadBase {}
export interface ExecuteEodImportPayload extends ExecutePayloadBase {
  markMissingAsSubmitted?: boolean;
  defaultIsLate?: boolean;
  useLegacyFormat?: boolean;
}

export type UploadInvoicesResult = UploadBaseResult;
export type InvoicesImportSummary = ImportSummaryBase;
export interface InvoiceMapPayload extends MapPayloadBase {}
export interface ExecuteInvoiceImportPayload extends ExecutePayloadBase {
  defaultStatus?: string;
  defaultCurrency?: string;
  defaultCustomerEmail?: string;
  defaultCustomerName?: string;
  defaultCreatedByEmail?: string;
  isOdooImport?: boolean;
}

export type UploadCandidatesResult = UploadBaseResult;
export type CandidatesImportSummary = ImportSummaryBase;
export interface CandidateMapPayload extends MapPayloadBase {}
export interface ExecuteCandidateImportPayload extends ExecutePayloadBase {
  defaultStage?: string;
  defaultSalaryCurrency?: string;
  isOdooImport?: boolean;
}

export type UploadCheckInOutResult = UploadBaseResult;
export type CheckInOutImportSummary = ImportSummaryBase;
export interface CheckInOutMapPayload extends MapPayloadBase {}
export interface ExecuteCheckInOutImportPayload extends ExecutePayloadBase {
  manualMatches?: {
    employees?: Record<string, string>;
  };
}



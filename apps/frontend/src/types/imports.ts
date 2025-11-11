export type CrmImportType = 'contacts' | 'leads' | 'opportunities';

export interface ImportFieldMetadata {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

export interface UploadImportResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: ImportFieldMetadata[];
}

export type UploadContactsResult = UploadImportResult;

export interface FieldMappingEntry {
  sourceColumn: string;
  targetField: string;
}

export interface MapImportPayload {
  mappings: FieldMappingEntry[];
  ignoredColumns?: string[];
}

export interface ExecuteImportPayload {
  updateExisting?: boolean;
  defaultCustomerId?: string;
}

export interface ContactImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}



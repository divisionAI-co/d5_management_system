import { apiClient } from './client';
import type {
  ContactImportSummary,
  LeadsImportSummary,
  OpportunitiesImportSummary,
  EmployeeImportSummary,
  EodImportSummary,
  CheckInOutImportSummary,
  InvoicesImportSummary,
  CandidatesImportSummary,
  ContactMapPayload,
  LeadMapPayload,
  OpportunityMapPayload,
  EmployeeMapPayload,
  EodMapPayload,
  CheckInOutMapPayload,
  InvoiceMapPayload,
  CandidateMapPayload,
  ExecuteContactImportPayload,
  ExecuteLeadImportPayload,
  ExecuteOpportunityImportPayload,
  ExecuteEmployeeImportPayload,
  ExecuteEodImportPayload,
  ExecuteCheckInOutImportPayload,
  ExecuteInvoiceImportPayload,
  ExecuteCandidateImportPayload,
  UploadContactsResult,
  UploadLeadsResult,
  UploadOpportunitiesResult,
  UploadEmployeesResult,
  UploadEodResult,
  UploadCheckInOutResult,
  UploadInvoicesResult,
  UploadCandidatesResult,
} from '@/types/imports';

const multipartHeaders = { 'Content-Type': 'multipart/form-data' };

const uploadCsv = async <T>(url: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<T>(url, formData, {
    headers: multipartHeaders,
  });
  return data;
};

export const contactImportsApi = {
  upload: async (file: File) =>
    uploadCsv<UploadContactsResult>('/imports/upload', file),

  saveMapping: async (importId: string, payload: ContactMapPayload) => {
    const { data } = await apiClient.post(`/imports/${importId}/map`, payload);
    return data;
  },

  execute: async (
    importId: string,
    payload: ExecuteContactImportPayload,
  ) => {
    const { data } = await apiClient.post<ContactImportSummary>(
      `/imports/${importId}/execute`,
      payload,
    );
    return data;
  },
};

export const leadsImportsApi = {
  upload: async (file: File) =>
    uploadCsv<UploadLeadsResult>('/imports/leads/upload', file),

  saveMapping: async (importId: string, payload: LeadMapPayload) => {
    const { data } = await apiClient.post(
      `/imports/leads/${importId}/map`,
      payload,
    );
    return data;
  },

  execute: async (importId: string, payload: ExecuteLeadImportPayload) => {
    const { data } = await apiClient.post<LeadsImportSummary>(
      `/imports/leads/${importId}/execute`,
      payload,
    );
    return data;
  },
};

export const opportunitiesImportsApi = {
  upload: async (file: File) =>
    uploadCsv<UploadOpportunitiesResult>(
      '/imports/opportunities/upload',
      file,
    ),

  saveMapping: async (
    importId: string,
    payload: OpportunityMapPayload,
  ) => {
    const { data } = await apiClient.post(
      `/imports/opportunities/${importId}/map`,
      payload,
    );
    return data;
  },

  validate: async (importId: string) => {
    const { data } = await apiClient.get<{
      unmatchedCustomers: string[];
      unmatchedOwners: string[];
    }>(`/imports/opportunities/${importId}/validate`);
    return data;
  },

  execute: async (
    importId: string,
    payload: ExecuteOpportunityImportPayload,
  ) => {
    const { data } = await apiClient.post<OpportunitiesImportSummary>(
      `/imports/opportunities/${importId}/execute`,
      payload,
    );
    return data;
  },
};

export const employeesImportsApi = {
  upload: async (file: File) =>
    uploadCsv<UploadEmployeesResult>('/imports/employees/upload', file),

  saveMapping: async (importId: string, payload: EmployeeMapPayload) => {
    const { data } = await apiClient.post(
      `/imports/employees/${importId}/map`,
      payload,
    );
    return data;
  },

  execute: async (
    importId: string,
    payload: ExecuteEmployeeImportPayload,
  ) => {
    const { data } = await apiClient.post<EmployeeImportSummary>(
      `/imports/employees/${importId}/execute`,
      payload,
    );
    return data;
  },
};

export const eodImportsApi = {
  upload: async (file: File) =>
    uploadCsv<UploadEodResult>('/imports/eod/upload', file),

  saveMapping: async (importId: string, payload: EodMapPayload) => {
    const { data } = await apiClient.post(`/imports/eod/${importId}/map`, payload);
    return data;
  },

  validate: async (importId: string) => {
    const { data } = await apiClient.get<{
      unmatchedEmployees: string[];
    }>(`/imports/eod/${importId}/validate`);
    return data;
  },

  execute: async (importId: string, payload: ExecuteEodImportPayload) => {
    const { data } = await apiClient.post<EodImportSummary>(
      `/imports/eod/${importId}/execute`,
      payload,
    );
    return data;
  },
};

export const invoicesImportsApi = {
  upload: async (file: File) =>
    uploadCsv<UploadInvoicesResult>('/imports/invoices/upload', file),

  saveMapping: async (importId: string, payload: InvoiceMapPayload) => {
    const { data } = await apiClient.post(`/imports/invoices/${importId}/map`, payload);
    return data;
  },

  execute: async (importId: string, payload: ExecuteInvoiceImportPayload) => {
    const { data } = await apiClient.post<InvoicesImportSummary>(
      `/imports/invoices/${importId}/execute`,
      payload,
    );
    return data;
  },
};

export const candidatesImportsApi = {
  upload: async (file: File) =>
    uploadCsv<UploadCandidatesResult>('/imports/candidates/upload', file),

  saveMapping: async (importId: string, payload: CandidateMapPayload) => {
    const { data } = await apiClient.post(
      `/imports/candidates/${importId}/map`,
      payload,
    );
    return data;
  },

  validate: async (importId: string) => {
    const { data } = await apiClient.get<{
      unmatchedRecruiters: string[];
      unmatchedPositions: string[];
      unmatchedActivityTypes: string[];
    }>(`/imports/candidates/${importId}/validate`);
    return data;
  },

  execute: async (
    importId: string,
    payload: ExecuteCandidateImportPayload,
  ) => {
    const { data } = await apiClient.post<CandidatesImportSummary>(
      `/imports/candidates/${importId}/execute`,
      payload,
    );
    return data;
  },
};

export const checkInOutImportsApi = {
  upload: async (file: File) =>
    uploadCsv<UploadCheckInOutResult>('/imports/check-in-outs/upload', file),

  saveMapping: async (importId: string, payload: CheckInOutMapPayload) => {
    const { data } = await apiClient.post(
      `/imports/check-in-outs/${importId}/map`,
      payload,
    );
    return data;
  },

  validate: async (importId: string) => {
    const { data } = await apiClient.get<{
      unmatchedEmployees: string[];
    }>(`/imports/check-in-outs/${importId}/validate`);
    return data;
  },

  execute: async (
    importId: string,
    payload: ExecuteCheckInOutImportPayload,
  ) => {
    const { data } = await apiClient.post<CheckInOutImportSummary>(
      `/imports/check-in-outs/${importId}/execute`,
      payload,
    );
    return data;
  },
};


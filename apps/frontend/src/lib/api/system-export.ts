import { apiClient } from './client';

export interface SystemExportData {
  version: string;
  exportedAt: string;
  metadata: {
    totalRecords: number;
    models: string[];
  };
  data: {
    [modelName: string]: any[];
  };
}

export interface SystemImportResult {
  success: boolean;
  message: string;
  imported: number;
  errors: string[];
}

export const systemExportApi = {
  // Download export file
  downloadExport: async (): Promise<void> => {
    const response = await apiClient.get('/system-export/export', {
      responseType: 'blob',
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    const filename = `system-export-${new Date().toISOString().split('T')[0]}.json`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  // Import system data (safe - preserves existing)
  import: async (file: File): Promise<SystemImportResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<SystemImportResult>(
      '/system-export/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data;
  },

  // Import system data with clear (destructive)
  importWithClear: async (file: File): Promise<SystemImportResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await apiClient.post<SystemImportResult>(
      '/system-export/import-with-clear',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return data;
  },
};

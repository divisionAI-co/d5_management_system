import { useState } from 'react';
import { systemExportApi } from '@/lib/api/system-export';
import { Download, Upload, AlertTriangle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { FeedbackToast } from '@/components/ui/feedback-toast';

export default function SystemExportPage() {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingWithClear, setIsImportingWithClear] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    message: string;
    imported: number;
    errors: string[];
  } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportError(null);
    try {
      await systemExportApi.downloadExport();
    } catch (error: any) {
      setExportError(error.response?.data?.message || 'Failed to export system data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        alert('Please select a JSON file');
        return;
      }
      setSelectedFile(file);
      setImportResult(null);
    }
  };

  const handleImport = async (clearExisting: boolean) => {
    if (!selectedFile) {
      alert('Please select a file to import');
      return;
    }

    if (clearExisting) {
      const confirmed = window.confirm(
        'WARNING: This will clear all existing data before importing. This action cannot be undone. Are you sure?'
      );
      if (!confirmed) return;
    }

    if (clearExisting) {
      setIsImportingWithClear(true);
    } else {
      setIsImporting(true);
    }
    setImportResult(null);

    try {
      const result = clearExisting
        ? await systemExportApi.importWithClear(selectedFile)
        : await systemExportApi.import(selectedFile);
      setImportResult(result);
      if (result.success) {
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('import-file') as HTMLInputElement;
        if (fileInput) {
          fileInput.value = '';
        }
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        message: error.response?.data?.message || 'Failed to import system data',
        imported: 0,
        errors: [error.response?.data?.message || 'Unknown error'],
      });
    } finally {
      setIsImporting(false);
      setIsImportingWithClear(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">System Export / Import</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Export all system data to a JSON file or import previously exported data.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Export Section */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export System Data
            </h2>
            <p className="text-sm text-muted-foreground">
              Download a complete backup of all system data as a JSON file.
            </p>
          </div>
          <div className="px-6 py-6 space-y-4">
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 dark:border-yellow-800 dark:bg-yellow-900/20">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                    Export Information
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    This will export all data from the system including users, customers, candidates,
                    employees, invoices, tasks, and more. The export file can be used to restore the
                    system to this state.
                  </p>
                </div>
              </div>
            </div>

            {exportError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
                <div className="flex gap-3">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                      Export Failed
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mt-1">{exportError}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export System Data
                </>
              )}
            </button>
          </div>
        </div>

        {/* Import Section */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import System Data
            </h2>
            <p className="text-sm text-muted-foreground">
              Restore system data from a previously exported JSON file.
            </p>
          </div>
          <div className="px-6 py-6 space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                    Warning
                  </h3>
                  <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                    Importing data will overwrite existing records with the same IDs. Use "Import with
                    Clear" to completely replace all data.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="import-file" className="block text-sm font-medium text-foreground">
                Select JSON File
              </label>
              <input
                id="import-file"
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            {importResult && (
              <div
                className={`rounded-lg border px-4 py-3 ${
                  importResult.success
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
                    : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                }`}
              >
                <div className="flex gap-3">
                  {importResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h3
                      className={`text-sm font-semibold ${
                        importResult.success
                          ? 'text-green-800 dark:text-green-200'
                          : 'text-red-800 dark:text-red-200'
                      }`}
                    >
                      {importResult.success ? 'Import Successful' : 'Import Failed'}
                    </h3>
                    <div
                      className={`text-sm mt-1 space-y-2 ${
                        importResult.success
                          ? 'text-green-700 dark:text-green-300'
                          : 'text-red-700 dark:text-red-300'
                      }`}
                    >
                      <p>{importResult.message}</p>
                      {importResult.imported > 0 && (
                        <p>Imported {importResult.imported} records.</p>
                      )}
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold">Errors:</p>
                          <ul className="list-disc list-inside space-y-1">
                            {importResult.errors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleImport(false)}
                disabled={!selectedFile || isImporting || isImportingWithClear}
                className="flex-1 inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import
                  </>
                )}
              </button>
              <button
                onClick={() => handleImport(true)}
                disabled={!selectedFile || isImporting || isImportingWithClear}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImportingWithClear ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Import & Clear
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

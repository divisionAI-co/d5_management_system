import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadCloud, ArrowLeft, Loader2 } from 'lucide-react';

import type {
  ImportSummaryBase,
  MapPayloadBase,
  UploadBaseResult,
  ExecutePayloadBase,
} from '@/types/imports';
import { FeedbackToast } from '@/components/ui/feedback-toast';

type ImportStep = 'upload' | 'map' | 'execute' | 'result';

type FieldMapping = Record<string, string>;

interface PendingState<TUpload extends UploadBaseResult> {
  importId: string;
  upload: TUpload;
}

interface RenderExecuteOptionsProps<TOptions> {
  options: TOptions;
  setOptions: React.Dispatch<React.SetStateAction<TOptions>>;
}

interface ImportDialogProps<
  TUpload extends UploadBaseResult,
  TSummary extends ImportSummaryBase,
  TOptions,
  TExecute extends ExecutePayloadBase,
> {
  open: boolean;
  title: string;
  description: string;
  entityLabel: string;
  duplicateHint: string;
  onClose: () => void;
  upload: (file: File) => Promise<TUpload>;
  saveMapping: (importId: string, payload: MapPayloadBase) => Promise<unknown>;
  execute: (importId: string, payload: TExecute) => Promise<TSummary>;
  buildExecutePayload: (
    args: { updateExisting: boolean; options: TOptions }
  ) => TExecute;
  initialOptions: () => TOptions;
  renderExecuteOptions?: (
    props: RenderExecuteOptionsProps<TOptions>,
  ) => React.ReactNode;
  invalidateQueries?: string[] | ((summary: TSummary) => string[]);
}

export function ImportDialog<
  TUpload extends UploadBaseResult,
  TSummary extends ImportSummaryBase,
  TOptions,
  TExecute extends ExecutePayloadBase,
>({
  open,
  title,
  description,
  entityLabel,
  duplicateHint,
  onClose,
  upload,
  saveMapping,
  execute,
  buildExecutePayload,
  initialOptions,
  renderExecuteOptions,
  invalidateQueries,
}: ImportDialogProps<TUpload, TSummary, TOptions, TExecute>) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('upload');
  const [pending, setPending] = useState<PendingState<TUpload> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [summary, setSummary] = useState<TSummary | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [options, setOptions] = useState<TOptions>(() => initialOptions());
  const [mutationError, setMutationError] = useState<string | null>(null);

  const resetState = () => {
    setStep('upload');
    setPending(null);
    setSelectedFile(null);
    setMapping({});
    setSummary(null);
    setUpdateExisting(true);
    setOptions(initialOptions());
  };

  const closeDialog = () => {
    resetState();
    onClose();
  };

  const uploadMutation = useMutation({
    mutationFn: (file: File) => upload(file),
    onSuccess: (data) => {
      setPending({ importId: data.id, upload: data });
      
      // Initialize mapping with suggested mappings if available
      if (data.suggestedMappings && data.suggestedMappings.length > 0) {
        const initialMapping: FieldMapping = {};
        data.suggestedMappings.forEach(({ sourceColumn, targetField }) => {
          initialMapping[targetField] = sourceColumn;
        });
        setMapping(initialMapping);
      }
      
      setStep('map');
    },
  });

  const mappingMutation = useMutation({
    mutationFn: (payload: { importId: string; mappings: FieldMapping }) => {
      const entries = Object.entries(payload.mappings)
        .filter(([, column]) => column)
        .map(([targetField, sourceColumn]) => ({
          targetField,
          sourceColumn,
        }));

      return saveMapping(payload.importId, { mappings: entries });
    },
    onSuccess: () => {
      setStep('execute');
    },
  });

  const executeMutation = useMutation({
    mutationFn: () => {
      if (!pending) {
        throw new Error('No import pending');
      }
      const payload = buildExecutePayload({ updateExisting, options });
      return execute(pending.importId, payload);
    },
    onSuccess: (result) => {
      setSummary(result);
      setStep('result');

      const keys =
        typeof invalidateQueries === 'function'
          ? invalidateQueries(result)
          : invalidateQueries;

      if (keys?.length) {
        keys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: [key] });
        });
      }
    },
  });

  useEffect(() => {
    if (uploadMutation.isError || mappingMutation.isError || executeMutation.isError) {
      const rawError =
        (uploadMutation.error as any) ??
        (mappingMutation.error as any) ??
        (executeMutation.error as any);

      const resolvedMessage =
        rawError?.response?.data?.message ??
        (rawError instanceof Error ? rawError.message : null) ??
        'An unexpected error occurred. Please try again.';

      setMutationError(resolvedMessage);
    } else {
      setMutationError(null);
    }
  }, [
    uploadMutation.isError,
    mappingMutation.isError,
    executeMutation.isError,
    uploadMutation.error,
    mappingMutation.error,
    executeMutation.error,
  ]);

  const clearMutationError = () => {
    setMutationError(null);
    uploadMutation.reset();
    mappingMutation.reset();
    executeMutation.reset();
  };

  const availableColumns = useMemo(
    () => pending?.upload.columns ?? [],
    [pending?.upload.columns],
  );

  const fieldDefinitions = useMemo(
    () => pending?.upload.availableFields ?? [],
    [pending?.upload.availableFields],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      return;
    }
    uploadMutation.mutate(selectedFile);
  };

  const handleMappingChange = (field: string, column: string) => {
    setMapping((prev) => {
      const updated: FieldMapping = { ...prev };

      Object.entries(updated).forEach(([key, value]) => {
        if (key !== field && value === column) {
          delete updated[key];
        }
      });

      if (!column) {
        delete updated[field];
      } else {
        updated[field] = column;
      }
      return updated;
    });
  };

  const handleSaveMapping = (event: React.FormEvent) => {
    event.preventDefault();
    if (!pending) return;

    const requiredFields = fieldDefinitions.filter((field) => field.required);
    const missingRequired = requiredFields.filter(
      (field) => !mapping[field.key],
    );

    if (missingRequired.length) {
      alert(
        `The following required fields must be mapped: ${missingRequired
          .map((field) => field.label)
          .join(', ')}`,
      );
      return;
    }

    mappingMutation.mutate({
      importId: pending.importId,
      mappings: mapping,
    });
  };

  const handleExecute = (event: React.FormEvent) => {
    event.preventDefault();
    executeMutation.mutate();
  };

  const renderUploadStep = () => (
    <form onSubmit={handleUpload} className="space-y-6">
      <div className="rounded-lg border border-dashed border-border bg-muted p-6 text-center">
        <UploadCloud className="mx-auto h-10 w-10 text-blue-500" />
        <p className="mt-4 text-sm text-muted-foreground">
          Upload a CSV or Excel (XLSX) file exported from Odoo. Only the first sheet will be
          processed.
        </p>
        <label className="mt-6 inline-flex cursor-pointer items-center justify-center gap-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
          Choose File
        </label>
        {selectedFile && (
          <p className="mt-3 text-sm text-muted-foreground">{selectedFile.name}</p>
        )}
      </div>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={closeDialog}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!selectedFile || uploadMutation.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploadMutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          Continue
        </button>
      </div>
    </form>
  );

  const renderMappingStep = () => {
    if (!pending) return null;

    return (
      <form onSubmit={handleSaveMapping} className="space-y-6">
        <button
          type="button"
          onClick={() => setStep('upload')}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to upload
        </button>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">
            Map Columns
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Map each {entityLabel.toLowerCase()} field to a column from your file.
            Required fields must be mapped before continuing.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Field</th>
                  <th className="px-4 py-2 text-left font-semibold">
                    Description
                  </th>
                  <th className="px-4 py-2 text-left font-semibold">
                    File Column
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fieldDefinitions.map((field) => (
                  <tr key={field.key}>
                    <td className="px-4 py-2 font-medium text-foreground">
                      {field.label}{' '}
                      {field.required && (
                        <span className="text-xs font-semibold uppercase text-red-500">
                          Required
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {field.description}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={mapping[field.key] ?? ''}
                        onChange={(event) =>
                          handleMappingChange(field.key, event.target.value)
                        }
                        className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Not mapped</option>
                        {availableColumns.map((column) => (
                          <option key={column} value={column}>
                            {column}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h4 className="text-sm font-semibold text-foreground">
            Sample Records
          </h4>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-border text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  {availableColumns.map((column) => (
                    <th key={column} className="px-3 py-2 text-left font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pending.upload.sampleRows.map((row, index) => (
                  <tr key={index}>
                    {availableColumns.map((column) => (
                      <td key={column} className="px-3 py-2">
                        {row[column] ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mappingMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mappingMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Continue
          </button>
        </div>
      </form>
    );
  };

  const renderExecuteStep = () => {
    if (!pending) return null;

    return (
      <form onSubmit={handleExecute} className="space-y-6">
        <button
          type="button"
          onClick={() => setStep('map')}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to mapping
        </button>

        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">
            Execution Options
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how records should be handled when {entityLabel.toLowerCase()} already exist
            in the CRM.
          </p>

          <div className="mt-4 space-y-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(event) => setUpdateExisting(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Update existing {entityLabel.toLowerCase()}
                </p>
                <p className="text-xs text-muted-foreground">{duplicateHint}</p>
              </div>
            </label>

            {renderExecuteOptions ? (
              <div className="space-y-4">
                {renderExecuteOptions({ options, setOptions })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={executeMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {executeMutation.isPending && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            Run Import
          </button>
        </div>
      </form>
    );
  };

  const renderResultStep = () => {
    if (!summary) return null;

    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">
            Import Summary
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Import ID: <span className="font-mono">{summary.importId}</span>
          </p>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg bg-muted p-3">
              <dt className="text-xs uppercase text-muted-foreground">
                Total rows
              </dt>
              <dd className="text-lg font-semibold text-foreground">
                {summary.totalRows}
              </dd>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <dt className="text-xs uppercase text-muted-foreground">
                Processed
              </dt>
              <dd className="text-lg font-semibold text-foreground">
                {summary.processedRows}
              </dd>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3">
              <dt className="text-xs uppercase text-emerald-700">Created</dt>
              <dd className="text-lg font-semibold text-emerald-700">
                {summary.createdCount}
              </dd>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <dt className="text-xs uppercase text-blue-700">Updated</dt>
              <dd className="text-lg font-semibold text-blue-700">
                {summary.updatedCount}
              </dd>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <dt className="text-xs uppercase text-amber-700">Skipped</dt>
              <dd className="text-lg font-semibold text-amber-700">
                {summary.skippedCount}
              </dd>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <dt className="text-xs uppercase text-red-700">Failed</dt>
              <dd className="text-lg font-semibold text-red-700">
                {summary.failedCount}
              </dd>
            </div>
          </dl>
        </div>

        {summary.errors.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h4 className="text-sm font-semibold text-red-700">
              Issues encountered
            </h4>
            <p className="mt-1 text-xs text-red-600">
              Only the first {summary.errors.length} errors are shown.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-red-700">
              {summary.errors.map((error, index) => (
                <li key={index} className="rounded bg-white/60 p-2">
                  <span className="font-medium">Row {error.row}:</span>{' '}
                  {error.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={closeDialog}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  };

  if (!open) {
    return null;
  }

  return (
    <>
      {mutationError && (
        <FeedbackToast
          message={mutationError}
          onDismiss={clearMutationError}
          tone="error"
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4">
      <div className="relative flex w-full max-w-5xl flex-col rounded-2xl bg-card shadow-xl max-h-[90vh] overflow-hidden">
        <div className="flex-shrink-0 space-y-4 border-b border-border bg-card/80 p-6">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <ol className="flex flex-wrap items-center gap-4 text-xs font-medium uppercase tracking-wide">
            {[
              { id: 'upload', label: 'Upload' },
              { id: 'map', label: 'Map Fields' },
              { id: 'execute', label: 'Run Import' },
              { id: 'result', label: 'Summary' },
            ].map((item) => {
              const active = step === item.id;
              const completed =
                ['map', 'execute', 'result'].includes(step) &&
                item.id !== step &&
                step !== 'upload';
              return (
                <li
                  key={item.id}
                  className={`rounded-full px-3 py-1 ${
                    active
                      ? 'bg-blue-600 text-white'
                      : completed
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {item.label}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {step === 'upload' && renderUploadStep()}
          {step === 'map' && renderMappingStep()}
          {step === 'execute' && renderExecuteStep()}
          {step === 'result' && renderResultStep()}
        </div>
      </div>
    </div>
    </>
  );
}

import { ImportDialog } from '@/components/imports/ImportDialog';
import { eodImportsApi } from '@/lib/api/imports';
import type {
  EodImportSummary,
  ExecuteEodImportPayload,
  UploadEodResult,
} from '@/types/imports';

interface EodImportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface EodExecuteOptions {
  markMissingAsSubmitted: boolean;
  defaultIsLate: boolean;
}

export function EodImportDialog({ open, onClose }: EodImportDialogProps) {
  return (
    <ImportDialog<UploadEodResult, EodImportSummary, EodExecuteOptions, ExecuteEodImportPayload>
      open={open}
      title="Import EOD Reports"
      description="Upload the exported Excel file, map the employee email and report columns, and import EOD submissions."
      entityLabel="EOD Reports"
      duplicateHint="Matches on employee email and report date. When disabled, existing reports are skipped."
      onClose={onClose}
      upload={eodImportsApi.upload}
      saveMapping={eodImportsApi.saveMapping}
      execute={eodImportsApi.execute}
      initialOptions={() => ({
        markMissingAsSubmitted: false,
        defaultIsLate: false,
      })}
      buildExecutePayload={({ updateExisting, options }) => ({
        updateExisting,
        markMissingAsSubmitted: options.markMissingAsSubmitted,
        defaultIsLate: options.defaultIsLate,
      })}
      invalidateQueries={['eod-reports']}
      renderExecuteOptions={({ options, setOptions }) => (
        <div className="space-y-4">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={options.markMissingAsSubmitted}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  markMissingAsSubmitted: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                Mark missing submissions as submitted now
              </p>
              <p className="text-xs text-muted-foreground">
                When enabled, rows without a "Submitted At" value will be marked as submitted at the time of import.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={options.defaultIsLate}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  defaultIsLate: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
            />
            <div>
              <p className="text-sm font-medium text-foreground">
                Mark missing entries as late
              </p>
              <p className="text-xs text-muted-foreground">
                Applies when the import file does not specify an "Is Late" value.
              </p>
            </div>
          </label>
        </div>
      )}
    />
  );
}

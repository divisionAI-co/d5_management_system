import { ImportDialog } from '@/components/imports/ImportDialog';
import { checkInsImportsApi } from '@/lib/api/imports';
import type {
  CheckInsImportSummary,
  ExecuteCheckInsImportPayload,
  UploadCheckInsResult,
} from '@/types/imports';

interface CheckInImportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface CheckInExecuteOptions {
  // No additional options needed for check-ins import
}

export function CheckInImportDialog({ open, onClose }: CheckInImportDialogProps) {
  return (
    <ImportDialog<
      UploadCheckInsResult,
      CheckInsImportSummary,
      CheckInExecuteOptions,
      ExecuteCheckInsImportPayload
    >
      open={open}
      title="Import Check-ins & Check-outs"
      description="Upload an Excel or CSV file with check-in/check-out records, map the columns, and import the data."
      entityLabel="Check-ins"
      duplicateHint="Matches on date, time, card number, and status. When disabled, existing records are skipped."
      onClose={onClose}
      upload={checkInsImportsApi.upload}
      saveMapping={checkInsImportsApi.saveMapping}
      validate={checkInsImportsApi.validate}
      execute={checkInsImportsApi.execute}
      initialOptions={() => ({})}
      buildExecutePayload={({ updateExisting, manualMatches }) => ({
        updateExisting,
        manualMatches: manualMatches ? {
          employees: manualMatches.unmatchedEmployees,
        } : undefined,
      })}
      invalidateQueries={['check-ins']}
      renderExecuteOptions={() => null}
    />
  );
}


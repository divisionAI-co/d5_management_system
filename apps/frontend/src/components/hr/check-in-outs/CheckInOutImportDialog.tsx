import { ImportDialog } from '@/components/imports/ImportDialog';
import { checkInOutImportsApi } from '@/lib/api/imports';
import type {
  CheckInOutImportSummary,
  ExecuteCheckInOutImportPayload,
  UploadCheckInOutResult,
} from '@/types/imports';

interface CheckInOutImportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CheckInOutImportDialog({ open, onClose }: CheckInOutImportDialogProps) {
  return (
    <ImportDialog<UploadCheckInOutResult, CheckInOutImportSummary, {}, ExecuteCheckInOutImportPayload>
      open={open}
      title="Import Check-In/Check-Out Records"
      description="Upload the exported Excel file, map the columns, and import check-in/check-out records."
      entityLabel="Check-In/Check-Out Records"
      duplicateHint="Matches on employee and date/time. When disabled, existing records are skipped."
      onClose={onClose}
      upload={checkInOutImportsApi.upload}
      saveMapping={checkInOutImportsApi.saveMapping}
      validate={checkInOutImportsApi.validate}
      execute={checkInOutImportsApi.execute}
      initialOptions={() => ({})}
      buildExecutePayload={({ updateExisting, manualMatches }) => ({
        updateExisting,
        manualMatches: manualMatches ? {
          employees: manualMatches.unmatchedEmployees,
        } : undefined,
      })}
      invalidateQueries={['check-in-outs']}
      useEmployeesForUnmatched={true}
    />
  );
}


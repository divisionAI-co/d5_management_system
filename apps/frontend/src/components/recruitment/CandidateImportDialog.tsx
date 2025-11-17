import { ImportDialog } from '@/components/imports/ImportDialog';
import { candidatesImportsApi } from '@/lib/api/imports';
import type {
  CandidatesImportSummary,
  ExecuteCandidateImportPayload,
  UploadCandidatesResult,
} from '@/types/imports';
import { CandidateStage } from '@/types/recruitment';

interface CandidateImportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface CandidateExecuteOptions {
  defaultStage: CandidateStage | '';
  defaultSalaryCurrency: string;
  isOdooImport: boolean;
}

const CANDIDATE_STAGE_LABELS: Record<CandidateStage, string> = {
  VALIDATION: 'Validation',
  CULTURAL_INTERVIEW: 'Cultural Interview',
  TECHNICAL_INTERVIEW: 'Technical Interview',
  CUSTOMER_INTERVIEW: 'Customer Interview',
  ON_HOLD: 'On Hold',
  CUSTOMER_REVIEW: 'Customer Review',
  CONTRACT_PROPOSAL: 'Contract Proposal',
  CONTRACT_SIGNING: 'Contract Signing',
  HIRED: 'Hired',
  REJECTED: 'Rejected',
};

export function CandidateImportDialog({ open, onClose }: CandidateImportDialogProps) {
  return (
    <ImportDialog<
      UploadCandidatesResult,
      CandidatesImportSummary,
      CandidateExecuteOptions,
      ExecuteCandidateImportPayload
    >
      open={open}
      title="Import Candidates"
      description="Upload the exported candidate spreadsheet to populate the recruiting pipeline."
      entityLabel="Candidates"
      duplicateHint="Matches on email address. When disabled, existing candidates will be skipped."
      onClose={onClose}
      upload={candidatesImportsApi.upload}
      saveMapping={candidatesImportsApi.saveMapping}
      validate={candidatesImportsApi.validate}
      execute={candidatesImportsApi.execute}
      initialOptions={() => ({
        defaultStage: '',
        defaultSalaryCurrency: 'USD',
        isOdooImport: false,
      })}
      buildExecutePayload={({ updateExisting, options, manualMatches }) => ({
        updateExisting,
        defaultStage: options.defaultStage || undefined,
        defaultSalaryCurrency: options.defaultSalaryCurrency || undefined,
        isOdooImport: options.isOdooImport,
        manualMatches: manualMatches ? {
          recruiters: manualMatches.unmatchedRecruiters,
          positions: manualMatches.unmatchedPositions,
          activityTypes: manualMatches.unmatchedActivityTypes,
        } : undefined,
      })}
      invalidateQueries={['candidates']}
      renderExecuteOptions={({ options, setOptions }) => (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Default stage
            </label>
            <select
              value={options.defaultStage}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  defaultStage: event.target.value as CandidateStage | '',
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Use import value or default (Validation)</option>
              {Object.entries(CANDIDATE_STAGE_LABELS).map(([stage, label]) => (
                <option key={stage} value={stage}>
                  {label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Applied when the spreadsheet does not specify a candidate stage.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Default salary currency
            </label>
            <input
              type="text"
              value={options.defaultSalaryCurrency}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  defaultSalaryCurrency: event.target.value.toUpperCase(),
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 uppercase focus:border-transparent focus:ring-2 focus:ring-blue-500"
              maxLength={3}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Provide a three-letter ISO currency code (e.g., USD, EUR).
            </p>
          </div>

          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="is-odoo-import"
              checked={options.isOdooImport}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  isOdooImport: event.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-border text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1">
              <label
                htmlFor="is-odoo-import"
                className="text-sm font-medium text-muted-foreground"
              >
                Odoo Import
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Enable Odoo-specific processing: extract Google Drive links from HTML notes and convert HTML fields to plain text.
              </p>
            </div>
          </div>
        </div>
      )}
    />
  );
}

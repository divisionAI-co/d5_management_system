import { ImportDialog } from '@/components/imports/ImportDialog';
import { leadsImportsApi } from '@/lib/api/imports';
import type { CustomerSummary } from '@/types/crm';
import type {
  ExecuteLeadImportPayload,
  LeadsImportSummary,
  UploadLeadsResult,
} from '@/types/imports';

interface LeadsImportDialogProps {
  open: boolean;
  customers: CustomerSummary[];
  onClose: () => void;
}

interface LeadsExecuteOptions {
  defaultOwnerEmail: string;
  defaultStatus: string;
}

const LEAD_STATUSES = [
  { value: '', label: 'Do not set' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'UNQUALIFIED', label: 'Unqualified' },
  { value: 'CONVERTED', label: 'Converted' },
];

export function LeadsImportDialog({
  open,
  customers: _customers,
  onClose,
}: LeadsImportDialogProps) {
  return (
    <ImportDialog<
      UploadLeadsResult,
      LeadsImportSummary,
      LeadsExecuteOptions,
      ExecuteLeadImportPayload
    >
      open={open}
      title="Import Leads from Odoo"
      description="Upload your exported leads, map their fields, and sync them into the CRM in minutes."
      entityLabel="Leads"
      duplicateHint="Matches on email address. When disabled, duplicates will be skipped."
      onClose={onClose}
      upload={leadsImportsApi.upload}
      saveMapping={leadsImportsApi.saveMapping}
      execute={leadsImportsApi.execute}
      initialOptions={() => ({ defaultOwnerEmail: '', defaultStatus: 'NEW' })}
      buildExecutePayload={({ updateExisting, options }) => ({
        updateExisting,
        defaultOwnerEmail: options.defaultOwnerEmail || undefined,
        defaultStatus: options.defaultStatus || undefined,
      })}
      invalidateQueries={['leads']}
      renderExecuteOptions={({ options, setOptions }) => (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Default owner email (optional)
            </label>
            <input
              type="email"
              value={options.defaultOwnerEmail}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  defaultOwnerEmail: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="owner@example.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Used when the owner email is missing in the CSV.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Default status
            </label>
            <select
              value={options.defaultStatus}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  defaultStatus: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {LEAD_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Applied when a lead status is missing in the CSV.
            </p>
          </div>
        </div>
      )}
    />
  );
}



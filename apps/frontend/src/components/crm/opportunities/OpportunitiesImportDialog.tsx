import { ImportDialog } from '@/components/imports/ImportDialog';
import { opportunitiesImportsApi } from '@/lib/api/imports';
import type { CustomerSummary } from '@/types/crm';
import type {
  ExecuteOpportunityImportPayload,
  OpportunitiesImportSummary,
  UploadOpportunitiesResult,
} from '@/types/imports';

interface OpportunitiesImportDialogProps {
  open: boolean;
  customers: CustomerSummary[];
  onClose: () => void;
}

interface OpportunityExecuteOptions {
  defaultOwnerEmail: string;
  defaultCustomerId: string;
  defaultStage: string;
}

const OPPORTUNITY_STAGES = [
  'Qualification',
  'Needs Analysis',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
];

export function OpportunitiesImportDialog({
  open,
  customers,
  onClose,
}: OpportunitiesImportDialogProps) {
  return (
    <ImportDialog<
      UploadOpportunitiesResult,
      OpportunitiesImportSummary,
      OpportunityExecuteOptions,
      ExecuteOpportunityImportPayload
    >
      open={open}
      title="Import Opportunities from Odoo"
      description="Upload your exported opportunities, map the relevant fields, and merge them into your CRM pipeline."
      entityLabel="Opportunities"
      duplicateHint="Matches on opportunity name and customer. When disabled, duplicates will be skipped."
      onClose={onClose}
      upload={opportunitiesImportsApi.upload}
      saveMapping={opportunitiesImportsApi.saveMapping}
      validate={opportunitiesImportsApi.validate}
      execute={opportunitiesImportsApi.execute}
      initialOptions={() => ({
        defaultOwnerEmail: '',
        defaultCustomerId: '',
        defaultStage: 'Qualification',
      })}
      buildExecutePayload={({ updateExisting, options, manualMatches }) => ({
        updateExisting,
        defaultOwnerEmail: options.defaultOwnerEmail || undefined,
        defaultCustomerId: options.defaultCustomerId || undefined,
        defaultStage: options.defaultStage || undefined,
        manualMatches: manualMatches ? {
          customers: manualMatches.unmatchedCustomers,
          owners: manualMatches.unmatchedOwners,
        } : undefined,
      })}
      invalidateQueries={['opportunities']}
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
              Default customer (optional)
            </label>
            <select
              value={options.defaultCustomerId}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  defaultCustomerId: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Do not set</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Applied when an opportunity is missing a linked customer.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Default stage
            </label>
            <select
              value={options.defaultStage}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  defaultStage: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Do not set</option>
              {OPPORTUNITY_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Applied when the stage is missing in the CSV.
            </p>
          </div>
        </div>
      )}
    />
  );
}


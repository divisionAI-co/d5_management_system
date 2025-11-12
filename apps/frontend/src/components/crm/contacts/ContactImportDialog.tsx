import { ImportDialog } from '@/components/imports/ImportDialog';
import { contactImportsApi } from '@/lib/api/imports';
import type { CustomerSummary } from '@/types/crm';
import type {
  ExecuteContactImportPayload,
  UploadContactsResult,
  ContactImportSummary,
} from '@/types/imports';

interface ContactImportDialogProps {
  open: boolean;
  customers: CustomerSummary[];
  onClose: () => void;
}

interface ContactExecuteOptions {
  defaultCustomerId: string;
}

export function ContactImportDialog({
  open,
  customers,
  onClose,
}: ContactImportDialogProps) {
  return (
    <ImportDialog<
      UploadContactsResult,
      ContactImportSummary,
      ContactExecuteOptions,
      ExecuteContactImportPayload
    >
      open={open}
      title="Import Contacts from Odoo"
      description="Follow the steps below to upload your Odoo export, map columns, and import contacts into the CRM."
      entityLabel="Contacts"
      duplicateHint="Matches on email. When disabled, duplicates will be skipped."
      onClose={onClose}
      upload={contactImportsApi.upload}
      saveMapping={contactImportsApi.saveMapping}
      execute={contactImportsApi.execute}
      initialOptions={() => ({ defaultCustomerId: '' })}
      buildExecutePayload={({ updateExisting, options }) => ({
        updateExisting,
        defaultCustomerId: options.defaultCustomerId || undefined,
      })}
      invalidateQueries={['contacts']}
      renderExecuteOptions={({ options, setOptions }) => (
        <div className="space-y-4">
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
              Contacts will be linked to this customer when not specified in the file.
            </p>
          </div>
        </div>
      )}
    />
  );
}



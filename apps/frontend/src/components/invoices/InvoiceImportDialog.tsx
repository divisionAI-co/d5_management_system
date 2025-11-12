import { ImportDialog } from '@/components/imports/ImportDialog';
import { invoicesImportsApi } from '@/lib/api/imports';
import type {
  ExecuteInvoiceImportPayload,
  InvoicesImportSummary,
  UploadInvoicesResult,
} from '@/types/imports';

interface InvoiceImportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface InvoiceExecuteOptions {
  defaultStatus: string;
  defaultCurrency: string;
  defaultCustomerEmail: string;
  defaultCustomerName: string;
  defaultCreatedByEmail: string;
}

const INVOICE_STATUSES = [
  { value: '', label: 'Use import value or default (Draft)' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PAID', label: 'Paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function InvoiceImportDialog({ open, onClose }: InvoiceImportDialogProps) {
  return (
    <ImportDialog<
      UploadInvoicesResult,
      InvoicesImportSummary,
      InvoiceExecuteOptions,
      ExecuteInvoiceImportPayload
    >
      open={open}
      title="Import Invoices"
      description="Upload the exported invoice spreadsheet, map your columns, and sync billing records into the finance module."
      entityLabel="Invoices"
      duplicateHint="Matches on invoice number. When disabled, existing invoices will be skipped."
      onClose={onClose}
      upload={invoicesImportsApi.upload}
      saveMapping={invoicesImportsApi.saveMapping}
      execute={invoicesImportsApi.execute}
      initialOptions={() => ({
        defaultStatus: '',
        defaultCurrency: 'USD',
        defaultCustomerEmail: '',
        defaultCustomerName: '',
        defaultCreatedByEmail: '',
      })}
      buildExecutePayload={({ updateExisting, options }) => ({
        updateExisting,
        defaultStatus: options.defaultStatus || undefined,
        defaultCurrency: options.defaultCurrency || undefined,
        defaultCustomerEmail: options.defaultCustomerEmail || undefined,
        defaultCustomerName: options.defaultCustomerName || undefined,
        defaultCreatedByEmail: options.defaultCreatedByEmail || undefined,
      })}
      invalidateQueries={['invoices']}
      renderExecuteOptions={({ options, setOptions }) => (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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
                {INVOICE_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Used when the spreadsheet does not specify a status.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default currency
              </label>
              <input
                type="text"
                value={options.defaultCurrency}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    defaultCurrency: event.target.value.toUpperCase(),
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 uppercase focus:border-transparent focus:ring-2 focus:ring-blue-500"
                maxLength={3}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Provide a three-letter ISO currency code (e.g., USD, EUR).
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default customer email
              </label>
              <input
                type="email"
                value={options.defaultCustomerEmail}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    defaultCustomerEmail: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="customer@example.com"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used when the spreadsheet does not include a customer email.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default customer name
              </label>
              <input
                type="text"
                value={options.defaultCustomerName}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    defaultCustomerName: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Acme Corp"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Fallback when the spreadsheet does not provide customer name or email.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Default creator email
            </label>
            <input
              type="email"
              value={options.defaultCreatedByEmail}
              onChange={(event) =>
                setOptions((prev) => ({
                  ...prev,
                  defaultCreatedByEmail: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="billing@example.com"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Required when the spreadsheet does not specify the invoice creator.
            </p>
          </div>
        </div>
      )}
    />
  );
}

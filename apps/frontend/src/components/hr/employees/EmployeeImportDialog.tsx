import { ImportDialog } from '@/components/imports/ImportDialog';
import { employeesImportsApi } from '@/lib/api/imports';
import type {
  EmployeeImportSummary,
  ExecuteEmployeeImportPayload,
  UploadEmployeesResult,
} from '@/types/imports';

interface EmployeeImportDialogProps {
  open: boolean;
  onClose: () => void;
}

interface EmployeeExecuteOptions {
  defaultRole: string;
  defaultStatus: string;
  defaultContractType: string;
  defaultManagerEmail: string;
  defaultSalaryCurrency: string;
  defaultPassword: string;
}

const USER_ROLES = [
  'EMPLOYEE',
  'HR',
  'RECRUITER',
  'ACCOUNT_MANAGER',
  'SALESPERSON',
  'ADMIN',
];

const EMPLOYMENT_STATUSES = [
  { value: '', label: 'Use import value or default (Active)' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ON_LEAVE', label: 'On Leave' },
  { value: 'TERMINATED', label: 'Terminated' },
  { value: 'RESIGNED', label: 'Resigned' },
];

const CONTRACT_TYPES = [
  { value: '', label: 'Use import value or default (Full Time)' },
  { value: 'FULL_TIME', label: 'Full Time' },
  { value: 'PART_TIME', label: 'Part Time' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'INTERNSHIP', label: 'Internship' },
];

export function EmployeeImportDialog({ open, onClose }: EmployeeImportDialogProps) {
  return (
    <ImportDialog<
      UploadEmployeesResult,
      EmployeeImportSummary,
      EmployeeExecuteOptions,
      ExecuteEmployeeImportPayload
    >
      open={open}
      title="Import Employees from Odoo"
      description="Upload the exported employee list, map fields, and synchronise profiles into the HR module."
      entityLabel="Employees"
      duplicateHint="Matches on work email. When disabled, existing users/employees will be skipped."
      onClose={onClose}
      upload={employeesImportsApi.upload}
      saveMapping={employeesImportsApi.saveMapping}
      execute={employeesImportsApi.execute}
      initialOptions={() => ({
        defaultRole: 'EMPLOYEE',
        defaultStatus: '',
        defaultContractType: '',
        defaultManagerEmail: '',
        defaultSalaryCurrency: 'USD',
        defaultPassword: '',
      })}
      buildExecutePayload={({ updateExisting, options }) => ({
        updateExisting,
        defaultRole: options.defaultRole || undefined,
        defaultStatus: options.defaultStatus || undefined,
        defaultContractType: options.defaultContractType || undefined,
        defaultManagerEmail: options.defaultManagerEmail || undefined,
        defaultSalaryCurrency: options.defaultSalaryCurrency || undefined,
        defaultPassword: options.defaultPassword || undefined,
      })}
      invalidateQueries={['employees']}
      renderExecuteOptions={({ options, setOptions }) => (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default user role
              </label>
              <select
                value={options.defaultRole}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    defaultRole: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {USER_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Applied to newly created users when the CSV does not specify a role.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default employment status
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
                {EMPLOYMENT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Used when the CSV omits the employment status value.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default contract type
              </label>
              <select
                value={options.defaultContractType}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    defaultContractType: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {CONTRACT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Applied when the CSV does not define a contract type.
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
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default manager email (optional)
              </label>
              <input
                type="email"
                value={options.defaultManagerEmail}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    defaultManagerEmail: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="manager@example.com"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used when no manager email is provided in the CSV.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Default password for new users (optional)
              </label>
              <input
                type="text"
                value={options.defaultPassword}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    defaultPassword: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Leave blank to auto-generate"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Applied only when a new platform user is created for an employee.
              </p>
            </div>
          </div>
        </div>
      )}
    />
  );
}

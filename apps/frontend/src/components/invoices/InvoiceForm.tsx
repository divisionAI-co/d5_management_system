import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { invoicesApi } from '@/lib/api/invoices';
import { customersApi } from '@/lib/api/crm';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { formatCurrency } from '@/lib/utils/currency';
import type {
  CreateInvoicePayload,
  InvoiceDetail,
  InvoiceItemInput,
  InvoiceStatus,
  UpdateInvoicePayload,
} from '@/types/invoices';
import type { CustomerSummary } from '@/types/crm';

const INVOICE_STATUSES: { label: string; value: InvoiceStatus }[] = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Paid', value: 'PAID' },
  { label: 'Overdue', value: 'OVERDUE' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

type ItemFormValue = {
  description: string;
  quantity: string;
  unitPrice: string;
};

type FormValues = {
  customerId: string;
  invoiceNumber?: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  taxRate: string;
  status: InvoiceStatus;
  notes?: string;
  isRecurring: boolean;
  recurringDay?: number | null;
  items: ItemFormValue[];
};

interface InvoiceFormProps {
  invoice?: InvoiceDetail | null;
  onClose: () => void;
  onSuccess: (invoice: InvoiceDetail) => void;
}

const getDefaultIssueDate = () => {
  return new Date().toISOString().split('T')[0];
};

const getDefaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString().split('T')[0];
};

export function InvoiceForm({ invoice, onClose, onSuccess }: InvoiceFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(invoice);
  const [customerError, setCustomerError] = useState<string | null>(null);

  const customersQuery = useQuery({
    queryKey: ['customers', 'for-invoices'],
    queryFn: () =>
      customersApi.list({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  });

  useEffect(() => {
    if (customersQuery.isError) {
      setCustomerError('Unable to load customers. Please refresh and try again.');
    } else if (customersQuery.isSuccess) {
      setCustomerError(null);
    }
  }, [customersQuery.isError, customersQuery.isSuccess]);

  const defaultValues = useMemo<FormValues>(() => {
    if (!invoice) {
      return {
        customerId: '',
        invoiceNumber: '',
        issueDate: getDefaultIssueDate(),
        dueDate: getDefaultDueDate(),
        currency: 'USD',
        taxRate: '0',
        status: 'DRAFT',
        notes: '',
        isRecurring: false,
        recurringDay: null,
        items: [
          {
            description: '',
            quantity: '1',
            unitPrice: '0',
          },
        ],
      };
    }

    return {
      customerId: invoice.customerId,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate ? invoice.issueDate.slice(0, 10) : getDefaultIssueDate(),
      dueDate: invoice.dueDate ? invoice.dueDate.slice(0, 10) : getDefaultDueDate(),
      currency: invoice.currency ?? 'USD',
      taxRate: String(invoice.taxRate ?? 0),
      status: invoice.status,
      notes: invoice.notes ?? '',
      isRecurring: invoice.isRecurring,
      recurringDay: invoice.recurringDay ?? null,
      items:
        invoice.items?.length
          ? invoice.items.map((item) => ({
              description: item.description,
              quantity: String(item.quantity ?? 0),
              unitPrice: String(item.unitPrice ?? 0),
            }))
          : [
              {
                description: '',
                quantity: '1',
                unitPrice: '0',
              },
            ],
    };
  }, [invoice]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const watchedItems = watch('items');
  const watchedTaxRate = Number(watch('taxRate') || '0');

  const subtotal = watchedItems.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    return sum + quantity * unitPrice;
  }, 0);

  const taxAmount = subtotal * (watchedTaxRate / 100);
  const total = subtotal + taxAmount;

  const createMutation = useMutation({
    mutationFn: (payload: CreateInvoicePayload) => invoicesApi.create(payload),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateInvoicePayload) => invoicesApi.update(invoice!.id, payload),
  });

  const onSubmit = (values: FormValues) => {
    const lineItems: InvoiceItemInput[] = values.items
      .map((item) => ({
        description: item.description.trim(),
        quantity: Number(item.quantity) || 0,
        unitPrice: Number(item.unitPrice) || 0,
      }))
      .filter((item) => item.description.length > 0);

    if (!lineItems.length) {
      alert('Please add at least one line item.');
      return;
    }

    const taxRateValue = Number(values.taxRate) || 0;
    const payload: CreateInvoicePayload = {
      customerId: values.customerId,
      invoiceNumber: values.invoiceNumber || undefined,
      issueDate: values.issueDate || undefined,
      dueDate: values.dueDate,
      currency: values.currency || 'USD',
      taxRate: taxRateValue,
      status: values.status,
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
      items: lineItems,
      isRecurring: values.isRecurring,
      recurringDay:
        values.isRecurring && values.recurringDay
          ? Number(values.recurringDay)
          : undefined,
    };

    if (isEdit) {
      updateMutation.mutate(
        {
          ...payload,
          statusNote: undefined,
        },
        {
          onSuccess: (updated) => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            queryClient.invalidateQueries({ queryKey: ['invoice', updated.id] });
            onSuccess(updated);
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
          onSuccess(created);
        },
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const customers: CustomerSummary[] = customersQuery.data?.data ?? [];
  const isRecurringField = register('isRecurring');

  return (
    <>
      {customerError && (
        <FeedbackToast
          message={customerError}
          onDismiss={() => setCustomerError(null)}
          tone="error"
        />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Edit Invoice' : 'Create Invoice'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Update invoice details, line items and billing metadata.'
                : 'Generate a new invoice for a customer, configure items, taxes and recurrence.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 px-6 py-6">
          <section className="rounded-lg border border-border p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Billing Details
            </h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Customer *
                </label>
                <select
                  {...register('customerId', { required: 'Customer is required' })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
                {customersQuery.isLoading && (
                  <p className="mt-1 text-sm text-muted-foreground">Loading customers...</p>
                )}
                
                {!customersQuery.isLoading && !customersQuery.isError && customers.length === 0 && (
                  <p className="mt-1 text-sm text-amber-600">
                    No customers found. Create a customer before generating invoices.
                  </p>
                )}
                {errors.customerId && (
                  <p className="mt-1 text-sm text-red-600">{errors.customerId.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Invoice Number
                </label>
                <input
                  type="text"
                  {...register('invoiceNumber')}
                  placeholder="Leave blank to auto-generate"
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Issue Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    {...register('issueDate', { required: true })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  <CalendarIcon className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Due Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    {...register('dueDate', { required: 'Due date is required' })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  <CalendarIcon className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
                </div>
                {errors.dueDate && (
                  <p className="mt-1 text-sm text-red-600">{errors.dueDate.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Currency *
                </label>
                <input
                  type="text"
                  {...register('currency', { required: true })}
                  className="w-full rounded-lg border border-border px-3 py-2 uppercase focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Status</label>
                <select
                  {...register('status', { required: true })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {INVOICE_STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Line Items
                </h3>
                <p className="text-sm text-muted-foreground">
                  Add the services or products that make up this invoice.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  append({
                    description: '',
                    quantity: '1',
                    unitPrice: '0',
                  })
                }
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-lg border border-border p-3 md:grid-cols-[minmax(0,1fr)_120px_120px_40px]"
                >
                  <div className="md:col-span-1">
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Description *
                    </label>
                    <input
                      type="text"
                      {...register(`items.${index}.description`, {
                        required: 'Description is required',
                      })}
                      placeholder="Service description"
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.items?.[index]?.description && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.items[index]?.description?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Quantity
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`items.${index}.quantity`, {
                        validate: (value) =>
                          Number(value) >= 0 || 'Quantity must be greater than or equal to 0',
                      })}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.items?.[index]?.quantity && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.items[index]?.quantity?.message}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Unit Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`items.${index}.unitPrice`, {
                        validate: (value) =>
                          Number(value) >= 0 || 'Unit price must be greater than or equal to 0',
                      })}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                    {errors.items?.[index]?.unitPrice && (
                      <p className="mt-1 text-xs text-red-600">
                        {errors.items[index]?.unitPrice?.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-end">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-red-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Tax Rate (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('taxRate', {
                    validate: (value) =>
                      Number(value) >= 0 || 'Tax rate must be greater than or equal to 0',
                  })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                {errors.taxRate && (
                  <p className="mt-1 text-sm text-red-600">{errors.taxRate.message}</p>
                )}
              </div>
              <div className="md:col-span-2 rounded-lg bg-muted p-4">
                <dl className="grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <dt>Subtotal</dt>
                    <dd className="font-medium">
                      {formatCurrency(subtotal, watch('currency') || 'USD')}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt>Tax ({watchedTaxRate || 0}%)</dt>
                    <dd className="font-medium">
                      {formatCurrency(taxAmount, watch('currency') || 'USD')}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-2 text-base">
                    <dt>Total</dt>
                    <dd className="font-semibold">
                      {formatCurrency(total, watch('currency') || 'USD')}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>


          <section className="rounded-lg border border-border p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recurrence & Notes
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    {...isRecurringField}
                    onChange={(event) => {
                      isRecurringField.onChange(event);
                      setValue('isRecurring', event.target.checked);
                      if (!event.target.checked) {
                        setValue('recurringDay', null, { shouldValidate: true });
                      }
                    }}
                    className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  Recurring invoice
                </label>
                <p className="text-xs text-muted-foreground">
                  When enabled, a new draft invoice will be generated each month on the selected day.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Recurring Day (1-28)
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  {...register('recurringDay', {
                    validate: (value) => {
                      if (!watch('isRecurring')) {
                        return true;
                      }
                      if (value === undefined || value === null || value === 0) {
                        return 'Recurring day is required when recurrence is enabled';
                      }
                      const numeric = Number(value);
                      if (Number.isNaN(numeric) || numeric < 1 || numeric > 28) {
                        return 'Recurring day must be between 1 and 28';
                      }
                      return true;
                    },
                  })}
                  disabled={!watch('isRecurring')}
                  className="w-32 rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-muted/70"
                />
                {errors.recurringDay && (
                  <p className="mt-1 text-sm text-red-600">{errors.recurringDay.message}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Internal Notes</label>
              <textarea
                rows={4}
                {...register('notes')}
                placeholder="Add any payment instructions, context or follow-up actions..."
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-border pt-6 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
      </div>
    </>
  );
}



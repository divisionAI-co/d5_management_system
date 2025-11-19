import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/crm';
import type { ConvertLeadPayload, CustomerSentiment, CustomerStatus, CustomerType, Lead } from '@/types/crm';
import { X } from 'lucide-react';

interface LeadConvertModalProps {
  lead: Lead;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
}

type FormValues = ConvertLeadPayload;

const CUSTOMER_TYPES: CustomerType[] = ['STAFF_AUGMENTATION', 'SOFTWARE_SUBSCRIPTION', 'BOTH'];
const CUSTOMER_STATUSES: CustomerStatus[] = ['ONBOARDING', 'ACTIVE', 'AT_RISK', 'PAUSED', 'CHURNED'];
const CUSTOMER_SENTIMENTS: CustomerSentiment[] = ['HAPPY', 'NEUTRAL', 'UNHAPPY'];

export function LeadConvertModal({ lead, onClose, onSuccess }: LeadConvertModalProps) {
  const queryClient = useQueryClient();

  // Get primary contact from contacts array or fallback to legacy contact
  const primaryContact = (lead.contacts && lead.contacts.length > 0)
    ? lead.contacts[0]
    : lead.contact;

  const defaultCustomerName = primaryContact?.companyName
    ? primaryContact.companyName
    : primaryContact
      ? `${primaryContact.firstName} ${primaryContact.lastName}`
      : '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      customerName: defaultCustomerName,
      customerEmail: primaryContact?.email || '',
      customerPhone: primaryContact?.phone ?? undefined,
      customerWebsite: lead.prospectWebsite ?? undefined,
      customerIndustry: lead.prospectIndustry ?? undefined,
      customerType: 'STAFF_AUGMENTATION',
      customerStatus: 'ACTIVE',
      customerSentiment: 'HAPPY',
      leadStatus: lead.status === 'WON' ? lead.status : 'WON',
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: FormValues) => leadsApi.convert(lead.id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
      queryClient.invalidateQueries({ queryKey: ['customer', data.convertedCustomer?.id] });
      onSuccess(data);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      ...values,
      customerMonthlyValue:
        values.customerMonthlyValue !== undefined && values.customerMonthlyValue !== null
          ? Number(values.customerMonthlyValue)
          : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Convert Lead</h2>
            <p className="text-sm text-muted-foreground">
              Finalize the conversion to a customer and capture contract metadata.
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
          <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
            <p>
              Converting lead <span className="font-semibold text-foreground">{lead.title}</span> for contact
              {primaryContact ? (
                <span className="font-semibold text-foreground"> {primaryContact.firstName} {primaryContact.lastName}</span>
              ) : (
                <span className="font-semibold text-foreground"> (No contact)</span>
              )}.
            </p>
            {lead.prospectCompanyName && (
              <p className="mt-1">
                Prospect company: <span className="font-semibold text-foreground">{lead.prospectCompanyName}</span>
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Customer Name *</label>
              <input
                type="text"
                {...register('customerName', { required: 'Customer name is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.customerName && <p className="text-sm text-red-600">{errors.customerName.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Customer Email *</label>
              <input
                type="email"
                {...register('customerEmail', { required: 'Customer email is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.customerEmail && <p className="text-sm text-red-600">{errors.customerEmail.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Customer Phone</label>
              <input
                type="text"
                {...register('customerPhone')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Website</label>
              <input
                type="text"
                {...register('customerWebsite')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Industry</label>
              <input
                type="text"
                {...register('customerIndustry')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Customer Type *</label>
              <select
                {...register('customerType', { required: 'Customer type is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {CUSTOMER_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Customer Status</label>
              <select
                {...register('customerStatus')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {CUSTOMER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Customer Sentiment</label>
              <select
                {...register('customerSentiment')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {CUSTOMER_SENTIMENTS.map((sentiment) => (
                  <option key={sentiment} value={sentiment}>
                    {sentiment}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Monthly Value</label>
              <input
                type="number"
                step="0.01"
                {...register('customerMonthlyValue', { valueAsNumber: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Currency</label>
              <input
                type="text"
                maxLength={10}
                {...register('customerCurrency')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="USD"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Customer Notes</label>
              <textarea
                rows={3}
                {...register('customerNotes')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Add onboarding notes or context"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Lead Status After Conversion</label>
              <select
                {...register('leadStatus')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {['WON', 'LOST'].map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-border pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? 'Converting...' : 'Convert Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

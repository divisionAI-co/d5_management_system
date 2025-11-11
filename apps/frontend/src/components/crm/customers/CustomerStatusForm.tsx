import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/crm';
import type { CustomerDetail, CustomerSentiment, CustomerStatus } from '@/types/crm';
import { X } from 'lucide-react';

const CUSTOMER_STATUSES: { label: string; value: CustomerStatus }[] = [
  { label: 'Onboarding', value: 'ONBOARDING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'At Risk', value: 'AT_RISK' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Churned', value: 'CHURNED' },
];

const CUSTOMER_SENTIMENTS: { label: string; value: CustomerSentiment }[] = [
  { label: 'Happy', value: 'HAPPY' },
  { label: 'Neutral', value: 'NEUTRAL' },
  { label: 'Unhappy', value: 'UNHAPPY' },
];

interface CustomerStatusFormProps {
  customer: CustomerDetail;
  onClose: () => void;
  onSuccess: (customer: CustomerDetail) => void;
}

type FormValues = {
  status: CustomerStatus;
  sentiment: CustomerSentiment;
  note?: string;
};

export function CustomerStatusForm({ customer, onClose, onSuccess }: CustomerStatusFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      status: customer.status,
      sentiment: customer.sentiment,
      note: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      customersApi.updateStatus(customer.id, {
        status: values.status,
        sentiment: values.sentiment,
        note: values.note ? values.note.trim() : undefined,
      }),
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values, {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['customer', customer.id] });
        onSuccess(updated);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Update Customer Health</h2>
            <p className="text-sm text-gray-500">
              Adjust the customer lifecycle status and sentiment.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 px-6 py-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status *</label>
            <select
              {...register('status', { required: 'Status is required' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {CUSTOMER_STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-red-600">{errors.status.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Sentiment *</label>
            <select
              {...register('sentiment', { required: 'Sentiment is required' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {CUSTOMER_SENTIMENTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.sentiment && (
              <p className="mt-1 text-sm text-red-600">{errors.sentiment.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={4}
              {...register('note')}
              placeholder="Add context for the status change..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



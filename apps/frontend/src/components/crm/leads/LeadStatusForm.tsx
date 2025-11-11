import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/crm';
import type { Lead, LeadStatus } from '@/types/crm';
import { X } from 'lucide-react';

interface LeadStatusFormProps {
  lead: Lead;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
}

type FormValues = {
  status: LeadStatus;
  probability?: number | null;
  lostReason?: string;
  actualCloseDate?: string;
};

const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

export function LeadStatusForm({ lead, onClose, onSuccess }: LeadStatusFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      status: lead.status,
      probability: lead.probability ?? undefined,
      lostReason: lead.lostReason ?? '',
      actualCloseDate: lead.actualCloseDate ? lead.actualCloseDate.split('T')[0] : undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: FormValues) =>
      leadsApi.updateStatus(lead.id, {
        ...payload,
        probability: payload.probability ?? undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead.id] });
      onSuccess(data);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Update Lead Status</h2>
            <p className="text-sm text-gray-500">Adjust the lifecycle stage and probability.</p>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              {...register('status', { required: 'Status is required' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {errors.status && <p className="text-sm text-red-600">{errors.status.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Probability %</label>
            <input
              type="number"
              min={0}
              max={100}
              {...register('probability', { valueAsNumber: true })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Actual Close Date</label>
            <input
              type="date"
              {...register('actualCloseDate')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Lost Reason</label>
            <textarea
              rows={3}
              {...register('lostReason')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="Capture the reason if the lead was lost"
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
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

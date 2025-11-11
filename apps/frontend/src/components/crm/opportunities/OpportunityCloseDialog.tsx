import { Controller, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { opportunitiesApi } from '@/lib/api/crm';
import type { CloseOpportunityPayload, Opportunity, OpportunityDetail } from '@/types/crm';
import { Loader2, X } from 'lucide-react';

interface OpportunityCloseDialogProps {
  opportunity: Opportunity;
  onClose: () => void;
  onSuccess: (opportunity: OpportunityDetail) => void;
}

type FormValues = {
  isWon: boolean;
  stage?: string;
  closedAt?: string;
};

export function OpportunityCloseDialog({
  opportunity,
  onClose,
  onSuccess,
}: OpportunityCloseDialogProps) {
  const queryClient = useQueryClient();

  const defaultStage = opportunity.isClosed
    ? opportunity.stage
    : opportunity.stage.toLowerCase().includes('proposal') || opportunity.stage.toLowerCase().includes('negotiation')
    ? 'Closed Won'
    : opportunity.stage;

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      isWon: opportunity.isWon,
      stage: opportunity.isWon ? 'Closed Won' : defaultStage || 'Closed Won',
      closedAt: (opportunity.closedAt ?? new Date().toISOString()).split('T')[0],
    },
  });

  const isWon = watch('isWon');

  const closeMutation = useMutation({
    mutationFn: (payload: CloseOpportunityPayload) =>
      opportunitiesApi.close(opportunity.id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity', opportunity.id] });
      onSuccess(data);
    },
  });

  const onSubmit = (values: FormValues) => {
    closeMutation.mutate({
      isWon: values.isWon,
      stage: values.stage || (values.isWon ? 'Closed Won' : 'Closed Lost'),
      closedAt: values.closedAt,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Close Opportunity</h2>
            <p className="text-sm text-muted-foreground">
              Decide the outcome and capture the closing details for{' '}
              <span className="font-semibold text-muted-foreground">{opportunity.title}</span>.
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
          <Controller
            name="isWon"
            control={control}
            render={({ field }) => (
              <div className="space-y-3 rounded-lg border border-border bg-muted p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Outcome
                </h3>
                <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={field.value === true}
                      onChange={() => field.onChange(true)}
                    />
                    Won
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={field.value === false}
                      onChange={() => field.onChange(false)}
                    />
                    Lost
                  </label>
                </div>
              </div>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Stage<span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                {...register('stage', { required: 'Stage is required when closing.' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder={isWon ? 'Closed Won' : 'Closed Lost'}
              />
              {errors.stage ? <p className="mt-1 text-sm text-rose-600">{errors.stage.message}</p> : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Closed Date</label>
              <input
                type="date"
                {...register('closedAt')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={closeMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {closeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { leadsApi } from '@/lib/api/crm/leads';
import { opportunitiesApi } from '@/lib/api/crm/opportunities';
import type { CreateOpportunityPayload, Lead } from '@/types/crm';

interface CreatePositionModalProps {
  onClose: () => void;
  onCreated?: (positionId?: string | null) => void;
}

interface FormValues {
  leadId: string;
  title: string;
  description?: string;
  value: number;
  jobDescriptionUrl?: string;
  positionTitle?: string;
  positionDescription?: string;
  positionRequirements?: string;
}

export function CreatePositionModal({ onClose, onCreated }: CreatePositionModalProps) {
  const [leadSearch, setLeadSearch] = useState('');

  const leadsQuery = useQuery({
    queryKey: ['leads', 'position-select', leadSearch],
    queryFn: () => leadsApi.list({ search: leadSearch, page: 1, pageSize: 100 }),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: '',
      description: '',
      value: 0,
      jobDescriptionUrl: '',
      positionTitle: '',
      positionDescription: '',
      positionRequirements: '',
    },
  });

  const titleValue = watch('title');

  const mutation = useMutation({
    mutationFn: (payload: CreateOpportunityPayload) => opportunitiesApi.create(payload),
    onSuccess: (opportunity) => {
      onCreated?.(opportunity.openPosition?.id ?? null);
      onClose();
    },
  });

  const leads = useMemo(() => leadsQuery.data?.data ?? [], [leadsQuery.data]);

  const onSubmit = (values: FormValues) => {
    const payload: CreateOpportunityPayload = {
      leadId: values.leadId,
      title: values.title,
      description: values.description || undefined,
      type: 'STAFF_AUGMENTATION',
      value: Number.isFinite(values.value) ? Number(values.value) : 0,
      jobDescriptionUrl: values.jobDescriptionUrl || undefined,
      positionTitle: values.positionTitle || values.title,
      positionDescription: values.positionDescription || undefined,
      positionRequirements: values.positionRequirements || undefined,
      stage: 'Discovery',
    };

    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Create New Position</h2>
            <p className="text-sm text-muted-foreground">
              Positions are generated from staff augmentation opportunities. Provide lead details below to create the opportunity and linked position.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-2">
          <section className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Lead *
              </label>
              <input
                type="text"
                value={leadSearch}
                onChange={(event) => setLeadSearch(event.target.value)}
                placeholder="Search lead by title or contact..."
                className="mb-2 w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              {leadsQuery.isLoading ? (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Loading leads...
                </div>
              ) : leads.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
                  No leads found. Create a lead first so we can attach the position to the correct client context.
                </div>
              ) : (
                <select
                  {...register('leadId', { required: 'Lead is required' })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">Select a lead</option>
                  {leads.map((lead: Lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.title} — {lead.contact.firstName} {lead.contact.lastName}
                    </option>
                  ))}
                </select>
              )}
              {errors.leadId && (
                <p className="mt-1 text-xs text-red-500">{errors.leadId.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Opportunity Title *
              </label>
              <input
                type="text"
                {...register('title', { required: 'Title is required' })}
                onBlur={() => {
                  const currentTitle = titleValue;
                  if (currentTitle) {
                    setValue('positionTitle', currentTitle, { shouldValidate: false });
                  }
                }}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Senior React Developer"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Opportunity Description
              </label>
              <textarea
                rows={4}
                {...register('description')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Context about the client need, timeline, and expectations."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Projected Value (USD)
              </label>
              <input
                type="number"
                step="100"
                {...register('value', { valueAsNumber: true, min: { value: 0, message: 'Value must be positive' } })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="15000"
              />
              {errors.value && (
                <p className="mt-1 text-xs text-red-500">{errors.value.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Job Description URL
              </label>
              <input
                type="url"
                {...register('jobDescriptionUrl')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="https://..."
              />
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Position Title
              </label>
              <input
                type="text"
                {...register('positionTitle')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Same as opportunity title by default"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Position Description
              </label>
              <textarea
                rows={4}
                {...register('positionDescription')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Responsibilities, tech stack, and expectations for the candidate."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Position Requirements
              </label>
              <textarea
                rows={4}
                {...register('positionRequirements')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Must-have skills, years of experience, timezone coverage, etc."
              />
            </div>
          </section>

          <div className="flex flex-col gap-3 border-t border-border pt-4 lg:col-span-2 lg:flex-row lg:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || leads.length === 0}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? 'Creating...' : 'Create Position'}
            </button>
          </div>

          {mutation.isError && (
            <div className="lg:col-span-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              Unable to create the position right now. Please verify the lead details and try again.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

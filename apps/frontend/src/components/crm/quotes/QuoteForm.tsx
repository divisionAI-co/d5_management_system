import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { quotesApi, leadsApi, opportunitiesApi } from '@/lib/api/crm';
import type { CreateQuotePayload, Quote, QuoteStatus } from '@/types/crm';
import { X } from 'lucide-react';
import { RichTextEditor } from '@/components/shared/RichTextEditor';

interface QuoteFormProps {
  quote?: Quote;
  onClose: () => void;
  onSuccess: () => void;
}

type FormValues = {
  leadId: string;
  opportunityId?: string;
  quoteNumber?: string;
  title: string;
  description?: string;
  overview?: string;
  functionalProposal?: string;
  technicalProposal?: string;
  teamComposition?: string;
  paymentTerms?: string;
  warrantyPeriod?: string;
  totalValue?: number | null;
  currency?: string;
  status: QuoteStatus;
  milestones?: string;
};

const QUOTE_STATUSES: QuoteStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED'];

export function QuoteForm({ quote, onClose, onSuccess }: QuoteFormProps) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(quote);

  const leadsQuery = useQuery({
    queryKey: ['leads', 'quote-select'],
    queryFn: () => leadsApi.list({ page: 1, pageSize: 100 }),
  });

  const defaultValues = useMemo<FormValues>(() => {
    if (!quote) {
      const urlLeadId = searchParams.get('leadId');
      const urlOpportunityId = searchParams.get('opportunityId');
      return {
        leadId: urlLeadId || '',
        opportunityId: urlOpportunityId || '',
        title: '',
        status: 'DRAFT',
        currency: 'USD',
        milestones: '',
      } as FormValues;
    }

    return {
      leadId: quote.leadId,
      opportunityId: quote.opportunityId ?? '',
      quoteNumber: quote.quoteNumber,
      title: quote.title,
      description: quote.description ?? '',
      overview: quote.overview ?? '',
      functionalProposal: quote.functionalProposal ?? '',
      technicalProposal: quote.technicalProposal ?? '',
      teamComposition: quote.teamComposition ?? '',
      paymentTerms: quote.paymentTerms ?? '',
      warrantyPeriod: quote.warrantyPeriod ?? '',
      totalValue: quote.totalValue ?? undefined,
      currency: quote.currency || 'USD',
      status: quote.status,
      milestones: quote.milestones ?? '',
    } as FormValues;
  }, [quote]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<FormValues>({
    defaultValues,
  });

  const selectedLeadId = watch('leadId');
  const opportunitiesQuery = useQuery({
    queryKey: ['opportunities', 'quote-select', selectedLeadId],
    queryFn: () => opportunitiesApi.list({ leadId: selectedLeadId, page: 1, pageSize: 100 }),
    enabled: !!selectedLeadId,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateQuotePayload) => quotesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      onSuccess();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreateQuotePayload) => quotesApi.update(quote!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', quote!.id] });
      onSuccess();
    },
  });

  const onSubmit = async (data: FormValues) => {
    const payload: CreateQuotePayload = {
      leadId: data.leadId,
      opportunityId: data.opportunityId || undefined,
      quoteNumber: data.quoteNumber,
      title: data.title,
      description: data.description || undefined,
      overview: data.overview || undefined,
      functionalProposal: data.functionalProposal || undefined,
      technicalProposal: data.technicalProposal || undefined,
      teamComposition: data.teamComposition || undefined,
      milestones: data.milestones || undefined,
      paymentTerms: data.paymentTerms || undefined,
      warrantyPeriod: data.warrantyPeriod || undefined,
      totalValue: data.totalValue || undefined,
      currency: data.currency || 'USD',
      status: data.status,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const leads = leadsQuery.data?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <h2 className="text-xl font-semibold text-foreground">
            {isEdit ? 'Edit Quote' : 'Create Quote'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Lead <span className="text-red-500">*</span>
              </label>
              <select
                {...register('leadId', { required: 'Lead is required' })}
                disabled={isEdit}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">Select a lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.title} {lead.contacts && lead.contacts.length > 0 && `- ${lead.contacts[0].firstName} ${lead.contacts[0].lastName}`}
                  </option>
                ))}
              </select>
              {errors.leadId && (
                <p className="mt-1 text-xs text-red-500">{errors.leadId.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Opportunity (Optional)
              </label>
              <select
                {...register('opportunityId')}
                disabled={!selectedLeadId || opportunitiesQuery.isLoading}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">No opportunity linked</option>
                {opportunitiesQuery.data?.data.map((opp) => (
                  <option key={opp.id} value={opp.id}>
                    {opp.title} {opp.value ? `(USD ${opp.value})` : ''}
                  </option>
                ))}
              </select>
              {!selectedLeadId && (
                <p className="mt-1 text-xs text-muted-foreground">Select a lead first to see opportunities</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">
                Quote Number
              </label>
              <input
                type="text"
                {...register('quoteNumber')}
                placeholder="Auto-generated if empty"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              {...register('title', { required: 'Title is required' })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Description</label>
            <RichTextEditor
              value={watch('description') || ''}
              onChange={(html) => setValue('description', html)}
              placeholder="Enter quote description..."
              minHeight="150px"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Overview</label>
            <RichTextEditor
              value={watch('overview') || ''}
              onChange={(html) => setValue('overview', html)}
              placeholder="Provide a high-level overview of the proposal..."
              minHeight="200px"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Functional Proposal</label>
            <RichTextEditor
              value={watch('functionalProposal') || ''}
              onChange={(html) => setValue('functionalProposal', html)}
              placeholder="Describe the functional aspects of your proposal..."
              minHeight="250px"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Technical Proposal</label>
            <RichTextEditor
              value={watch('technicalProposal') || ''}
              onChange={(html) => setValue('technicalProposal', html)}
              placeholder="Describe the technical aspects of your proposal..."
              minHeight="250px"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Team Composition</label>
            <RichTextEditor
              value={watch('teamComposition') || ''}
              onChange={(html) => setValue('teamComposition', html)}
              placeholder="Describe the team that will work on this project..."
              minHeight="200px"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Milestones</label>
            <RichTextEditor
              value={watch('milestones') || ''}
              onChange={(html) => setValue('milestones', html)}
              placeholder="Describe project milestones, deliverables, and timeline..."
              minHeight="250px"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Payment Terms</label>
            <textarea
              {...register('paymentTerms')}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="Describe payment terms and schedule..."
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Warranty Period</label>
              <input
                type="text"
                {...register('warrantyPeriod')}
                placeholder="e.g., 12 months"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Total Value</label>
              <input
                type="number"
                step="0.01"
                {...register('totalValue', { valueAsNumber: true })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">Currency</label>
              <select
                {...register('currency')}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="ALL">ALL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Status</label>
            <select
              {...register('status')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
            >
              {QUOTE_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting || createMutation.isPending || updateMutation.isPending
                ? 'Saving...'
                : isEdit
                  ? 'Update Quote'
                  : 'Create Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


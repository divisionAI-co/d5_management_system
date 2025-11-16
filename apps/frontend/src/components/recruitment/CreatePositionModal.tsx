import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, X } from 'lucide-react';
import { positionsApi } from '@/lib/api/recruitment';
import { opportunitiesApi } from '@/lib/api/crm/opportunities';
import type { Opportunity } from '@/types/crm';
import type {
  CreatePositionDto,
  PositionStatus,
  OpenPosition,
  UpdatePositionDto,
} from '@/types/recruitment';

interface CreatePositionModalProps {
  onClose: () => void;
  onCreated?: (position: OpenPosition) => void;
  onUpdated?: (position: OpenPosition) => void;
  defaultOpportunity?: {
    id: string;
    title: string;
    customerName?: string;
  };
  position?: OpenPosition | null;
}

interface FormValues {
  title: string;
  description?: string;
  requirements?: string;
  opportunityId?: string;
  status: PositionStatus;
}

export function CreatePositionModal({
  onClose,
  onCreated,
  onUpdated,
  defaultOpportunity,
  position,
}: CreatePositionModalProps) {
  const queryClient = useQueryClient();
  const [opportunitySearch, setOpportunitySearch] = useState('');
  const isEditMode = Boolean(position);

  const opportunitiesQuery = useQuery({
    queryKey: ['opportunities', 'position-select', opportunitySearch],
    enabled: !defaultOpportunity,
    queryFn: () =>
      opportunitiesApi.list({
        search: opportunitySearch || undefined,
        page: 1,
        pageSize: 50,
        // Don't filter by isClosed - show all opportunities, user can choose
      }),
  });

  const opportunities = useMemo<Opportunity[]>(
    () => opportunitiesQuery.data?.data ?? [],
    [opportunitiesQuery.data],
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: position?.title ?? defaultOpportunity?.title ?? '',
      description: position?.description ?? '',
      requirements: position?.requirements ?? '',
      // Default to empty string (no opportunity link) when creating new position
      opportunityId: position?.opportunity?.id ?? defaultOpportunity?.id ?? '',
      status: position?.status ?? 'Open',
    },
  });

  const selectedOpportunityId = watch('opportunityId');

  useEffect(() => {
    reset({
      title: position?.title ?? defaultOpportunity?.title ?? '',
      description: position?.description ?? '',
      requirements: position?.requirements ?? '',
      opportunityId: position?.opportunity?.id ?? defaultOpportunity?.id ?? '',
      status: position?.status ?? 'Open',
    });
  }, [defaultOpportunity, position, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: CreatePositionDto) => positionsApi.create(payload),
    onSuccess: (position) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      if (position.opportunity) {
        queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      }
      onCreated?.(position);
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdatePositionDto }) =>
      positionsApi.update(id, payload),
    onSuccess: (position) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['position', position.id] });
      onUpdated?.(position);
      onClose();
    },
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: FormValues) => {
    if (isEditMode && position) {
      const payload: UpdatePositionDto = {
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        requirements: values.requirements?.trim() || undefined,
        status: values.status,
        // Include opportunityId in update to allow changing the link
        opportunityId: values.opportunityId || undefined,
      };
      updateMutation.mutate({ id: position.id, payload });
      return;
    }

    const payload: CreatePositionDto = {
      title: values.title.trim(),
      description: values.description?.trim() || undefined,
      requirements: values.requirements?.trim() || undefined,
      status: values.status,
      opportunityId: defaultOpportunity
        ? defaultOpportunity.id
        : values.opportunityId || undefined,
    };

    createMutation.mutate(payload);
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              {isEditMode ? 'Edit Job Position' : 'Create Job Position'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEditMode
                ? 'Update position details to keep recruiting and delivery aligned.'
                : 'Job positions can exist independently or be linked to an opportunity. Link it when you’re ready to source candidates.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Position Title<span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                {...register('title', { required: 'Title is required' })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Senior React Engineer"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-rose-600">{errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Status
              </label>
              <select
                {...register('status')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="Open">Open</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Filled">Filled</option>
              </select>
            </div>
            </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <textarea
                rows={4}
                {...register('description')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Overview of responsibilities and context."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Requirements
              </label>
              <textarea
                rows={4}
                {...register('requirements')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Key skills, location/timezone expectations, availability, etc."
              />
            </div>
            </div>

          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">Opportunity Link</p>
                <p className="text-xs text-muted-foreground">
                  Optional. Link to an opportunity when you want CRM context for this role.
                </p>
              </div>
              {defaultOpportunity ? (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Locked from opportunity
                </span>
              ) : null}
            </div>

            {defaultOpportunity ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                <p className="font-semibold">{defaultOpportunity.title}</p>
                {defaultOpportunity.customerName ? (
                  <p className="text-xs text-blue-700">{defaultOpportunity.customerName}</p>
                ) : null}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={opportunitySearch}
                      onChange={(event) => setOpportunitySearch(event.target.value)}
                      placeholder="Search opportunity by title or client"
                      className="w-full rounded-lg border border-border px-9 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                {opportunitiesQuery.isLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading opportunities...
                  </div>
                ) : opportunities.length === 0 ? (
                  <div className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                    {opportunitySearch
                      ? 'No opportunities found matching your search.'
                      : 'No opportunities available.'}
                  </div>
                ) : (
                  <select
                    {...register('opportunityId')}
                    value={selectedOpportunityId || ''}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="">No opportunity link</option>
                    {opportunities.map((opportunity) => (
                      <option key={opportunity.id} value={opportunity.id}>
                        {opportunity.title}
                        {opportunity.customer ? ` — ${opportunity.customer.name}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? isEditMode
                  ? 'Saving…'
                  : 'Creating…'
                : isEditMode
                ? 'Save Changes'
                : 'Create Position'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { opportunitiesApi, customersApi, leadsApi } from '@/lib/api/crm';
import { usersApi } from '@/lib/api/users';
import { DEFAULT_OPPORTUNITY_STAGE, OPPORTUNITY_STAGES } from '@/constants/opportunities';
import { useOpportunityStagesStore } from '@/lib/stores/opportunity-stages-store';
import type {
  CreateOpportunityPayload,
  OpportunityDetail,
  CustomerSummary,
  Lead,
  CustomerType,
} from '@/types/crm';
import { Loader2, X } from 'lucide-react';
import { MentionInput } from '@/components/shared/MentionInput';

interface OpportunityFormProps {
  opportunityId?: string;
  onClose: () => void;
  onSuccess: (opportunity: OpportunityDetail) => void;
}

type FormValues = {
  leadId: string;
  customerId?: string;
  title: string;
  description?: string;
  type: CustomerType;
  value: number;
  stage: string;
  assignedToId?: string;
  jobDescriptionUrl?: string;
  positionTitle?: string;
  positionDescription?: string;
  positionRequirements?: string;
};

const CUSTOMER_TYPE_OPTIONS: Array<{ label: string; value: CustomerType }> = [
  { label: 'Staff Augmentation', value: 'STAFF_AUGMENTATION' },
  { label: 'Software Subscription', value: 'SOFTWARE_SUBSCRIPTION' },
  { label: 'Hybrid', value: 'BOTH' },
];

export function OpportunityForm({ opportunityId, onClose, onSuccess }: OpportunityFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(opportunityId);
  const stageStoreStages = useOpportunityStagesStore((state) => state.stages);
  const registerStages = useOpportunityStagesStore((state) => state.registerStages);

  const opportunityQuery = useQuery({
    queryKey: ['opportunity', opportunityId],
    queryFn: () => opportunitiesApi.getById(opportunityId!),
    enabled: isEdit,
  });

  const customersQuery = useQuery({
    queryKey: ['customers', 'options'],
    queryFn: () =>
      customersApi.list({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  });

  const leadsQuery = useQuery({
    queryKey: ['leads', 'options'],
    queryFn: () =>
      leadsApi.list({
        page: 1,
        pageSize: 50,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'options'],
    queryFn: () => usersApi.list({ page: 1, pageSize: 100 }),
  });

  const opportunity = opportunityQuery.data;

  const baseCustomers = useMemo(
    () => customersQuery.data?.data ?? [],
    [customersQuery.data?.data],
  );

  const customers: CustomerSummary[] = useMemo(() => {
    if (
      opportunity?.customer &&
      opportunity.customerId &&
      !baseCustomers.some((customer) => customer.id === opportunity.customerId)
    ) {
      return [
        ...baseCustomers,
        {
          id: opportunity.customer.id,
          name: opportunity.customer.name,
          email: opportunity.customer.email ?? '',
          phone: opportunity.customer.phone ?? '',
          website: '',
          industry: '',
          type: opportunity.type,
          status: 'ACTIVE',
          sentiment: 'NEUTRAL',
          address: '',
          city: '',
          country: '',
          postalCode: '',
          monthlyValue: null,
          currency: 'USD',
          notes: '',
          tags: [],
          odooId: '',
          createdAt: opportunity.createdAt,
          updatedAt: opportunity.updatedAt,
          _count: {
            contacts: 0,
            opportunities: 0,
            invoices: 0,
          },
        } as CustomerSummary,
      ];
    }
    return baseCustomers;
  }, [baseCustomers, opportunity]);

  const baseLeads = useMemo(() => leadsQuery.data?.data ?? [], [leadsQuery.data?.data]);

  const leads: Lead[] = useMemo(() => {
    if (
      opportunity?.lead &&
      !baseLeads.some((lead) => lead.id === opportunity.lead?.id)
    ) {
      const fallbackLead: Lead = {
        id: opportunity.lead.id,
        title: opportunity.lead.title,
        status: opportunity.lead.status ?? 'NEW',
        description: opportunity.description ?? '',
        value: opportunity.value,
        probability: null,
        assignedToId: opportunity.assignedToId ?? undefined,
        source: undefined,
        expectedCloseDate: undefined,
        actualCloseDate: undefined,
        lostReason: undefined,
        prospectCompanyName: undefined,
        prospectWebsite: undefined,
        prospectIndustry: undefined,
        convertedCustomerId: opportunity.customerId ?? undefined,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
        contact: {
          id: opportunity.lead.id,
          firstName: opportunity.customer?.name ?? 'Contact',
          lastName: '',
          email: '',
          phone: '',
          role: '',
          companyName: opportunity.customer?.name ?? '',
          customerId: opportunity.customerId ?? undefined,
          createdAt: opportunity.createdAt,
          updatedAt: opportunity.updatedAt,
        },
        assignedTo: opportunity.assignedTo
          ? {
              id: opportunity.assignedTo.id,
              firstName: opportunity.assignedTo.firstName,
              lastName: opportunity.assignedTo.lastName,
              email: opportunity.assignedTo.email,
            }
          : null,
        convertedCustomer: opportunity.customer
          ? {
              id: opportunity.customer.id,
              name: opportunity.customer.name,
              email: opportunity.customer.email ?? undefined,
            }
          : null,
      };

      return [...baseLeads, fallbackLead];
    }
    return baseLeads;
  }, [baseLeads, opportunity]);

  const users = usersQuery.data?.data ?? [];
  const eligibleUsers = useMemo(() => {
    // Filter to only ADMIN and SALESPERSON roles
    const filtered = users.filter(
        (user) =>
          user.isActive && (user.role === 'ADMIN' || user.role === 'SALESPERSON'),
    );
    
    // If editing and current owner is not in the filtered list, include them
    // This prevents accidentally unassigning when the owner's role changed
    if (opportunity?.assignedToId) {
      const currentOwner = users.find((user) => user.id === opportunity.assignedToId);
      if (currentOwner && !filtered.some((user) => user.id === currentOwner.id)) {
        return [...filtered, currentOwner];
      }
    }
    
    return filtered;
  }, [users, opportunity?.assignedToId]);
  const stageOptions = useMemo(() => {
    if (
      opportunity?.stage &&
      !stageStoreStages.some(
        (stage) => stage.toLowerCase() === opportunity.stage.toLowerCase(),
      )
    ) {
      return [...stageStoreStages, opportunity.stage];
    }
    return stageStoreStages.length > 0 ? stageStoreStages : OPPORTUNITY_STAGES;
  }, [stageStoreStages, opportunity?.stage]);

  const defaultStageValue = stageOptions[0] ?? DEFAULT_OPPORTUNITY_STAGE;

  useEffect(() => {
    if (opportunity?.stage) {
      registerStages([opportunity.stage]);
    }
  }, [opportunity?.stage, registerStages]);

  const defaultValues = useMemo<FormValues>(() => {
    if (!opportunity) {
      return {
        leadId: '',
        customerId: '',
        title: '',
        description: '',
        type: 'STAFF_AUGMENTATION',
        value: 0,
        stage: defaultStageValue,
        assignedToId: undefined,
        jobDescriptionUrl: '',
        positionTitle: '',
        positionDescription: '',
        positionRequirements: '',
      };
    }

    return {
      leadId: opportunity.lead?.id ?? '',
      customerId: opportunity.customerId ?? '',
      title: opportunity.title,
      description: opportunity.description ?? '',
      type: opportunity.type,
      value: opportunity.value ?? 0,
      stage: opportunity.stage ?? defaultStageValue,
      assignedToId: opportunity.assignedToId ?? undefined,
      jobDescriptionUrl: opportunity.jobDescriptionUrl ?? '',
      positionTitle: opportunity.openPosition?.title ?? '',
      positionDescription: opportunity.openPosition?.description ?? '',
      positionRequirements: opportunity.openPosition?.requirements ?? '',
    };
  }, [opportunity, defaultStageValue]);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  const descriptionValue = watch('description') || '';
  const positionDescriptionValue = watch('positionDescription') || '';

  const selectedType = watch('type');
  const selectedLeadId = watch('leadId');
  const selectedCustomerId = watch('customerId');
  const requiresPositionDetails =
    selectedType === 'STAFF_AUGMENTATION' || selectedType === 'BOTH';

  useEffect(() => {
    if (opportunity) {
      reset(defaultValues);
    }
  }, [opportunity, defaultValues, reset]);

  useEffect(() => {
    const selectedLead = leads.find((lead) => lead.id === selectedLeadId);
    if (
      selectedLead?.convertedCustomerId &&
      selectedLead.convertedCustomerId !== selectedCustomerId
    ) {
      setValue('customerId', selectedLead.convertedCustomerId);
    }
  }, [selectedLeadId, selectedCustomerId, leads, setValue]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateOpportunityPayload) => opportunitiesApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      onSuccess(data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreateOpportunityPayload) =>
      opportunitiesApi.update(opportunityId!, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      onSuccess(data);
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload: CreateOpportunityPayload = {
      leadId: values.leadId,
      customerId: values.customerId && values.customerId !== '' ? values.customerId : undefined,
      title: values.title,
      description: values.description || undefined,
      type: values.type,
      value: Number.isFinite(values.value) ? values.value : 0,
      assignedToId: values.assignedToId || undefined,
      jobDescriptionUrl: values.jobDescriptionUrl || undefined,
      stage: values.stage || DEFAULT_OPPORTUNITY_STAGE,
    };

    if (requiresPositionDetails) {
      payload.positionTitle = values.positionTitle || undefined;
      payload.positionDescription = values.positionDescription || undefined;
      payload.positionRequirements = values.positionRequirements || undefined;
    }

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  if (isEdit && opportunityQuery.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-card px-6 py-4 text-muted-foreground shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading opportunity details...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Edit Opportunity' : 'New Opportunity'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Update opportunity details to keep the pipeline current.'
                : 'Capture a new opportunity for your pipeline.'}
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
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Lead<span className="text-rose-500">*</span>
              </label>
              <select
                {...register('leadId', { required: 'Select a lead' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select lead</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.title}
                  </option>
                ))}
              </select>
              {errors.leadId ? (
                <p className="mt-1 text-sm text-rose-600">{errors.leadId.message}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Customer <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <select
                {...register('customerId')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned / Not converted</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Once the lead converts, the opportunity will automatically inherit the customer.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Title<span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                {...register('title', { required: 'Opportunity title is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Eg. 3 React Engineers for Fintech client"
              />
              {errors.title ? <p className="mt-1 text-sm text-rose-600">{errors.title.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Description</label>
              <MentionInput
                value={descriptionValue}
                onChange={(value) => setValue('description', value)}
                rows={3}
                placeholder="Add context, scope, stakeholders or next steps. Type @ to mention someone"
                multiline={true}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Type<span className="text-rose-500">*</span>
              </label>
              <select
                {...register('type', { required: 'Select an opportunity type' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {CUSTOMER_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Stage<span className="text-rose-500">*</span>
              </label>
              <select
                {...register('stage', { required: 'Stage is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
              {errors.stage ? <p className="mt-1 text-sm text-rose-600">{errors.stage.message}</p> : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Value (USD)<span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                step="0.01"
                {...register('value', {
                  valueAsNumber: true,
                  required: 'Projected value is required',
                  min: { value: 0, message: 'Value must be positive' },
                })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.value ? <p className="mt-1 text-sm text-rose-600">{errors.value.message}</p> : null}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Assigned To</label>
              <select
                {...register('assignedToId')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Unassigned</option>
                {eligibleUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName} ({user.role})
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                Only active admins and salespeople can own opportunities.
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Job Description URL</label>
              <input
                type="url"
                {...register('jobDescriptionUrl')}
                placeholder="https://"
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {requiresPositionDetails ? (
            <div className="space-y-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-800">
                Staffing Details
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Position Title</label>
                  <input
                    type="text"
                    {...register('positionTitle')}
                    placeholder="Role title for recruiters"
                    className="w-full rounded-lg border border-blue-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-blue-900">Requirements</label>
                  <input
                    type="text"
                    {...register('positionRequirements')}
                    placeholder="Key skills or requirements"
                    className="w-full rounded-lg border border-blue-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-blue-900">Position Description</label>
                  <MentionInput
                    value={positionDescriptionValue}
                    onChange={(value) => setValue('positionDescription', value)}
                    rows={3}
                    placeholder="Share detailed context for recruiters. Type @ to mention someone"
                    multiline={true}
                    className="w-full rounded-lg border border-blue-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          ) : null}

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
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {isEdit ? 'Save Changes' : 'Create Opportunity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



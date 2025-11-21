import { useEffect, useMemo, useState, useRef } from 'react';
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
import { Loader2, X, ChevronDown, Search, Plus, Trash2 } from 'lucide-react';
import { MentionInput } from '@/components/shared/MentionInput';
import { FeedbackToast } from '@/components/ui/feedback-toast';

interface OpportunityFormProps {
  opportunityId?: string;
  onClose: () => void;
  onSuccess: (opportunity: OpportunityDetail) => void;
}

type PositionFormData = {
  title: string;
  description?: string;
  requirements?: string;
  recruitmentStatus?: 'HEADHUNTING' | 'STANDARD';
};

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
  positionTitle?: string; // Legacy - kept for backward compatibility
  positionDescription?: string; // Legacy
  positionRequirements?: string; // Legacy
  positions?: PositionFormData[]; // New array format
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [debouncedLeadSearchTerm, setDebouncedLeadSearchTerm] = useState('');
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const leadDropdownRef = useRef<HTMLDivElement>(null);
  const leadInputRef = useRef<HTMLInputElement>(null);

  // Debounce search term
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedLeadSearchTerm(leadSearchTerm);
    }, 300);
    return () => clearTimeout(timeout);
  }, [leadSearchTerm]);

  const leadsQuery = useQuery({
    queryKey: ['leads', 'options', debouncedLeadSearchTerm],
    queryFn: () =>
      leadsApi.list({
        page: 1,
        pageSize: 100,
        sortBy: 'createdAt',
        sortOrder: 'desc',
        search: debouncedLeadSearchTerm || undefined,
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
        positions: [],
      };
    }

    // Use new array format if openPositions exists
    const positionsArray: PositionFormData[] = 
      opportunity.openPositions && opportunity.openPositions.length > 0
        ? opportunity.openPositions.map((pos) => ({
            title: pos.title,
            description: pos.description ?? '',
            requirements: pos.requirements ?? '',
            recruitmentStatus: pos.recruitmentStatus ?? undefined,
          }))
        : [];

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
      positionTitle: '', // Always use array format now
      positionDescription: '',
      positionRequirements: '',
      positions: positionsArray.length > 0 ? positionsArray : [],
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
  const positions = watch('positions') || [];

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
    
    // Update search term to show selected lead title
    if (selectedLead && selectedLeadId && leadSearchTerm !== selectedLead.title) {
      setLeadSearchTerm(selectedLead.title);
    }
  }, [selectedLeadId, selectedCustomerId, leads, setValue, leadSearchTerm]);

  // Initialize lead search term when editing
  useEffect(() => {
    if (opportunity?.lead && opportunity.lead.id && !leadSearchTerm) {
      setLeadSearchTerm(opportunity.lead.title);
    }
  }, [opportunity?.lead, leadSearchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        leadDropdownRef.current &&
        !leadDropdownRef.current.contains(event.target as Node) &&
        leadInputRef.current &&
        !leadInputRef.current.contains(event.target as Node)
      ) {
        setShowLeadDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const createMutation = useMutation({
    mutationFn: (payload: CreateOpportunityPayload) => opportunitiesApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      setSuccessMessage('Opportunity created successfully');
      onSuccess(data);
      setTimeout(() => {
        onClose();
      }, 1000);
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || 'Failed to create opportunity');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreateOpportunityPayload) =>
      opportunitiesApi.update(opportunityId!, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['opportunity', opportunityId] });
      setSuccessMessage('Opportunity updated successfully');
      onSuccess(data);
      setTimeout(() => {
        onClose();
      }, 1000);
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || 'Failed to update opportunity');
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
      // Use new array format if positions are provided, otherwise fall back to legacy format
      if (values.positions && values.positions.length > 0) {
        payload.positions = values.positions.filter(
          (pos) => pos.title && pos.title.trim().length > 0
        );
      } else {
        // Legacy format for backward compatibility
        payload.positionTitle = values.positionTitle || undefined;
        payload.positionDescription = values.positionDescription || undefined;
        payload.positionRequirements = values.positionRequirements || undefined;
      }
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
              <div className="relative" ref={leadDropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    ref={leadInputRef}
                    type="text"
                    value={leadSearchTerm}
                    onChange={(e) => {
                      setLeadSearchTerm(e.target.value);
                      setShowLeadDropdown(true);
                    }}
                    onFocus={() => setShowLeadDropdown(true)}
                    placeholder="Search leads by title or contact..."
                    className="w-full rounded-lg border border-border pl-10 pr-10 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="hidden"
                    {...register('leadId', { required: 'Select a lead' })}
                  />
                </div>
                
                {showLeadDropdown && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                    {leadsQuery.isLoading ? (
                      <div className="flex items-center justify-center px-4 py-3 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading leads...
                      </div>
                    ) : leads.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-muted-foreground">
                        {leadSearchTerm ? 'No leads found matching your search' : 'No leads available'}
                      </div>
                    ) : (
                      leads.map((lead) => (
                        <button
                          key={lead.id}
                          type="button"
                          onClick={() => {
                            setValue('leadId', lead.id, { shouldValidate: true });
                            setLeadSearchTerm(lead.title);
                            setShowLeadDropdown(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm transition hover:bg-muted ${
                            selectedLeadId === lead.id ? 'bg-blue-50 text-blue-900' : 'text-foreground'
                          }`}
                        >
                          <div className="font-medium">{lead.title}</div>
                          {(() => {
                            const contactsToShow = (lead.contacts && lead.contacts.length > 0) 
                              ? lead.contacts 
                              : (lead.contact ? [lead.contact] : []);
                            const hasMultipleContacts = lead.contacts && lead.contacts.length > 1;
                            
                            return contactsToShow.length > 0 ? (
                              <div className="text-xs text-muted-foreground">
                                {contactsToShow.slice(0, 2).map((contact, idx) => (
                                  <div key={contact.id || idx}>
                                    {contact.firstName} {contact.lastName}
                                    {contact.companyName && ` • ${contact.companyName}`}
                                    {contact.email && ` • ${contact.email}`}
                                  </div>
                                ))}
                                {hasMultipleContacts && contactsToShow.length > 2 && (
                                  <div className="mt-1 text-blue-600">
                                    +{contactsToShow.length - 2} more contact{contactsToShow.length - 2 !== 1 ? 's' : ''}
                                  </div>
                                )}
                                {hasMultipleContacts && contactsToShow.length <= 2 && (
                                  <div className="mt-1 text-blue-600">
                                    ({contactsToShow.length} contacts)
                                  </div>
                                )}
                              </div>
                            ) : null;
                          })()}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
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
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-800">
                  Staffing Details
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const currentPositions = watch('positions') || [];
                    setValue('positions', [
                      ...currentPositions,
                      { title: '', description: '', requirements: '' },
                    ]);
                  }}
                  className="flex items-center gap-1 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Position
                </button>
              </div>

              {positions.length > 0 ? (
                <div className="space-y-4">
                  {positions.map((_, index) => (
                    <div
                      key={index}
                      className="rounded-lg border border-blue-200 bg-white p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-blue-900">
                          Position {index + 1}
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            const currentPositions = watch('positions') || [];
                            setValue(
                              'positions',
                              currentPositions.filter((_, i) => i !== index)
                            );
                          }}
                          className="rounded p-1 text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-blue-900">
                            Position Title<span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            {...register(`positions.${index}.title` as const, {
                              required: 'Position title is required',
                            })}
                            placeholder="Role title for recruiters"
                            className="w-full rounded-lg border border-blue-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-blue-900">
                            Recruitment Status
                          </label>
                          <select
                            {...register(`positions.${index}.recruitmentStatus` as const)}
                            className="w-full rounded-lg border border-blue-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Standard</option>
                            <option value="HEADHUNTING">Headhunting</option>
                            <option value="STANDARD">Standard</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-blue-900">
                            Requirements
                          </label>
                          <input
                            type="text"
                            {...register(`positions.${index}.requirements` as const)}
                            placeholder="Key skills or requirements"
                            className="w-full rounded-lg border border-blue-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-sm font-medium text-blue-900">
                            Position Description
                          </label>
                          <MentionInput
                            value={watch(`positions.${index}.description` as const) || ''}
                            onChange={(value) =>
                              setValue(`positions.${index}.description` as const, value)
                            }
                            rows={3}
                            placeholder="Share detailed context for recruiters. Type @ to mention someone"
                            multiline={true}
                            className="w-full rounded-lg border border-blue-200 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-blue-300 bg-white p-6 text-center">
                  <p className="text-sm text-blue-700">
                    No positions added yet. Click "Add Position" to create staffing requirements.
                  </p>
                </div>
              )}
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
      {successMessage && (
        <FeedbackToast
          message={successMessage}
          onDismiss={() => setSuccessMessage(null)}
          tone="success"
        />
      )}
      {errorMessage && (
        <FeedbackToast
          message={errorMessage}
          onDismiss={() => setErrorMessage(null)}
          tone="error"
        />
      )}
    </div>
  );
}



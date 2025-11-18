import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/crm';
import { usersApi } from '@/lib/api/users';
import type { CreateLeadPayload, Lead, LeadStatus, LeadContactPayload } from '@/types/crm';
import { X } from 'lucide-react';
import { MentionInput } from '@/components/shared/MentionInput';

interface LeadFormProps {
  lead?: Lead;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
}

type FormValues = {
  contactMode: 'existing' | 'new';
  contactId?: string;
  contact?: LeadContactPayload;
  title: string;
  description?: string;
  status: LeadStatus;
  value?: number | null;
  probability?: number | null;
  assignedToId?: string | null;
  source?: string;
  expectedCloseDate?: string;
  prospectCompanyName?: string;
  prospectWebsite?: string;
  prospectIndustry?: string;
};

const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];

export function LeadForm({ lead, onClose, onSuccess }: LeadFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(lead);

  const [contactSearch, setContactSearch] = useState('');

  const contactsQuery = useQuery({
    queryKey: ['lead-contacts', contactSearch],
    queryFn: () => leadsApi.listContacts(contactSearch),
  });

  const usersQuery = useQuery({
    queryKey: ['users', 'lead-select'],
    queryFn: () => usersApi.list({ page: 1, pageSize: 100 }),
  });

  const defaultValues = useMemo<FormValues>(() => {
    if (!lead) {
      return {
        contactMode: 'new',
        status: 'NEW',
      } as FormValues;
    }

    return {
      contactMode: 'existing',
      contactId: lead.contact?.id,
      title: lead.title,
      description: lead.description ?? '',
      status: lead.status,
      value: lead.value ?? undefined,
      probability: lead.probability ?? undefined,
      assignedToId: lead.assignedToId ?? undefined,
      source: lead.source ?? '',
      expectedCloseDate: lead.expectedCloseDate
        ? lead.expectedCloseDate.split('T')[0]
        : undefined,
      prospectCompanyName: lead.prospectCompanyName ?? '',
      prospectWebsite: lead.prospectWebsite ?? '',
      prospectIndustry: lead.prospectIndustry ?? '',
      contact: lead.contact
        ? {
            firstName: lead.contact.firstName,
            lastName: lead.contact.lastName,
            email: lead.contact.email,
            phone: lead.contact.phone ?? undefined,
            role: lead.contact.role ?? undefined,
            companyName: lead.contact.companyName ?? undefined,
            customerId: lead.contact.customerId ?? undefined,
          }
        : undefined,
    } as FormValues;
  }, [lead]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  const descriptionValue = watch('description') || '';

  const contactMode = watch('contactMode');
  const selectedContactId = watch('contactId');

  useEffect(() => {
    if (!isEdit) {
      setValue('status', 'NEW');
    }
  }, [isEdit, setValue]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateLeadPayload) => leadsApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      onSuccess(data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreateLeadPayload) => leadsApi.update(lead!.id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', lead!.id] });
      onSuccess(data);
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload: CreateLeadPayload = {
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      value: values.value ?? undefined,
      probability: values.probability ?? undefined,
      assignedToId: values.assignedToId || undefined,
      source: values.source || undefined,
      expectedCloseDate: values.expectedCloseDate || undefined,
      prospectCompanyName: values.prospectCompanyName || undefined,
      prospectWebsite: values.prospectWebsite || undefined,
      prospectIndustry: values.prospectIndustry || undefined,
    };

    if (values.contactMode === 'existing') {
      if (!values.contactId) {
        throw new Error('Please select a contact');
      }
      payload.contactId = values.contactId;
    } else if (values.contact) {
      payload.contact = {
        firstName: values.contact.firstName,
        lastName: values.contact.lastName,
        email: values.contact.email,
        phone: values.contact.phone || undefined,
        role: values.contact.role || undefined,
        companyName: values.contact.companyName || undefined,
        customerId: values.contact.customerId || undefined,
      };
    }

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Edit Lead' : 'New Lead'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit ? 'Update the lead details.' : 'Capture a new prospect opportunity.'}
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
          <div className="space-y-4 rounded-lg border border-border bg-muted p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase text-muted-foreground">Contact</h3>
              <div className="flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    value="existing"
                    {...register('contactMode')}
                    defaultChecked={contactMode === 'existing'}
                  />
                  Existing
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    value="new"
                    {...register('contactMode')}
                    defaultChecked={contactMode === 'new'}
                  />
                  New
                </label>
              </div>
            </div>

            {contactMode === 'existing' ? (
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Search contacts by name, email, or company"
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <select
                  {...register('contactId', {
                    required: contactMode === 'existing' ? 'Please select a contact' : false,
                  })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  defaultValue={selectedContactId || ''}
                >
                  <option value="">Select a contact</option>
                  {contactsQuery.data?.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.firstName} {contact.lastName} — {contact.email}
                    </option>
                  ))}
                </select>
                {errors.contactId && (
                  <p className="text-sm text-red-600">{errors.contactId.message}</p>
                )}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">First Name *</label>
                  <input
                    type="text"
                    {...register('contact.firstName', { required: 'Required' })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.contact?.firstName && (
                    <p className="text-sm text-red-600">{errors.contact.firstName.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Last Name *</label>
                  <input
                    type="text"
                    {...register('contact.lastName', { required: 'Required' })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.contact?.lastName && (
                    <p className="text-sm text-red-600">{errors.contact.lastName.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Email *</label>
                  <input
                    type="email"
                    {...register('contact.email', { required: 'Required' })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                  {errors.contact?.email && (
                    <p className="text-sm text-red-600">{errors.contact.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Phone</label>
                  <input
                    type="text"
                    {...register('contact.phone')}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Role</label>
                  <input
                    type="text"
                    {...register('contact.role')}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">Company</label>
                  <input
                    type="text"
                    {...register('contact.companyName')}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Title *</label>
              <input
                type="text"
                {...register('title', { required: 'Lead title is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Description</label>
              <MentionInput
                value={descriptionValue}
                onChange={(value) => setValue('description', value)}
                rows={3}
                placeholder="Add context, discovery notes or qualification criteria. Type @ to mention someone"
                multiline={true}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Status</label>
              <select
                {...register('status')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {LEAD_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Probability %</label>
              <input
                type="number"
                min={0}
                max={100}
                step={1}
                {...register('probability', { valueAsNumber: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Value</label>
              <input
                type="number"
                step="0.01"
                {...register('value', { valueAsNumber: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Expected Close Date</label>
              <input
                type="date"
                {...register('expectedCloseDate')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Source</label>
              <input
                type="text"
                {...register('source')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Assigned To</label>
              <select
                {...register('assignedToId')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                defaultValue={lead?.assignedToId || ''}
              >
                <option value="">Unassigned</option>
                {(usersQuery.data?.data ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.firstName} {user.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Prospect Company</label>
              <input
                type="text"
                {...register('prospectCompanyName')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Prospect Website</label>
              <input
                type="text"
                {...register('prospectWebsite')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Prospect Industry</label>
              <input
                type="text"
                {...register('prospectIndustry')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
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
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

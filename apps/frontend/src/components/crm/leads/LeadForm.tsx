import { useEffect, useMemo, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { leadsApi } from '@/lib/api/crm';
import { usersApi } from '@/lib/api/users';
import type { CreateLeadPayload, Lead, LeadStatus, LeadType, LeadContactPayload, Contact } from '@/types/crm';
import { X, Search, ChevronDown, XCircle } from 'lucide-react';
import { MentionInput } from '@/components/shared/MentionInput';

interface LeadFormProps {
  lead?: Lead;
  onClose: () => void;
  onSuccess: (lead: Lead) => void;
}

type FormValues = {
  contactMode: 'existing' | 'new';
  contactIds?: string[];
  contactId?: string; // Legacy single contact
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
  leadType?: LeadType | null;
};

const LEAD_STATUSES: LeadStatus[] = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST'];
const LEAD_TYPES: LeadType[] = ['END_CUSTOMER', 'INTERMEDIARY'];

export function LeadForm({ lead, onClose, onSuccess }: LeadFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(lead);

  const [contactSearch, setContactSearch] = useState('');
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedContactsCache, setSelectedContactsCache] = useState<Map<string, Contact>>(new Map());
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const contactInputRef = useRef<HTMLInputElement>(null);

  const usersQuery = useQuery({
    queryKey: ['users', 'lead-select'],
    queryFn: () => usersApi.list({ page: 1, pageSize: 100 }),
  });

  const defaultValues = useMemo<FormValues>(() => {
    if (!lead) {
      return {
        title: '',
        contactMode: 'new',
        status: 'NEW',
        contactIds: [],
      } as FormValues;
    }

    // Get contacts from many-to-many relationship or fallback to legacy single contact
    const contacts = (lead.contacts && lead.contacts.length > 0) 
      ? lead.contacts 
      : (lead.contact ? [lead.contact] : []);
    const contactIds = contacts.map(c => c.id);

    return {
      contactMode: contacts.length > 0 ? 'existing' : 'new',
      contactIds: contactIds,
      contactId: contactIds[0], // Legacy single contact for backward compatibility
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
      leadType: lead.leadType ?? undefined,
      contact: contacts[0]
        ? {
            firstName: contacts[0].firstName,
            lastName: contacts[0].lastName,
            email: contacts[0].email,
            phone: contacts[0].phone ?? undefined,
            role: contacts[0].role ?? undefined,
            companyName: contacts[0].companyName ?? undefined,
            customerId: contacts[0].customerId ?? undefined,
          }
        : undefined,
    } as FormValues;
  }, [lead]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  const descriptionValue = watch('description') || '';
  const contactMode = watch('contactMode');
  const selectedContactId = watch('contactId');
  
  // Initialize selected contact IDs when editing
  useEffect(() => {
    if (lead) {
      // Extract contacts from many-to-many relationship (contacts array has nested contact objects)
      // or fallback to legacy single contact
      const contacts = (lead.contacts && lead.contacts.length > 0) 
        ? lead.contacts.map((lc: any) => lc.contact || lc).filter(Boolean)
        : (lead.contact ? [lead.contact] : []);
      const contactIds = contacts.map((c: any) => c.id).filter(Boolean);
      setSelectedContactIds(contactIds);
      
      // Also populate the cache with these contacts
      const cache = new Map<string, Contact>();
      contacts.forEach((c: any) => {
        if (c && c.id) {
          cache.set(c.id, c);
        }
      });
      setSelectedContactsCache(cache);
    } else {
      setSelectedContactIds([]);
      setSelectedContactsCache(new Map());
    }
  }, [lead]);

  const contactsQuery = useQuery({
    queryKey: ['lead-contacts', contactSearch],
    queryFn: () => leadsApi.listContacts(contactSearch || undefined),
  });

  // Note: selectedContactId is used for the legacy single contact mode
  // The selectedContacts memo below handles the multi-contact display

  // Build the list of contacts to show in dropdown (excluding already selected ones)
  const contactOptions = useMemo(() => {
    const results = contactsQuery.data ?? [];
    // Filter out already selected contacts
    return results.filter(c => !selectedContactIds.includes(c.id));
  }, [contactsQuery.data, selectedContactIds]);

  // Update cache when contactsQuery data changes
  useEffect(() => {
    if (contactsQuery.data && selectedContactIds.length > 0) {
      setSelectedContactsCache(prev => {
        const newCache = new Map(prev);
        let updated = false;
        selectedContactIds.forEach(id => {
          if (!newCache.has(id)) {
            const contact = contactsQuery.data?.find(c => c.id === id);
            if (contact) {
              newCache.set(id, contact);
              updated = true;
            }
          }
        });
        return updated ? newCache : prev;
      });
    }
  }, [contactsQuery.data, selectedContactIds]);

  // Get selected contact objects for display
  const selectedContacts = useMemo(() => {
    if (selectedContactIds.length === 0) {
      return [];
    }
    
    const allContacts = contactsQuery.data ?? [];
    const result: Contact[] = [];
    const addedIds = new Set<string>();
    
    // First, try to get contacts from cache (most reliable)
    selectedContactIds.forEach(id => {
      const cached = selectedContactsCache.get(id);
      if (cached && !addedIds.has(id)) {
        result.push(cached);
        addedIds.add(id);
      }
    });
    
    // Then, get contacts from the search results that match selected IDs
    selectedContactIds.forEach(id => {
      if (!addedIds.has(id)) {
        const contact = allContacts.find(c => c.id === id);
        if (contact) {
          result.push(contact);
          addedIds.add(id);
        }
      }
    });
    
    // Also include lead's contacts that are selected but not in search results
    // Handle both many-to-many structure (with nested contact) and legacy single contact
    if (lead?.contacts && lead.contacts.length > 0) {
      lead.contacts.forEach((lc: any) => {
        const contactObj = lc.contact || lc;
        if (contactObj && contactObj.id && selectedContactIds.includes(contactObj.id) && !addedIds.has(contactObj.id)) {
          result.push(contactObj);
          addedIds.add(contactObj.id);
        }
      });
    }
    
    // Include legacy contact if selected but not already included
    if (lead?.contact && selectedContactIds.includes(lead.contact.id) && !addedIds.has(lead.contact.id)) {
      result.push(lead.contact);
      addedIds.add(lead.contact.id);
    }
    
    return result;
  }, [selectedContactIds, contactsQuery.data, lead, selectedContactsCache]);

  useEffect(() => {
    if (!isEdit) {
      setValue('status', 'NEW');
    }
  }, [isEdit, setValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        contactDropdownRef.current &&
        !contactDropdownRef.current.contains(event.target as Node) &&
        contactInputRef.current &&
        !contactInputRef.current.contains(event.target as Node)
      ) {
        setShowContactDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Auto-select first filtered result when searching
  useEffect(() => {
    if (contactMode === 'existing' && contactSearch && contactOptions.length > 0) {
      // Only auto-select if no contact is currently selected, or if the selected contact is not in the filtered results
      const selectedInOptions = contactOptions.some((c) => c.id === selectedContactId);
      if (!selectedContactId || !selectedInOptions) {
        setValue('contactId', contactOptions[0].id, { shouldValidate: false });
      }
    }
  }, [contactSearch, contactOptions, contactMode, selectedContactId, setValue]);

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
    // Clear previous errors
    clearErrors('contactMode');
    
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
      leadType: values.leadType || undefined,
    };

    if (values.contactMode === 'existing') {
      if (selectedContactIds.length === 0) {
        setError('contactMode', {
          type: 'manual',
          message: 'Please select at least one contact',
        });
        return;
      }
      // Use new multiple contactIds approach
      payload.contactIds = selectedContactIds;
      // Also set legacy contactId for backward compatibility (first contact)
      if (selectedContactIds.length > 0) {
        payload.contactId = selectedContactIds[0];
      }
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
                <label className="block text-sm font-medium text-muted-foreground">
                  Select Contacts {selectedContactIds.length > 0 && `(${selectedContactIds.length} selected)`}
                </label>
                <div className="relative" ref={contactDropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      ref={contactInputRef}
                      type="text"
                      placeholder="Search contacts by name, email, or company..."
                      value={contactSearch}
                      onChange={(event) => {
                        setContactSearch(event.target.value);
                        setShowContactDropdown(true);
                      }}
                      onFocus={() => setShowContactDropdown(true)}
                      className="w-full rounded-lg border border-border pl-10 pr-10 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                    <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  </div>

                  {showContactDropdown && (
                    <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-card shadow-lg">
                      {contactsQuery.isLoading ? (
                        <div className="flex items-center justify-center px-4 py-3 text-sm text-muted-foreground">
                          Loading contacts...
                        </div>
                      ) : contactOptions.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-muted-foreground">
                          {contactSearch ? 'No contacts found matching your search' : 'No contacts available'}
                        </div>
                      ) : (
                        contactOptions.map((contact) => (
                          <button
                            key={contact.id}
                            type="button"
                            onClick={() => {
                              const newIds = [...selectedContactIds, contact.id];
                              setSelectedContactIds(newIds);
                              // Immediately add to cache so it shows up right away
                              setSelectedContactsCache(prev => new Map(prev).set(contact.id, contact));
                              setContactSearch('');
                              setShowContactDropdown(false);
                              // Clear error when a contact is selected
                              if (selectedContactIds.length === 0) {
                                clearErrors('contactMode');
                              }
                            }}
                            className="w-full px-4 py-2 text-left text-sm transition hover:bg-muted text-foreground"
                          >
                            <div className="font-medium">{contact.firstName} {contact.lastName}</div>
                            <div className="text-xs text-muted-foreground">
                              {contact.email}
                              {contact.companyName && ` • ${contact.companyName}`}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {selectedContacts.length > 0 && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-muted-foreground">
                      Selected Contacts:
                    </label>
                    <div className="space-y-2">
                      {selectedContacts.map((contact) => (
                        <div
                          key={contact.id}
                          className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm"
                        >
                          <div>
                            <span className="font-semibold text-blue-900">
                              {contact.firstName} {contact.lastName}
                            </span>
                            <span className="ml-2 text-xs text-blue-700">
                              {contact.email}
                              {contact.companyName && ` • ${contact.companyName}`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updatedIds = selectedContactIds.filter(id => id !== contact.id);
                              setSelectedContactIds(updatedIds);
                              // Remove from cache
                              setSelectedContactsCache(prev => {
                                const newCache = new Map(prev);
                                newCache.delete(contact.id);
                                return newCache;
                              });
                              // Clear error if there are still contacts selected
                              if (updatedIds.length > 0) {
                                clearErrors('contactMode');
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 transition"
                            aria-label={`Remove ${contact.firstName} ${contact.lastName}`}
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {((selectedContactIds.length === 0 && contactMode === 'existing') || errors.contactMode) && (
                  <p className="text-sm text-red-600">
                    {errors.contactMode?.message || 'Please select at least one contact'}
                  </p>
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
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Lead Type</label>
              <select
                {...register('leadType')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select type</option>
                {LEAD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === 'END_CUSTOMER' ? 'End Customer' : 'Intermediary'}
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

import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { contactsApi, customersApi } from '@/lib/api/crm';
import type { ContactDetail, ContactSummary, CreateContactPayload } from '@/types/crm';
import { X } from 'lucide-react';

interface ContactFormProps {
  contact?: ContactSummary | ContactDetail;
  onClose: () => void;
  onSuccess: (contact: ContactSummary | ContactDetail) => void;
}

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  companyName?: string;
  linkedinUrl?: string;
  notes?: string;
  customerId?: string;
};

export function ContactForm({ contact, onClose, onSuccess }: ContactFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(contact);

  const customersQuery = useQuery({
    queryKey: ['customers', 'contact-options'],
    queryFn: () =>
      customersApi.list({
        page: 1,
        pageSize: 100,
        sortBy: 'name',
        sortOrder: 'asc',
      }),
  });

  const defaultValues = useMemo<FormValues>(() => {
    if (!contact) {
      return {
        firstName: '',
        lastName: '',
        email: '',
      };
    }

    return {
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email,
      phone: contact.phone ?? '',
      role: contact.role ?? '',
      companyName: contact.companyName ?? '',
      linkedinUrl: contact.linkedinUrl ?? '',
      notes: contact.notes ?? '',
      customerId: contact.customerId ?? undefined,
    };
  }, [contact]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateContactPayload) => contactsApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onSuccess(data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: CreateContactPayload) => contactsApi.update(contact!.id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', contact!.id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onSuccess(data);
    },
  });

  const onSubmit = (values: FormValues) => {
    const payload: CreateContactPayload = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      phone: values.phone?.trim() || undefined,
      role: values.role?.trim() || undefined,
      companyName: values.companyName?.trim() || undefined,
      linkedinUrl: values.linkedinUrl?.trim() || undefined,
      notes: values.notes?.trim() || undefined,
      customerId: values.customerId || undefined,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const customers = customersQuery.data?.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {isEdit ? 'Edit Contact' : 'New Contact'}
            </h2>
            <p className="text-sm text-gray-500">
              {isEdit
                ? 'Update contact information and account association.'
                : 'Capture a new relationship contact for your pipeline.'}
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
              <input
                type="text"
                {...register('firstName', { required: 'First name is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.firstName && (
                <p className="text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
              <input
                type="text"
                {...register('lastName', { required: 'Last name is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.lastName && (
                <p className="text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="text"
                {...register('phone')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
              <input
                type="text"
                {...register('role')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Company</label>
              <input
                type="text"
                {...register('companyName')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">LinkedIn</label>
              <input
                type="url"
                {...register('linkedinUrl')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Associated Customer</label>
              <select
                {...register('customerId')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                defaultValue={contact?.customerId ?? ''}
              >
                <option value="">Unassigned</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={4}
              {...register('notes')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="Add context, relationship history or next actions"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-200 pt-6">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

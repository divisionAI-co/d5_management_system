import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/crm';
import type {
  CreateCustomerPayload,
  CustomerDetail,
  CustomerSentiment,
  CustomerStatus,
  CustomerType,
  UpdateCustomerPayload,
} from '@/types/crm';
import { X } from 'lucide-react';
import { MentionInput } from '@/components/shared/MentionInput';
import { DrivePicker } from '@/components/shared/DrivePicker';
import type { DriveFile } from '@/types/integrations';
import { FeedbackToast } from '@/components/ui/feedback-toast';

const CUSTOMER_TYPES: { label: string; value: CustomerType }[] = [
  { label: 'Staff Augmentation', value: 'STAFF_AUGMENTATION' },
  { label: 'Software Subscription', value: 'SOFTWARE_SUBSCRIPTION' },
  { label: 'Both', value: 'BOTH' },
];

const CUSTOMER_STATUSES: { label: string; value: CustomerStatus }[] = [
  { label: 'Onboarding', value: 'ONBOARDING' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'At Risk', value: 'AT_RISK' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Churned', value: 'CHURNED' },
];

const CUSTOMER_SENTIMENTS: { label: string; value: CustomerSentiment }[] = [
  { label: 'Happy', value: 'HAPPY' },
  { label: 'Neutral', value: 'NEUTRAL' },
  { label: 'Unhappy', value: 'UNHAPPY' },
];

type FormValues = {
  name: string;
  email: string;
  phone?: string;
  website?: string;
  industry?: string;
  type: CustomerType;
  status: CustomerStatus;
  sentiment: CustomerSentiment;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  taxId?: string;
  registrationId?: string;
  monthlyValue?: string;
  currency?: string;
  notes?: string;
  tags?: string;
  driveFolderId?: string;
  driveFolderUrl?: string;
  odooId?: string;
};

interface CustomerFormProps {
  customer?: CustomerDetail | null;
  onClose: () => void;
  onSuccess: (customer: CustomerDetail) => void;
}

export function CustomerForm({ customer, onClose, onSuccess }: CustomerFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(customer);
  const [drivePickerOpen, setDrivePickerOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaultValues = useMemo<FormValues>(() => {
    if (!customer) {
      return {
        name: '',
        email: '',
        type: 'STAFF_AUGMENTATION',
        status: 'ONBOARDING',
        sentiment: 'NEUTRAL',
        currency: 'USD',
        tags: '',
        taxId: '',
        registrationId: '',
        driveFolderId: '',
        driveFolderUrl: '',
      };
    }

    return {
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? '',
      website: customer.website ?? '',
      industry: customer.industry ?? '',
      type: customer.type,
      status: customer.status,
      sentiment: customer.sentiment,
      address: customer.address ?? '',
      city: customer.city ?? '',
      country: customer.country ?? '',
      postalCode: customer.postalCode ?? '',
      taxId: customer.taxId ?? '',
      registrationId: customer.registrationId ?? '',
      monthlyValue:
        customer.monthlyValue !== undefined && customer.monthlyValue !== null
          ? String(customer.monthlyValue)
          : '',
      currency: customer.currency ?? 'USD',
      notes: customer.notes ?? '',
      tags: customer.tags?.join(', ') ?? '',
      driveFolderId: customer.driveFolderId ?? '',
      driveFolderUrl: customer.driveFolderUrl ?? '',
      odooId: customer.odooId ?? '',
    };
  }, [customer]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  const notesValue = watch('notes') || '';
  const driveFolderIdValue = watch('driveFolderId');

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const handleSelectDriveFolder = (folder: DriveFile) => {
    const folderLink = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;
    setValue('driveFolderUrl', folderLink, { shouldDirty: true, shouldTouch: true });
    setValue('driveFolderId', folder.id, { shouldDirty: true, shouldTouch: true });
  };

  const handleUseCurrentFolder = (folderId: string) => {
    const link = `https://drive.google.com/drive/folders/${folderId}`;
    setValue('driveFolderUrl', link, { shouldDirty: true, shouldTouch: true });
    setValue('driveFolderId', folderId, { shouldDirty: true, shouldTouch: true });
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateCustomerPayload) => customersApi.create(payload),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateCustomerPayload) => customersApi.update(customer!.id, payload),
  });

  const onSubmit = (values: FormValues) => {
    const tags = values.tags
      ? values.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean)
      : undefined;

    const monthlyValue =
      values.monthlyValue && values.monthlyValue !== ''
        ? Number(values.monthlyValue)
        : undefined;

    const payload: CreateCustomerPayload = {
      name: values.name,
      email: values.email,
      phone: values.phone || undefined,
      website: values.website || undefined,
      industry: values.industry || undefined,
      type: values.type,
      status: values.status,
      sentiment: values.sentiment,
      address: values.address || undefined,
      city: values.city || undefined,
      country: values.country || undefined,
      postalCode: values.postalCode || undefined,
      taxId: values.taxId || undefined,
      registrationId: values.registrationId || undefined,
      monthlyValue,
      currency: values.currency || undefined,
      notes: values.notes || undefined,
      tags,
      driveFolderId: values.driveFolderId || undefined,
      driveFolderUrl: values.driveFolderUrl || undefined,
      odooId: values.odooId || undefined,
    };

    if (isEdit) {
      updateMutation.mutate(payload, {
        onSuccess: (updated) => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          queryClient.invalidateQueries({ queryKey: ['customer', updated.id] });
          setSuccessMessage('Customer updated successfully');
          onSuccess(updated);
          setTimeout(() => {
            onClose();
          }, 1000);
        },
        onError: (error: any) => {
          setErrorMessage(error?.response?.data?.message || 'Failed to update customer');
        },
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: (created) => {
          queryClient.invalidateQueries({ queryKey: ['customers'] });
          setSuccessMessage('Customer created successfully');
          onSuccess(created);
          setTimeout(() => {
            onClose();
          }, 1000);
        },
        onError: (error: any) => {
          setErrorMessage(error?.response?.data?.message || 'Failed to create customer');
        },
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Edit Customer' : 'New Customer'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEdit
                ? 'Update customer details and account configuration.'
                : 'Add a new customer to the CRM.'}
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
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Name *</label>
              <input
                type="text"
                {...register('name', { required: 'Customer name is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Email *</label>
              <input
                type="email"
                {...register('email', { required: 'Email is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Phone</label>
              <input
                type="text"
                {...register('phone')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Website</label>
              <input
                type="url"
                {...register('website')}
                placeholder="https://"
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Type *</label>
              <select
                {...register('type', { required: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {CUSTOMER_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Status *</label>
              <select
                {...register('status', { required: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {CUSTOMER_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Sentiment *</label>
              <select
                {...register('sentiment', { required: true })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {CUSTOMER_SENTIMENTS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Industry</label>
              <input
                type="text"
                {...register('industry')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Monthly Value</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...register('monthlyValue')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  {...register('currency')}
                  className="w-24 rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Address</label>
              <input
                type="text"
                {...register('address')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">City</label>
                <input
                  type="text"
                  {...register('city')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Country</label>
                <input
                  type="text"
                  {...register('country')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Postal Code</label>
                <input
                  type="text"
                  {...register('postalCode')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Tax ID</label>
              <input
                type="text"
                {...register('taxId')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. VAT123456"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Registration ID</label>
              <input
                type="text"
                {...register('registrationId')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                placeholder="Company registration number"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Tags</label>
              <input
                type="text"
                {...register('tags')}
                placeholder="enterprise, priority"
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Odoo ID</label>
              <input
                type="text"
                {...register('odooId')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <label className="block text-sm font-medium text-muted-foreground">
                  Google Drive Folder ID
                </label>
                <button
                  type="button"
                  onClick={() => setDrivePickerOpen(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Choose from Drive
                </button>
              </div>
              <input
                type="text"
                {...register('driveFolderId')}
                placeholder="1A2b3C4D5E6F7G8H"
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the folder ID or URL containing contracts and documents
              </p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Google Drive Folder URL (alternative)
              </label>
              <input
                type="text"
                {...register('driveFolderUrl')}
                placeholder="https://drive.google.com/drive/folders/..."
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Notes</label>
            <MentionInput
              value={notesValue}
              onChange={(value) => setValue('notes', value)}
              rows={4}
              placeholder="Add any context or onboarding notes... Type @ to mention someone"
              multiline={true}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
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
              {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>

      <DrivePicker
        open={drivePickerOpen}
        mode="folder"
        initialFolderId={driveFolderIdValue || undefined}
        title="Choose Google Drive Folder"
        description="Navigate your Google Drive and pick the folder that stores customer contracts and documents."
        onClose={() => setDrivePickerOpen(false)}
        onSelectFolder={handleSelectDriveFolder}
        onUseCurrentFolder={handleUseCurrentFolder}
      />
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



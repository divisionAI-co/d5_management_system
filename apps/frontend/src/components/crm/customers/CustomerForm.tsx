import { useEffect, useMemo, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customersApi } from '@/lib/api/crm';
import { storageApi } from '@/lib/api/storage';
import { googleDriveApi } from '@/lib/api/google-drive';
import type {
  CreateCustomerPayload,
  CustomerDetail,
  CustomerSentiment,
  CustomerStatus,
  CustomerType,
  UpdateCustomerPayload,
} from '@/types/crm';
import { X, Upload, FolderOpen } from 'lucide-react';
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
  imageUrl?: string;
  featured?: boolean;
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
  const [showImageDrivePicker, setShowImageDrivePicker] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
        imageUrl: '',
        featured: false,
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
      imageUrl: customer.imageUrl ?? '',
      featured: customer.featured ?? false,
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

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => {
      return storageApi.upload(file);
    },
    onSuccess: (result) => {
      // Construct full URL for image
      // result.url is a relative path like /storage/files/image/...
      // The storage service returns a path like /storage/files/image/abc123.jpg
      // We need to prepend the API base URL
      
      if (!result || !result.url) {
        setErrorMessage('Upload succeeded but no URL was returned. Please try again.');
        setUploadingImage(false);
        return;
      }
      
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      
      // Get the relative path from result.url
      let urlPath = result.url.trim();
      
      // Remove /api/v1 from urlPath if present (to avoid duplication)
      if (urlPath.startsWith('/api/v1')) {
        urlPath = urlPath.replace('/api/v1', '');
      }
      
      // Ensure path starts with /
      if (!urlPath.startsWith('/')) {
        urlPath = `/${urlPath}`;
      }
      
      // Construct full URL - ensure base URL has protocol and no trailing slash
      let baseUrl = API_BASE_URL.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `http://${baseUrl}`;
      }
      // Remove trailing slash from base URL
      baseUrl = baseUrl.replace(/\/+$/, '');
      
      // Construct the full URL
      const imageUrl = `${baseUrl}${urlPath}`;
      
      // Validate URL format before setting
      try {
        const url = new URL(imageUrl);
        // Ensure it's a valid HTTP/HTTPS URL
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
          throw new Error('Invalid protocol');
        }
        // URL is valid, set it
        console.log('Setting imageUrl:', imageUrl); // Debug log
        setValue('imageUrl', imageUrl, { shouldDirty: true, shouldTouch: true });
      } catch (error) {
        console.error('Invalid URL constructed:', { imageUrl, baseUrl, urlPath, result }, error);
        setErrorMessage(`Failed to construct valid image URL: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
      }
      setUploadingImage(false);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to upload image. Please try again.';
      setErrorMessage(errorMessage);
      setUploadingImage(false);
    },
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image file');
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMessage('Image size must be less than 10MB');
      return;
    }

    setUploadingImage(true);
    uploadImageMutation.mutate(file);
    
    // Reset input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleImageDriveFileSelect = (file: DriveFile) => {
    // Convert Google Drive file to URL
    // The backend will convert this to a proxy URL when saving
    const driveUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    setValue('imageUrl', driveUrl, { shouldDirty: true, shouldTouch: true });
    setShowImageDrivePicker(false);
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
      imageUrl: values.imageUrl?.trim() || undefined, // Only send if not empty
      featured: values.featured || false,
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

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Company Logo</label>
              <div className="space-y-2">
                {/* Logo Preview */}
                {watch('imageUrl') && (
                  <div className="relative w-full overflow-hidden rounded-lg border border-border">
                    <img
                      src={watch('imageUrl')}
                      alt="Company Logo"
                      className="h-32 w-full object-contain bg-muted/50"
                      onError={(e) => {
                        // Hide image on error
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setValue('imageUrl', '', { shouldDirty: true, shouldTouch: true })}
                      className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-black/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                
                {/* Upload Controls */}
                <div className="flex items-center gap-2">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploadingImage}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {uploadingImage ? (
                      <>
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3 w-3" />
                        Upload
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowImageDrivePicker(true)}
                    disabled={uploadingImage}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    <FolderOpen className="h-3 w-3" />
                    Pick from Drive
                  </button>
                </div>
                
                {/* URL Input (for manual entry) */}
                <input
                  type="url"
                  {...register('imageUrl')}
                  placeholder="Or paste image URL or Google Drive link"
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-muted-foreground">
                  Upload a logo, pick from Google Drive, or paste a URL. Google Drive images will be automatically converted.
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  {...register('featured')}
                  id="featured-customer"
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="featured-customer" className="text-sm font-medium text-muted-foreground">
                  Featured Customer
                </label>
              </div>
              <p className="ml-2 text-xs text-muted-foreground">
                Show on public website
              </p>
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

      {/* Drive Picker for Company Logo */}
      <DrivePicker
        open={showImageDrivePicker}
        mode="file"
        fileTypeFilter="image"
        title="Select Company Logo from Google Drive"
        description="Choose a logo from your Google Drive to use as the company logo."
        onClose={() => setShowImageDrivePicker(false)}
        onSelectFile={handleImageDriveFileSelect}
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



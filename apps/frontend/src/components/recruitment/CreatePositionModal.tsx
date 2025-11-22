import { useEffect, useMemo, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Search, X, Upload, FolderOpen } from 'lucide-react';
import { positionsApi } from '@/lib/api/recruitment';
import { opportunitiesApi } from '@/lib/api/crm/opportunities';
import { storageApi } from '@/lib/api/storage';
import { googleDriveApi } from '@/lib/api/google-drive';
import type { Opportunity } from '@/types/crm';
import type {
  CreatePositionDto,
  PositionStatus,
  RecruitmentStatus,
  OpenPosition,
  UpdatePositionDto,
} from '@/types/recruitment';
import type { DriveFile } from '@/types/integrations';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { DrivePicker } from '@/components/shared/DrivePicker';
import { FeedbackToast } from '@/components/ui/feedback-toast';

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
  slug?: string;
  imageUrl?: string;
  description?: string;
  requirements?: string;
  opportunityId?: string;
  status: PositionStatus;
  recruitmentStatus?: RecruitmentStatus | null;
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
  const [isOpportunityDropdownOpen, setIsOpportunityDropdownOpen] = useState(false);
  const opportunityDropdownRef = useRef<HTMLDivElement>(null);
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showImageDrivePicker, setShowImageDrivePicker] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isEditMode = Boolean(position);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: position?.title ?? defaultOpportunity?.title ?? '',
      slug: position?.slug ?? '',
      imageUrl: position?.imageUrl ?? '',
      description: position?.description ?? '',
      requirements: position?.requirements ?? '',
      // Default to empty string (no opportunity link) when creating new position
      opportunityId: position?.opportunity?.id ?? defaultOpportunity?.id ?? '',
      status: position?.status ?? 'Open',
      recruitmentStatus: position?.recruitmentStatus ?? null,
    },
  });

  const selectedOpportunityId = watch('opportunityId');

  const opportunitiesQuery = useQuery({
    queryKey: ['opportunities', 'position-select', opportunitySearch],
    enabled:
      !defaultOpportunity &&
      (isOpportunityDropdownOpen || opportunitySearch.length > 0 || !!selectedOpportunityId),
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        opportunityDropdownRef.current &&
        !opportunityDropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpportunityDropdownOpen(false);
      }
    };

    if (isOpportunityDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpportunityDropdownOpen]);

  // Update search field when opportunity is selected
  useEffect(() => {
    if (selectedOpportunityId && opportunities.length > 0) {
      const selected = opportunities.find((o) => o.id === selectedOpportunityId);
      if (selected && opportunitySearch !== selected.title) {
        setOpportunitySearch(selected.title);
      }
    }
    // Don't auto-clear search field - let user control it or let the button handler clear it
  }, [selectedOpportunityId, opportunities, opportunitySearch]);

  useEffect(() => {
    reset({
      title: position?.title ?? defaultOpportunity?.title ?? '',
      slug: position?.slug ?? '',
      imageUrl: position?.imageUrl ?? '',
      description: position?.description ?? '',
      requirements: position?.requirements ?? '',
      opportunityId: position?.opportunity?.id ?? defaultOpportunity?.id ?? '',
      status: position?.status ?? 'Open',
      recruitmentStatus: position?.recruitmentStatus ?? null,
    });
    // Set initial search value if opportunity is pre-selected
    if (position?.opportunity || defaultOpportunity) {
      setOpportunitySearch(position?.opportunity?.title ?? defaultOpportunity?.title ?? '');
    }
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
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to create position. Please try again.';
      setErrorFeedback(errorMessage);
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
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update position. Please try again.';
      setErrorFeedback(errorMessage);
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => {
      return storageApi.upload(file);
    },
    onSuccess: (result) => {
      // Construct full URL for image
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      let urlPath = result.url;
      if (urlPath.startsWith('/api/v1')) {
        urlPath = urlPath.replace('/api/v1', '');
      }
      if (!urlPath.startsWith('/')) {
        urlPath = `/${urlPath}`;
      }
      const imageUrl = `${API_BASE_URL}${urlPath}`;
      setValue('imageUrl', imageUrl);
      setUploadingImage(false);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to upload image. Please try again.';
      setErrorFeedback(errorMessage);
      setUploadingImage(false);
    },
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorFeedback('Please select an image file');
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorFeedback('Image size must be less than 10MB');
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
    setValue('imageUrl', driveUrl);
    setShowImageDrivePicker(false);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (values: FormValues) => {
    if (isEditMode && position) {
      const payload: UpdatePositionDto = {
        title: values.title.trim(),
        slug: values.slug?.trim() || undefined,
        imageUrl: values.imageUrl?.trim() || undefined,
        description: values.description?.trim() || undefined,
        requirements: values.requirements?.trim() || undefined,
        status: values.status,
        recruitmentStatus: values.recruitmentStatus || undefined,
        // Include opportunityId in update to allow changing the link
        // Send null explicitly to unlink, or the opportunity ID to link
        opportunityId: values.opportunityId ? values.opportunityId : null,
      };
      updateMutation.mutate({ id: position.id, payload });
      return;
    }

    const payload: CreatePositionDto = {
      title: values.title.trim(),
      slug: values.slug?.trim() || undefined,
      imageUrl: values.imageUrl?.trim() || undefined,
      description: values.description?.trim() || undefined,
      requirements: values.requirements?.trim() || undefined,
      status: values.status,
      recruitmentStatus: values.recruitmentStatus || undefined,
      opportunityId: defaultOpportunity
        ? defaultOpportunity.id
        : values.opportunityId || undefined,
    };

    createMutation.mutate(payload);
  };


  return (
    <>
      {errorFeedback && (
        <FeedbackToast
          message={errorFeedback}
          onDismiss={() => setErrorFeedback(null)}
          tone="error"
        />
      )}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="flex h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              {isEditMode ? 'Edit Job Position' : 'Create Job Position'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEditMode
                ? 'Update position details to keep recruiting and delivery aligned.'
                : "Job positions can exist independently or be linked to an opportunity. Link it when you're ready to source candidates."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto space-y-6 px-6 py-6">
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
                Slug (URL-friendly)
              </label>
              <input
                type="text"
                {...register('slug')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="auto-generated-from-title"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                URL-friendly identifier. Auto-generated from title if not provided.
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Position Image
            </label>
            <div className="space-y-2">
              {/* Image Preview */}
              {watch('imageUrl') && (
                <div className="relative w-full overflow-hidden rounded-lg border border-border">
                  <img
                    src={watch('imageUrl')}
                    alt="Position"
                    className="h-48 w-full object-cover"
                    onError={(e) => {
                      // Hide image on error
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setValue('imageUrl', '')}
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
                      Upload Image
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
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Or paste image URL or Google Drive link"
              />
              <p className="text-xs text-muted-foreground">
                Upload an image, pick from Google Drive, or paste a URL. Google Drive images will be automatically converted.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">

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
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Recruitment Status
              </label>
              <select
                {...register('recruitmentStatus')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select status</option>
                <option value="HEADHUNTING">Headhunting</option>
                <option value="STANDARD">Standard</option>
              </select>
            </div>
            </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Description
              </label>
              <RichTextEditor
                value={watch('description') || ''}
                onChange={(html) => setValue('description', html)}
                placeholder="Overview of responsibilities and context."
                minHeight="200px"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Requirements
              </label>
              <RichTextEditor
                value={watch('requirements') || ''}
                onChange={(html) => setValue('requirements', html)}
                placeholder="Key skills, location/timezone expectations, availability, etc."
                minHeight="200px"
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
              <div className="relative" ref={opportunityDropdownRef}>
                {selectedOpportunityId && !isOpportunityDropdownOpen && (
                  <div className="mb-2 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">
                        {opportunities.find((o) => o.id === selectedOpportunityId)?.title ||
                          'Linked opportunity'}
                      </p>
                      {opportunities.find((o) => o.id === selectedOpportunityId)?.customer && (
                        <p className="text-xs text-blue-700">
                          {opportunities.find((o) => o.id === selectedOpportunityId)?.customer?.name}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setValue('opportunityId', '', { shouldValidate: true });
                        setOpportunitySearch('');
                      }}
                      className="ml-2 rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
                    >
                      Unlink
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={opportunitySearch}
                      onChange={(event) => {
                        setOpportunitySearch(event.target.value);
                        setIsOpportunityDropdownOpen(true);
                      }}
                      onFocus={() => setIsOpportunityDropdownOpen(true)}
                      placeholder={
                        selectedOpportunityId
                          ? 'Search to change opportunity...'
                          : 'Search opportunity by title or client'
                      }
                      className="w-full rounded-lg border border-border px-9 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                    />
                  </div>
                </div>

                {isOpportunityDropdownOpen && (
                  <div className="absolute z-10 mt-2 w-full rounded-lg border border-border bg-card shadow-lg max-h-60 overflow-y-auto">
                    {opportunitiesQuery.isLoading ? (
                      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading opportunities...
                      </div>
                    ) : opportunities.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        {opportunitySearch
                          ? 'No opportunities found matching your search.'
                          : 'Start typing to search opportunities...'}
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setValue('opportunityId', '', { shouldValidate: true });
                            setIsOpportunityDropdownOpen(false);
                            setOpportunitySearch('');
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                            !selectedOpportunityId ? 'bg-blue-50 font-semibold' : ''
                          }`}
                        >
                          No opportunity link
                        </button>
                        {opportunities.map((opportunity) => (
                          <button
                            key={opportunity.id}
                            type="button"
                            onClick={() => {
                              setValue('opportunityId', opportunity.id);
                              setIsOpportunityDropdownOpen(false);
                              setOpportunitySearch(opportunity.title);
                            }}
                            className={`w-full px-3 py-2 text-left text-sm hover:bg-muted ${
                              selectedOpportunityId === opportunity.id ? 'bg-blue-50 font-semibold' : ''
                            }`}
                          >
                            <div className="font-medium">{opportunity.title}</div>
                            {opportunity.customer && (
                              <div className="text-xs text-muted-foreground">
                                {opportunity.customer.name}
                              </div>
                            )}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:justify-end flex-shrink-0">
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

      {/* Drive Picker for Position Image */}
      <DrivePicker
        open={showImageDrivePicker}
        mode="file"
        fileTypeFilter="image"
        title="Select Position Image from Google Drive"
        description="Choose an image from your Google Drive to use as the position image."
        onClose={() => setShowImageDrivePicker(false)}
        onSelectFile={handleImageDriveFileSelect}
      />
    </div>
    </>
  );
}

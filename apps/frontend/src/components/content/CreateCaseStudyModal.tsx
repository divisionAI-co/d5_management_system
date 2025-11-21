import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { caseStudiesApi } from '@/lib/api/content';
import type {
  CaseStudy,
  CreateCaseStudyDto,
  UpdateCaseStudyDto,
  CaseStudyStatus,
} from '@/types/content';
import { RichTextEditor } from '@/components/shared/RichTextEditor';
import { FeedbackToast } from '@/components/ui/feedback-toast';

interface CreateCaseStudyModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  caseStudy?: CaseStudy | null;
}

interface FormValues {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  status: CaseStudyStatus;
  publishedAt?: string;
  challenge?: string;
  solution?: string;
  aboutCustomer?: string;
  clientName?: string;
  clientLogo?: string;
  industry?: string;
  projectDate?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export function CreateCaseStudyModal({
  onClose,
  onSuccess,
  caseStudy,
}: CreateCaseStudyModalProps) {
  const queryClient = useQueryClient();
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const isEditMode = Boolean(caseStudy);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: caseStudy?.title ?? '',
      slug: caseStudy?.slug ?? '',
      excerpt: caseStudy?.excerpt ?? '',
      content: caseStudy?.content ?? '',
      featuredImage: caseStudy?.featuredImage ?? '',
      status: caseStudy?.status ?? 'DRAFT',
      publishedAt: caseStudy?.publishedAt
        ? new Date(caseStudy.publishedAt).toISOString().split('T')[0]
        : '',
      challenge: caseStudy?.challenge ?? '',
      solution: caseStudy?.solution ?? '',
      aboutCustomer: caseStudy?.aboutCustomer ?? '',
      clientName: caseStudy?.clientName ?? '',
      clientLogo: caseStudy?.clientLogo ?? '',
      industry: caseStudy?.industry ?? '',
      projectDate: caseStudy?.projectDate
        ? new Date(caseStudy.projectDate).toISOString().split('T')[0]
        : '',
      metaTitle: caseStudy?.metaTitle ?? '',
      metaDescription: caseStudy?.metaDescription ?? '',
    },
  });

  useEffect(() => {
    reset({
      title: caseStudy?.title ?? '',
      slug: caseStudy?.slug ?? '',
      excerpt: caseStudy?.excerpt ?? '',
      content: caseStudy?.content ?? '',
      featuredImage: caseStudy?.featuredImage ?? '',
      status: caseStudy?.status ?? 'DRAFT',
      publishedAt: caseStudy?.publishedAt
        ? new Date(caseStudy.publishedAt).toISOString().split('T')[0]
        : '',
      challenge: caseStudy?.challenge ?? '',
      solution: caseStudy?.solution ?? '',
      aboutCustomer: caseStudy?.aboutCustomer ?? '',
      clientName: caseStudy?.clientName ?? '',
      clientLogo: caseStudy?.clientLogo ?? '',
      industry: caseStudy?.industry ?? '',
      projectDate: caseStudy?.projectDate
        ? new Date(caseStudy.projectDate).toISOString().split('T')[0]
        : '',
      metaTitle: caseStudy?.metaTitle ?? '',
      metaDescription: caseStudy?.metaDescription ?? '',
    });
  }, [caseStudy, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateCaseStudyDto) => caseStudiesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-studies'] });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to create case study. Please try again.';
      setErrorFeedback(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCaseStudyDto }) =>
      caseStudiesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['case-studies'] });
      queryClient.invalidateQueries({ queryKey: ['case-study', caseStudy?.id] });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update case study. Please try again.';
      setErrorFeedback(errorMessage);
    },
  });

  const onSubmit = (data: FormValues) => {
    const payload: CreateCaseStudyDto | UpdateCaseStudyDto = {
      title: data.title,
      slug: data.slug || undefined,
      excerpt: data.excerpt || undefined,
      content: data.content,
      featuredImage: data.featuredImage || undefined,
      status: data.status,
      publishedAt: data.publishedAt || undefined,
      challenge: data.challenge || undefined,
      solution: data.solution || undefined,
      aboutCustomer: data.aboutCustomer || undefined,
      clientName: data.clientName || undefined,
      clientLogo: data.clientLogo || undefined,
      industry: data.industry || undefined,
      projectDate: data.projectDate || undefined,
      metaTitle: data.metaTitle || undefined,
      metaDescription: data.metaDescription || undefined,
    };

    if (isEditMode && caseStudy) {
      updateMutation.mutate({ id: caseStudy.id, payload });
    } else {
      createMutation.mutate(payload as CreateCaseStudyDto);
    }
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
                {isEditMode ? 'Edit Case Study' : 'Create Case Study'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEditMode
                  ? 'Update case study details.'
                  : 'Create a new case study for your website.'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex-1 overflow-y-auto space-y-6 px-6 py-6"
          >
            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Title<span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                {...register('title', { required: 'Title is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Case study title"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-rose-600">{errors.title.message}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
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
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <select
                  {...register('status')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Client Name
                </label>
                <input
                  type="text"
                  {...register('clientName')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Client name"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Industry
                </label>
                <input
                  type="text"
                  {...register('industry')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Industry"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Excerpt
              </label>
              <textarea
                {...register('excerpt')}
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Short summary of the case study"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Challenge
              </label>
              <RichTextEditor
                value={watch('challenge') || ''}
                onChange={(html) => setValue('challenge', html)}
                placeholder="Describe the challenge the customer faced. You can insert images using Google Drive links."
                minHeight="200px"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The challenge the customer faced before your solution.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Solution
              </label>
              <RichTextEditor
                value={watch('solution') || ''}
                onChange={(html) => setValue('solution', html)}
                placeholder="Describe the solution you provided. You can insert images using Google Drive links."
                minHeight="200px"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The solution you provided to address the challenge.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                About the Customer
              </label>
              <RichTextEditor
                value={watch('aboutCustomer') || ''}
                onChange={(html) => setValue('aboutCustomer', html)}
                placeholder="Information about the customer. You can insert images using Google Drive links."
                minHeight="200px"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Background information about the customer and their business.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Additional Content
              </label>
              <RichTextEditor
                value={watch('content') || ''}
                onChange={(html) => setValue('content', html)}
                placeholder="Any additional content for the case study. You can insert images using Google Drive links."
                minHeight="200px"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tip: You can insert images from Google Drive by adding them in the editor. Google Drive links will be automatically converted.
              </p>
              {errors.content && (
                <p className="mt-1 text-xs text-rose-600">{errors.content.message}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Featured Image URL
                </label>
                <input
                  type="url"
                  {...register('featuredImage')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="https://example.com/image.jpg or Google Drive link"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports Google Drive links
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Client Logo URL
                </label>
                <input
                  type="url"
                  {...register('clientLogo')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="https://example.com/logo.jpg or Google Drive link"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Supports Google Drive links
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Publication Date
                </label>
                <input
                  type="date"
                  {...register('publishedAt')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Project Date
                </label>
                <input
                  type="date"
                  {...register('projectDate')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  SEO Meta Title
                </label>
                <input
                  type="text"
                  {...register('metaTitle')}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="SEO title (max 60 chars)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  SEO Meta Description
                </label>
                <textarea
                  {...register('metaDescription')}
                  rows={2}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="SEO description (max 160 chars)"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : isEditMode
                    ? 'Update Case Study'
                    : 'Create Case Study'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}


import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Image as ImageIcon, FolderOpen } from 'lucide-react';
import { blogsApi } from '@/lib/api/content';
import { storageApi } from '@/lib/api/storage';
import { googleDriveApi } from '@/lib/api/google-drive';
import type { Blog, CreateBlogDto, UpdateBlogDto, BlogStatus } from '@/types/content';
import type { DriveFile } from '@/types/integrations';
import { RichTextEditor, type RichTextEditorRef } from '@/components/shared/RichTextEditor';
import { DrivePicker } from '@/components/shared/DrivePicker';
import { FeedbackToast } from '@/components/ui/feedback-toast';

interface CreateBlogModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  blog?: Blog | null;
}

interface FormValues {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  featuredImage?: string;
  featured: boolean;
  status: BlogStatus;
  publishedAt?: string;
  metaTitle?: string;
  metaDescription?: string;
}

export function CreateBlogModal({ onClose, onSuccess, blog }: CreateBlogModalProps) {
  const queryClient = useQueryClient();
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingFeaturedImage, setUploadingFeaturedImage] = useState(false);
  const [showDrivePicker, setShowDrivePicker] = useState(false);
  const [showContentDrivePicker, setShowContentDrivePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const featuredImageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichTextEditorRef>(null);
  const isEditMode = Boolean(blog);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: blog?.title ?? '',
      slug: blog?.slug ?? '',
      excerpt: blog?.excerpt ?? '',
      content: blog?.content ?? '',
      featuredImage: blog?.featuredImage ?? '',
      featured: blog?.featured ?? false,
      status: blog?.status ?? 'DRAFT',
      publishedAt: blog?.publishedAt
        ? new Date(blog.publishedAt).toISOString().split('T')[0]
        : '',
      metaTitle: blog?.metaTitle ?? '',
      metaDescription: blog?.metaDescription ?? '',
    },
  });

  useEffect(() => {
    reset({
      title: blog?.title ?? '',
      slug: blog?.slug ?? '',
      excerpt: blog?.excerpt ?? '',
      content: blog?.content ?? '',
      featuredImage: blog?.featuredImage ?? '',
      featured: blog?.featured ?? false,
      status: blog?.status ?? 'DRAFT',
      publishedAt: blog?.publishedAt
        ? new Date(blog.publishedAt).toISOString().split('T')[0]
        : '',
      metaTitle: blog?.metaTitle ?? '',
      metaDescription: blog?.metaDescription ?? '',
    });
  }, [blog, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateBlogDto) => blogsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to create blog. Please try again.';
      setErrorFeedback(errorMessage);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateBlogDto }) =>
      blogsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      queryClient.invalidateQueries({ queryKey: ['blog', blog?.id] });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to update blog. Please try again.';
      setErrorFeedback(errorMessage);
    },
  });

  const uploadImageMutation = useMutation({
    mutationFn: (file: File) => {
      if (!blog?.id) {
        throw new Error('Blog must be saved before uploading images');
      }
      return blogsApi.uploadImage(blog.id, file);
    },
    onSuccess: (result) => {
      // Insert image at cursor position in editor
      // result.url is a relative path like /storage/files/image/...
      // VITE_API_URL already includes /api/v1, so we just prepend it
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      // Remove /api/v1 from result.url if present to avoid duplication
      let urlPath = result.url;
      if (urlPath.startsWith('/api/v1')) {
        urlPath = urlPath.replace('/api/v1', '');
      }
      // Ensure path starts with /
      if (!urlPath.startsWith('/')) {
        urlPath = `/${urlPath}`;
      }
      const imageUrl = `${API_BASE_URL}${urlPath}`;
      
      if (editorRef.current) {
        editorRef.current.insertImage(imageUrl, result.filename);
      } else {
        // Fallback: append to content if ref not available
        const currentContent = watch('content') || '';
        const imageHtml = `<img src="${imageUrl}" alt="${result.filename}" />`;
        setValue('content', currentContent + imageHtml);
      }
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

  const uploadFeaturedImageMutation = useMutation({
    mutationFn: (file: File) => {
      return storageApi.upload(file, { blogId: blog?.id });
    },
    onSuccess: (result) => {
      // Construct full URL for featured image
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      let urlPath = result.url;
      if (urlPath.startsWith('/api/v1')) {
        urlPath = urlPath.replace('/api/v1', '');
      }
      if (!urlPath.startsWith('/')) {
        urlPath = `/${urlPath}`;
      }
      const imageUrl = `${API_BASE_URL}${urlPath}`;
      setValue('featuredImage', imageUrl);
      setUploadingFeaturedImage(false);
    },
    onError: (error: any) => {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'Failed to upload featured image. Please try again.';
      setErrorFeedback(errorMessage);
      setUploadingFeaturedImage(false);
    },
  });

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrorFeedback('Please select an image file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorFeedback('Image size must be less than 10MB');
      return;
    }

    if (!blog?.id && !isEditMode) {
      setErrorFeedback('Please save the blog first, then upload images');
      return;
    }

    setUploadingImage(true);
    uploadImageMutation.mutate(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFeaturedImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadingFeaturedImage(true);
    uploadFeaturedImageMutation.mutate(file);
    
    // Reset input
    if (featuredImageInputRef.current) {
      featuredImageInputRef.current.value = '';
    }
  };

  const handleDriveFileSelect = (file: DriveFile) => {
    // Convert Google Drive file to URL
    // The backend will convert this to a proxy URL when saving
    const driveUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    setValue('featuredImage', driveUrl);
    setShowDrivePicker(false);
  };

  const handleContentDriveFileSelect = (file: DriveFile) => {
    // Convert Google Drive file to URL and insert into editor
    // The backend will convert this to a proxy URL when saving
    const driveUrl = file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`;
    
    if (editorRef.current) {
      editorRef.current.insertImage(driveUrl, file.name || 'Image from Drive');
    } else {
      // Fallback: append to content if ref not available
      const currentContent = watch('content') || '';
      const imageHtml = `<img src="${driveUrl}" alt="${file.name || 'Image from Drive'}" />`;
      setValue('content', currentContent + imageHtml);
    }
    setShowContentDrivePicker(false);
  };

  const onSubmit = (data: FormValues) => {
    const payload: CreateBlogDto | UpdateBlogDto = {
      title: data.title,
      slug: data.slug || undefined,
      excerpt: data.excerpt || undefined,
      content: data.content,
      featuredImage: data.featuredImage || undefined,
      featured: data.featured,
      status: data.status,
      publishedAt: data.publishedAt || undefined,
      metaTitle: data.metaTitle || undefined,
      metaDescription: data.metaDescription || undefined,
    };

    if (isEditMode && blog) {
      updateMutation.mutate({ id: blog.id, payload });
    } else {
      createMutation.mutate(payload as CreateBlogDto);
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
                {isEditMode ? 'Edit Blog Post' : 'Create Blog Post'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isEditMode
                  ? 'Update blog post details.'
                  : 'Create a new blog post for your website.'}
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
                placeholder="Blog post title"
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

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register('featured')}
                  className="h-4 w-4 rounded border-border text-blue-600 focus:ring-2 focus:ring-blue-200"
                />
                <span className="text-sm font-medium text-muted-foreground">
                  Featured Blog Post
                </span>
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Featured blog posts will be highlighted on your website.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Excerpt
              </label>
              <textarea
                {...register('excerpt')}
                rows={3}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                placeholder="Short summary of the blog post"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="block text-sm font-medium text-muted-foreground">
                Content<span className="text-rose-500">*</span>
              </label>
                {isEditMode && blog?.id && (
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploadingImage}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
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
                      onClick={() => setShowContentDrivePicker(true)}
                      disabled={uploadingImage}
                      className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                    >
                      <FolderOpen className="h-3 w-3" />
                      Pick from Drive
                    </button>
                  </div>
                )}
              </div>
              <RichTextEditor
                ref={editorRef}
                value={watch('content') || ''}
                onChange={(html) => setValue('content', html)}
                placeholder="Blog post content. You can insert images using Google Drive links or upload them directly."
                minHeight="300px"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Tip: {isEditMode && blog?.id 
                  ? 'You can upload images using the "Upload Image" button above, or insert images from Google Drive by adding them in the editor. Google Drive links will be automatically converted.'
                  : 'After saving, you can upload images using the "Upload Image" button. You can also insert images from Google Drive by adding them in the editor. Google Drive links will be automatically converted.'}
              </p>
              {errors.content && (
                <p className="mt-1 text-xs text-rose-600">{errors.content.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                Featured Image
              </label>
              <div className="space-y-2">
                {/* Featured Image Preview */}
                {watch('featuredImage') && (
                  <div className="relative w-full overflow-hidden rounded-lg border border-border">
                    <img
                      src={watch('featuredImage')}
                      alt="Featured"
                      className="h-48 w-full object-cover"
                      onError={(e) => {
                        // Hide image on error
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setValue('featuredImage', '')}
                      className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white transition hover:bg-black/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
                
                {/* Upload Controls */}
                <div className="flex items-center gap-2">
                  <input
                    ref={featuredImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFeaturedImageUpload}
                    className="hidden"
                    disabled={uploadingFeaturedImage}
                  />
                  <button
                    type="button"
                    onClick={() => featuredImageInputRef.current?.click()}
                    disabled={uploadingFeaturedImage}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    {uploadingFeaturedImage ? (
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
                    onClick={() => setShowDrivePicker(true)}
                    disabled={uploadingFeaturedImage}
                    className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted disabled:opacity-50"
                  >
                    <FolderOpen className="h-3 w-3" />
                    Pick from Drive
                  </button>
                </div>
                
                {/* URL Input (for manual entry) */}
              <input
                type="url"
                {...register('featuredImage')}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  placeholder="Or paste image URL or Google Drive link"
              />
                <p className="text-xs text-muted-foreground">
                  Upload an image, pick from Google Drive, or paste a URL. Google Drive images will be automatically converted.
              </p>
              </div>
            </div>

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
                    ? 'Update Blog'
                    : 'Create Blog'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Drive Picker for Featured Images */}
      <DrivePicker
        open={showDrivePicker}
        mode="file"
        fileTypeFilter="image"
        title="Select Featured Image from Google Drive"
        description="Choose an image from your Google Drive to use as the featured image."
        onClose={() => setShowDrivePicker(false)}
        onSelectFile={handleDriveFileSelect}
      />

      {/* Drive Picker for Content Images */}
      <DrivePicker
        open={showContentDrivePicker}
        mode="file"
        fileTypeFilter="image"
        title="Select Image from Google Drive"
        description="Choose an image from your Google Drive to insert into the content."
        onClose={() => setShowContentDrivePicker(false)}
        onSelectFile={handleContentDriveFileSelect}
      />
    </>
  );
}


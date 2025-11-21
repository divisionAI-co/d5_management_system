import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { X, Send, Loader2, Mail, Eye, EyeOff } from 'lucide-react';
import { templatesApi } from '@/lib/api/templates';
import { SafeHtml } from '@/components/ui/SafeHtml';

interface SendEmailModalProps {
  title: string;
  defaultTo?: string;
  defaultSubject?: string;
  onClose: () => void;
  onSend: (payload: {
    to: string;
    subject: string;
    templateId?: string;
    htmlContent?: string;
    textContent?: string;
    cc?: string;
    bcc?: string;
  }) => Promise<any>;
  previewEmail?: (payload: {
    templateId?: string;
    htmlContent?: string;
    textContent?: string;
  }) => Promise<{ html: string; text: string }>;
}

type FormValues = {
  to: string;
  subject: string;
  emailOption: 'template' | 'custom';
  templateId?: string;
  htmlContent?: string;
  textContent?: string;
  cc?: string;
  bcc?: string;
};

export function SendEmailModal({
  title,
  defaultTo = '',
  defaultSubject = '',
  onClose,
  onSend,
  previewEmail,
}: SendEmailModalProps) {
  const [isSending, setIsSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ html: string; text: string } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      to: defaultTo,
      subject: defaultSubject,
      emailOption: 'template',
      htmlContent: '',
      textContent: '',
      cc: '',
      bcc: '',
    },
  });

  const emailOption = watch('emailOption');
  const templateId = watch('templateId');
  const htmlContent = watch('htmlContent');
  const textContent = watch('textContent');

  // Fetch email templates
  const templatesQuery = useQuery({
    queryKey: ['templates', { type: 'EMAIL', onlyActive: true }],
    queryFn: () => templatesApi.list({ type: 'EMAIL', onlyActive: true }),
    enabled: emailOption === 'template',
  });

  const templates = templatesQuery.data || [];

  // Convert plain text to HTML preserving line breaks
  const convertTextToHtml = (text: string): string => {
    if (!text) return '';
    // If it already looks like HTML, return as is
    if (text.includes('<') && text.includes('>')) {
      return text;
    }
    // Convert line breaks to paragraphs
    return text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        return trimmed ? `<p>${trimmed}</p>` : '<br>';
      })
      .join('');
  };

  // Load preview when content changes
  useEffect(() => {
    if (showPreview && previewEmail) {
      const timer = setTimeout(() => {
        loadPreview();
      }, 500); // Debounce preview loading

      return () => clearTimeout(timer);
    }
  }, [templateId, htmlContent, textContent, emailOption, showPreview]);

  const loadPreview = async () => {
    if (!previewEmail) return;

    setIsLoadingPreview(true);
    setPreviewError(null);

    try {
      const payload: {
        templateId?: string;
        htmlContent?: string;
        textContent?: string;
      } = {};

      if (emailOption === 'template' && templateId) {
        payload.templateId = templateId;
      } else if (emailOption === 'custom') {
        // Convert plain text to HTML if needed
        const html = htmlContent || '';
        payload.htmlContent = html ? convertTextToHtml(html) : '';
        payload.textContent = textContent || '';
      }

      const preview = await previewEmail(payload);
      setPreviewContent(preview);
    } catch (error) {
      console.error('Failed to load preview:', error);
      setPreviewError(error instanceof Error ? error.message : 'Failed to load preview');
      setPreviewContent(null);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const onSubmit = async (values: FormValues) => {
    setIsSending(true);
    try {
      const payload: {
        to: string;
        subject: string;
        templateId?: string;
        htmlContent?: string;
        textContent?: string;
        cc?: string;
        bcc?: string;
      } = {
        to: values.to,
        subject: values.subject,
      };

      if (values.emailOption === 'template' && values.templateId) {
        payload.templateId = values.templateId;
      } else if (values.emailOption === 'custom') {
        if (!values.htmlContent && !values.textContent) {
          throw new Error('Either HTML or text content is required for custom emails');
        }
        // Convert plain text to HTML if needed
        payload.htmlContent = values.htmlContent ? convertTextToHtml(values.htmlContent) : undefined;
        payload.textContent = values.textContent;
      }

      if (values.cc) {
        payload.cc = values.cc;
      }
      if (values.bcc) {
        payload.bcc = values.bcc;
      }

      await onSend(payload);
      onClose();
    } catch (error) {
      console.error('Failed to send email:', error);
      alert(error instanceof Error ? error.message : 'Failed to send email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">{title}</h2>
              <p className="text-sm text-muted-foreground">Send an email using a template or custom content</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left column: Form fields */}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  To <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  {...register('to', { required: 'Recipient email is required' })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="recipient@example.com"
                />
                {errors.to ? <p className="mt-1 text-sm text-rose-600">{errors.to.message}</p> : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">
                  Subject <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  {...register('subject', { required: 'Subject is required' })}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Email subject"
                />
                {errors.subject ? (
                  <p className="mt-1 text-sm text-rose-600">{errors.subject.message}</p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-muted-foreground">Email Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      {...register('emailOption')}
                      value="template"
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-foreground">Use Template</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      {...register('emailOption')}
                      value="custom"
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="text-sm text-foreground">Custom Email</span>
                  </label>
                </div>
              </div>

              {emailOption === 'template' ? (
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">
                    Template <span className="text-rose-500">*</span>
                  </label>
                  {templatesQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading templates...
                    </div>
                  ) : templates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No email templates available</p>
                  ) : (
                    <select
                      {...register('templateId', {
                        required: emailOption === 'template' ? 'Please select a template' : false,
                      })}
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a template</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name} {template.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {errors.templateId ? (
                    <p className="mt-1 text-sm text-rose-600">{errors.templateId.message}</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Email Content <span className="text-rose-500">*</span>
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (Line breaks will be preserved)
                      </span>
                    </label>
                    <textarea
                      {...register('htmlContent', {
                        required: emailOption === 'custom' ? 'Email content is required' : false,
                      })}
                      rows={12}
                      className="w-full rounded-lg border border-border px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      placeholder="Type your email content here. Line breaks will be preserved as paragraphs."
                    />
                    {errors.htmlContent ? (
                      <p className="mt-1 text-sm text-rose-600">{errors.htmlContent.message}</p>
                    ) : null}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-muted-foreground">
                      Text Content (Optional)
                    </label>
                    <textarea
                      {...register('textContent')}
                      rows={5}
                      className="w-full rounded-lg border border-border px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      placeholder="Plain text version"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">CC (Optional)</label>
                  <input
                    type="text"
                    {...register('cc')}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="cc1@example.com, cc2@example.com"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-muted-foreground">BCC (Optional)</label>
                  <input
                    type="text"
                    {...register('bcc')}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="bcc1@example.com, bcc2@example.com"
                  />
                </div>
              </div>
            </div>

            {/* Right column: Preview */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-muted-foreground">Preview</label>
                {previewEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPreview(!showPreview);
                      if (!showPreview) {
                        loadPreview();
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {showPreview ? (
                      <>
                        <EyeOff className="h-4 w-4" />
                        Hide Preview
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" />
                        Show Preview
                      </>
                    )}
                  </button>
                )}
              </div>

              {showPreview && previewEmail && (
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  {isLoadingPreview ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Loading preview...</span>
                    </div>
                  ) : previewError ? (
                    <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-600">
                      {previewError}
                    </div>
                  ) : previewContent ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="mb-2 text-sm font-medium text-foreground">HTML Preview:</h4>
                        <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-white p-4 shadow-sm">
                          <SafeHtml html={previewContent.html || '<p class="text-muted-foreground">No content</p>'} />
                        </div>
                      </div>
                      {previewContent.text && (
                        <div>
                          <h4 className="mb-2 text-sm font-medium text-foreground">Text Preview:</h4>
                          <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-white p-4 font-mono text-xs text-muted-foreground">
                            {previewContent.text || 'No text content'}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Select a template or enter content to see preview
                    </div>
                  )}
                </div>
              )}

              {!showPreview && previewEmail && (
                <div className="rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center">
                  <Eye className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Click "Show Preview" to see how your email will look
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

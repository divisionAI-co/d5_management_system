import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { X, Send, Loader2, Mail } from 'lucide-react';
import { templatesApi } from '@/lib/api/templates';

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
}: SendEmailModalProps) {
  const [isSending, setIsSending] = useState(false);

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

  // Fetch email templates
  const templatesQuery = useQuery({
    queryKey: ['templates', { type: 'EMAIL', onlyActive: true }],
    queryFn: () => templatesApi.list({ type: 'EMAIL', onlyActive: true }),
    enabled: emailOption === 'template',
  });

  const templates = templatesQuery.data || [];

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
        payload.htmlContent = values.htmlContent;
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card shadow-xl">
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
                    HTML Content <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    {...register('htmlContent', {
                      required: emailOption === 'custom' ? 'HTML content is required' : false,
                    })}
                    rows={10}
                    className="w-full rounded-lg border border-border px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="<html>...</html>"
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


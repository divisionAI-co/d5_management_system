import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Send, Loader2, Mail } from 'lucide-react';
import { candidatesApi } from '@/lib/api/recruitment/candidates';
import { templatesApi } from '@/lib/api/templates';
import type { Candidate, MarkInactivePayload } from '@/types/recruitment';
import { FeedbackToast } from '@/components/ui/feedback-toast';

interface MarkInactiveModalProps {
  candidate: Candidate;
  onClose: () => void;
  onSuccess: (candidate: Candidate) => void;
}

type FormValues = {
  reason: string;
  sendEmail: boolean;
  emailOption: 'none' | 'template' | 'custom';
  templateId?: string;
  emailSubject?: string;
  emailBody?: string;
  emailTo?: string;
};

const INACTIVE_REASONS = [
  'Position filled',
  'Candidate withdrew',
  'Not a good fit',
  'Skills mismatch',
  'Salary expectations too high',
  'Availability issues',
  'Other',
];

const defaultEmailBody = (candidate: Candidate, reason?: string) => {
  return `Dear ${candidate.firstName} ${candidate.lastName},

Thank you for your interest in joining our team. After careful consideration, we have decided to move forward with other candidates at this time.

${reason ? `Reason: ${reason}` : ''}

We appreciate the time you invested in the application process and wish you the best in your career endeavors.

Best regards,
Recruitment Team`;
};

export function MarkInactiveModal({ candidate, onClose, onSuccess }: MarkInactiveModalProps) {
  const queryClient = useQueryClient();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      reason: '',
      sendEmail: false,
      emailOption: 'template',
      emailTo: candidate.email || '',
      emailSubject: `Update on Your Application - ${candidate.firstName} ${candidate.lastName}`,
      emailBody: defaultEmailBody(candidate),
    },
  });

  const sendEmail = watch('sendEmail');
  const emailOption = watch('emailOption');
  const reason = watch('reason');

  // Fetch email templates
  const templatesQuery = useQuery({
    queryKey: ['templates', { type: 'EMAIL', onlyActive: true }],
    queryFn: () => templatesApi.list({ type: 'EMAIL', onlyActive: true }),
    enabled: sendEmail && emailOption === 'template',
  });

  const markInactiveMutation = useMutation({
    mutationFn: (payload: MarkInactivePayload) => candidatesApi.markInactive(candidate.id, payload),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['candidates'] });
      setSuccessMessage('Candidate unlinked from positions successfully');
      onSuccess(updated);
      setTimeout(() => {
        onClose();
      }, 1000);
    },
    onError: (error: any) => {
      setErrorMessage(error?.response?.data?.message || 'Failed to unlink candidate from positions');
    },
  });

  // Update email body when reason changes
  useEffect(() => {
    if (emailOption === 'custom' && reason) {
      setValue('emailBody', defaultEmailBody(candidate, reason));
    }
  }, [reason, emailOption, candidate, setValue]);

  const onSubmit = (values: FormValues) => {
    const shouldSendEmail = values.sendEmail;
    
    const payload: MarkInactivePayload = {
      reason: values.reason || undefined,
      sendEmail: shouldSendEmail,
      templateId: shouldSendEmail && values.emailOption === 'template' ? values.templateId : undefined,
      emailSubject:
        shouldSendEmail && values.emailOption === 'custom' ? values.emailSubject : undefined,
      emailBody: shouldSendEmail && values.emailOption === 'custom' ? values.emailBody : undefined,
      emailTo: shouldSendEmail && values.emailTo ? values.emailTo : undefined,
    };

    markInactiveMutation.mutate(payload, {
      onSuccess: (updated) => {
        onSuccess(updated);
      },
    });
  };

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    if (reason === 'Other') {
      setValue('reason', '');
    } else {
      setValue('reason', reason);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-card shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Unlink Candidate from Positions</h2>
            <p className="text-sm text-muted-foreground">
              Remove {candidate.firstName} {candidate.lastName} from all linked positions
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="space-y-6 px-6 py-6">
            {/* Reason Selection */}
            <div>
              <label className="mb-2 block text-sm font-medium text-muted-foreground">
                Reason for unlinking <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {INACTIVE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleReasonSelect(r)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                      selectedReason === r
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {selectedReason === 'Other' && (
                <textarea
                  {...register('reason', { required: 'Please provide a reason' })}
                  rows={3}
                  placeholder="Please specify the reason..."
                  className="mt-3 w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
              )}
              {selectedReason && selectedReason !== 'Other' && (
                <input type="hidden" {...register('reason')} value={selectedReason} />
              )}
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
              )}
            </div>

            {/* Email Options */}
            <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-3">
                <input
                  id="send-email"
                  type="checkbox"
                  {...register('sendEmail')}
                  className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="send-email" className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4" />
                  Send email notification to candidate
                </label>
              </div>

              {sendEmail && (
                <div className="space-y-4 pl-7">
                  {/* Email Option Selection */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-muted-foreground">
                      Email Type
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          {...register('emailOption')}
                          value="none"
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-muted-foreground">Don't send email</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          {...register('emailOption')}
                          value="template"
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-muted-foreground">Use email template</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          {...register('emailOption')}
                          value="custom"
                          className="h-4 w-4 text-blue-600"
                        />
                        <span className="text-sm text-muted-foreground">Write custom email</span>
                      </label>
                    </div>
                  </div>

                  {/* Template Selection */}
                  {emailOption === 'template' && (
                    <div>
                      <label className="mb-1 block text-sm font-medium text-muted-foreground">
                        Select Template
                      </label>
                      {templatesQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading templates...
                        </div>
                      ) : templatesQuery.isError ? (
                        <p className="text-sm text-red-600">Failed to load templates</p>
                      ) : (
                        <select
                          {...register('templateId', {
                            required: emailOption === 'template' ? 'Please select a template' : false,
                          })}
                          className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        >
                          <option value="">Select a template...</option>
                          {templatesQuery.data?.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {errors.templateId && (
                        <p className="mt-1 text-sm text-red-600">{errors.templateId.message}</p>
                      )}
                    </div>
                  )}

                  {/* Custom Email Fields */}
                  {emailOption === 'custom' && (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-muted-foreground">
                          To
                        </label>
                        <input
                          type="email"
                          {...register('emailTo', {
                            required: emailOption === 'custom' ? 'Recipient email is required' : false,
                          })}
                          className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                          placeholder="candidate@example.com"
                        />
                        {errors.emailTo && (
                          <p className="mt-1 text-sm text-red-600">{errors.emailTo.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-muted-foreground">
                          Subject <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          {...register('emailSubject', {
                            required: emailOption === 'custom' ? 'Subject is required' : false,
                          })}
                          className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        />
                        {errors.emailSubject && (
                          <p className="mt-1 text-sm text-red-600">{errors.emailSubject.message}</p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-muted-foreground">
                          Message <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          rows={8}
                          {...register('emailBody', {
                            required: emailOption === 'custom' ? 'Email body is required' : false,
                          })}
                          className="w-full rounded-lg border border-border px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        />
                        {errors.emailBody && (
                          <p className="mt-1 text-sm text-red-600">{errors.emailBody.message}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col gap-3 border-t border-border bg-muted/20 px-6 py-4 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={markInactiveMutation.isPending || !selectedReason}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {markInactiveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Unlinking...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Unlink Positions
                </>
              )}
            </button>
          </div>
        </form>
      </div>
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


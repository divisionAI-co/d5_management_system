import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { quotesApi } from '@/lib/api/crm';
import type { Quote, SendQuotePayload } from '@/types/crm';
import { X } from 'lucide-react';

interface SendQuoteModalProps {
  quote: Quote;
  onClose: () => void;
  onSuccess: () => void;
}

type FormValues = {
  to: string;
  subject?: string;
  message?: string;
  cc?: string;
  bcc?: string;
};

export function SendQuoteModal({ quote, onClose, onSuccess }: SendQuoteModalProps) {
  const queryClient = useQueryClient();
  const lead = quote.lead;
  const primaryContact = lead.contacts && lead.contacts.length > 0 ? lead.contacts[0] : null;
  const defaultEmail = primaryContact?.email || '';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      to: defaultEmail,
      subject: `Quote: ${quote.title} - ${quote.quoteNumber}`,
      message: '',
    },
  });

  const sendMutation = useMutation({
    mutationFn: (payload: SendQuotePayload) => quotesApi.send(quote.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', quote.id] });
      onSuccess();
    },
  });

  const onSubmit = async (data: FormValues) => {
    const payload: SendQuotePayload = {
      to: data.to,
      subject: data.subject || `Quote: ${quote.title} - ${quote.quoteNumber}`,
      textContent: data.message,
      cc: data.cc,
      bcc: data.bcc,
    };
    sendMutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-xl font-semibold text-foreground">Send Quote</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              To <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              {...register('to', { required: 'Recipient email is required' })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            {errors.to && (
              <p className="mt-1 text-xs text-red-500">{errors.to.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Subject</label>
            <input
              type="text"
              {...register('subject')}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">Message</label>
            <textarea
              {...register('message')}
              rows={4}
              placeholder="Optional message to include in the email..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">CC</label>
              <input
                type="text"
                {...register('cc')}
                placeholder="comma-separated emails"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-foreground">BCC</label>
              <input
                type="text"
                {...register('bcc')}
                placeholder="comma-separated emails"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
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
              disabled={isSubmitting || sendMutation.isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting || sendMutation.isPending ? 'Sending...' : 'Send Quote'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


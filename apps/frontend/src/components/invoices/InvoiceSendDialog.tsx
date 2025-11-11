import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Send, Loader2 } from 'lucide-react';
import { invoicesApi } from '@/lib/api/invoices';
import type { InvoiceDetail, SendInvoicePayload } from '@/types/invoices';

type FormValues = {
  to: string;
  cc?: string;
  subject: string;
  message: string;
};

interface InvoiceSendDialogProps {
  invoice: InvoiceDetail;
  onClose: () => void;
  onSent: (invoice: InvoiceDetail) => void;
}

const defaultMessage = (invoice: InvoiceDetail) => {
  const customerName = invoice.customer?.name ?? 'customer';
  const dueDate = new Date(invoice.dueDate).toLocaleDateString();
  const totalFormatted = invoice.total.toLocaleString(undefined, {
    style: 'currency',
    currency: invoice.currency ?? 'USD',
  });

  return `Hi ${customerName},

Please find attached invoice ${invoice.invoiceNumber} for ${totalFormatted}.
Payment is due on ${dueDate}. Let us know if you have any questions.

Thank you,
Finance Team`;
};

export function InvoiceSendDialog({ invoice, onClose, onSent }: InvoiceSendDialogProps) {
  const queryClient = useQueryClient();

  const defaultValues = useMemo<FormValues>(
    () => ({
      to: invoice.customer?.email ?? '',
      cc: '',
      subject: `Invoice ${invoice.invoiceNumber} from D5 Management`,
      message: defaultMessage(invoice),
    }),
    [invoice],
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const sendMutation = useMutation({
    mutationFn: (payload: SendInvoicePayload) => invoicesApi.send(invoice.id, payload),
  });

  const onSubmit = (values: FormValues) => {
    const parseEmails = (input?: string) =>
      input
        ?.split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    const payload: SendInvoicePayload = {
      to: parseEmails(values.to),
      cc: parseEmails(values.cc),
      subject: values.subject,
      message: values.message
        .split('\n')
        .map((line) => line.trim())
        .join('\n\n'),
    };

    sendMutation.mutate(payload, {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
        onSent(updated);
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Send Invoice</h2>
            <p className="text-sm text-muted-foreground">
              Email invoice {invoice.invoiceNumber} to the customer with optional message.
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

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                To * (comma separated)
              </label>
              <input
                type="text"
                {...register('to', {
                  required: 'At least one recipient email is required',
                })}
                placeholder="billing@example.com, ap@example.com"
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.to && <p className="mt-1 text-sm text-red-600">{errors.to.message}</p>}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">
                CC (optional)
              </label>
              <input
                type="text"
                {...register('cc')}
                placeholder="finance@example.com"
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-muted-foreground">Subject *</label>
              <input
                type="text"
                {...register('subject', { required: 'Subject is required' })}
                className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
              {errors.subject && (
                <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Message</label>
            <textarea
              rows={6}
              {...register('message')}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-6 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sendMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send Invoice
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



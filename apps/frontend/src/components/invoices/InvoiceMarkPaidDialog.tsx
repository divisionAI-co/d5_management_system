import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, CheckCircle, Loader2 } from 'lucide-react';
import { invoicesApi } from '@/lib/api/invoices';
import type { InvoiceDetail, MarkInvoicePaidPayload } from '@/types/invoices';

type FormValues = {
  paidDate: string;
  note?: string;
};

interface InvoiceMarkPaidDialogProps {
  invoice: InvoiceDetail;
  onClose: () => void;
  onMarked: (invoice: InvoiceDetail) => void;
}

const getDefaultPaidDate = () => new Date().toISOString().split('T')[0];

export function InvoiceMarkPaidDialog({
  invoice,
  onClose,
  onMarked,
}: InvoiceMarkPaidDialogProps) {
  const queryClient = useQueryClient();

  const defaultValues = useMemo<FormValues>(
    () => ({
      paidDate: invoice.paidDate ? invoice.paidDate.slice(0, 10) : getDefaultPaidDate(),
      note: '',
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

  const markPaidMutation = useMutation({
    mutationFn: (payload: MarkInvoicePaidPayload) => invoicesApi.markPaid(invoice.id, payload),
  });

  const onSubmit = (values: FormValues) => {
    const payload: MarkInvoicePaidPayload = {
      paidDate: values.paidDate,
      note: values.note?.trim() ? values.note.trim() : undefined,
    };

    markPaidMutation.mutate(payload, {
      onSuccess: (updated) => {
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
        queryClient.invalidateQueries({ queryKey: ['invoice', invoice.id] });
        onMarked(updated);
      },
    });
  };

  const amountFormatted = invoice.total.toLocaleString(undefined, {
    style: 'currency',
    currency: invoice.currency ?? 'USD',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Mark Invoice as Paid</h2>
            <p className="text-sm text-muted-foreground">
              Record payment for invoice {invoice.invoiceNumber} ({amountFormatted}).
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
          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">Paid Date *</label>
            <input
              type="date"
              {...register('paidDate', { required: 'Paid date is required' })}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
            {errors.paidDate && (
              <p className="mt-1 text-sm text-red-600">{errors.paidDate.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-muted-foreground">
              Payment Notes (optional)
            </label>
            <textarea
              rows={4}
              {...register('note')}
              className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
              placeholder="Add transaction reference or payment details..."
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
              disabled={markPaidMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {markPaidMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Confirm Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



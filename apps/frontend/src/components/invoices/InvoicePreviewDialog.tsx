import { useState, useEffect } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { invoicesApi } from '@/lib/api/invoices';
import type { InvoiceDetail, PreviewInvoiceResponse } from '@/types/invoices';

interface InvoicePreviewDialogProps {
  invoice: InvoiceDetail;
  templateId?: string;
  onClose: () => void;
}

export function InvoicePreviewDialog({
  invoice,
  templateId,
  onClose,
}: InvoicePreviewDialogProps) {
  const [preview, setPreview] = useState<PreviewInvoiceResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await invoicesApi.preview(invoice.id, { templateId });
        setPreview(result);
      } catch (err) {
        console.error('Failed to load preview:', err);
        setError('Failed to load invoice preview. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPreview();
  }, [invoice.id, templateId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="relative flex flex-col overflow-hidden rounded-lg bg-card shadow-lg"
        style={{
          width: '850px', // A4 width (794px) + padding
          height: '1200px', // A4 height (1123px) + header + padding
          maxWidth: '95vw',
          maxHeight: '95vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Invoice Preview</h2>
            <p className="text-sm text-muted-foreground">
              {invoice.invoiceNumber}
              {preview?.templateId && ' · Using custom template'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading && (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm text-muted-foreground">Generating preview...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex h-full items-center justify-center">
              <div className="flex max-w-md flex-col items-center gap-3 text-center">
                <AlertTriangle className="h-12 w-12 text-amber-500" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <button
                  onClick={onClose}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {!isLoading && !error && preview && (
            <div className="flex-1 min-h-0 overflow-auto bg-gray-100 flex items-center justify-center p-4">
              <iframe
                title="Invoice preview"
                className="border-0 bg-white shadow-lg"
                style={{
                  width: '794px',
                  height: '1123px',
                  maxWidth: '100%',
                }}
                srcDoc={preview.renderedHtml}
                sandbox="allow-same-origin allow-scripts"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


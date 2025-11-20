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
        // Convert relative API URLs to absolute URLs for iframe compatibility
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
        // API_URL already includes /api/v1, so remove it from the path
        const processedHtml = result.renderedHtml.replace(
          /src=["'](\/api\/v1\/[^"']+)["']/gi,
          (_match, path) => `src="${apiUrl}${path.replace(/^\/api\/v1/, '')}"`
        );
        setPreview({ ...result, renderedHtml: processedHtml });
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
      <div className="relative flex h-full max-h-[90vh] w-full max-w-5xl flex-col rounded-lg bg-card shadow-lg">
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
        <div className="flex-1 overflow-hidden">
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
            <iframe
              title="Invoice preview"
              className="h-full w-full border-0 bg-white"
              srcDoc={`<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https: http://localhost:* drive.google.com; connect-src 'self' http://localhost:* https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';"></head><body>${preview.renderedHtml}</body></html>`}
              sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
            />
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


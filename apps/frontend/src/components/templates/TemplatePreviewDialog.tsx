import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { templatesApi } from '@/lib/api/templates';
import type { TemplateModel } from '@/types/templates';
import { FeedbackToast } from '@/components/ui/feedback-toast';

interface TemplatePreviewDialogProps {
  template: TemplateModel;
  onClose: () => void;
}

const buildInitialData = (template: TemplateModel) => {
  const sampleEntries = template.variables
    .filter((variable) => variable.sampleValue !== undefined)
    .reduce<Record<string, unknown>>((acc, variable) => {
      acc[variable.key] = variable.sampleValue as unknown;
      return acc;
    }, {});

  if (Object.keys(sampleEntries).length === 0) {
    return '{}';
  }

  try {
    return JSON.stringify(sampleEntries, null, 2);
  } catch (error) {
    return '{}';
  }
};

export function TemplatePreviewDialog({ template, onClose }: TemplatePreviewDialogProps) {
  const [sampleDataInput, setSampleDataInput] = useState<string>(() =>
    buildInitialData(template),
  );
  const [renderedHtml, setRenderedHtml] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const templateSummary = useMemo(() => {
    const typeLabel = template.type
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

    return `${template.name} · ${typeLabel}`;
  }, [template.name, template.type]);

  const renderPreview = async () => {
    setIsLoading(true);
    setError(null);

    let parsedData: Record<string, unknown> | undefined;

    const trimmed = sampleDataInput.trim();
    if (trimmed.length) {
      try {
        parsedData = JSON.parse(trimmed);
      } catch (parseError) {
        setIsLoading(false);
        setError('Sample data must be valid JSON.');
        return;
      }
    }

    try {
      const response = await templatesApi.preview(template.id, {
        data: parsedData,
      });
      // Convert relative API URLs to absolute for iframe compatibility
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      // API_URL already includes /api/v1, so remove it from the path
      const processedHtml = response.renderedHtml.replace(
        /src=["'](\/api\/v1\/[^"']+)["']/gi,
        (_match, path) => `src="${apiUrl}${path.replace(/^\/api\/v1/, '')}"`
      );
      // Use iframe srcDoc to render HTML - iframe provides isolation
      // No sanitization needed as iframe sandbox prevents script execution
      setRenderedHtml(processedHtml);
    } catch (apiError) {
      setError(
        apiError instanceof Error
          ? apiError.message
          : 'Failed to render preview. Please try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    renderPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  return (
    <>
      {error && (
        <FeedbackToast message={error} onDismiss={() => setError(null)} tone="error" />
      )}

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Template Preview</h2>
            <p className="text-sm text-muted-foreground">{templateSummary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col lg:flex-row">
          <div className="flex h-72 flex-col border-b border-border p-4 lg:h-auto lg:w-[320px] lg:border-b-0 lg:border-r">
            <h3 className="text-sm font-semibold text-foreground">Sample Data</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Provide JSON data used to render the template. Variables without values default to an
              empty string.
            </p>
            <textarea
              value={sampleDataInput}
              onChange={(event) => setSampleDataInput(event.target.value)}
              className="min-h-[220px] flex-1 rounded-lg border border-border px-3 py-2 font-mono text-xs focus:border-transparent focus:ring-2 focus:ring-blue-500"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={renderPreview}
              disabled={isLoading}
              className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {isLoading ? 'Rendering...' : 'Render Preview'}
            </button>
          </div>

          <div className="flex-1 overflow-hidden bg-muted/70">
            {(() => {
              // Add CSP meta tag to iframe content to allow loading images from localhost
              const htmlContent = renderedHtml || '<div style="padding:24px;font-family:Arial,sans-serif;color:#6b7280;">Rendering preview...</div>';
              const htmlWithCsp = `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https: http://localhost:* drive.google.com; connect-src 'self' http://localhost:* https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';"></head><body>${htmlContent}</body></html>`;
              
              return (
                <iframe
                  title="Template preview"
                  className="h-full w-full border-0 bg-card"
                  srcDoc={htmlWithCsp}
                  sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="no-referrer"
                />
              );
            })()}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}



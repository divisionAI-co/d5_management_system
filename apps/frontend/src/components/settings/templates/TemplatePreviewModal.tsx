import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw, X } from 'lucide-react';

import { templatesApi } from '@/lib/api/templates';
import type { TemplateModel } from '@/types/templates';

type PreviewState =
  | { status: 'idle'; html: string | null; error: string | null }
  | { status: 'loading'; html: string | null; error: string | null }
  | { status: 'success'; html: string; error: null }
  | { status: 'error'; html: string | null; error: string };

type TemplatePreviewModalProps = {
  open: boolean;
  template: TemplateModel | null;
  onClose: () => void;
};

const stringifyData = (value: Record<string, unknown>) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
};

export function TemplatePreviewModal({ open, template, onClose }: TemplatePreviewModalProps) {
  const [dataInput, setDataInput] = useState<string>('{}');
  const [state, setState] = useState<PreviewState>({ status: 'idle', html: null, error: null });

  const sampleData = useMemo(() => {
    if (!template?.variables?.length) {
      return {};
    }

    return template.variables.reduce<Record<string, unknown>>((accumulator, variable) => {
      if (!variable.key) {
        return accumulator;
      }

      if (variable.sampleValue !== undefined) {
        accumulator[variable.key] = variable.sampleValue;
      } else {
        accumulator[variable.key] = '';
      }

      return accumulator;
    }, {});
  }, [template]);

  useEffect(() => {
    if (!open || !template) {
      return;
    }

    setDataInput(stringifyData(sampleData));
    setState({ status: 'idle', html: null, error: null });
  }, [open, template, sampleData]);

  // Convert relative API URLs to absolute URLs for iframe compatibility
  const convertRelativeUrls = (html: string): string => {
    if (!html) return html;
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    // Replace relative API URLs with absolute ones
    // API_URL already includes /api/v1, so remove it from the path
    return html.replace(
      /src=["'](\/api\/v1\/[^"']+)["']/gi,
      (match, path) => `src="${apiUrl}${path.replace(/^\/api\/v1/, '')}"`
    );
  };

  const fetchPreview = useCallback(async () => {
    if (!template) {
      return;
    }

    try {
      setState({ status: 'loading', html: null, error: null });

      let payload: Record<string, unknown> = {};

      if (dataInput.trim()) {
        try {
          payload = JSON.parse(dataInput);
        } catch (error: any) {
          throw new Error('Preview data must be valid JSON.');
        }
      }

      const response = await templatesApi.preview(template.id, { data: payload });
      // Convert relative URLs to absolute for iframe compatibility
      const processedHtml = convertRelativeUrls(response.renderedHtml);
      setState({ status: 'success', html: processedHtml, error: null });
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        'Unable to render preview. Please check your template.';
      setState({ status: 'error', html: null, error: message });
    }
  }, [dataInput, template]);

  useEffect(() => {
    if (!open || !template) {
      return;
    }

    fetchPreview();
  }, [open, template, fetchPreview]);

  if (!open || !template) {
    return null;
  }

  const renderPreview = () => {
    if (state.status === 'loading') {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm font-medium">Rendering template preview...</span>
          </div>
        </div>
      );
    }

    if (state.status === 'error') {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-red-600">
          <p className="text-sm font-semibold">{state.error}</p>
          <button
            type="button"
            onClick={fetchPreview}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
          >
            <RefreshCcw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      );
    }

    if (state.status === 'success' && state.html) {
      // Add CSP meta tag to iframe content to allow loading images from localhost
      const htmlWithCsp = `<!DOCTYPE html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src 'self' data: https: http://localhost:* drive.google.com; connect-src 'self' http://localhost:* https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline';"></head><body>${state.html}</body></html>`;
      
      return (
        <div className="h-full min-h-0 overflow-hidden rounded-lg border border-border bg-card">
          <iframe
            title="Template preview"
            className="h-full w-full border-0"
            srcDoc={htmlWithCsp}
            sandbox="allow-same-origin allow-scripts allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[95vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{template.name} Preview</h2>
            <p className="text-sm text-muted-foreground">
              Templates render with Handlebars. Provide sample JSON data and refresh to see the output.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden md:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto border-b border-border bg-muted p-5 md:border-r md:border-b-0">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Sample Data (JSON)</label>
              <textarea
                value={dataInput}
                onChange={(event) => setDataInput(event.target.value)}
                rows={12}
                spellCheck={false}
                className="w-full flex-1 rounded-lg border border-border bg-card px-3 py-2 font-mono text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[11px] text-muted-foreground">
                Use sample data to populate merge variables. Invalid JSON will prevent preview rendering.
              </p>
            </div>

            <button
              type="button"
              onClick={fetchPreview}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh Preview
            </button>

            <div className="space-y-3 rounded-lg border border-border bg-card p-3">
              <h3 className="text-sm font-semibold text-foreground">Template Variables</h3>
              {template.variables?.length ? (
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {template.variables.map((variable) => (
                    <li key={variable.key} className="rounded-md bg-muted px-3 py-2">
                      <p className="font-semibold text-foreground">{variable.key}</p>
                      {variable.description && (
                        <p className="text-xs text-muted-foreground">{variable.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No variables registered for this template.</p>
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/70 p-5">
            {renderPreview()}
          </section>
        </div>
      </div>
    </div>
  );
}



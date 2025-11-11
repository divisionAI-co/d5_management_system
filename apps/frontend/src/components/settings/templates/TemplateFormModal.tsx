import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';

import type { CreateTemplatePayload, TemplateModel, TemplateType, TemplateVariable } from '@/types/templates';
import type { TemplateBlock } from '@/types/templates';
import { TemplateBlockEditor } from './TemplateBlockEditor';
import {
  createRawHtmlBlock,
  extractBlocksFromHtml,
  getDefaultTemplateBlocks,
  injectBlockMetadata,
  renderBlocksToHtml,
} from './template-blocks';

type TemplateFormValues = {
  name: string;
  type: TemplateType;
  htmlContent: string;
  cssContent: string;
  isDefault: boolean;
  isActive: boolean;
};

type TemplateVariableForm = {
  id: string;
  key: string;
  description: string;
  sampleValue: string;
};

type TemplateFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  template?: TemplateModel;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateTemplatePayload) => void;
};

const DEFAULT_HTML = `<main style="font-family: Arial, sans-serif; line-height: 1.5;">
  <h1 style="color: #1f2937;">Hi {{firstName}},</h1>
  <p>Thanks for choosing D5 Management System. This is your email template body.</p>
  <p style="margin-top: 24px;">— The D5 Team</p>
</main>`;

const TEMPLATE_TYPE_OPTIONS: Array<{ value: TemplateType; label: string; description: string }> = [
  {
    value: 'EMAIL',
    label: 'Email',
    description: 'Transactional or notification emails sent to users/customers.',
  },
  {
    value: 'INVOICE',
    label: 'Invoice',
    description: 'HTML template used when emailing invoices to customers.',
  },
  {
    value: 'CUSTOMER_REPORT',
    label: 'Customer Report',
    description: 'Summary reports sent to clients with engagement metrics.',
  },
  {
    value: 'PERFORMANCE_REVIEW',
    label: 'Performance Review',
    description: 'Documents for employee review exports or emails.',
  },
];

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `var_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
};

const newVariable = (): TemplateVariableForm => ({
  id: generateId(),
  key: '',
  description: '',
  sampleValue: '',
});

const toFormVariable = (variable: TemplateVariable): TemplateVariableForm => ({
  id: generateId(),
  key: variable.key ?? '',
  description: variable.description ?? '',
  sampleValue:
    variable.sampleValue === null || variable.sampleValue === undefined
      ? ''
      : typeof variable.sampleValue === 'string'
        ? variable.sampleValue
        : JSON.stringify(variable.sampleValue, null, 2),
});

export function TemplateFormModal({
  open,
  mode,
  template,
  submitting = false,
  onClose,
  onSubmit,
}: TemplateFormModalProps) {
  const [formValues, setFormValues] = useState<TemplateFormValues>(() => ({
    name: '',
    type: 'EMAIL',
    htmlContent: DEFAULT_HTML,
    cssContent: '',
    isDefault: false,
    isActive: true,
  }));

  const [variables, setVariables] = useState<TemplateVariableForm[]>(() => [newVariable()]);
  const [blocks, setBlocks] = useState<TemplateBlock[]>(() => getDefaultTemplateBlocks());
  const [editingMode, setEditingMode] = useState<'visual' | 'html'>('visual');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (template) {
      const { blocks: storedBlocks, htmlWithoutMeta } = extractBlocksFromHtml(template.htmlContent);

      setFormValues({
        name: template.name,
        type: template.type,
        htmlContent: htmlWithoutMeta,
        cssContent: template.cssContent ?? '',
        isDefault: template.isDefault,
        isActive: template.isActive,
      });

      const vars = template.variables?.length
        ? template.variables.map((item) => toFormVariable(item))
        : [newVariable()];
      setVariables(vars);

      if (storedBlocks && storedBlocks.length) {
        setBlocks(storedBlocks);
        setEditingMode('visual');
      } else {
        setBlocks([createRawHtmlBlock(htmlWithoutMeta)]);
        setEditingMode('html');
      }
    } else {
      const defaultBlocks = getDefaultTemplateBlocks();
      setFormValues({
        name: '',
        type: 'EMAIL',
        htmlContent: renderBlocksToHtml(defaultBlocks),
        cssContent: '',
        isDefault: false,
        isActive: true,
      });
      setVariables([newVariable()]);
      setBlocks(defaultBlocks);
      setEditingMode('visual');
    }
    setErrorMessage(null);
  }, [open, template]);

  useEffect(() => {
    if (editingMode !== 'visual') {
      return;
    }

    const generated = renderBlocksToHtml(blocks);
    setFormValues((prev) => {
      if (prev.htmlContent === generated) {
        return prev;
      }

      return {
        ...prev,
        htmlContent: generated,
      };
    });
  }, [blocks, editingMode]);

  const dialogTitle = useMemo(
    () => (mode === 'create' ? 'Create Template' : `Edit ${template?.name ?? 'Template'}`),
    [mode, template?.name],
  );

  if (!open) {
    return null;
  }

  const handleVariableChange = (id: string, key: keyof TemplateVariableForm, value: string) => {
    setVariables((prev) =>
      prev.map((variable) => (variable.id === id ? { ...variable, [key]: value } : variable)),
    );
  };

  const handleRemoveVariable = (id: string) => {
    setVariables((prev) => {
      if (prev.length === 1) {
        return prev;
      }
      return prev.filter((variable) => variable.id !== id);
    });
  };

  const buildPayload = (): CreateTemplatePayload | null => {
    if (!formValues.name.trim()) {
      setErrorMessage('Template name is required.');
      return null;
    }

    if (!formValues.htmlContent.trim()) {
      setErrorMessage('HTML content cannot be empty.');
      return null;
    }

    const preparedVariables: TemplateVariable[] = [];

    for (const variable of variables) {
      if (!variable.key.trim()) {
        continue;
      }

      const entry: TemplateVariable = {
        key: variable.key.trim(),
      };

      if (variable.description.trim()) {
        entry.description = variable.description.trim();
      }

      if (variable.sampleValue.trim()) {
        const raw = variable.sampleValue.trim();

        try {
          entry.sampleValue = JSON.parse(raw);
        } catch {
          entry.sampleValue = raw;
        }
      }

      preparedVariables.push(entry);
    }

    if (!preparedVariables.length) {
      preparedVariables.push({ key: 'firstName', description: 'Recipient first name', sampleValue: 'Taylor' });
    }

    let htmlContent = formValues.htmlContent;

    if (editingMode === 'visual') {
      const htmlFromBlocks = renderBlocksToHtml(blocks);
      htmlContent = injectBlockMetadata(htmlFromBlocks, blocks);
    }

    return {
      name: formValues.name.trim(),
      type: formValues.type,
      htmlContent,
      cssContent: formValues.cssContent.trim() || undefined,
      variables: preparedVariables,
      isDefault: formValues.isDefault,
      isActive: formValues.isActive,
    };
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const payload = buildPayload();
    if (!payload) {
      return;
    }

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{dialogTitle}</h2>
            <p className="text-sm text-muted-foreground">
              Define the HTML, CSS and merge variables for this template. Use Handlebars syntax such as
              {' {{firstName}} '} in your markup.
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="Invoice Payment Reminder"
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Template Type</label>
                <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                  {TEMPLATE_TYPE_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition ${
                        formValues.type === option.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-transparent hover:border-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="template-type"
                        value={option.value}
                        checked={formValues.type === option.value}
                        onChange={() => setFormValues((prev) => ({ ...prev, type: option.value }))}
                        className="mt-1 h-4 w-4 border-border text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">CSS Styles (optional)</label>
                <textarea
                  value={formValues.cssContent}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, cssContent: event.target.value }))
                  }
                  rows={8}
                  className="w-full rounded-lg border border-border px-3 py-2 font-mono text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`body {\n  background: #ffffff;\n  color: #111827;\n}`}
                />
                <p className="text-xs text-muted-foreground">
                  These styles are injected into the &lt;head&gt; of the rendered template.
                </p>
              </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Variables</span>
                    <button
                      type="button"
                      onClick={() => setVariables((prev) => [...prev, newVariable()])}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Plus className="h-4 w-4" />
                      Add Variable
                    </button>
                  </div>

                  <div className="space-y-3">
                  {variables.map((variable, index) => (
                    <div
                      key={variable.id}
                      className="rounded-lg border border-border bg-muted/80 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          Variable {index + 1}
                        </span>
                        {variables.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVariable(variable.id)}
                            className="rounded-lg p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground/80 hover:text-muted-foreground"
                            aria-label="Remove variable"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                        <div className="mt-2 space-y-2">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Key</label>
                          <input
                            type="text"
                            value={variable.key}
                            onChange={(event) =>
                              handleVariableChange(variable.id, 'key', event.target.value)
                            }
                            placeholder="firstName"
                            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Refer to this variable as {'{{'} {variable.key || 'key'} {'}}'} in the HTML.
                          </p>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Description</label>
                          <input
                            type="text"
                            value={variable.description}
                            onChange={(event) =>
                              handleVariableChange(variable.id, 'description', event.target.value)
                            }
                            placeholder="Recipient first name"
                            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground">
                            Sample Value (string or JSON)
                          </label>
                          <textarea
                            value={variable.sampleValue}
                            onChange={(event) =>
                              handleVariableChange(variable.id, 'sampleValue', event.target.value)
                            }
                            rows={3}
                            placeholder='"Taylor" or {"amount": 299}'
                            className="mt-1 w-full rounded-lg border border-border px-3 py-1.5 font-mono text-xs focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-border bg-card p-4">
                <label className="text-sm font-medium text-muted-foreground">Visibility</label>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formValues.isActive}
                      onChange={(event) =>
                        setFormValues((prev) => ({ ...prev, isActive: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                    />
                    <span>Template is active and available for use.</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formValues.isDefault}
                      onChange={(event) =>
                        setFormValues((prev) => ({ ...prev, isDefault: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                    />
                    <span>Mark as the default template for this type.</span>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Only one template per type can be default. Saving will automatically mark other templates as non-default.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-muted-foreground">Template Content</label>
                  <div className="inline-flex items-center rounded-lg border border-border bg-muted/60 p-1">
                    <button
                      type="button"
                      onClick={() => setEditingMode('visual')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        editingMode === 'visual'
                          ? 'bg-white text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Visual Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingMode('html')}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                        editingMode === 'html'
                          ? 'bg-white text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      HTML
                    </button>
                  </div>
                </div>

                {editingMode === 'visual' ? (
                  <div className="space-y-4 rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">
                      Assemble your email using pre-built content blocks. Switching back to the raw HTML editor is always possible.
                    </p>
                    <TemplateBlockEditor
                      blocks={blocks}
                      onChange={setBlocks}
                      availableVariables={variables
                        .map((variable) => variable.key.trim())
                        .filter(Boolean)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <textarea
                      value={formValues.htmlContent}
                      onChange={(event) =>
                        setFormValues((prev) => ({ ...prev, htmlContent: event.target.value }))
                      }
                      rows={28}
                      spellCheck={false}
                      className="w-full rounded-lg border border-border px-3 py-2 font-mono text-xs leading-5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={DEFAULT_HTML}
                    />
                    <p className="text-xs text-muted-foreground">
                      Build markup using Handlebars tokens. You can include conditionals like
                      {' {{#if isOverdue}}...{{/if}} '}.
                    </p>
                    {mode === 'edit' && (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            blocks.length === 1 &&
                            blocks[0].type === 'raw_html' &&
                            blocks[0].html === template?.htmlContent
                          ) {
                            setBlocks(getDefaultTemplateBlocks());
                            setEditingMode('visual');
                            return;
                          }

                          const confirmSwitch = window.confirm(
                            'Switching to the visual builder will regenerate the template layout based on blocks and may overwrite custom HTML. Continue?',
                          );

                          if (confirmSwitch) {
                            setBlocks(getDefaultTemplateBlocks());
                            setEditingMode('visual');
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        Use Visual Builder
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'create' ? 'Create Template' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



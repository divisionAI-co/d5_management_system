import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, X } from 'lucide-react';
import { templatesApi } from '@/lib/api/templates';
import type {
  CreateTemplatePayload,
  TemplateModel,
  TemplateType,
  TemplateVariable,
  UpdateTemplatePayload,
} from '@/types/templates';

const TEMPLATE_TYPE_OPTIONS: { label: string; value: TemplateType }[] = [
  { label: 'Invoice', value: 'INVOICE' },
  { label: 'Customer Report', value: 'CUSTOMER_REPORT' },
  { label: 'Performance Review', value: 'PERFORMANCE_REVIEW' },
  { label: 'Email', value: 'EMAIL' },
];

type VariableFormValue = {
  key: string;
  description: string;
  sampleValue: string;
};

type FormValues = {
  name: string;
  type: TemplateType;
  htmlContent: string;
  cssContent: string;
  isDefault: boolean;
  isActive: boolean;
  variables: VariableFormValue[];
};

interface TemplateFormProps {
  template?: TemplateModel | null;
  onClose: () => void;
  onSuccess: (template: TemplateModel) => void;
}

const formatSampleValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
};

const parseSampleValue = (value: string): unknown => {
  if (!value.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

export function TemplateForm({ template, onClose, onSuccess }: TemplateFormProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(template);

  const defaultValues = useMemo<FormValues>(() => {
    if (!template) {
      return {
        name: '',
        type: 'INVOICE',
        htmlContent: '',
        cssContent: '',
        isDefault: false,
        isActive: true,
        variables: [],
      };
    }

    return {
      name: template.name,
      type: template.type,
      htmlContent: template.htmlContent ?? '',
      cssContent: template.cssContent ?? '',
      isDefault: template.isDefault,
      isActive: template.isActive,
      variables: (template.variables ?? []).map((variable) => ({
        key: variable.key,
        description: variable.description ?? '',
        sampleValue: formatSampleValue(variable.sampleValue),
      })),
    };
  }, [template]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'variables',
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const createMutation = useMutation({
    mutationFn: (payload: CreateTemplatePayload) => templatesApi.create(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      onSuccess(data);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateTemplatePayload) => templatesApi.update(template!.id, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      onSuccess(data);
    },
  });

  const onSubmit = (values: FormValues) => {
    const variables: TemplateVariable[] = values.variables
      .map((variable) => ({
        key: variable.key.trim(),
        description: variable.description.trim() ? variable.description.trim() : undefined,
        sampleValue: parseSampleValue(variable.sampleValue),
      }))
      .filter((variable) => variable.key.length > 0);

    const payload: CreateTemplatePayload = {
      name: values.name.trim(),
      type: values.type,
      htmlContent: values.htmlContent,
      cssContent: values.cssContent.trim() ? values.cssContent : undefined,
      variables,
      isDefault: values.isDefault,
      isActive: values.isActive,
    };

    if (isEdit) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const submitError = (createMutation.error || updateMutation.error) as Error | null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {isEdit ? 'Edit Template' : 'Create Template'}
            </h2>
            <p className="text-sm text-muted-foreground">
              Define reusable HTML templates with Handlebars variables and optional CSS styling.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground/70 hover:text-muted-foreground"
            aria-label="Close template form"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto px-6 py-6"
        >
          <div className="grid gap-6 lg:grid-cols-[2fr,1.2fr]">
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Template Name
                  </label>
                  <input
                    type="text"
                    {...register('name', { required: 'Template name is required' })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Invoice - Payment Reminder"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Template Type
                  </label>
                  <select
                    {...register('type', { required: 'Template type is required' })}
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    {TEMPLATE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.type && (
                    <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isDefault"
                    {...register('isDefault')}
                    className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isDefault" className="text-sm text-muted-foreground">
                    Set as default template for this type
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="isActive"
                    {...register('isActive')}
                    className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="isActive" className="text-sm text-muted-foreground">
                    Template is active and available for use
                  </label>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  HTML Content
                </label>
                <textarea
                  {...register('htmlContent', { required: 'HTML content is required' })}
                  rows={16}
                  className="w-full rounded-lg border border-border px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="<div>Hello {{firstName}}</div>"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Use Handlebars syntax (e.g. &#123;&#123;firstName&#125;&#125;) to insert variables.
                </p>
                {errors.htmlContent && (
                  <p className="mt-1 text-xs text-red-600">{errors.htmlContent.message}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  CSS (Optional)
                </label>
                <textarea
                  {...register('cssContent')}
                  rows={8}
                  className="w-full rounded-lg border border-border px-3 py-2 font-mono text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="h1 { color: #1f2937; }"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Styles are injected into the template inside a &lt;style&gt; tag.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Template Variables</h3>
                    <p className="text-xs text-muted-foreground">
                      Define variables available to this template along with optional descriptions
                      and sample values for previews.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      append({
                        key: '',
                        description: '',
                        sampleValue: '',
                      })
                    }
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add Variable
                  </button>
                </div>

                {fields.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                    No variables defined. Add at least one variable or leave empty if the template
                    uses static content.
                  </div>
                )}

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase text-muted-foreground">
                          Variable #{index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                            Key
                          </label>
                          <input
                            type="text"
                            {...register(`variables.${index}.key` as const)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            placeholder="customerName"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                            Description
                          </label>
                          <input
                            type="text"
                            {...register(`variables.${index}.description` as const)}
                            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            placeholder="Full name of the customer"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                            Sample Value (used for preview)
                          </label>
                          <textarea
                            {...register(`variables.${index}.sampleValue` as const)}
                            rows={3}
                            className="w-full rounded-lg border border-border px-3 py-2 font-mono text-xs focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            placeholder='Text or JSON, e.g. "Acme Corp" or {"total": 45.5}'
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {submitError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {submitError.message || 'Failed to save template. Please try again.'}
                </div>
              )}

              <div className="mt-auto flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : isEdit ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}



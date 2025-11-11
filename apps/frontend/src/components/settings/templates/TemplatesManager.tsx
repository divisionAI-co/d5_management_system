import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Loader2, Plus, RefreshCcw, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';

import { templatesApi } from '@/lib/api/templates';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { CreateTemplatePayload, TemplateFilters, TemplateModel, TemplateType } from '@/types/templates';
import { TemplateFormModal } from './TemplateFormModal';
import { TemplatePreviewModal } from './TemplatePreviewModal';

const TEMPLATE_TYPE_LABEL: Record<TemplateType, string> = {
  EMAIL: 'Email',
  INVOICE: 'Invoice',
  CUSTOMER_REPORT: 'Customer Report',
  PERFORMANCE_REVIEW: 'Performance Review',
};

const FILTER_TYPE_OPTIONS: Array<{ label: string; value?: TemplateType }> = [
  { label: 'All Types', value: undefined },
  { label: 'Email', value: 'EMAIL' },
  { label: 'Invoice', value: 'INVOICE' },
  { label: 'Customer Report', value: 'CUSTOMER_REPORT' },
  { label: 'Performance Review', value: 'PERFORMANCE_REVIEW' },
];

export function TemplatesManager() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<TemplateFilters>({ search: '', type: undefined, onlyActive: true });
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateModel | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [previewTemplate, setPreviewTemplate] = useState<TemplateModel | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sanitizedFilters = useMemo(() => {
    const payload: TemplateFilters = {};

    if (filters.type) {
      payload.type = filters.type;
    }
    if (filters.onlyActive) {
      payload.onlyActive = true;
    }
    if (filters.search?.trim()) {
      payload.search = filters.search.trim();
    }

    return payload;
  }, [filters]);

  const templatesQuery = useQuery({
    queryKey: ['templates', sanitizedFilters],
    queryFn: () => templatesApi.list(sanitizedFilters),
  });

  const createMutation = useMutation({
    mutationFn: (payload: CreateTemplatePayload) => templatesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setFeedbackMessage('Template created successfully.');
      setShowForm(false);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Unable to create template right now.';
      setErrorMessage(message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<CreateTemplatePayload> }) =>
      templatesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setFeedbackMessage('Template updated successfully.');
      setShowForm(false);
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message ?? 'Unable to update template at this time.';
      setErrorMessage(message);
    },
  });

  const openCreate = () => {
    setSelectedTemplate(null);
    setFormMode('create');
    setShowForm(true);
    setErrorMessage(null);
    setFeedbackMessage(null);
  };

  const openEdit = (template: TemplateModel) => {
    setSelectedTemplate(template);
    setFormMode('edit');
    setShowForm(true);
    setErrorMessage(null);
    setFeedbackMessage(null);
  };

  const handleSubmit = (payload: CreateTemplatePayload) => {
    if (formMode === 'create') {
      createMutation.mutate(payload);
    } else if (formMode === 'edit' && selectedTemplate) {
      updateMutation.mutate({ id: selectedTemplate.id, payload });
    }
  };

  const renderAccessWarning = () => (
    <div className="mx-auto max-w-3xl space-y-6 rounded-lg bg-card p-8 shadow-sm">
      <div className="flex items-center gap-3 text-amber-600">
        <ShieldAlert className="h-8 w-8" />
        <div>
          <h1 className="text-xl font-semibold">Restricted Access</h1>
          <p className="text-sm text-amber-700">
            Only administrators can manage email and document templates.
          </p>
        </div>
      </div>
    </div>
  );

  if (user?.role !== 'ADMIN') {
    return renderAccessWarning();
  }

  const templates = templatesQuery.data ?? [];

  return (
    <div className="container mx-auto space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-10 w-10 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Templates</h1>
            <p className="text-sm text-muted-foreground">
              Manage reusable HTML templates for invoices, customer reports, performance reviews and emails.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => templatesQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Template
          </button>
        </div>
      </div>

      {feedbackMessage && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedbackMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="flex w-full flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filters.search ?? ''}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
              placeholder="Search templates by name"
              className="w-full rounded-lg border border-border pl-10 pr-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filters.type ?? ''}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                type: (event.target.value || undefined) as TemplateType | undefined,
              }))
            }
            className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 md:w-48"
          >
            {FILTER_TYPE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value ?? ''}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={filters.onlyActive ?? false}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, onlyActive: event.target.checked || undefined }))
              }
              className="h-4 w-4 rounded border-border text-blue-600 focus:ring-blue-500"
            />
            Show only active
          </label>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Template</th>
                <th className="px-6 py-3 text-left font-semibold">Type</th>
                <th className="px-6 py-3 text-left font-semibold">Variables</th>
                <th className="px-6 py-3 text-left font-semibold">Default</th>
                <th className="px-6 py-3 text-left font-semibold">Status</th>
                <th className="px-6 py-3 text-left font-semibold">Updated</th>
                <th className="px-6 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-muted-foreground">
              {templatesQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span>Loading templates...</span>
                    </div>
                  </td>
                </tr>
              ) : templates.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm">
                        No templates found. Adjust your filters or create a new template.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id} className="transition hover:bg-muted">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">{template.name}</div>
                      <div className="text-xs text-muted-foreground">ID: {template.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase text-blue-600">
                        {TEMPLATE_TYPE_LABEL[template.type]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {template.variables?.length ?? 0} variables
                    </td>
                    <td className="px-6 py-4">
                      {template.isDefault ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Default
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-muted/70 px-3 py-1 text-xs font-semibold text-muted-foreground">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {template.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(template.updatedAt), 'MMM dd, yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewTemplate(template)}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground/70"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(template)}
                          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TemplateFormModal
        open={showForm}
        mode={formMode}
        template={formMode === 'edit' ? selectedTemplate ?? undefined : undefined}
        submitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => setShowForm(false)}
        onSubmit={handleSubmit}
      />

      <TemplatePreviewModal open={Boolean(previewTemplate)} template={previewTemplate} onClose={() => setPreviewTemplate(null)} />
    </div>
  );
}



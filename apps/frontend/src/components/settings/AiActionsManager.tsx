import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';

import { aiActionsApi } from '@/lib/api/ai-actions';
import type {
  AiActionCollectionSummary,
  AiActionPayload,
  AiActionSummary,
  AiActionUpdatePayload,
  AiCollectionDefinition,
  AiCollectionFieldDefinition,
  AiCollectionFormat,
  AiCollectionKey,
  AiEntityType,
  AiFieldDefinition,
} from '@/types/ai-actions';
import { cn } from '@/lib/utils';

type FormMode = 'create' | 'edit';

interface SelectedField {
  key: string;
  label: string;
  description?: string;
}

interface CollectionModalState {
  mode: 'create' | 'edit';
  index?: number;
}

interface FormState {
  id?: string;
  name: string;
  description: string;
  entityType: AiEntityType | '';
  promptTemplate: string;
  model: string;
  isActive: boolean;
  selectedFields: SelectedField[];
  collections: AiActionCollectionSummary[];
}

const DEFAULT_FORM: FormState = {
  name: '',
  description: '',
  entityType: '',
  promptTemplate: '',
  model: '',
  isActive: true,
  selectedFields: [],
  collections: [],
};

const ENTITY_OPTIONS: Array<{ label: string; value: AiEntityType }> = [
  { label: 'Candidate', value: 'CANDIDATE' },
  { label: 'Opportunity', value: 'OPPORTUNITY' },
  { label: 'Customer', value: 'CUSTOMER' },
  { label: 'Lead', value: 'LEAD' },
  { label: 'Employee', value: 'EMPLOYEE' },
  { label: 'Contact', value: 'CONTACT' },
  { label: 'Task', value: 'TASK' },
];

export function AiActionsManager() {
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [formState, setFormState] = useState<FormState>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [collectionModal, setCollectionModal] = useState<CollectionModalState | null>(null);

  const actionsQuery = useQuery({
    queryKey: ['ai-actions', 'admin'],
    queryFn: () => aiActionsApi.list({ includeInactive: true }),
  });

  const availableFieldsQuery = useQuery({
    queryKey: ['ai-actions', 'fields', formState.entityType],
    queryFn: () => aiActionsApi.listFields(formState.entityType as AiEntityType),
    enabled: showForm && Boolean(formState.entityType),
  });

  const collectionDefinitionsQuery = useQuery({
    queryKey: ['ai-actions', 'collection-definitions', formState.entityType],
    queryFn: () => aiActionsApi.listCollectionDefinitions(formState.entityType as AiEntityType),
    enabled: showForm && Boolean(formState.entityType),
  });

  const createMutation = useMutation({
    mutationFn: (payload: AiActionPayload) => aiActionsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-actions', 'admin'] });
      setFeedback('Gemini action created successfully.');
      closeForm();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Unable to create Gemini action.';
      setError(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AiActionUpdatePayload }) =>
      aiActionsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-actions', 'admin'] });
      setFeedback('Gemini action updated.');
      closeForm();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Unable to update Gemini action.';
      setError(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => aiActionsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-actions', 'admin'] });
      setFeedback('Gemini action deleted.');
    },
    onError: () => {
      setError('Unable to delete Gemini action.');
    },
  });

  const actions = useMemo(() => actionsQuery.data ?? [], [actionsQuery.data]);

  useEffect(() => {
    if (!showForm) {
      setFormState(DEFAULT_FORM);
      setError(null);
    }
  }, [showForm]);

  useEffect(() => {
    if (!showForm || !availableFieldsQuery.data) return;

    // Ensure selected fields still exist for the current entity type.
    setFormState((prev) => {
      const validSelections = prev.selectedFields.filter((field) =>
        availableFieldsQuery.data?.some((definition) => definition.key === field.key),
      );

      // Auto-select initial fields if nothing selected.
      if (validSelections.length === 0) {
        const defaults = availableFieldsQuery.data.slice(0, 3).map((field) => ({
          key: field.key,
          label: field.label,
          description: field.description,
        }));
        return {
          ...prev,
          selectedFields: defaults,
        };
      }

      // Preserve existing order.
      return {
        ...prev,
        selectedFields: validSelections.map((field) => ({
          key: field.key,
          label: field.label,
          description: field.description,
        })),
      };
    });
  }, [availableFieldsQuery.data, showForm]);

  const openCreateForm = () => {
    setFormMode('create');
    setFormState(DEFAULT_FORM);
    setShowForm(true);
    setError(null);
    setCollectionModal(null);
  };

  const openEditForm = (action: AiActionSummary) => {
    setFormMode('edit');
    setFormState({
      id: action.id,
      name: action.name,
      description: action.description ?? '',
      entityType: action.entityType,
      promptTemplate: action.promptTemplate,
      model: action.model ?? '',
      isActive: action.isActive,
      selectedFields: action.fields.map((field) => ({
        key: field.fieldKey,
        label: field.fieldLabel,
        description:
          typeof field.metadata === 'object' && field.metadata !== null && 'description' in field.metadata
            ? String((field.metadata as Record<string, unknown>).description ?? '')
            : undefined,
      })),
      collections:
        action.collections?.map((collection) => ({
          id: collection.id,
          collectionKey: collection.collectionKey,
          label: collection.label,
          description: collection.description ?? null,
          format: collection.format,
          limit: collection.limit ?? undefined,
          order: collection.order,
          metadata: collection.metadata ?? null,
          fields:
            collection.fields?.map((field) => ({
              id: field.id,
              fieldKey: field.fieldKey,
              fieldLabel: field.fieldLabel,
              order: field.order ?? 0,
              metadata: field.metadata ?? undefined,
            })) ?? [],
        })) ?? [],
    });
    setShowForm(true);
    setError(null);
    setCollectionModal(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setCollectionModal(null);
  };

  const availableFields = (availableFieldsQuery.data ?? []) as AiFieldDefinition[];
  const selectedFieldKeys = new Set(formState.selectedFields.map((field) => field.key));
  const remainingFields = availableFields.filter((field) => !selectedFieldKeys.has(field.key));
  const availableCollections = (collectionDefinitionsQuery.data ?? []) as AiCollectionDefinition[];

  const handleCollectionSave = (collection: AiActionCollectionSummary) => {
    setFormState((prev) => {
      if (!collectionModal) {
        return prev;
      }

      if (collectionModal.mode === 'edit' && collectionModal.index !== undefined) {
        const updated = [...prev.collections];
        updated[collectionModal.index] = {
          ...collection,
          order: collectionModal.index,
        };
        return {
          ...prev,
          collections: updated,
        };
      }

      return {
        ...prev,
        collections: [
          ...prev.collections,
          {
            ...collection,
            order: prev.collections.length,
          },
        ],
      };
    });
    setCollectionModal(null);
  };

  const handleRemoveCollection = (index: number) => {
    setFormState((prev) => {
      const next = prev.collections.filter((_, idx) => idx !== index).map((collection, idx) => ({
        ...collection,
        order: idx,
      }));
      return {
        ...prev,
        collections: next,
      };
    });
  };

  const openCollectionModalState = (mode: CollectionModalState['mode'], index?: number) => {
    setCollectionModal({ mode, index });
  };

  const addField = (field: AiFieldDefinition) => {
    setFormState((prev) => ({
      ...prev,
      selectedFields: [
        ...prev.selectedFields,
        {
          key: field.key,
          label: field.label,
          description: field.description,
        },
      ],
    }));
  };

  const removeField = (fieldKey: string) => {
    setFormState((prev) => ({
      ...prev,
      selectedFields: prev.selectedFields.filter((field) => field.key !== fieldKey),
    }));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    setFormState((prev) => {
      const nextFields = [...prev.selectedFields];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= nextFields.length) {
        return prev;
      }
      const temp = nextFields[index];
      nextFields[index] = nextFields[targetIndex];
      nextFields[targetIndex] = temp;
      return { ...prev, selectedFields: nextFields };
    });
  };

  const toggleActive = (action: AiActionSummary) => {
    updateMutation.mutate({
      id: action.id,
      payload: { isActive: !action.isActive },
    });
  };

  const handleDelete = (action: AiActionSummary) => {
    if (action.isSystem) {
      setError('System actions cannot be deleted.');
      return;
    }
    if (window.confirm(`Delete Gemini action "${action.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(action.id);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!formState.name.trim()) {
      setError('Name is required.');
      return;
    }

    if (!formState.entityType) {
      setError('Select an entity type.');
      return;
    }

    if (!formState.promptTemplate.trim()) {
      setError('Prompt template is required.');
      return;
    }

    if (formState.selectedFields.length === 0) {
      setError('Select at least one field to include in the prompt.');
      return;
    }

    const payload: AiActionPayload = {
      name: formState.name.trim(),
      description: formState.description.trim() || undefined,
      entityType: formState.entityType,
      promptTemplate: formState.promptTemplate,
      model: formState.model.trim() || undefined,
      isActive: formState.isActive,
      fields: formState.selectedFields.map((field, index) => ({
        fieldKey: field.key,
        fieldLabel: field.label,
        metadata: field.description ? { description: field.description } : undefined,
        order: index,
      })),
    collections:
      formState.collections.length > 0
        ? formState.collections.map((collection) => ({
            collectionKey: collection.collectionKey,
            format: collection.format,
            limit: collection.limit,
            metadata: collection.metadata ?? undefined,
            fields: collection.fields.map((field, fieldIndex) => ({
              fieldKey: field.fieldKey,
              fieldLabel: field.fieldLabel,
              metadata: field.metadata ?? undefined,
              order: field.order ?? fieldIndex,
            })),
          }))
        : undefined,
    };

    if (formMode === 'create') {
      createMutation.mutate(payload);
    } else if (formMode === 'edit' && formState.id) {
      updateMutation.mutate({ id: formState.id, payload });
    }
  };

  return (
    <>
      <div className="space-y-6 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Sparkles className="h-10 w-10 text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gemini Actions</h1>
            <p className="text-sm text-muted-foreground">
              Manage reusable prompts that teammates can run directly from candidate, opportunity, and other entity
              records.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => actionsQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New action
          </button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {feedback}{' '}
          <button className="text-xs font-semibold uppercase" onClick={() => setFeedback(null)}>
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Action</th>
              <th className="px-4 py-3 text-left font-semibold">Entity</th>
              <th className="px-4 py-3 text-left font-semibold">Fields</th>
              <th className="px-4 py-3 text-left font-semibold">Collections</th>
              <th className="px-4 py-3 text-left font-semibold">Model</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {actionsQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
                  Loading Gemini actions…
                </td>
              </tr>
            ) : actions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                  No Gemini actions yet. Create your first template to help teammates run AI workflows faster.
                </td>
              </tr>
            ) : (
              actions.map((action) => (
                <tr key={action.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-foreground">{action.name}</div>
                    {action.description && (
                      <div className="mt-1 text-xs text-muted-foreground">{action.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs font-medium uppercase text-muted-foreground">{action.entityType}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{action.fields.length}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{action.collections.length}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{action.model ?? 'Default'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(action)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-semibold transition',
                        action.isActive
                          ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                          : 'bg-amber-100 text-amber-700 hover:bg-amber-200',
                      )}
                    >
                      <Check className="h-3 w-3" />
                      {action.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(action)}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(action)}
                        className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <h3 className="text-lg font-semibold text-foreground">
                  {formMode === 'create' ? 'Create Gemini Action' : 'Edit Gemini Action'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-6 px-6 py-6 md:grid-cols-[1.5fr_1fr]">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Action name
                  </label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Example: Candidate summary"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formState.description}
                    onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional context for teammates"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Entity type
                    </label>
                    <select
                      value={formState.entityType}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          entityType: event.target.value as AiEntityType,
                          selectedFields: [],
                          collections: [],
                        }))
                      }
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select entity</option>
                      {ENTITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                      Model override
                    </label>
                    <input
                      type="text"
                      value={formState.model}
                      onChange={(event) => setFormState((prev) => ({ ...prev, model: event.target.value }))}
                      className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      placeholder="gemini-1.5-flash-latest (optional)"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Prompt template
                  </label>
                  <textarea
                    rows={10}
                    value={formState.promptTemplate}
                    onChange={(event) => setFormState((prev) => ({ ...prev, promptTemplate: event.target.value }))}
                    className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Use {{fieldKey}} placeholders to inject field values."
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Included fields ({formState.selectedFields.length})
                  </label>
                  <div className="space-y-2 rounded-lg border border-border bg-background/70 p-3">
                    {formState.selectedFields.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Select fields from the list below to send context to Gemini.
                      </p>
                    ) : (
                      formState.selectedFields.map((field, index) => (
                        <div
                        key={field.key}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                        >
                          <div>
                            <p className="font-medium">
                              {field.label}{' '}
                              <span className="text-xs font-normal text-muted-foreground">({field.key})</span>
                            </p>
                            <p className="text-xs text-muted-foreground">{field.description}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => moveField(index, 'up')}
                              className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              aria-label="Move field up"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moveField(index, 'down')}
                              className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                              aria-label="Move field down"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeField(field.key)}
                              className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-red-500"
                              aria-label="Remove field"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Available fields
                  </label>
                  <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-border bg-background/70 p-3 text-sm">
                    {availableFieldsQuery.isLoading ? (
                      <div className="flex items-center justify-center text-xs text-muted-foreground">
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Loading fields…
                      </div>
                    ) : remainingFields.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        All fields are already selected for this action.
                      </p>
                    ) : (
                      remainingFields.map((field) => (
                        <button
                        key={field.key}
                          type="button"
                          onClick={() => addField(field)}
                          className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-left text-sm transition hover:border-blue-500 hover:text-blue-600"
                        >
                          <span>
                            {field.label}{' '}
                            <span className="text-xs font-semibold text-muted-foreground">({field.key})</span>
                            {field.description && (
                              <span className="block text-xs text-muted-foreground">{field.description}</span>
                            )}
                          </span>
                          <Sparkles className="h-4 w-4 text-blue-500" />
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase text-muted-foreground">
                    <span>Related collections ({formState.collections.length})</span>
                    <button
                      type="button"
                      onClick={() => openCollectionModalState('create')}
                      disabled={
                        !formState.entityType ||
                        collectionDefinitionsQuery.isLoading ||
                        (collectionDefinitionsQuery.data?.length ?? 0) === 0
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                  </div>
                  <div className="space-y-2 rounded-lg border border-border bg-background/70 p-3 text-sm">
                    {!formState.entityType ? (
                      <p className="text-xs text-muted-foreground">
                        Select an entity to view available collections such as EOD reports or opportunities.
                      </p>
                    ) : collectionDefinitionsQuery.isLoading ? (
                      <div className="flex items-center justify-center text-xs text-muted-foreground">
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        Loading collections…
                      </div>
                    ) : collectionDefinitionsQuery.isError ? (
                      <p className="text-xs text-red-600">
                        Could not load available collections. Try refreshing the page.
                      </p>
                    ) : formState.collections.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No collections added yet. Use the button above to include multi-row context like EOD reports or
                        opportunities.
                      </p>
                    ) : (
                      formState.collections.map((collection, index) => (
                        <div
                          key={`${collection.collectionKey}-${index}`}
                          className="rounded-lg border border-border bg-muted/30 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-foreground">
                                {collection.label}{' '}
                                <span className="text-xs font-normal text-muted-foreground">
                                  ({collection.collectionKey})
                                </span>
                              </p>
                              {collection.description && (
                                <p className="text-xs text-muted-foreground">{collection.description}</p>
                              )}
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="rounded-full bg-muted px-2 py-0.5 uppercase">
                                  {collection.format.toLowerCase().replace('_', ' ')}
                                </span>
                                <span className="rounded-full bg-muted px-2 py-0.5">
                                  Limit: {collection.limit ?? 'Default'}
                                </span>
                                <span className="rounded-full bg-muted px-2 py-0.5">
                                  Fields:{' '}
                                  {collection.fields.map((field) => field.fieldLabel).join(', ') || 'None selected'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openCollectionModalState('edit', index)}
                                className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                aria-label="Edit collection"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveCollection(index)}
                                className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-red-500"
                                aria-label="Remove collection"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 text-[11px] text-muted-foreground">
                            Use{' '}
                            <code className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">
                              {`{{${collection.collectionKey}}}`}
                            </code>{' '}
                            in your prompt. If omitted, the collection will be appended at the end of the prompt.
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={formState.isActive}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        isActive: event.target.checked,
                      }))
                    }
                  />
                  Action is active
                </label>

                <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <Wand2 className="mt-0.5 h-4 w-4 text-blue-500" />
                    <p>
                      Use{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">{'{{placeholder}}'}</code>{' '}
                      for single fields and{' '}
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">{'{{COLLECTION_KEY}}'}</code>{' '}
                      for related collections. Gemini responses are automatically added to the activity timeline.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="md:col-span-2">
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                </div>
              )}

              <div className="md:col-span-2 flex items-center justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {formMode === 'create' ? 'Create action' : 'Save changes'}
                </button>
              </div>
            </form>

            {availableFieldsQuery.isError && (
              <div className="border-t border-border bg-red-50 px-6 py-3 text-xs text-red-600">
                Could not load entity fields. Ensure the selected entity has field mappings configured.
              </div>
            )}
          </div>
        </div>
      )}
    </div>

      {collectionModal && formState.entityType && (
        <CollectionEditorModal
          entityType={formState.entityType as AiEntityType}
          definitions={availableCollections}
          initialValue={
            collectionModal.mode === 'edit' && collectionModal.index !== undefined
              ? formState.collections[collectionModal.index]
              : undefined
          }
          onClose={() => setCollectionModal(null)}
          onSubmit={handleCollectionSave}
        />
      )}
    </>
  );
}


interface CollectionEditorModalProps {
  entityType: AiEntityType;
  definitions: AiCollectionDefinition[];
  initialValue?: AiActionCollectionSummary;
  onClose: () => void;
  onSubmit: (collection: AiActionCollectionSummary) => void;
}

function CollectionEditorModal({
  entityType,
  definitions,
  initialValue,
  onClose,
  onSubmit,
}: CollectionEditorModalProps) {
  const hasDefinitions = definitions.length > 0;
  const defaultDefinition = hasDefinitions
    ? definitions.find((definition) => definition.collectionKey === initialValue?.collectionKey) ?? definitions[0]
    : undefined;

  const [selectedKey, setSelectedKey] = useState<AiCollectionKey | undefined>(defaultDefinition?.collectionKey);
  const [format, setFormat] = useState<AiCollectionFormat>(
    initialValue?.format ?? defaultDefinition?.defaultFormat ?? 'TABLE',
  );
  const [limit, setLimit] = useState<number | undefined>(initialValue?.limit ?? defaultDefinition?.defaultLimit);
  const [selectedFieldKeys, setSelectedFieldKeys] = useState<string[]>(
    initialValue?.fields.map((field) => field.fieldKey) ?? [],
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const fieldsQuery = useQuery({
    queryKey: ['ai-actions', 'collection-fields', entityType, selectedKey],
    queryFn: () => aiActionsApi.listCollectionFields(entityType, selectedKey as AiCollectionKey),
    enabled: Boolean(entityType && selectedKey),
  });

  useEffect(() => {
    if (!selectedKey && defaultDefinition) {
      setSelectedKey(defaultDefinition.collectionKey);
      setFormat(defaultDefinition.defaultFormat);
      setLimit(defaultDefinition.defaultLimit);
    }
  }, [defaultDefinition, selectedKey]);

  useEffect(() => {
    if (fieldsQuery.data && fieldsQuery.data.length > 0 && selectedFieldKeys.length === 0) {
      setSelectedFieldKeys(fieldsQuery.data.slice(0, 3).map((field) => field.key));
    }
  }, [fieldsQuery.data, selectedFieldKeys.length]);

  const currentDefinition = useMemo(
    () => definitions.find((definition) => definition.collectionKey === selectedKey),
    [definitions, selectedKey],
  );

  const availableFields = (fieldsQuery.data ?? []) as AiCollectionFieldDefinition[];
  const toggleField = (fieldKey: string) => {
    setSelectedFieldKeys((prev) =>
      prev.includes(fieldKey) ? prev.filter((key) => key !== fieldKey) : [...prev, fieldKey],
    );
  };

  const handleSave = () => {
    setValidationError(null);
    if (!selectedKey || !currentDefinition) {
      setValidationError('Select a collection to include.');
      return;
    }
    if (selectedFieldKeys.length === 0) {
      setValidationError('Select at least one field to send to Gemini.');
      return;
    }

    const selectedFields = selectedFieldKeys.map((fieldKey, index) => {
      const definitionField = availableFields.find((field) => field.key === fieldKey);
      const previousField = initialValue?.fields.find((field) => field.fieldKey === fieldKey);
      return {
        id: previousField?.id,
        fieldKey,
        fieldLabel: definitionField?.label ?? previousField?.fieldLabel ?? fieldKey,
        order: index,
        metadata: previousField?.metadata ?? null,
      };
    });

    onSubmit({
      id: initialValue?.id,
      collectionKey: selectedKey,
      label: currentDefinition.label,
      description: currentDefinition.description ?? null,
      format,
      limit,
      order: initialValue?.order ?? 0,
      metadata: initialValue?.metadata ?? null,
      fields: selectedFields,
    });
  };

  const formatOptions = useMemo(() => {
    if (!currentDefinition) {
      return [];
    }
    const uniqueFormats = new Set(currentDefinition.supportedFormats);
    uniqueFormats.add(currentDefinition.defaultFormat);
    return Array.from(uniqueFormats);
  }, [currentDefinition]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-3xl rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500" />
            <h3 className="text-lg font-semibold text-foreground">
              {initialValue ? 'Edit collection' : 'Add collection'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 px-5 py-5 md:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Collection
              </label>
              <select
                value={selectedKey ?? ''}
                onChange={(event) => {
                  const key = event.target.value as AiCollectionKey;
                  setSelectedKey(key);
                  const definition = definitions.find((item) => item.collectionKey === key);
                  if (definition) {
                    setFormat(definition.defaultFormat);
                    setLimit(definition.defaultLimit);
                  }
                  setSelectedFieldKeys([]);
                }}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              >
                {!hasDefinitions && <option value="">No collections available</option>}
                {definitions.map((definition) => (
                  <option key={definition.collectionKey} value={definition.collectionKey}>
                    {definition.label}
                  </option>
                ))}
              </select>
              {currentDefinition?.description && (
                <p className="mt-1 text-xs text-muted-foreground">{currentDefinition.description}</p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Format
                </label>
                <select
                  value={format}
                  onChange={(event) => setFormat(event.target.value as AiCollectionFormat)}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                >
                  {formatOptions.map((option) => (
                    <option key={option} value={option}>
                      {option.replace('_', ' ').toLowerCase()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Max rows
                </label>
                <input
                  type="number"
                  min={1}
                  value={limit ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setLimit(value === '' ? undefined : Number(value));
                  }}
                  className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder={currentDefinition?.defaultLimit ? String(currentDefinition.defaultLimit) : 'Default'}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Placeholder
              </label>
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Use{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">
                  {selectedKey ? `{{${selectedKey}}}` : '{{PLACEHOLDER}}'}
                </code>{' '}
                inside your prompt to inject this collection. If omitted, the collection will be appended after the
                prompt.
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-xs font-semibold uppercase text-muted-foreground">Fields</label>
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border bg-background/70 p-3 text-sm">
              {fieldsQuery.isLoading ? (
                <div className="flex items-center justify-center text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Loading fields…
                </div>
              ) : availableFields.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No fields available for this collection yet. Try a different collection type.
                </p>
              ) : (
                availableFields.map((field) => (
                  <label
                    key={field.key}
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted/60',
                      selectedFieldKeys.includes(field.key) && 'bg-blue-500/10 text-blue-600 dark:text-blue-200',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedFieldKeys.includes(field.key)}
                      onChange={() => toggleField(field.key)}
                    />
                    <span>
                      <span className="block text-[13px] font-semibold">{field.label}</span>
                      {field.description && (
                        <span className="text-xs text-muted-foreground">{field.description}</span>
                      )}
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        {validationError && (
          <div className="border-t border-border bg-red-50 px-5 py-3 text-xs text-red-600">{validationError}</div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            <Sparkles className="h-4 w-4" />
            Save collection
          </button>
        </div>
      </div>
    </div>
  );
}


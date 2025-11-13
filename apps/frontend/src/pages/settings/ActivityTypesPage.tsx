import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Palette, Pencil, Plus, RefreshCw, Shield, Trash2 } from 'lucide-react';

import { activitiesApi } from '@/lib/api/activities';
import type { ActivityType, ActivityTypePayload, ActivityTypeUpdatePayload } from '@/types/activities';
import { FeedbackToast } from '@/components/ui/feedback-toast';

type FormMode = 'create' | 'edit';

const DEFAULT_FORM: ActivityTypePayload = {
  name: '',
  key: '',
  description: '',
  color: '#2563EB',
  icon: '',
  isActive: true,
  order: 0,
};

export default function ActivityTypesPage() {
  const queryClient = useQueryClient();
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [showForm, setShowForm] = useState(false);
  const [selectedType, setSelectedType] = useState<ActivityType | null>(null);
  const [formState, setFormState] = useState<ActivityTypePayload>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activityTypesQuery = useQuery({
    queryKey: ['activity-types', { includeInactive: true }],
    queryFn: () => activitiesApi.listTypes(true),
  });

  const createMutation = useMutation({
    mutationFn: activitiesApi.createType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-types'] });
      setFeedback('Activity type created successfully.');
      closeForm();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Unable to create activity type.';
      setError(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ActivityTypePayload | ActivityTypeUpdatePayload }) =>
      activitiesApi.updateType(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-types'] });
      setFeedback('Activity type updated successfully.');
      closeForm();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Unable to update activity type.';
      setError(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: activitiesApi.deleteType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity-types'] });
      setFeedback('Activity type deleted.');
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? 'Unable to delete activity type.';
      setError(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const types = useMemo(() => activityTypesQuery.data ?? [], [activityTypesQuery.data]);

  const openCreateForm = () => {
    setFormMode('create');
    setSelectedType(null);
    setFormState(DEFAULT_FORM);
    setError(null);
    setShowForm(true);
  };

  const openEditForm = (activityType: ActivityType) => {
    setFormMode('edit');
    setSelectedType(activityType);
    setFormState({
      name: activityType.name,
      key: activityType.key,
      description: activityType.description ?? undefined,
      color: activityType.color ?? undefined,
      icon: activityType.icon ?? undefined,
      isActive: activityType.isActive,
      order: activityType.order,
    });
    setError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setSelectedType(null);
    setFormState(DEFAULT_FORM);
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const payload: ActivityTypePayload = {
      ...formState,
      name: formState.name.trim(),
      key: formState.key.trim().replace(/\s+/g, '_').toUpperCase(),
      description: formState.description?.trim() || undefined,
      icon: formState.icon?.trim() || undefined,
    };

    if (!payload.name) {
      setError('Name is required.');
      return;
    }

    if (!payload.key) {
      setError('Key is required.');
      return;
    }

    if (formMode === 'create') {
      createMutation.mutate(payload);
    } else if (selectedType) {
      updateMutation.mutate({ id: selectedType.id, payload });
    }
  };

  const toggleActive = (activityType: ActivityType) => {
    updateMutation.mutate({
      id: activityType.id,
      payload: { 
        name: activityType.name,
        key: activityType.key,
        isActive: !activityType.isActive 
      } as ActivityTypePayload,
    });
  };

  const handleDelete = (activityType: ActivityType) => {
    if (activityType.isSystem) {
      setError('System activity types cannot be deleted.');
      return;
    }

    if (
      window.confirm(
        `Delete activity type "${activityType.name}"? This cannot be undone if it is not used.`,
      )
    ) {
      deleteMutation.mutate(activityType.id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Activity Types</h1>
          <p className="text-sm text-muted-foreground">
            Configure the categories teammates can use when logging notes, reminders, and updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => activityTypesQuery.refetch()}
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
            New Type
          </button>
        </div>
      </div>

      {feedback && (
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
          tone="success"
        />
      )}

      {error && (
        <FeedbackToast
          message={error}
          onDismiss={() => setError(null)}
          tone="error"
        />
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Name</th>
              <th className="px-4 py-3 text-left font-semibold">Key</th>
              <th className="px-4 py-3 text-left font-semibold">Color</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-left font-semibold">System</th>
              <th className="px-4 py-3 text-left font-semibold">Updated</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {activityTypesQuery.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Loading activity types...
                </td>
              </tr>
            ) : types.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No activity types defined yet.
                </td>
              </tr>
            ) : (
              types.map((activityType) => (
                <tr key={activityType.id} className="bg-card">
                  <td className="px-4 py-3 text-foreground">
                    <div className="font-semibold">{activityType.name}</div>
                    {activityType.description && (
                      <div className="text-xs text-muted-foreground">{activityType.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{activityType.key}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ backgroundColor: activityType.color ?? '#2563EB' }}
                      />
                      <span className="text-xs text-muted-foreground">
                        {activityType.color ?? '#2563EB'}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        activityType.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-muted/70 text-muted-foreground'
                      }`}
                    >
                      {activityType.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {activityType.isSystem ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-600">
                        <Shield className="h-3.5 w-3.5" />
                        System
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(activityType.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(activityType)}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(activityType)}
                        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                      >
                        {activityType.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      {!activityType.isSystem && (
                        <button
                          type="button"
                          onClick={() => handleDelete(activityType)}
                          className="inline-flex items-center gap-2 rounded-md border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/60 px-4 py-8">
          <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {formMode === 'create' ? 'Create Activity Type' : 'Edit Activity Type'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Define how teammates categorize activity records.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                className="rounded-full border border-border p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Name
                </label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Key
                  </label>
                  <input
                    type="text"
                    value={formState.key}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, key: event.target.value }))
                    }
                    className="w-full rounded-lg border border-border px-3 py-2 uppercase focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="FOLLOW_UP"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formState.color ?? '#2563EB'}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, color: event.target.value }))
                      }
                      className="h-10 w-14 rounded border border-border"
                    />
                    <input
                      type="text"
                      value={formState.color ?? '#2563EB'}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, color: event.target.value }))
                      }
                      className="flex-1 rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                  Description
                </label>
                <textarea
                  value={formState.description ?? ''}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, description: event.target.value }))
                  }
                  rows={3}
                  className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  placeholder="Explain how this type should be used."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Icon (optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={formState.icon ?? ''}
                      onChange={(event) =>
                        setFormState((prev) => ({ ...prev, icon: event.target.value }))
                      }
                      className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g. Phone, Mail, Clock"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formState.order ?? 0}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        order: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-border px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={formState.isActive ?? true}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, isActive: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border border-border text-blue-600 focus:ring-blue-500"
                  />
                  Active by default
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}



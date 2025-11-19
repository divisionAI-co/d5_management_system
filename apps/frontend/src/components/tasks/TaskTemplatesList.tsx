import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, Play, Square, Calendar, Users, RefreshCw } from 'lucide-react';
import { tasksApi } from '@/lib/api/tasks';
import type { TaskTemplate, TaskRecurrenceType } from '@/types/tasks';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { useState } from 'react';

const RECURRENCE_LABELS: Record<TaskRecurrenceType, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
  YEARLY: 'Yearly',
};

interface TaskTemplatesListProps {
  onEdit: (template: TaskTemplate) => void;
  onClose?: () => void;
}

export function TaskTemplatesList({ onEdit, onClose }: TaskTemplatesListProps) {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const templatesQuery = useQuery({
    queryKey: ['task-templates'],
    queryFn: () => tasksApi.templates.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.templates.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      setFeedback('Template deleted successfully.');
    },
    onError: (error: any) => {
      setError(
        error?.response?.data?.message ?? 'Failed to delete template. Please try again.'
      );
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      tasksApi.templates.update(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] });
      setFeedback('Template updated successfully.');
    },
    onError: (error: any) => {
      setError(
        error?.response?.data?.message ?? 'Failed to update template. Please try again.'
      );
    },
  });

  const templates = templatesQuery.data ?? [];

  const formatRecurrence = (template: TaskTemplate): string => {
    const type = RECURRENCE_LABELS[template.recurrenceType];
    const interval = template.recurrenceInterval;
    if (interval === 1) {
      return type;
    }
    return `Every ${interval} ${type.toLowerCase()}${interval > 1 ? 's' : ''}`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (templatesQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
        <div className="h-32 animate-pulse rounded-xl border border-border bg-card" />
      </div>
    );
  }

  if (templatesQuery.isError) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-700">
        Failed to load task templates. Please try refreshing.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedback && (
        <FeedbackToast
          message={feedback}
          onDismiss={() => setFeedback(null)}
          tone="info"
        />
      )}

      {error && (
        <FeedbackToast
          message={error}
          onDismiss={() => setError(null)}
          tone="error"
        />
      )}

      {templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
          <p className="font-medium text-muted-foreground">
            No recurring task templates found.
          </p>
          <p className="mt-1">
            Create a template to automatically generate tasks on a schedule.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className={`rounded-xl border p-4 shadow-sm transition ${
                template.isActive
                  ? 'border-border bg-card'
                  : 'border-gray-300 bg-gray-50'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-foreground">
                      {template.title}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        template.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {template.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>

                  {template.description && (
                    <p className="text-sm text-muted-foreground">
                      {template.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatRecurrence(template)}
                    </span>
                    <span>
                      Starts: {formatDate(template.startDate)}
                    </span>
                    {template.endDate && (
                      <span>
                        Ends: {formatDate(template.endDate)}
                      </span>
                    )}
                    {template._count && template._count.generatedTasks > 0 && (
                      <span>
                        {template._count.generatedTasks} task{template._count.generatedTasks !== 1 ? 's' : ''} generated
                      </span>
                    )}
                  </div>

                  {template.defaultAssigneeIds && template.defaultAssigneeIds.length > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{template.defaultAssigneeIds.length} assignee{template.defaultAssigneeIds.length !== 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      toggleActiveMutation.mutate({
                        id: template.id,
                        isActive: !template.isActive,
                      })
                    }
                    disabled={toggleActiveMutation.isPending}
                    className={`rounded-lg p-2 transition ${
                      template.isActive
                        ? 'text-orange-600 hover:bg-orange-50'
                        : 'text-green-600 hover:bg-green-50'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    title={template.isActive ? 'Pause template' : 'Activate template'}
                  >
                    {template.isActive ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => onEdit(template)}
                    className="rounded-lg p-2 text-blue-600 transition hover:bg-blue-50"
                    title="Edit template"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete template "${template.title}"? This will not delete already generated tasks.`
                        )
                      ) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Delete template"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {templates.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {templates.length} template{templates.length !== 1 ? 's' : ''} total
          </p>
          <button
            onClick={() => templatesQuery.refetch()}
            disabled={templatesQuery.isFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${templatesQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}


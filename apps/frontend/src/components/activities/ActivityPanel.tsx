import { useEffect, useMemo, useState } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import {
  CheckCircle,
  Clock,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  PlusCircle,
  Repeat,
  Sparkles,
  XCircle,
} from 'lucide-react';

import { activitiesApi } from '@/lib/api/activities';
import type { Activity } from '@/types/activities';
import { cn } from '@/lib/utils';
import { GeminiActionsSection } from './GeminiActionsSection';
import { FeedbackToast } from '@/components/ui/feedback-toast';
import { MentionInput } from '@/components/shared/MentionInput';
import { highlightMentions } from '@/lib/utils/mention-highlight';

type EntityType =
  | 'customer'
  | 'lead'
  | 'opportunity'
  | 'candidate'
  | 'employee'
  | 'contact'
  | 'task';

const AI_ACTIVITY_KEY = 'AI_ACTION';

function buildFilter(entityType: EntityType, entityId: string) {
  return {
    customerId: entityType === 'customer' ? entityId : undefined,
    leadId: entityType === 'lead' ? entityId : undefined,
    opportunityId: entityType === 'opportunity' ? entityId : undefined,
    candidateId: entityType === 'candidate' ? entityId : undefined,
    employeeId: entityType === 'employee' ? entityId : undefined,
    contactId: entityType === 'contact' ? entityId : undefined,
    taskId: entityType === 'task' ? entityId : undefined,
  };
}

interface ActivityItemProps {
  activity: Activity;
  getTypeStyles: (activity: Activity) => { backgroundColor: string; color: string; borderColor: string };
  completionMutation: UseMutationResult<
    unknown,
    unknown,
    { id: string; isCompleted: boolean },
    unknown
  >;
  pinMutation: UseMutationResult<unknown, unknown, { id: string; isPinned: boolean }, unknown>;
}

function ActivityItem({
  activity,
  getTypeStyles,
  completionMutation,
  pinMutation,
}: ActivityItemProps) {
  const isAiActivity = useMemo(() => {
    const typeKey = activity.activityType?.key?.toUpperCase();
    const typeName = activity.activityType?.name?.toUpperCase();
    const typeLabel = activity.typeLabel?.toUpperCase();
    const metadata = (activity.metadata ?? undefined) as Record<string, unknown> | undefined;
    const hasAiMetadata =
      Boolean(metadata?.aiActionExecutionId) ||
      Boolean(metadata?.aiActionId) ||
      Boolean(metadata?.geminiExecutionId);

    return (
      typeKey === AI_ACTIVITY_KEY ||
      typeName === 'AI ACTION' ||
      typeLabel === 'AI ACTION' ||
      hasAiMetadata === true
    );
  }, [activity]);

  const [isExpanded, setIsExpanded] = useState(() => !isAiActivity);

  useEffect(() => {
    setIsExpanded(isAiActivity ? false : true);
  }, [isAiActivity]);

  const handleToggle = () => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase',
                )}
                style={getTypeStyles(activity)}
              >
                {activity.typeLabel ?? activity.activityType?.name ?? 'Activity'}
              </span>
              {activity.isPinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">
                  <Pin className="h-3.5 w-3.5" />
                  Pinned
                </span>
              )}
              {activity.isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Completed
                </span>
              )}
            </div>

            {isAiActivity && (
              <button
                type="button"
                onClick={handleToggle}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-expanded={isExpanded}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {isExpanded ? 'Hide AI output' : 'View AI output'}
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-foreground">
              {highlightMentions(activity.subject)}
            </h3>
            {isAiActivity && !isExpanded && (
              <span className="text-xs text-muted-foreground">
                {new Date(activity.createdAt).toLocaleString()}
              </span>
            )}
          </div>

        {(!isAiActivity || isExpanded) ? (
          <>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span>
                Logged by {activity.createdBy.firstName} {activity.createdBy.lastName} ·{' '}
                {new Date(activity.createdAt).toLocaleString()}
              </span>
              {activity.activityDate && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Occurs {new Date(activity.activityDate).toLocaleString()}
                </span>
              )}
              {activity.reminderAt && (
                <span className="inline-flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  Reminder {new Date(activity.reminderAt).toLocaleString()}
                </span>
              )}
            </div>

            {activity.body && (
              <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                {highlightMentions(activity.body)}
              </pre>
            )}
          </>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() =>
            completionMutation.mutate({ id: activity.id, isCompleted: !activity.isCompleted })
          }
          className={cn(
            'inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-semibold transition',
            activity.isCompleted
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
          disabled={completionMutation.isPending}
        >
          {activity.isCompleted ? (
            <>
              <XCircle className="h-3.5 w-3.5" />
              Reopen
            </>
          ) : (
            <>
              <CheckCircle className="h-3.5 w-3.5" />
              Complete
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => pinMutation.mutate({ id: activity.id, isPinned: !activity.isPinned })}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
          disabled={pinMutation.isPending}
        >
          {activity.isPinned ? (
            <>
              <PinOff className="h-3.5 w-3.5" />
              Unpin
            </>
          ) : (
            <>
              <Pin className="h-3.5 w-3.5" />
              Pin
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface ActivityPanelProps {
  entityId: string;
  entityType: EntityType;
  title?: string;
  emptyState?: string;
}

interface ActivityComposerState {
  activityTypeId: string;
  subject: string;
  body: string;
  activityDate?: string;
  reminderAt?: string;
}

const DEFAULT_COMPOSER: ActivityComposerState = {
  activityTypeId: '',
  subject: '',
  body: '',
};

export function ActivityPanel({
  entityId,
  entityType,
  title = 'Activities',
  emptyState = 'No activities yet. Log a note or reminder to keep the team aligned.',
}: ActivityPanelProps) {
  const queryClient = useQueryClient();
  const [composerState, setComposerState] = useState<ActivityComposerState>(DEFAULT_COMPOSER);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [showGeminiSection, setShowGeminiSection] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  const activityTypesQuery = useQuery({
    queryKey: ['activity-types', { includeInactive: false }],
    queryFn: () => activitiesApi.listTypes(false),
  });

  const filter = useMemo(() => buildFilter(entityType, entityId), [entityId, entityType]);

  const activitiesQuery = useInfiniteQuery<import('@/types/activities').ActivityListResponse, Error>({
    queryKey: ['activities', entityType, entityId],
    initialPageParam: 1,
    queryFn: ({ pageParam = 1 }) =>
      activitiesApi.list({
        ...filter,
        page: pageParam as number,
        pageSize: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
  });

  const createMutation = useMutation({
    mutationFn: activitiesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', entityType, entityId] });
      setComposerState((prev) => ({
        ...DEFAULT_COMPOSER,
        activityTypeId: prev.activityTypeId,
      }));
      setComposerError(null);
      setActivityError(null);
      setShowComposer(false);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? 'Unable to create activity. Please try again.';
      setComposerError(Array.isArray(message) ? message.join(' ') : String(message));
      setActivityError(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, isPinned }: { id: string; isPinned: boolean }) =>
      activitiesApi.togglePin(id, isPinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', entityType, entityId] });
      setActivityError(null);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? 'Unable to update pin state. Please try again.';
      setActivityError(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const completionMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: string; isCompleted: boolean }) =>
      activitiesApi.toggleComplete(id, isCompleted),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities', entityType, entityId] });
      setActivityError(null);
    },
    onError: (error: any) => {
      const message =
        error?.response?.data?.message ?? 'Unable to update activity status. Please try again.';
      setActivityError(Array.isArray(message) ? message.join(' ') : String(message));
    },
  });

  const availableTypes =
    activityTypesQuery.data?.filter((type) => type.isActive || type.isSystem) ?? [];

  const activities =
    activitiesQuery.data?.pages.flatMap((page: import('@/types/activities').ActivityListResponse) => page.data as Activity[]) ?? [];

  const isLoading =
    activitiesQuery.isLoading ||
    activityTypesQuery.isLoading ||
    createMutation.isPending ||
    pinMutation.isPending ||
    completionMutation.isPending;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setComposerError(null);

    if (!composerState.activityTypeId) {
      setComposerError('Select an activity type before saving.');
      return;
    }

    if (!composerState.subject.trim()) {
      setComposerError('Subject is required.');
      return;
    }

    const targets = Object.entries(filter).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value) acc[key] = value;
      return acc;
    }, {});

    createMutation.mutate({
      activityTypeId: composerState.activityTypeId,
      subject: composerState.subject.trim(),
      body: composerState.body?.trim() || undefined,
      activityDate: composerState.activityDate || undefined,
      reminderAt: composerState.reminderAt || undefined,
      targets,
    });
  };

  const getTypeStyles = (activity: Activity) => {
    const color = activity.typeColor ?? activity.activityType?.color ?? '#2563EB';
    return {
      backgroundColor: `${color}1A`,
      color,
      borderColor: `${color}4D`,
    };
  };

  useEffect(() => {
    if (!composerState.activityTypeId && availableTypes.length > 0) {
      setComposerState((prev) => ({
        ...prev,
        activityTypeId: availableTypes[0].id,
      }));
    }
  }, [availableTypes, composerState.activityTypeId]);

  return (
    <div className="space-y-6">
      {activityError && (
        <FeedbackToast
          message={activityError}
          onDismiss={() => setActivityError(null)}
          tone="error"
        />
      )}

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground">
              Log quick notes, next steps, or reminders to keep teammates informed.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowComposer((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-expanded={showComposer}
              aria-controls="activity-composer"
            >
              {showComposer ? (
                <>
                  <XCircle className="h-4 w-4" />
                  Hide activity form
                </>
              ) : (
                <>
                  <PlusCircle className="h-4 w-4" />
                  Log activity
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => activitiesQuery.refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Repeat className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {showComposer && (
          <form
            id="activity-composer"
            onSubmit={handleSubmit}
            className="mt-6 space-y-4 rounded-lg border border-border bg-background/40 p-4"
          >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Activity Type
              </label>
              <select
                value={composerState.activityTypeId}
                onChange={(event) =>
                  setComposerState((prev) => ({ ...prev, activityTypeId: event.target.value }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select type</option>
                {availableTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Subject
              </label>
              <MentionInput
                value={composerState.subject}
                onChange={(value) =>
                  setComposerState((prev) => ({ ...prev, subject: value }))
                }
                placeholder="e.g. Call recap or next steps. Type @ to mention someone"
                multiline={false}
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
              Details
            </label>
            <MentionInput
              value={composerState.body}
              onChange={(value) =>
                setComposerState((prev) => ({ ...prev, body: value }))
              }
              rows={3}
              placeholder="Add context, notes, or follow-up steps for your teammates. Type @ to mention someone"
              multiline={true}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Activity Date
              </label>
              <input
                type="datetime-local"
                value={composerState.activityDate ?? ''}
                onChange={(event) =>
                  setComposerState((prev) => ({
                    ...prev,
                    activityDate: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-muted-foreground">
                Reminder At
              </label>
              <input
                type="datetime-local"
                value={composerState.reminderAt ?? ''}
                onChange={(event) =>
                  setComposerState((prev) => ({
                    ...prev,
                    reminderAt: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {composerError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {composerError}
            </div>
          )}

          <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setComposerState((prev) => ({
                    ...DEFAULT_COMPOSER,
                    activityTypeId: prev.activityTypeId,
                  }));
                  setComposerError(null);
                }}
                className="rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-4 w-4" />
                    Log Activity
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {showGeminiSection ? (
        <div className="space-y-3">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setShowGeminiSection(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <XCircle className="h-4 w-4" />
              Hide Gemini actions
            </button>
          </div>
          <GeminiActionsSection
            entityId={entityId}
            entityType={entityType}
            onDismiss={() => setShowGeminiSection(false)}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted-foreground">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-foreground">Gemini actions</h3>
              <p className="text-xs text-muted-foreground">
                Attach saved prompts or run ad-hoc Gemini requests to capture AI-generated summaries and next steps.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGeminiSection(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Sparkles className="h-4 w-4" />
              Show Gemini actions
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {activities.length === 0 && !activitiesQuery.isFetching ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
            {emptyState}
          </div>
        ) : (
          activities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              getTypeStyles={getTypeStyles}
              completionMutation={completionMutation}
              pinMutation={pinMutation}
            />
          ))
        )}

        {activitiesQuery.hasNextPage && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => activitiesQuery.fetchNextPage()}
              disabled={activitiesQuery.isFetchingNextPage}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activitiesQuery.isFetchingNextPage ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading…
                </>
              ) : (
                'Load More'
              )}
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center text-xs text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Syncing latest activity…
          </div>
        )}
      </div>
    </div>
  );
}



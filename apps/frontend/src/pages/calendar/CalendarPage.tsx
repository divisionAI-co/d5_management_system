import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  List,
  Plus,
  RefreshCw,
  XCircle,
} from 'lucide-react';

import { googleCalendarApi } from '@/lib/api/google-calendar';
import type { CalendarEvent } from '@/types/google-calendar';
import { useToast } from '@/components/ui/use-toast';
import { GoogleCalendarCreateEventModal } from '@/components/calendar/GoogleCalendarCreateEventModal';

const DEFAULT_RANGE_DAYS = 7;

function resolveDate(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return parseISO(value);
  } catch (error) {
    return null;
  }
}

function formatEventTime(event: CalendarEvent) {
  const startValue = event.start?.dateTime ?? event.start?.date ?? null;
  const endValue = event.end?.dateTime ?? event.end?.date ?? null;

  const startDate = resolveDate(startValue);
  const endDate = resolveDate(endValue);

  if (!startDate) {
    return 'No start time';
  }

  if (!endDate) {
    return format(startDate, 'PPP pp');
  }

  const startFormat = event.start?.date ? 'PPP' : 'PPP pp';
  const endFormat = event.end?.date ? 'PPP' : 'PPP pp';

  return `${format(startDate, startFormat)} → ${format(endDate, endFormat)}`;
}

function getEventDateKey(event: CalendarEvent) {
  const value = event.start?.dateTime ?? event.start?.date ?? null;

  if (!value) {
    return null;
  }

  try {
    return format(parseISO(value), 'yyyy-MM-dd');
  } catch (error) {
    return null;
  }
}

function getEventIdentifier(event: CalendarEvent, fallbackIndex: number) {
  const startValue = event.start?.dateTime ?? event.start?.date ?? `unknown-${fallbackIndex}`;
  return event.id ?? `${startValue}-${event.summary ?? `event-${fallbackIndex}`}`;
}

function buildListRange() {
  const now = new Date();
  const timeMin = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const timeMax = new Date(now.getTime() + DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);

  return {
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    maxResults: 100,
  };
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('calendar');
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [expandedEventIds, setExpandedEventIds] = useState<Record<string, boolean>>({});

  const {
    data: status,
    isLoading: isStatusLoading,
    isFetching: isStatusFetching,
  } = useQuery({
    queryKey: ['google-calendar', 'status'],
    queryFn: googleCalendarApi.getStatus,
    refetchOnWindowFocus: false,
  });

  const eventQueryParams = useMemo(() => {
    if (viewMode === 'calendar') {
      const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

      return {
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        maxResults: 250,
      };
    }

    return buildListRange();
  }, [currentMonth, viewMode]);

  const {
    data: eventsResponse,
    isLoading: isEventsLoading,
    refetch: refetchEvents,
    isFetching: isEventsFetching,
  } = useQuery({
    queryKey: ['google-calendar', 'events', viewMode, eventQueryParams],
    queryFn: () => googleCalendarApi.listEvents(eventQueryParams),
    enabled: status?.connected ?? false,
    refetchOnWindowFocus: false,
  });

  const disconnectMutation = useMutation({
    mutationFn: () => googleCalendarApi.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'status'] });
      queryClient.removeQueries({ queryKey: ['google-calendar', 'events'] });
      toast({
        title: 'Google Calendar disconnected',
        description: 'You can reconnect at any time to view your appointments.',
      });
    },
    onError: () => {
      toast({
        title: 'Could not disconnect',
        description: 'Please try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: googleCalendarApi.createEvent,
    onSuccess: async () => {
      toast({
        title: 'Event created',
        description: 'The event was added to your Google Calendar.',
      });
      setIsCreateModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['google-calendar', 'events'] });
    },
    onError: () => {
      toast({
        title: 'Could not create event',
        description: 'Please review the event details and try again.',
        variant: 'destructive',
      });
    },
  });

  const handleConnect = async () => {
    try {
      const redirectUri = `${window.location.origin}/integrations/google/callback`;
      const {url} = await googleCalendarApi.getAuthUrl({ redirectUri, state: 'google_calendar' }) as unknown as {url: string};
      window.location.href = url;
    } catch (error) {
      toast({
        title: 'Could not start Google sign-in',
        description: 'Please ensure the integration is enabled or try again later.',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['google-calendar', 'status'] }),
      refetchEvents(),
    ]);
  };

  const events = useMemo(() => eventsResponse?.events ?? [], [eventsResponse]);

  const eventMap = useMemo(() => {
    return events.reduce<Record<string, CalendarEvent[]>>((accumulator, event) => {
      const key = getEventDateKey(event);
      if (!key) {
        return accumulator;
      }

      if (!accumulator[key]) {
        accumulator[key] = [];
      }

      accumulator[key].push(event);
      return accumulator;
    }, {});
  }, [events]);

  const calendarCells = useMemo(() => {
    if (viewMode !== 'calendar') {
      return [];
    }

    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });

    const days: Array<{
      date: Date;
      key: string;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: CalendarEvent[];
    }> = [];

    for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
      const key = format(cursor, 'yyyy-MM-dd');
      days.push({
        date: cursor,
        key,
        isCurrentMonth: isSameMonth(cursor, currentMonth),
        isToday: isSameDay(cursor, new Date()),
        events: eventMap[key] ?? [],
      });
    }

    return days;
  }, [currentMonth, eventMap, viewMode]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600/10 text-blue-500 dark:bg-blue-500/10 dark:text-blue-200">
            <CalendarIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">My Calendar</h1>
            <p className="text-sm text-muted-foreground">
              View upcoming Google Calendar events inside the platform.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isStatusLoading || isStatusFetching || isEventsFetching}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition hover:text-blue-600 dark:hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>

          {status?.connected && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300 dark:hover:bg-blue-500/20"
            >
              <Plus className="h-4 w-4" />
              New event
            </button>
          )}

          <div className="inline-flex rounded-lg border border-border bg-card p-1 text-sm text-muted-foreground">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition ${
                viewMode === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <List className="h-4 w-4" />
              List
            </button>
            <button
              type="button"
              onClick={() => {
                setCurrentMonth(startOfMonth(new Date()));
                setViewMode('calendar');
              }}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-1.5 transition ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Calendar
            </button>
          </div>

          {status?.connected ? (
            <button
              type="button"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <LinkIcon className="h-4 w-4" />
              Connect Google Calendar
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Connection status</h2>
          <p className="text-sm text-muted-foreground">
            Google Calendar integration is {status?.connected ? 'active' : 'inactive'}.
          </p>
        </div>
        <div className="space-y-3 px-6 py-5 text-sm text-muted-foreground">
          {isStatusLoading ? (
            <p>Checking calendar connection…</p>
          ) : status?.connected ? (
            <>
              <p>
                Connected as{' '}
                <span className="font-medium text-foreground">{status.externalEmail}</span>
              </p>
              {status.lastSyncedAt && (
                <p>
                  Last synced:{' '}
                  <span className="font-medium text-foreground">
                    {format(new Date(status.lastSyncedAt), 'PPP pp')}
                  </span>
                </p>
              )}
              {status.expiresAt && (
                <p>
                  Access token expires:{' '}
                  <span className="font-medium text-foreground">
                    {format(new Date(status.expiresAt), 'PPP pp')}
                  </span>
                </p>
              )}
            </>
          ) : (
            <p>Connect your Google Calendar to start seeing your events here.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">Schedule</h2>
          <p className="text-sm text-muted-foreground">
            {viewMode === 'list'
              ? `Showing the next ${DEFAULT_RANGE_DAYS} days of events from your primary calendar.`
              : `Monthly view for ${format(currentMonth, 'MMMM yyyy')}.`}
          </p>
        </div>
        <div className="px-6 py-6">
          {!status?.connected ? (
            <p className="text-sm text-muted-foreground">
              Connect Google Calendar to view your events.
            </p>
          ) : isEventsLoading ? (
            <p className="text-sm text-muted-foreground">Loading events…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events found for the selected period.</p>
          ) : viewMode === 'list' ? (
            <div className="space-y-4">
              {events.map((event, index) => {
                const eventKey = getEventIdentifier(event, index);
                const isExpanded = expandedEventIds[eventKey] ?? false;

                return (
                  <div
                    key={eventKey}
                    className="rounded-lg border border-border bg-background px-4 py-4 transition hover:border-blue-500 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-semibold text-foreground">
                          {event.summary ?? 'Untitled event'}
                        </p>
                        <p className="text-sm text-muted-foreground">{formatEventTime(event)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {event.organizer && (
                          <div className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                            Organiser:{' '}
                            <span className="font-medium text-foreground">
                              {event.organizer.displayName ?? event.organizer.email ?? 'Unknown'}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedEventIds((previous) => ({
                              ...previous,
                              [eventKey]: !isExpanded,
                            }))
                          }
                          className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:text-blue-600 dark:hover:text-blue-400"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronDown className="h-4 w-4" />
                              Hide details
                            </>
                          ) : (
                            <>
                              <ChevronRight className="h-4 w-4" />
                              Show details
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                        {event.location && (
                          <p>
                            Location:{' '}
                            <span className="font-medium text-foreground">{event.location}</span>
                          </p>
                        )}
                        {event.hangoutLink && (
                          <p>
                            Meet link:{' '}
                            <a
                              href={event.hangoutLink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline dark:text-blue-300"
                            >
                              Join call
                            </a>
                          </p>
                        )}
                        {event.attendees.length > 0 && (
                          <div>
                            <p className="font-medium text-foreground">Attendees</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {event.attendees.map((attendee, attendeeIndex) => (
                                <span
                                  key={`${eventKey}-attendee-${attendeeIndex}-${attendee.email ?? 'unknown'}`}
                                  className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                                >
                                  {attendee.displayName ?? attendee.email ?? 'Guest'}
                                  {attendee.responseStatus && (
                                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                      {attendee.responseStatus}
                                    </span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {event.description && (
                          <p className="whitespace-pre-line">{event.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCurrentMonth((month) => addMonths(month, -1))}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:text-blue-600 dark:hover:text-blue-400"
                >
                  Previous
                </button>
                <div className="text-sm font-medium text-muted-foreground">
                  {format(currentMonth, 'MMMM yyyy')}
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentMonth((month) => addMonths(month, 1))}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition hover:text-blue-600 dark:hover:text-blue-400"
                >
                  Next
                </button>
              </div>
              <div className="grid grid-cols-7 gap-px rounded-lg border border-border bg-border text-xs sm:text-sm">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div
                    key={day}
                    className="bg-card px-2 py-2 text-center font-semibold text-muted-foreground"
                  >
                    {day}
                  </div>
                ))}
                {calendarCells.map((cell) => (
                  <div
                    key={cell.key}
                    className={`min-h-[110px] bg-background p-2 ${
                      cell.isCurrentMonth ? '' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        cell.isToday ? 'bg-blue-600 text-white' : 'text-muted-foreground'
                      }`}
                    >
                      {format(cell.date, 'd')}
                    </div>
                    <div className="mt-2 space-y-1">
                      {cell.events.slice(0, 3).map((event, eventIndex) => (
                        <a
                          key={`${cell.key}-${getEventIdentifier(event, eventIndex)}`}
                          href={event.htmlLink ?? undefined}
                          target={event.htmlLink ? '_blank' : undefined}
                          rel={event.htmlLink ? 'noreferrer' : undefined}
                          className="block truncate rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20"
                        >
                          {event.summary ?? 'Untitled'}
                        </a>
                      ))}
                      {cell.events.length > 3 && (
                        <span className="block rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                          +{cell.events.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <GoogleCalendarCreateEventModal
        open={isCreateModalOpen}
        onClose={() => {
          if (!createEventMutation.isPending) {
            setIsCreateModalOpen(false);
          }
        }}
        onSubmit={async (payload) => {
          await createEventMutation.mutateAsync(payload);
        }}
        isSubmitting={createEventMutation.isPending}
      />
    </div>
  );
}


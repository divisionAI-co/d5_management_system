export interface CalendarConnectionStatus {
  connected: boolean;
  externalEmail: string | null;
  externalAccountId: string | null;
  expiresAt: string | null;
  scope: string | null;
  lastSyncedAt: string | null;
  connectedAt: string | null;
}

export interface CalendarAttendee {
  email?: string | null;
  displayName?: string | null;
  responseStatus?: string | null;
  optional: boolean;
}

export interface CalendarOrganizer {
  email?: string | null;
  displayName?: string | null;
}

export interface CalendarEventTime {
  date?: string | null;
  dateTime?: string | null;
  timeZone?: string | null;
}

export interface CalendarEvent {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  location?: string | null;
  htmlLink?: string | null;
  hangoutLink?: string | null;
  start: CalendarEventTime | null;
  end: CalendarEventTime | null;
  attendees: CalendarAttendee[];
  organizer: CalendarOrganizer | null;
}

export interface CalendarEventsResponse {
  events: CalendarEvent[];
  timeRange: {
    from: string;
    to: string;
  };
}



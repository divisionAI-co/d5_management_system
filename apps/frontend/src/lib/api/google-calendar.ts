import { apiClient } from './client';
import type {
  CalendarConnectionStatus,
  CalendarEvent,
  CalendarEventsResponse,
} from '@/types/google-calendar';

export interface GetAuthUrlParams {
  redirectUri?: string;
}

export interface ExchangeCodePayload {
  code: string;
  redirectUri?: string;
}

export interface CreateEventPayload {
  summary: string;
  description?: string;
  location?: string;
  start: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    optional?: boolean;
  }>;
}

export interface ListEventsParams {
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

export const googleCalendarApi = {
  async getStatus() {
    const { data } = await apiClient.get<CalendarConnectionStatus>('/calendar/google/status');
    return data;
  },

  async getAuthUrl(params: GetAuthUrlParams = {}) {
    const { data } = await apiClient.get<{ url: string }>('/calendar/google/auth-url', {
      params,
    });
    return data.url;
  },

  async exchangeCode(payload: ExchangeCodePayload) {
    const { data } = await apiClient.post<CalendarConnectionStatus>(
      '/calendar/google/exchange',
      payload,
    );
    return data;
  },

  async listEvents(params: ListEventsParams = {}) {
    const { data } = await apiClient.get<CalendarEventsResponse>('/calendar/google/events', {
      params,
    });
    return data;
  },

  async createEvent(payload: CreateEventPayload) {
    const { data } = await apiClient.post<CalendarEvent>('/calendar/google/events', payload);
    return data;
  },

  async disconnect() {
    const { data } = await apiClient.delete<{ success: boolean }>(
      '/calendar/google/disconnect',
    );
    return data;
  },
};



import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { GoogleOAuthService, type GoogleOAuthConfig } from '../google-oauth.service';
import { CreateGoogleCalendarEventDto } from './dto/create-google-calendar-event.dto';

const INTEGRATION_NAME = 'google_calendar';
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const OAUTH_CONFIG: GoogleOAuthConfig = {
  clientIdEnvKey: 'GOOGLE_CLIENT_ID',
  clientSecretEnvKey: 'GOOGLE_CLIENT_SECRET',
  redirectUriEnvKey: 'GOOGLE_REDIRECT_URI',
  integrationName: INTEGRATION_NAME,
  defaultScopes: DEFAULT_SCOPES,
  errorPrefix: 'Google Calendar',
};

interface ListEventsOptions {
  timeMin?: Date;
  timeMax?: Date;
  maxResults?: number;
}

@Injectable()
export class GoogleCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {}

  async getConnectionStatus(userId: string) {
    return this.googleOAuth.getConnectionStatus(userId, INTEGRATION_NAME);
  }

  async generateAuthUrl(redirectUri?: string, state?: string) {
    await this.assertIntegrationEnabled();
    return this.googleOAuth.generateAuthUrl(OAUTH_CONFIG, redirectUri, state);
  }

  async exchangeCode(userId: string, code: string, redirectUri?: string) {
    await this.assertIntegrationEnabled();
    return this.googleOAuth.exchangeCode(userId, code, OAUTH_CONFIG, redirectUri);
  }

  async listEvents(userId: string, options: ListEventsOptions = {}) {
    const { authClient, connection } = await this.getAuthorizedClient(userId);

    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const now = new Date();
    const timeMin = options.timeMin ?? now;
    const timeMax =
      options.timeMax ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // Default: next 7 days

    let response: calendar_v3.Schema$Events | undefined;

    try {
      const { data } = await calendar.events.list({
        calendarId: 'primary',
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: options.maxResults ?? 50,
      });
      response = data;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch Google Calendar events.');
    }

    await this.prisma.userCalendarIntegration.update({
      where: {
        userId_provider: {
          userId,
          provider: INTEGRATION_NAME,
        },
      },
      data: {
        lastSyncedAt: new Date(),
        syncToken: response?.nextSyncToken ?? connection.syncToken,
      },
    });

    return {
      events: response?.items?.map((event) => this.mapGoogleEvent(event)) ?? [],
      timeRange: {
        from: timeMin,
        to: timeMax,
      },
    };
  }

  async createEvent(userId: string, payload: CreateGoogleCalendarEventDto) {
    const { authClient, connection } = await this.getAuthorizedClient(userId);

    const calendar = google.calendar({ version: 'v3', auth: authClient });

    let createdEvent: calendar_v3.Schema$Event | undefined;

    try {
      const { data } = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary: payload.summary,
          description: payload.description,
          location: payload.location,
          start: payload.start,
          end: payload.end,
          attendees: payload.attendees?.map((attendee) => ({
            email: attendee.email,
            displayName: attendee.displayName,
            optional: attendee.optional,
          })),
        },
      });

      createdEvent = data;
    } catch (error) {
      throw new InternalServerErrorException('Failed to create Google Calendar event.');
    }

    if (!createdEvent) {
      throw new InternalServerErrorException('Google Calendar did not return a created event.');
    }

    await this.prisma.userCalendarIntegration.update({
      where: {
        userId_provider: {
          userId,
          provider: INTEGRATION_NAME,
        },
      },
      data: {
        lastSyncedAt: new Date(),
        syncToken: connection.syncToken ?? null,
      },
    });

    const mappedEvent = this.mapGoogleEvent(createdEvent);

    if (!mappedEvent) {
      throw new InternalServerErrorException('Failed to map Google Calendar event response.');
    }

    return mappedEvent;
  }

  async disconnect(userId: string) {
    return this.googleOAuth.disconnect(userId, INTEGRATION_NAME);
  }


  private async assertIntegrationEnabled() {
    const integration = await this.prisma.integration.findUnique({
      where: { name: INTEGRATION_NAME },
    });

    if (!integration || !integration.isActive) {
      throw new BadRequestException('Google Calendar integration is disabled.');
    }

    return integration;
  }

  private async getAuthorizedClient(userId: string) {
    return this.googleOAuth.getAuthorizedClient(userId, INTEGRATION_NAME, OAUTH_CONFIG);
  }

  private mapGoogleEvent(event?: calendar_v3.Schema$Event | null) {
    if (!event) {
      return null;
    }

    return {
      id: event.id,
      status: event.status,
      summary: event.summary,
      description: event.description,
      location: event.location,
      htmlLink: event.htmlLink,
      hangoutLink: event.hangoutLink ?? event.conferenceData?.entryPoints?.[0]?.uri ?? null,
      start: event.start ?? null,
      end: event.end ?? null,
      attendees:
        event.attendees?.map((attendee) => ({
          email: attendee.email,
          displayName: attendee.displayName,
          responseStatus: attendee.responseStatus,
          optional: attendee.optional ?? false,
        })) ?? [],
      organizer: event.organizer
        ? {
            email: event.organizer.email,
            displayName: event.organizer.displayName,
          }
        : null,
    };
  }
}



import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import type { Credentials } from 'google-auth-library';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateGoogleCalendarEventDto } from './dto/create-google-calendar-event.dto';

const INTEGRATION_NAME = 'google_calendar';
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

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
  ) {}

  async getConnectionStatus(userId: string) {
    const connection = await this.prisma.userCalendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: INTEGRATION_NAME,
        },
      },
    });

    return {
      connected: Boolean(connection?.accessToken && connection?.refreshToken),
      externalEmail: connection?.externalEmail ?? null,
      externalAccountId: connection?.externalAccountId ?? null,
      expiresAt: connection?.expiresAt ?? null,
      scope: connection?.scope ?? null,
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      connectedAt: connection?.connectedAt ?? null,
    };
  }

  async generateAuthUrl(redirectUri?: string) {
    await this.assertIntegrationEnabled();

    const oauthClient = this.createOAuthClient(redirectUri);

    return oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: DEFAULT_SCOPES,
      include_granted_scopes: true,
    });
  }

  async exchangeCode(userId: string, code: string, redirectUri?: string) {
    await this.assertIntegrationEnabled();

    const oauthClient = this.createOAuthClient(redirectUri);

    let tokens: Credentials;

    try {
      const response = await oauthClient.getToken(code);
      tokens = response.tokens;
      oauthClient.setCredentials(tokens);
    } catch (error) {
      throw new BadRequestException('Failed to exchange authorization code with Google.');
    }

    const oauth2 = google.oauth2('v2');

    let userInfoEmail: string | undefined;
    let userInfoId: string | undefined;

    try {
      const { data } = await oauth2.userinfo.get({
        auth: oauthClient,
      });
      userInfoEmail = data.email ?? undefined;
      userInfoId = data.id ?? undefined;
    } catch (error) {
      throw new InternalServerErrorException(
        'Connected to Google but failed to fetch account details.',
      );
    }

    await this.persistTokens(userId, tokens, {
      externalAccountId: userInfoId,
      externalEmail: userInfoEmail,
    });

    return this.getConnectionStatus(userId);
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
    const connection = await this.prisma.userCalendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: INTEGRATION_NAME,
        },
      },
    });

    if (!connection) {
      return { success: true };
    }

    await this.prisma.userCalendarIntegration.update({
      where: {
        userId_provider: {
          userId,
          provider: INTEGRATION_NAME,
        },
      },
      data: {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        scope: null,
        externalAccountId: null,
        externalEmail: null,
        syncToken: null,
        lastSyncedAt: null,
      },
    });

    return { success: true };
  }

  private createOAuthClient(redirectUri?: string) {
    const clientId = this.configService.get<string>('GOOGLE_CALENDAR_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CALENDAR_CLIENT_SECRET');
    const defaultRedirect = this.configService.get<string>('GOOGLE_CALENDAR_REDIRECT_URI');

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        'Google Calendar client credentials are not configured. Please set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.',
      );
    }

    const resolvedRedirectUri = redirectUri ?? defaultRedirect;

    if (!resolvedRedirectUri) {
      throw new InternalServerErrorException(
        'Google Calendar redirect URI is not configured. Set GOOGLE_CALENDAR_REDIRECT_URI or provide redirectUri explicitly.',
      );
    }

    return new google.auth.OAuth2({
      clientId,
      clientSecret,
      redirectUri: resolvedRedirectUri,
    });
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
    const connection = await this.prisma.userCalendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: INTEGRATION_NAME,
        },
      },
    });

    if (!connection || !connection.refreshToken) {
      throw new NotFoundException('Google Calendar is not connected for this user.');
    }

    const oauthClient = this.createOAuthClient();

    oauthClient.setCredentials({
      access_token: connection.accessToken ?? undefined,
      refresh_token: connection.refreshToken ?? undefined,
      expiry_date: connection.expiresAt ? connection.expiresAt.getTime() : undefined,
      scope: connection.scope ?? undefined,
    });

    const needsRefresh =
      !connection.expiresAt ||
      connection.expiresAt.getTime() <= Date.now() + 60 * 1000 ||
      !connection.accessToken;

    if (needsRefresh) {
      try {
        const { credentials } = await oauthClient.refreshAccessToken();
        await this.persistTokens(userId, credentials);
      } catch (error) {
        throw new BadRequestException('Failed to refresh Google Calendar access token.');
      }
    }

    return {
      authClient: oauthClient,
      connection,
    };
  }

  private async persistTokens(
    userId: string,
    credentials: Credentials,
    metadata?: {
      externalEmail?: string;
      externalAccountId?: string;
    },
  ) {
    const expiresAt =
      credentials.expiry_date !== null && credentials.expiry_date !== undefined
        ? new Date(credentials.expiry_date)
        : null;

    await this.prisma.userCalendarIntegration.upsert({
      where: {
        userId_provider: {
          userId,
          provider: INTEGRATION_NAME,
        },
      },
      create: {
        userId,
        provider: INTEGRATION_NAME,
        accessToken: credentials.access_token ?? null,
        refreshToken: credentials.refresh_token ?? null,
        expiresAt,
        scope: credentials.scope ?? null,
        externalEmail: metadata?.externalEmail ?? null,
        externalAccountId: metadata?.externalAccountId ?? null,
      },
      update: {
        accessToken: credentials.access_token ?? undefined,
        refreshToken:
          credentials.refresh_token !== undefined ? credentials.refresh_token : undefined,
        expiresAt: expiresAt ?? undefined,
        scope: credentials.scope ?? undefined,
        externalEmail: metadata?.externalEmail ?? undefined,
        externalAccountId: metadata?.externalAccountId ?? undefined,
      },
    });
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



import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';
import type { Credentials } from 'google-auth-library';
import type { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BaseService } from '../../common/services/base.service';
import { ErrorMessages } from '../../common/constants/error-messages.const';
import { EncryptionService } from '../../common/encryption/encryption.service';

export interface GoogleOAuthConfig {
  clientIdEnvKey: string;
  clientSecretEnvKey: string;
  redirectUriEnvKey: string;
  integrationName: string;
  defaultScopes: string[];
  errorPrefix: string; // e.g., "Google Calendar" or "Google Drive"
}

export interface ConnectionStatus {
  connected: boolean;
  externalEmail: string | null;
  externalAccountId: string | null;
  expiresAt: Date | null;
  scope: string | null;
  lastSyncedAt: Date | null;
  connectedAt: Date | null;
}

@Injectable()
export class GoogleOAuthService extends BaseService {
  constructor(
    prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly encryptionService: EncryptionService,
  ) {
    super(prisma);
  }

  /**
   * Get connection status for a user
   */
  async getConnectionStatus(userId: string, provider: string): Promise<ConnectionStatus> {
    const connection = await this.prisma.userCalendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    // Note: We don't decrypt tokens here, just check if they exist
    const hasTokens = Boolean(
      connection?.accessToken && connection?.refreshToken,
    );
    return {
      connected: hasTokens,
      externalEmail: connection?.externalEmail ?? null,
      externalAccountId: connection?.externalAccountId ?? null,
      expiresAt: connection?.expiresAt ?? null,
      scope: connection?.scope ?? null,
      lastSyncedAt: connection?.lastSyncedAt ?? null,
      connectedAt: connection?.connectedAt ?? null,
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  async generateAuthUrl(
    config: GoogleOAuthConfig,
    redirectUri?: string,
    state?: string,
  ): Promise<{ url: string }> {
    const oauthClient = this.createOAuthClient(config, redirectUri);

    const url = oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: config.defaultScopes,
      include_granted_scopes: true,
      state: state || config.integrationName, // Use provided state or default to integration name
    });

    return { url };
  }

  /**
   * Exchange OAuth code for tokens
   */
  async exchangeCode(
    userId: string,
    code: string,
    config: GoogleOAuthConfig,
    redirectUri?: string,
  ): Promise<ConnectionStatus> {
    const oauthClient = this.createOAuthClient(config, redirectUri);

    let tokens: Credentials;

    try {
      const response = await oauthClient.getToken(code);
      tokens = response.tokens;
      oauthClient.setCredentials(tokens);
    } catch (error) {
      throw new BadRequestException(
        ErrorMessages.OPERATION_NOT_ALLOWED(`exchange authorization code with Google for ${config.errorPrefix}`),
      );
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
        ErrorMessages.FETCH_FAILED(`account details for ${config.errorPrefix}`),
      );
    }

    await this.persistTokens(userId, config.integrationName, tokens, {
      externalAccountId: userInfoId,
      externalEmail: userInfoEmail,
    });

    return this.getConnectionStatus(userId, config.integrationName);
  }

  /**
   * Disconnect user's integration
   */
  async disconnect(userId: string, provider: string): Promise<{ success: boolean }> {
    const connection = await this.prisma.userCalendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
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
          provider,
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

  /**
   * Get authorized OAuth client for a user (with automatic token refresh)
   */
  async getAuthorizedClient(
    userId: string,
    provider: string,
    config: GoogleOAuthConfig,
  ): Promise<{ authClient: OAuth2Client; connection: any }> {
    const connection = await this.prisma.userCalendarIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
    });

    if (!connection || !connection.refreshToken) {
      throw new InternalServerErrorException(
        ErrorMessages.OPERATION_NOT_ALLOWED(`access ${config.errorPrefix}`, 'integration is not connected for this user'),
      );
    }

    // Create OAuth client - redirect URI is not needed for token refresh
    const oauthClient = this.createOAuthClient(config);

    // Decrypt tokens before using them
    const decryptedAccessToken = connection.accessToken
      ? this.encryptionService.decrypt(connection.accessToken)
      : null;
    const decryptedRefreshToken = connection.refreshToken
      ? this.encryptionService.decrypt(connection.refreshToken)
      : null;

    oauthClient.setCredentials({
      access_token: decryptedAccessToken ?? undefined,
      refresh_token: decryptedRefreshToken ?? undefined,
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
        await this.persistTokens(userId, provider, credentials);
      } catch (error: any) {
        // If refresh fails, it might be because the token was revoked or invalid
        // Log the error and throw a more helpful message
        this.logger.error(
          `Failed to refresh ${config.errorPrefix} access token for user ${userId}`,
          error,
        );
        
        // If it's an invalid_grant error, the refresh token is invalid/revoked
        if (error?.response?.data?.error === 'invalid_grant') {
          throw new BadRequestException(
            ErrorMessages.OPERATION_NOT_ALLOWED(`use ${config.errorPrefix}`, 'connection has expired. Please reconnect your account'),
          );
        }
        
        throw new BadRequestException(
          ErrorMessages.OPERATION_NOT_ALLOWED(`refresh ${config.errorPrefix} access token`, 'Please try reconnecting your account'),
        );
      }
    }

    return {
      authClient: oauthClient,
      connection,
    };
  }

  /**
   * Create OAuth2 client
   * Note: redirectUri is only required for authorization flows, not for token refresh
   */
  private createOAuthClient(config: GoogleOAuthConfig, redirectUri?: string) {
    const clientId = this.configService.get<string>(config.clientIdEnvKey);
    const clientSecret = this.configService.get<string>(config.clientSecretEnvKey);
    const defaultRedirect = this.configService.get<string>(config.redirectUriEnvKey);

    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException(
        ErrorMessages.MISSING_REQUIRED_FIELD(`${config.errorPrefix} OAuth credentials`) + `. Please set ${config.clientIdEnvKey} and ${config.clientSecretEnvKey}.`,
      );
    }

    // For token refresh, redirect URI is not needed
    // Only require it when generating auth URLs
    const resolvedRedirectUri = redirectUri ?? defaultRedirect;

    // Create OAuth client
    // Redirect URI is required in constructor, but we can use a placeholder for token refresh
    // The redirect URI only matters when generating auth URLs
    return new google.auth.OAuth2({
      clientId,
      clientSecret,
      redirectUri: resolvedRedirectUri || 'http://localhost', // Placeholder if not provided (only used for auth URL generation)
    });
  }

  /**
   * Persist OAuth tokens for a user (encrypted)
   */
  private async persistTokens(
    userId: string,
    provider: string,
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

    // Encrypt tokens before storing
    const encryptedAccessToken = credentials.access_token
      ? this.encryptionService.encrypt(credentials.access_token)
      : null;
    const encryptedRefreshToken = credentials.refresh_token
      ? this.encryptionService.encrypt(credentials.refresh_token)
      : null;

    await this.prisma.userCalendarIntegration.upsert({
      where: {
        userId_provider: {
          userId,
          provider,
        },
      },
      create: {
        userId,
        provider,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        scope: credentials.scope ?? null,
        externalEmail: metadata?.externalEmail ?? null,
        externalAccountId: metadata?.externalAccountId ?? null,
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
        scope: credentials.scope ?? null,
        externalEmail: metadata?.externalEmail ?? null,
        externalAccountId: metadata?.externalAccountId ?? null,
      },
    });
  }
}


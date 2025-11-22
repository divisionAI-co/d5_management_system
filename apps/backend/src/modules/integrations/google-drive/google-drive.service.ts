import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { GoogleOAuthService, type GoogleOAuthConfig } from '../google-oauth.service';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  owners?: Array<{ displayName?: string | null; emailAddress?: string | null }>;
  isFolder: boolean;
}

export interface ListDriveFilesOptions {
  parentId?: string;
  pageToken?: string;
  pageSize?: number;
  search?: string;
  recursive?: boolean;
  userEmail?: string; // Filter files by user's view permissions
  mimeTypeFilter?: string; // Filter by mime type (e.g., 'image' for images only)
}

export interface DrivePermission {
  id: string;
  type: 'user' | 'group' | 'domain' | 'anyone';
  role: 'owner' | 'organizer' | 'fileOrganizer' | 'writer' | 'commenter' | 'reader';
  emailAddress?: string;
  displayName?: string;
  domain?: string;
  allowFileDiscovery?: boolean;
}

export interface UserFilePermissions {
  fileId: string;
  userEmail: string;
  canView: boolean;
  canComment: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isOwner: boolean;
  permissions: DrivePermission[];
}

const INTEGRATION_NAME = 'google_drive';
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const OAUTH_CONFIG: GoogleOAuthConfig = {
  clientIdEnvKey: 'GOOGLE_CLIENT_ID',
  clientSecretEnvKey: 'GOOGLE_CLIENT_SECRET',
  redirectUriEnvKey: 'GOOGLE_REDIRECT_URI',
  integrationName: INTEGRATION_NAME,
  defaultScopes: DEFAULT_SCOPES,
  errorPrefix: 'Google Drive',
};

@Injectable()
export class GoogleDriveService extends BaseService {
  private driveClient?: drive_v3.Drive;
  private configuredSharedDriveId?: string | null;

  constructor(
    private readonly configService: ConfigService,
    prisma: PrismaService,
    private readonly googleOAuth: GoogleOAuthService,
  ) {
    super(prisma);
  }

  private getSharedDriveId(): string | undefined {
    if (this.configuredSharedDriveId === undefined) {
      this.configuredSharedDriveId = this.configService.get<string>('GOOGLE_DRIVE_SHARED_DRIVE_ID');
    }

    return this.configuredSharedDriveId ?? undefined;
  }

  /**
   * Get drive client - tries user OAuth first, falls back to service account
   */
  private async getDriveClient(userId?: string): Promise<drive_v3.Drive> {
    // Try user OAuth first if userId is provided
    if (userId) {
      try {
        const userClient = await this.getUserDriveClient(userId);
        if (userClient) {
          return userClient;
        }
      } catch (error) {
        this.logger.warn(`Could not get user OAuth client for user ${userId}, falling back to service account`);
      }
    }

    // Fall back to service account
    if (this.driveClient) {
      return this.driveClient;
    }

    const clientEmail = this.configService.get<string>('GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL');
    const privateKeyRaw = this.configService.get<string>('GOOGLE_DRIVE_PRIVATE_KEY');

    if (!clientEmail || !privateKeyRaw) {
      this.logger.error(
        'Missing Google Drive credentials. Please set GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY',
      );
      throw new InternalServerErrorException(
        'Google Drive integration is not configured correctly. Contact an administrator.',
      );
    }

    const scopesConfig =
      this.configService.get<string>('GOOGLE_DRIVE_SCOPES') ||
      'https://www.googleapis.com/auth/drive';

    const scopes = scopesConfig
      .split(',')
      .map((scope) => scope.trim())
      .filter(Boolean);

    if (scopes.length === 0) {
      scopes.push('https://www.googleapis.com/auth/drive');
    }

    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKeyRaw.replace(/\\n/g, '\n'),
      scopes,
      subject: this.configService.get<string>('GOOGLE_DRIVE_IMPERSONATE_USER'),
    });

    this.driveClient = google.drive({ version: 'v3', auth });
    return this.driveClient;
  }

  /**
   * Get drive client using user's OAuth tokens
   */
  private async getUserDriveClient(userId: string): Promise<drive_v3.Drive | null> {
    try {
      const { authClient } = await this.googleOAuth.getAuthorizedClient(userId, INTEGRATION_NAME, OAUTH_CONFIG);
      return google.drive({ version: 'v3', auth: authClient });
    } catch (error) {
      this.logger.warn(`Could not get authorized client for user ${userId}`, error);
      return null;
    }
  }

  private mapFile(file: drive_v3.Schema$File): DriveFile {
    return {
      id: file.id!,
      name: file.name || 'Untitled',
      mimeType: file.mimeType || 'application/octet-stream',
      size: file.size ? Number(file.size) : undefined,
      parents: file.parents ?? undefined,
      createdTime: file.createdTime ?? undefined,
      modifiedTime: file.modifiedTime ?? undefined,
      webViewLink: file.webViewLink ?? undefined,
      iconLink: file.iconLink ?? undefined,
      thumbnailLink: file.thumbnailLink ?? undefined,
      owners: file.owners?.map((owner) => ({
        displayName: owner.displayName,
        emailAddress: owner.emailAddress,
      })),
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    };
  }

  private buildSearchQuery(options: ListDriveFilesOptions, parentId?: string, sharedDriveId?: string) {
    const queryParts: string[] = ['trashed = false'];

    // If shared drive is configured, restrict all queries to that shared drive
    if (sharedDriveId) {
      // For shared drives, we need to ensure files are within the shared drive
      // Files in shared drive root have the shared drive ID as their parent
      // Files in subfolders have the folder ID as their parent (which is also in the shared drive)
      if (!options.recursive && parentId) {
        // Filter by parent folder (or shared drive root)
        queryParts.push(`'${parentId}' in parents`);
      }
      // For recursive search in shared drive, the driveId parameter already restricts to the drive
    } else if (!options.recursive && parentId) {
      // For personal Drive, filter by parent folder
      queryParts.push(`'${parentId}' in parents`);
    }

    if (options.search) {
      const sanitized = options.search.replace(/'/g, "\\'");
      queryParts.push(`name contains '${sanitized}'`);
    }

    // Filter by mime type (e.g., 'image' for images only)
    if (options.mimeTypeFilter === 'image') {
      queryParts.push("mimeType contains 'image/'");
    }

    return queryParts.join(' and ');
  }

  // OAuth Methods
  async getConnectionStatus(userId: string) {
    return this.googleOAuth.getConnectionStatus(userId, INTEGRATION_NAME);
  }

  async generateAuthUrl(redirectUri?: string, state?: string) {
    return this.googleOAuth.generateAuthUrl(OAUTH_CONFIG, redirectUri, state);
  }

  async exchangeCode(userId: string, code: string, redirectUri?: string) {
    return this.googleOAuth.exchangeCode(userId, code, OAUTH_CONFIG, redirectUri);
  }

  async disconnect(userId: string) {
    return this.googleOAuth.disconnect(userId, INTEGRATION_NAME);
  }

  async listFiles(options: ListDriveFilesOptions, userId?: string) {
    const drive = await this.getDriveClient(userId);
    const sharedDriveId = this.getSharedDriveId();
    
    // Always use shared drive if configured, for both OAuth users and service account
    // This restricts the view to only the shared drive and its children
    const parentId = options.parentId || sharedDriveId;

    try {
      // Always use shared drive if configured, regardless of OAuth or service account
      const useSharedDrive = !!sharedDriveId;
      const corpora = options.recursive
        ? useSharedDrive
          ? 'drive'
          : 'default'
        : useSharedDrive
        ? 'drive'
        : 'default';

      // Build the request parameters
      const listParams: any = {
        pageSize: options.pageSize ?? 50,
        pageToken: options.pageToken,
        q: this.buildSearchQuery(options, parentId ?? undefined, sharedDriveId),
        orderBy: 'folder,name,modifiedTime desc',
        fields:
          'nextPageToken, files(id, name, mimeType, size, parents, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink, owners(displayName,emailAddress))',
      };

      // Corpus-specific parameters
      if (corpora === 'drive' && sharedDriveId) {
        // For shared drives, include these parameters
        // This restricts results to only files within the specified shared drive
        listParams.corpora = 'drive';
        listParams.driveId = sharedDriveId;
        listParams.includeItemsFromAllDrives = true;
        listParams.supportsAllDrives = true;
      }
      // For 'default' corpus (personal Drive), don't specify corpora at all
      // The API defaults to 'default' when corpora is omitted

      const response = await drive.files.list(listParams);

      let files = (response.data.files ?? []).map((file) => this.mapFile(file));

      // Filter by parent if not recursive to ensure correct hierarchy
      if (!options.recursive && parentId) {
        files = files.filter((file) => {
          // Files must have the parentId in their parents array
          // For shared drive root, parentId is the shared drive ID
          return file.parents?.includes(parentId) ?? false;
        });
      }

      // Filter by user permissions if userEmail is provided
      // For OAuth users: If Google Drive API returned the file, the user has access (API already filters)
      // For service accounts: We need to explicitly check permissions
      if (options.userEmail && files.length > 0 && !userId) {
        // Only do explicit permission filtering for service accounts
        // OAuth users: Trust the API - if it returned the file, user has access
        const filteredFiles: DriveFile[] = [];
        
        // Check permissions in parallel with a reasonable batch size to avoid rate limits
        const BATCH_SIZE = 10;
        for (let i = 0; i < files.length; i += BATCH_SIZE) {
          const batch = files.slice(i, i + BATCH_SIZE);
          const permissionChecks = await Promise.allSettled(
            batch.map(async (file) => {
              try {
                // Quick check: if user owns the file, they definitely have access
                const isOwner = file.owners?.some(
                  (owner) => owner.emailAddress?.toLowerCase() === options.userEmail!.toLowerCase()
                ) ?? false;
                
                if (isOwner) {
                  return { file, canView: true };
                }
                
                // For service account, check permissions explicitly
                const userPerms = await this.getUserFilePermissions(file.id, options.userEmail!, userId);
                return { file, canView: userPerms.canView };
              } catch (error: any) {
                // If permission check fails, check the error type
                // 403/404 means no access - hide the file
                if (error?.code === 403 || error?.code === 404) {
                  this.logger.debug(`User ${options.userEmail} does not have access to file ${file.id}`);
                  return { file, canView: false };
                }
                
                // For service account, err on the side of caution
                this.logger.warn(`Could not check permissions for file ${file.id}: ${error}`);
                return { file, canView: false };
              }
            }),
          );

          for (const result of permissionChecks) {
            if (result.status === 'fulfilled' && result.value.canView) {
              filteredFiles.push(result.value.file);
            }
          }
        }

        files = filteredFiles;
      }
      // For OAuth users: If Google Drive API returned the file, the user has access
      // The API already filters based on the authenticated user's permissions
      // This includes shared drive access, file-level permissions, etc.
      
      // Sort files: folders first, then by name
      files.sort((a, b) => {
        // Folders first
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        // Then alphabetically by name
        return a.name.localeCompare(b.name);
      });

      return {
        files,
        nextPageToken: response.data.nextPageToken ?? null,
        parentId: parentId ?? null,
        driveId: sharedDriveId ?? null,
      };
    } catch (error) {
      this.logger.error(`Failed to list Google Drive files`, error as Error);
      throw new InternalServerErrorException(ErrorMessages.FETCH_FAILED('Google Drive files'));
    }
  }

  async getFileMetadata(fileId: string, userId?: string): Promise<DriveFile> {
    const drive = await this.getDriveClient(userId);

    try {
      const { data } = await drive.files.get({
        fileId,
        supportsAllDrives: true,
        fields:
          'id, name, mimeType, size, parents, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink, owners(displayName,emailAddress)',
      });

      if (!data) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND_BY_FIELD('File', 'id', 'in Google Drive'));
      }

      return this.mapFile(data);
    } catch (error: any) {
      if (error?.code === 404) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND_BY_FIELD('File', 'id', 'in Google Drive'));
      }

      this.logger.error(`Failed to fetch Google Drive file ${fileId}`, error as Error);
      throw new InternalServerErrorException(ErrorMessages.FETCH_FAILED('file metadata from Google Drive'));
    }
  }

  async downloadFile(
    fileId: string,
    userId?: string,
  ): Promise<{ stream: Readable; file: DriveFile }> {
    const drive = await this.getDriveClient(userId);

    const file = await this.getFileMetadata(fileId, userId);

    try {
      const response = await drive.files.get(
        {
          fileId,
          alt: 'media',
          supportsAllDrives: true,
        },
        { responseType: 'stream' },
      );

      const stream = response.data as unknown as Readable;

      return { stream, file };
    } catch (error: any) {
      if (error?.code === 404) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND_BY_FIELD('File', 'id', 'in Google Drive'));
      }

      this.logger.error(`Failed to download Google Drive file ${fileId}`, error as Error);
      throw new InternalServerErrorException(ErrorMessages.FETCH_FAILED('file from Google Drive'));
    }
  }

  async createFolder(name: string, parentId?: string, userId?: string): Promise<DriveFile> {
    if (!name || !name.trim()) {
      throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('folder name'));
    }

    const drive = await this.getDriveClient(userId);
    const sharedDriveId = this.getSharedDriveId();
    const destinationParent = parentId || sharedDriveId;

    try {
      const { data } = await drive.files.create({
        supportsAllDrives: true,
        fields:
          'id, name, mimeType, size, parents, createdTime, modifiedTime, webViewLink, iconLink, owners(displayName,emailAddress)',
        requestBody: {
          name: name.trim(),
          mimeType: 'application/vnd.google-apps.folder',
          parents: destinationParent ? [destinationParent] : undefined,
        },
      });

      return this.mapFile(data);
    } catch (error) {
      this.logger.error('Failed to create folder in Google Drive', error as Error);
      throw new InternalServerErrorException(ErrorMessages.CREATE_FAILED('folder in Google Drive'));
    }
  }

  async uploadFile(file: Express.Multer.File, parentId?: string, userId?: string): Promise<DriveFile> {
    if (!file) {
      throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('file'));
    }

    const drive = await this.getDriveClient(userId);
    const sharedDriveId = this.getSharedDriveId();
    const destinationParent = parentId || sharedDriveId;

    try {
      const { data } = await drive.files.create({
        supportsAllDrives: true,
        fields:
          'id, name, mimeType, size, parents, createdTime, modifiedTime, webViewLink, iconLink, owners(displayName,emailAddress)',
        requestBody: {
          name: file.originalname,
          parents: destinationParent ? [destinationParent] : undefined,
        },
        media: {
          mimeType: file.mimetype,
          body: Readable.from(file.buffer),
        },
      });

      return this.mapFile(data);
    } catch (error) {
      this.logger.error('Failed to upload file to Google Drive', error as Error);
      throw new InternalServerErrorException(ErrorMessages.CREATE_FAILED('file in Google Drive'));
    }
  }

  async renameFile(fileId: string, name: string, userId?: string): Promise<DriveFile> {
    if (!name || !name.trim()) {
      throw new BadRequestException(ErrorMessages.INVALID_INPUT('file name', 'cannot be empty'));
    }

    const drive = await this.getDriveClient(userId);

    try {
      const { data } = await drive.files.update({
        fileId,
        supportsAllDrives: true,
        fields:
          'id, name, mimeType, size, parents, createdTime, modifiedTime, webViewLink, iconLink, owners(displayName,emailAddress)',
        requestBody: {
          name,
        },
      });

      return this.mapFile(data);
    } catch (error: any) {
      if (error?.code === 404) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND_BY_FIELD('File', 'id', 'in Google Drive'));
      }

      this.logger.error(`Failed to rename Google Drive file ${fileId}`, error as Error);
      throw new InternalServerErrorException(ErrorMessages.UPDATE_FAILED('file name in Google Drive'));
    }
  }

  async deleteFile(fileId: string, userId?: string): Promise<void> {
    const drive = await this.getDriveClient(userId);

    try {
      await drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });
    } catch (error: any) {
      if (error?.code === 404) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND_BY_FIELD('File', 'id', 'in Google Drive'));
      }

      this.logger.error(`Failed to delete Google Drive file ${fileId}`, error as Error);
      throw new InternalServerErrorException(ErrorMessages.DELETE_FAILED('file from Google Drive'));
    }
  }

  /**
   * Get all permissions for a specific file/folder
   */
  async getFilePermissions(fileId: string, userId?: string): Promise<DrivePermission[]> {
    const drive = await this.getDriveClient(userId);

    try {
      const { data } = await drive.permissions.list({
        fileId,
        fields: 'permissions(id,type,role,emailAddress,displayName,domain,allowFileDiscovery)',
        supportsAllDrives: true,
      });

      return (data.permissions || []).map((perm) => ({
        id: perm.id!,
        type: perm.type as DrivePermission['type'],
        role: perm.role as DrivePermission['role'],
        emailAddress: perm.emailAddress ?? undefined,
        displayName: perm.displayName ?? undefined,
        domain: perm.domain ?? undefined,
        allowFileDiscovery: perm.allowFileDiscovery ?? undefined,
      }));
    } catch (error: any) {
      if (error?.code === 404) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND_BY_FIELD('File', 'id', 'in Google Drive'));
      }

      this.logger.error(`Failed to get permissions for file ${fileId}`, error as Error);
      throw new InternalServerErrorException(ErrorMessages.FETCH_FAILED('file permissions from Google Drive'));
    }
  }

  /**
   * Get permissions for a specific user on a file/folder
   * This checks both direct user permissions and domain/group permissions
   * For shared drives, also considers drive-level permissions
   */
  async getUserFilePermissions(fileId: string, userEmail: string, userId?: string): Promise<UserFilePermissions> {
    const _drive = await this.getDriveClient(userId);
    
    // Get file metadata to check ownership and drive membership
    const file = await this.getFileMetadata(fileId, userId);
    const isOwner = file.owners?.some((owner) => owner.emailAddress?.toLowerCase() === userEmail.toLowerCase()) ?? false;

    // Try to get file-level permissions
    let allPermissions: DrivePermission[] = [];
    try {
      allPermissions = await this.getFilePermissions(fileId, userId);
    } catch (error: any) {
      // If we can't get permissions (e.g., user doesn't have permission to view permissions list),
      // but we can get the file metadata, the user has at least view access
      // For OAuth users, if we got the file, they can view it
      if (userId && error?.code !== 404) {
        // User can view the file (we got metadata) but can't see permissions
        // Default to reader access for view, but be conservative for edit/delete
        return {
          fileId,
          userEmail,
          canView: true, // If we got the file, they can view it
          canComment: isOwner, // Only if owner
          canEdit: isOwner, // Only if owner
          canDelete: isOwner, // Only if owner
          isOwner,
          permissions: [],
        };
      }
      throw error;
    }

    // Find permissions that apply to this user
    const userPermissions: DrivePermission[] = [];
    const emailLower = userEmail.toLowerCase();
    const _domain = emailLower.split('@')[1];

    for (const perm of allPermissions) {
      // Direct user permission
      if (perm.type === 'user' && perm.emailAddress?.toLowerCase() === emailLower) {
        userPermissions.push(perm);
      }
      // Domain permission (if user's domain matches)
      else if (perm.type === 'domain' && perm.domain && emailLower.endsWith(`@${perm.domain}`)) {
        userPermissions.push(perm);
      }
      // Anyone permission
      else if (perm.type === 'anyone') {
        userPermissions.push(perm);
      }
    }

    // Determine capabilities based on highest role
    let highestRole: DrivePermission['role'] = 'reader';
    if (isOwner) {
      highestRole = 'owner';
    } else if (userPermissions.length > 0) {
      const rolePriority: Record<DrivePermission['role'], number> = {
        owner: 6,
        organizer: 5,
        fileOrganizer: 4,
        writer: 3,
        commenter: 2,
        reader: 1,
      };

      highestRole = userPermissions.reduce((max, perm) => {
        return rolePriority[perm.role] > rolePriority[max] ? perm.role : max;
      }, userPermissions[0].role);
    } else if (userId) {
      // For OAuth users: if we got the file but no explicit permissions found,
      // user has at least view access (API already filtered)
      // But be conservative about edit/delete - only if owner
      highestRole = isOwner ? 'owner' : 'reader';
    }

    return {
      fileId,
      userEmail,
      canView: isOwner || highestRole !== 'reader' || userPermissions.length > 0 || (userId ? true : false),
      canComment: isOwner || ['owner', 'organizer', 'fileOrganizer', 'writer', 'commenter'].includes(highestRole),
      canEdit: isOwner || ['owner', 'organizer', 'fileOrganizer', 'writer'].includes(highestRole),
      canDelete: isOwner || ['owner', 'organizer', 'fileOrganizer'].includes(highestRole),
      isOwner,
      permissions: userPermissions,
    };
  }

  /**
   * Check if a user has a specific permission on a file
   */
  async checkUserPermission(
    fileId: string,
    userEmail: string,
    requiredRole: DrivePermission['role'],
    userId?: string,
  ): Promise<boolean> {
    const userPerms = await this.getUserFilePermissions(fileId, userEmail, userId);

    if (userPerms.isOwner) {
      return true; // Owners have all permissions
    }

    const rolePriority: Record<DrivePermission['role'], number> = {
      owner: 6,
      organizer: 5,
      fileOrganizer: 4,
      writer: 3,
      commenter: 2,
      reader: 1,
    };

    const userHighestRole = userPerms.permissions.reduce(
      (max, perm) => {
        return rolePriority[perm.role] > rolePriority[max] ? perm.role : max;
      },
      'reader' as DrivePermission['role'],
    );

    return rolePriority[userHighestRole] >= rolePriority[requiredRole];
  }
}




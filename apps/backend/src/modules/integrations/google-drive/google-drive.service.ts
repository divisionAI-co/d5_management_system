import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

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
}

@Injectable()
export class GoogleDriveService {
  private readonly logger = new Logger(GoogleDriveService.name);
  private driveClient?: drive_v3.Drive;
  private configuredSharedDriveId?: string | null;

  constructor(private readonly configService: ConfigService) {}

  private getSharedDriveId(): string | undefined {
    if (this.configuredSharedDriveId === undefined) {
      this.configuredSharedDriveId = this.configService.get<string>('GOOGLE_DRIVE_SHARED_DRIVE_ID');
    }

    return this.configuredSharedDriveId ?? undefined;
  }

  private getDriveClient(): drive_v3.Drive {
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

  private buildSearchQuery(options: ListDriveFilesOptions, parentId?: string) {
    const queryParts: string[] = ['trashed = false'];

    if (options.search) {
      const sanitized = options.search.replace(/'/g, "\\'");

      if (options.recursive) {
        // Search anywhere in drive, regardless of parent.
        queryParts.push(`name contains '${sanitized}'`);
      } else {
        queryParts.push(`name contains '${sanitized}'`);
      }
    }

    if (!options.recursive && parentId) {
      queryParts.push(`'${parentId}' in parents`);
    }

    return queryParts.join(' and ');
  }

  async listFiles(options: ListDriveFilesOptions) {
    const drive = this.getDriveClient();
    const sharedDriveId = this.getSharedDriveId();
    const parentId = options.parentId || sharedDriveId;

    try {
      const response = await drive.files.list({
        corpora: options.recursive
          ? sharedDriveId
            ? 'drive'
            : 'default'
          : sharedDriveId
          ? 'drive'
          : 'default',
        driveId: sharedDriveId,
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: options.pageSize ?? 50,
        pageToken: options.pageToken,
        q: this.buildSearchQuery(options, parentId ?? undefined),
        orderBy: 'folder,name,modifiedTime desc',
        fields:
          'nextPageToken, files(id, name, mimeType, size, parents, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink, owners(displayName,emailAddress))',
      });

      return {
        files: (response.data.files ?? [])
          .map((file) => this.mapFile(file))
          .filter((file) => {
            if (!options.recursive && parentId) {
              // When not recursive we already filtered via parents.
              return true;
            }

            if (!options.recursive) {
              return true;
            }

            if (!parentId) {
              return true;
            }

            // For recursive search with parent, only include files that are either in the parent
            // or contain the parent in their path hierarchy. Google Drive doesn't return the entire
            // path, so we allow all results and rely on client-side navigation.
            return true;
          }),
        nextPageToken: response.data.nextPageToken ?? null,
        parentId: parentId ?? null,
        driveId: sharedDriveId ?? null,
      };
    } catch (error) {
      this.logger.error(`Failed to list Google Drive files`, error as Error);
      throw new InternalServerErrorException('Unable to list Google Drive files at this time.');
    }
  }

  async getFileMetadata(fileId: string): Promise<DriveFile> {
    const drive = this.getDriveClient();

    try {
      const { data } = await drive.files.get({
        fileId,
        supportsAllDrives: true,
        fields:
          'id, name, mimeType, size, parents, createdTime, modifiedTime, webViewLink, iconLink, thumbnailLink, owners(displayName,emailAddress)',
      });

      if (!data) {
        throw new NotFoundException('File not found in Google Drive.');
      }

      return this.mapFile(data);
    } catch (error: any) {
      if (error?.code === 404) {
        throw new NotFoundException('File not found in Google Drive.');
      }

      this.logger.error(`Failed to fetch Google Drive file ${fileId}`, error as Error);
      throw new InternalServerErrorException('Unable to load file metadata from Google Drive.');
    }
  }

  async downloadFile(
    fileId: string,
  ): Promise<{ stream: Readable; file: DriveFile }> {
    const drive = this.getDriveClient();

    const file = await this.getFileMetadata(fileId);

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
        throw new NotFoundException('File not found in Google Drive.');
      }

      this.logger.error(`Failed to download Google Drive file ${fileId}`, error as Error);
      throw new InternalServerErrorException('Unable to download file from Google Drive.');
    }
  }

  async uploadFile(file: Express.Multer.File, parentId?: string): Promise<DriveFile> {
    if (!file) {
      throw new BadRequestException('No file provided for upload.');
    }

    const drive = this.getDriveClient();
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
      throw new InternalServerErrorException('Unable to upload file to Google Drive.');
    }
  }

  async renameFile(fileId: string, name: string): Promise<DriveFile> {
    if (!name || !name.trim()) {
      throw new BadRequestException('File name cannot be empty.');
    }

    const drive = this.getDriveClient();

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
        throw new NotFoundException('File not found in Google Drive.');
      }

      this.logger.error(`Failed to rename Google Drive file ${fileId}`, error as Error);
      throw new InternalServerErrorException('Unable to rename file in Google Drive.');
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    const drive = this.getDriveClient();

    try {
      await drive.files.delete({
        fileId,
        supportsAllDrives: true,
      });
    } catch (error: any) {
      if (error?.code === 404) {
        throw new NotFoundException('File not found in Google Drive.');
      }

      this.logger.error(`Failed to delete Google Drive file ${fileId}`, error as Error);
      throw new InternalServerErrorException('Unable to delete file from Google Drive.');
    }
  }
}




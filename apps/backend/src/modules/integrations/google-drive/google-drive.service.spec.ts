import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleDriveService } from './google-drive.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { GoogleOAuthService } from '../google-oauth.service';

describe('GoogleDriveService', () => {
  let service: GoogleDriveService;
  let prismaService: any;
  let configService: any;
  let googleOAuthService: any;
  let mockDriveClient: any;

  const mockDriveFile = {
    id: 'file-id-123',
    name: 'test-file.pdf',
    mimeType: 'application/pdf',
    size: '1024',
    parents: ['parent-folder-id'],
    createdTime: '2024-01-15T10:00:00Z',
    modifiedTime: '2024-01-20T15:30:00Z',
    webViewLink: 'https://drive.google.com/file/d/file-id-123/view',
    iconLink: 'https://drive.google.com/icon',
    owners: [{ displayName: 'Test User', emailAddress: 'test@example.com' }],
  };

  const mockFolder = {
    id: 'folder-id-123',
    name: 'Test Folder',
    mimeType: 'application/vnd.google-apps.folder',
    parents: ['parent-folder-id'],
    createdTime: '2024-01-15T10:00:00Z',
    modifiedTime: '2024-01-20T15:30:00Z',
    webViewLink: 'https://drive.google.com/drive/folders/folder-id-123',
    iconLink: 'https://drive.google.com/icon',
    owners: [{ displayName: 'Test User', emailAddress: 'test@example.com' }],
  };

  beforeEach(async () => {
    mockDriveClient = {
      files: {
        create: jest.fn(),
        get: jest.fn(),
        list: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      permissions: {
        list: jest.fn(),
      },
    };

    const mockPrismaService = {
      userIntegration: {
        findUnique: jest.fn(),
      },
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockGoogleOAuthService = {
      getConnectionStatus: jest.fn(),
      generateAuthUrl: jest.fn(),
      exchangeCode: jest.fn(),
      disconnect: jest.fn(),
      getAccessToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleDriveService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: GoogleOAuthService,
          useValue: mockGoogleOAuthService,
        },
      ],
    }).compile();

    service = module.get<GoogleDriveService>(GoogleDriveService);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);
    googleOAuthService = module.get(GoogleOAuthService);

    // Mock getDriveClient to return our mock drive client
    jest.spyOn(service as any, 'getDriveClient').mockResolvedValue(mockDriveClient);
    jest.spyOn(service as any, 'getSharedDriveId').mockReturnValue('shared-drive-id');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createFolder', () => {
    it('should create a folder successfully', async () => {
      mockDriveClient.files.create.mockResolvedValue({ data: mockFolder });

      const result = await service.createFolder('Test Folder', 'parent-folder-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('folder-id-123');
      expect(result.name).toBe('Test Folder');
      expect(result.isFolder).toBe(true);
      expect(mockDriveClient.files.create).toHaveBeenCalledWith({
        supportsAllDrives: true,
        fields: expect.stringContaining('id, name, mimeType'),
        requestBody: {
          name: 'Test Folder',
          mimeType: 'application/vnd.google-apps.folder',
          parents: ['parent-folder-id'],
        },
      });
    });

    it('should use shared drive ID when parentId not provided', async () => {
      mockDriveClient.files.create.mockResolvedValue({ data: mockFolder });

      await service.createFolder('Test Folder');

      expect(mockDriveClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            parents: ['shared-drive-id'],
          }),
        }),
      );
    });

    it('should trim folder name', async () => {
      mockDriveClient.files.create.mockResolvedValue({ data: mockFolder });

      await service.createFolder('  Test Folder  ');

      expect(mockDriveClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            name: 'Test Folder',
          }),
        }),
      );
    });

    it('should throw BadRequestException when folder name is empty', async () => {
      await expect(service.createFolder('')).rejects.toThrow(BadRequestException);
      await expect(service.createFolder('   ')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when folder name is null', async () => {
      await expect(service.createFolder(null as any)).rejects.toThrow(BadRequestException);
    });

    it('should handle Google Drive API errors', async () => {
      const error = new Error('Google Drive API error');
      mockDriveClient.files.create.mockRejectedValue(error);

      await expect(service.createFolder('Test Folder')).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should create folder without parent when neither parentId nor sharedDriveId provided', async () => {
      jest.spyOn(service as any, 'getSharedDriveId').mockReturnValue(undefined);
      mockDriveClient.files.create.mockResolvedValue({ data: mockFolder });

      await service.createFolder('Test Folder');

      expect(mockDriveClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            parents: undefined,
          }),
        }),
      );
    });
  });

  describe('uploadFile', () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: 'test-document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('fake pdf content'),
      destination: '',
      filename: '',
      path: '',
      stream: null as any,
    };

    it('should upload a file successfully', async () => {
      mockDriveClient.files.create.mockResolvedValue({ data: mockDriveFile });

      const result = await service.uploadFile(mockFile, 'parent-folder-id');

      expect(result).toBeDefined();
      expect(result.id).toBe('file-id-123');
      expect(result.name).toBe('test-document.pdf');
      expect(result.isFolder).toBe(false);
      expect(mockDriveClient.files.create).toHaveBeenCalledWith({
        supportsAllDrives: true,
        fields: expect.stringContaining('id, name, mimeType'),
        requestBody: {
          name: 'test-document.pdf',
          parents: ['parent-folder-id'],
        },
        media: {
          mimeType: 'application/pdf',
          body: expect.any(Buffer),
        },
      });
    });

    it('should use shared drive ID when parentId not provided', async () => {
      mockDriveClient.files.create.mockResolvedValue({ data: mockDriveFile });

      await service.uploadFile(mockFile);

      expect(mockDriveClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            parents: ['shared-drive-id'],
          }),
        }),
      );
    });

    it('should throw BadRequestException when file is null', async () => {
      await expect(service.uploadFile(null as any)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when file is undefined', async () => {
      await expect(service.uploadFile(undefined as any)).rejects.toThrow(BadRequestException);
    });

    it('should handle Google Drive API errors', async () => {
      const error = new Error('Google Drive API error');
      mockDriveClient.files.create.mockRejectedValue(error);

      await expect(service.uploadFile(mockFile)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should upload file with correct mime type', async () => {
      const docFile = {
        ...mockFile,
        mimetype: 'application/msword',
        originalname: 'document.doc',
      };
      mockDriveClient.files.create.mockResolvedValue({ data: mockDriveFile });

      await service.uploadFile(docFile);

      expect(mockDriveClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          media: expect.objectContaining({
            mimeType: 'application/msword',
          }),
        }),
      );
    });

    it('should upload file without parent when neither parentId nor sharedDriveId provided', async () => {
      jest.spyOn(service as any, 'getSharedDriveId').mockReturnValue(undefined);
      mockDriveClient.files.create.mockResolvedValue({ data: mockDriveFile });

      await service.uploadFile(mockFile);

      expect(mockDriveClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestBody: expect.objectContaining({
            parents: undefined,
          }),
        }),
      );
    });

    it('should use file buffer for upload', async () => {
      const fileBuffer = Buffer.from('test content');
      const fileWithBuffer = {
        ...mockFile,
        buffer: fileBuffer,
      };
      mockDriveClient.files.create.mockResolvedValue({ data: mockDriveFile });

      await service.uploadFile(fileWithBuffer);

      expect(mockDriveClient.files.create).toHaveBeenCalledWith(
        expect.objectContaining({
          media: expect.objectContaining({
            body: fileBuffer,
          }),
        }),
      );
    });
  });
});


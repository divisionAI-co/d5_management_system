import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { StorageService } from './storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileCategory } from '@prisma/client';

// Mock fs/promises
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('StorageService', () => {
  let service: StorageService;
  let prismaService: any;
  let configService: any;

  const mockStoredFile = {
    id: 'file-1',
    filename: 'test-image.jpg',
    storedName: '550e8400-e29b-41d4-a716-446655440000.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    category: 'IMAGE' as FileCategory,
    path: 'image/550e8400-e29b-41d4-a716-446655440000.jpg',
    url: '/api/v1/storage/files/image/550e8400-e29b-41d4-a716-446655440000.jpg',
    uploadedById: 'user-1',
    blogId: null,
    caseStudyId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'test-image.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image-data'),
    destination: '',
    filename: 'test-image.jpg',
    path: '',
    stream: null as any,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      storedFile: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const mockConfigService = {
      get: jest.fn((key: string, defaultValue?: string) => {
        if (key === 'STORAGE_ROOT') return './test-storage';
        if (key === 'STORAGE_PUBLIC_URL_PREFIX') return '/api/v1/storage/files';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
    prismaService = module.get(PrismaService);
    configService = module.get(ConfigService);

    // Mock fs operations
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue(Buffer.from('file-content'));
    mockedFs.unlink.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadFile', () => {
    it('should upload an image file successfully', async () => {
      const imageFile = { ...mockFile, mimetype: 'image/jpeg' };
      const storedName = '550e8400-e29b-41d4-a716-446655440000.jpg';

      // Mock randomUUID to return predictable value
      jest.spyOn(require('crypto'), 'randomUUID').mockReturnValue('550e8400-e29b-41d4-a716-446655440000');

      prismaService.storedFile.create.mockResolvedValue({
        ...mockStoredFile,
        storedName,
      });

      const result = await service.uploadFile(imageFile, {
        uploadedById: 'user-1',
      });

      expect(result.filename).toBe('test-image.jpg');
      expect(result.category).toBe('IMAGE');
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.size).toBe(1024);
      expect(mockedFs.mkdir).toHaveBeenCalled();
      expect(mockedFs.writeFile).toHaveBeenCalled();
      expect(prismaService.storedFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            filename: 'test-image.jpg',
            mimeType: 'image/jpeg',
            category: 'IMAGE',
            uploadedById: 'user-1',
          }),
        }),
      );
    });

    it('should upload a document file successfully', async () => {
      const documentFile = {
        ...mockFile,
        originalname: 'document.pdf',
        mimetype: 'application/pdf',
        size: 2048,
      };

      jest.spyOn(require('crypto'), 'randomUUID').mockReturnValue('550e8400-e29b-41d4-a716-446655440000');

      prismaService.storedFile.create.mockResolvedValue({
        ...mockStoredFile,
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        category: 'DOCUMENT',
        storedName: '550e8400-e29b-41d4-a716-446655440000.pdf',
      });

      const result = await service.uploadFile(documentFile, {
        uploadedById: 'user-1',
      });

      expect(result.filename).toBe('document.pdf');
      expect(result.category).toBe('DOCUMENT');
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should associate file with blog', async () => {
      jest.spyOn(require('crypto'), 'randomUUID').mockReturnValue('550e8400-e29b-41d4-a716-446655440000');

      prismaService.storedFile.create.mockResolvedValue({
        ...mockStoredFile,
        blogId: 'blog-1',
      });

      const result = await service.uploadFile(mockFile, {
        uploadedById: 'user-1',
        blogId: 'blog-1',
      });

      expect(prismaService.storedFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            blogId: 'blog-1',
          }),
        }),
      );
    });

    it('should associate file with case study', async () => {
      jest.spyOn(require('crypto'), 'randomUUID').mockReturnValue('550e8400-e29b-41d4-a716-446655440000');

      prismaService.storedFile.create.mockResolvedValue({
        ...mockStoredFile,
        caseStudyId: 'case-study-1',
      });

      const result = await service.uploadFile(mockFile, {
        uploadedById: 'user-1',
        caseStudyId: 'case-study-1',
      });

      expect(prismaService.storedFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseStudyId: 'case-study-1',
          }),
        }),
      );
    });

    it('should throw BadRequestException when file is missing', async () => {
      await expect(service.uploadFile(null as any, {})).rejects.toThrow(BadRequestException);
      await expect(service.uploadFile(null as any, {})).rejects.toThrow('File is required');
    });

    it('should throw BadRequestException when file size exceeds limit', async () => {
      const largeFile = {
        ...mockFile,
        size: 11 * 1024 * 1024, // 11MB
      };

      await expect(service.uploadFile(largeFile, { maxSizeMB: 10 })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.uploadFile(largeFile, { maxSizeMB: 10 })).rejects.toThrow(
        'File size exceeds',
      );
    });

    it('should throw BadRequestException when file type is not allowed', async () => {
      const invalidFile = {
        ...mockFile,
        mimetype: 'application/x-executable',
      };

      await expect(
        service.uploadFile(invalidFile, {
          allowedMimeTypes: ['image/jpeg', 'image/png'],
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.uploadFile(invalidFile, {
          allowedMimeTypes: ['image/jpeg', 'image/png'],
        }),
      ).rejects.toThrow('Invalid file type');
    });

    it('should use custom maxSizeMB', async () => {
      const largeFile = {
        ...mockFile,
        size: 6 * 1024 * 1024, // 6MB
      };

      jest.spyOn(require('crypto'), 'randomUUID').mockReturnValue('550e8400-e29b-41d4-a716-446655440000');

      prismaService.storedFile.create.mockResolvedValue(mockStoredFile);

      // Should succeed with 10MB limit
      await service.uploadFile(largeFile, { maxSizeMB: 10 });

      // Should fail with 5MB limit
      await expect(service.uploadFile(largeFile, { maxSizeMB: 5 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should categorize files correctly', async () => {
      jest.spyOn(require('crypto'), 'randomUUID').mockReturnValue('550e8400-e29b-41d4-a716-446655440000');

      const testCases = [
        { mimetype: 'image/jpeg', expectedCategory: 'IMAGE' },
        { mimetype: 'image/png', expectedCategory: 'IMAGE' },
        { mimetype: 'image/gif', expectedCategory: 'IMAGE' },
        { mimetype: 'application/pdf', expectedCategory: 'DOCUMENT' },
        { mimetype: 'application/msword', expectedCategory: 'DOCUMENT' },
        { mimetype: 'text/plain', expectedCategory: 'DOCUMENT' },
        { mimetype: 'application/octet-stream', expectedCategory: 'OTHER' },
        { mimetype: 'video/mp4', expectedCategory: 'OTHER' },
      ];

      for (const testCase of testCases) {
        const file = { ...mockFile, mimetype: testCase.mimetype };
        prismaService.storedFile.create.mockResolvedValue({
          ...mockStoredFile,
          category: testCase.expectedCategory,
        });

        const result = await service.uploadFile(file, {});
        expect(result.category).toBe(testCase.expectedCategory);
      }
    });
  });

  describe('getFile', () => {
    it('should return file content by ID', async () => {
      prismaService.storedFile.findUnique.mockResolvedValue(mockStoredFile);
      mockedFs.readFile.mockResolvedValue(Buffer.from('file-content'));

      const result = await service.getFile('file-1');

      expect(result.file).toEqual(Buffer.from('file-content'));
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.filename).toBe('test-image.jpg');
      expect(prismaService.storedFile.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
      expect(mockedFs.readFile).toHaveBeenCalledWith(
        expect.stringMatching(/test-storage[\\/]image[\\/]550e8400-e29b-41d4-a716-446655440000\.jpg/),
      );
    });

    it('should throw NotFoundException when file does not exist in database', async () => {
      prismaService.storedFile.findUnique.mockResolvedValue(null);

      await expect(service.getFile('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockedFs.readFile).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when file does not exist on disk', async () => {
      prismaService.storedFile.findUnique.mockResolvedValue(mockStoredFile);
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(service.getFile('file-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFileUrlById', () => {
    it('should return file URL by ID', async () => {
      prismaService.storedFile.findUnique.mockResolvedValue({
        url: '/api/v1/storage/files/image/550e8400-e29b-41d4-a716-446655440000.jpg',
      });

      const result = await service.getFileUrlById('file-1');

      expect(result).toBe('/api/v1/storage/files/image/550e8400-e29b-41d4-a716-446655440000.jpg');
      expect(prismaService.storedFile.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-1' },
        select: { url: true },
      });
    });

    it('should throw NotFoundException when file does not exist', async () => {
      prismaService.storedFile.findUnique.mockResolvedValue(null);

      await expect(service.getFileUrlById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFileByPath', () => {
    it('should return file content by category and stored name', async () => {
      prismaService.storedFile.findFirst.mockResolvedValue(mockStoredFile);
      mockedFs.readFile.mockResolvedValue(Buffer.from('file-content'));

      const result = await service.getFileByPath('image', '550e8400-e29b-41d4-a716-446655440000.jpg');

      expect(result.file).toEqual(Buffer.from('file-content'));
      expect(result.mimeType).toBe('image/jpeg');
      expect(result.filename).toBe('test-image.jpg');
      expect(prismaService.storedFile.findFirst).toHaveBeenCalledWith({
        where: {
          storedName: '550e8400-e29b-41d4-a716-446655440000.jpg',
          category: 'IMAGE',
        },
      });
    });

    it('should use default mimeType when file not found in database', async () => {
      prismaService.storedFile.findFirst.mockResolvedValue(null);
      mockedFs.readFile.mockResolvedValue(Buffer.from('file-content'));

      const result = await service.getFileByPath('image', 'unknown-file.jpg');

      expect(result.mimeType).toBe('application/octet-stream');
      expect(result.filename).toBe('unknown-file.jpg');
    });

    it('should throw NotFoundException when file does not exist on disk', async () => {
      prismaService.storedFile.findFirst.mockResolvedValue(mockStoredFile);
      mockedFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(
        service.getFileByPath('image', '550e8400-e29b-41d4-a716-446655440000.jpg'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteFile', () => {
    it('should delete file from disk and database', async () => {
      prismaService.storedFile.findUnique.mockResolvedValue(mockStoredFile);
      prismaService.storedFile.delete.mockResolvedValue(mockStoredFile);
      mockedFs.unlink.mockResolvedValue(undefined);

      await service.deleteFile('file-1');

      expect(prismaService.storedFile.findUnique).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
      expect(mockedFs.unlink).toHaveBeenCalledWith(
        expect.stringMatching(/test-storage[\\/]image[\\/]550e8400-e29b-41d4-a716-446655440000\.jpg/),
      );
      expect(prismaService.storedFile.delete).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
    });

    it('should continue with database deletion even if disk deletion fails', async () => {
      prismaService.storedFile.findUnique.mockResolvedValue(mockStoredFile);
      prismaService.storedFile.delete.mockResolvedValue(mockStoredFile);
      mockedFs.unlink.mockRejectedValue(new Error('File not found on disk'));

      await service.deleteFile('file-1');

      // Should still delete from database
      expect(prismaService.storedFile.delete).toHaveBeenCalledWith({
        where: { id: 'file-1' },
      });
    });

    it('should throw NotFoundException when file does not exist in database', async () => {
      prismaService.storedFile.findUnique.mockResolvedValue(null);

      await expect(service.deleteFile('nonexistent')).rejects.toThrow(NotFoundException);
      expect(mockedFs.unlink).not.toHaveBeenCalled();
      expect(prismaService.storedFile.delete).not.toHaveBeenCalled();
    });
  });

  describe('listFiles', () => {
    it('should return all files when no filters provided', async () => {
      const mockFiles = [mockStoredFile];
      prismaService.storedFile.findMany.mockResolvedValue(mockFiles);

      const result = await service.listFiles();

      expect(result).toEqual(mockFiles);
      expect(prismaService.storedFile.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    it('should filter by category', async () => {
      prismaService.storedFile.findMany.mockResolvedValue([mockStoredFile]);

      await service.listFiles({ category: 'IMAGE' });

      expect(prismaService.storedFile.findMany).toHaveBeenCalledWith({
        where: { category: 'IMAGE' },
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    it('should filter by blogId', async () => {
      prismaService.storedFile.findMany.mockResolvedValue([mockStoredFile]);

      await service.listFiles({ blogId: 'blog-1' });

      expect(prismaService.storedFile.findMany).toHaveBeenCalledWith({
        where: { blogId: 'blog-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    it('should filter by caseStudyId', async () => {
      prismaService.storedFile.findMany.mockResolvedValue([mockStoredFile]);

      await service.listFiles({ caseStudyId: 'case-study-1' });

      expect(prismaService.storedFile.findMany).toHaveBeenCalledWith({
        where: { caseStudyId: 'case-study-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    it('should filter by uploadedById', async () => {
      prismaService.storedFile.findMany.mockResolvedValue([mockStoredFile]);

      await service.listFiles({ uploadedById: 'user-1' });

      expect(prismaService.storedFile.findMany).toHaveBeenCalledWith({
        where: { uploadedById: 'user-1' },
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });

    it('should combine multiple filters', async () => {
      prismaService.storedFile.findMany.mockResolvedValue([mockStoredFile]);

      await service.listFiles({
        category: 'IMAGE',
        blogId: 'blog-1',
        uploadedById: 'user-1',
      });

      expect(prismaService.storedFile.findMany).toHaveBeenCalledWith({
        where: {
          category: 'IMAGE',
          blogId: 'blog-1',
          uploadedById: 'user-1',
        },
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    });
  });

  describe('initialization', () => {
    it('should initialize storage directories on construction', async () => {
      // Service is already initialized in beforeEach
      // Check that mkdir was called for each category
      expect(mockedFs.mkdir).toHaveBeenCalled();
    });

    it('should use default storage root when not configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: string) => {
        if (key === 'STORAGE_ROOT') return defaultValue;
        if (key === 'STORAGE_PUBLIC_URL_PREFIX') return defaultValue;
        return defaultValue;
      });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          StorageService,
          {
            provide: PrismaService,
            useValue: prismaService,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const newService = module.get<StorageService>(StorageService);
      expect(newService).toBeDefined();
    });
  });
});


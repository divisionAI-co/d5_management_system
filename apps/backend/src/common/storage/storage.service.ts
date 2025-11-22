import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { BaseService } from '../services/base.service';
import { ErrorMessages } from '../constants/error-messages.const';
import { FileCategory, Prisma } from '@prisma/client';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface UploadFileResult {
  id: string;
  filename: string;
  storedName: string;
  mimeType: string;
  size: number;
  category: FileCategory;
  url: string;
  path: string;
}

@Injectable()
export class StorageService extends BaseService {
  private readonly storageRoot: string;
  private readonly publicUrlPrefix: string;

  constructor(
    prisma: PrismaService,
    private configService: ConfigService,
  ) {
    super(prisma);
    this.storageRoot = this.configService.get<string>('STORAGE_ROOT', './storage');
    // Store relative path without /api/v1 - clients will prepend their base URL
    // The actual route is /api/v1/storage/files/:category/:storedName
    // But we store /storage/files/:category/:storedName so clients can construct the full URL
    this.publicUrlPrefix = this.configService.get<string>('STORAGE_PUBLIC_URL_PREFIX', '/storage/files');
    
    // Ensure storage directories exist
    this.initializeStorage();
  }

  private async initializeStorage() {
    try {
      const categories: FileCategory[] = ['IMAGE', 'DOCUMENT', 'OTHER'];
      for (const category of categories) {
        const categoryPath = path.join(this.storageRoot, category.toLowerCase());
        await fs.mkdir(categoryPath, { recursive: true });
      }
      this.logger.log(`Storage initialized at ${this.storageRoot}`);
    } catch (error) {
      this.logger.error('Failed to initialize storage directories', error);
    }
  }

  private getFileCategory(mimeType: string): FileCategory {
    if (mimeType.startsWith('image/')) {
      return 'IMAGE';
    }
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('word') ||
      mimeType.includes('excel') ||
      mimeType.includes('spreadsheet') ||
      mimeType.includes('text')
    ) {
      return 'DOCUMENT';
    }
    return 'OTHER';
  }

  private validateFile(file: Express.Multer.File, allowedMimeTypes?: string[], maxSizeMB: number = 10): void {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `File size exceeds ${maxSizeMB}MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      );
    }

    if (allowedMimeTypes && !allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`,
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    options: {
      uploadedById?: string;
      blogId?: string;
      caseStudyId?: string;
      allowedMimeTypes?: string[];
      maxSizeMB?: number;
    } = {},
  ): Promise<UploadFileResult> {
    const { uploadedById, blogId, caseStudyId, allowedMimeTypes, maxSizeMB = 10 } = options;

    // Validate file
    this.validateFile(file, allowedMimeTypes, maxSizeMB);

    const category = this.getFileCategory(file.mimetype);
    const fileExtension = path.extname(file.originalname);
    const storedName = `${randomUUID()}${fileExtension}`;
    const categoryPath = category.toLowerCase();
    const filePath = path.join(this.storageRoot, categoryPath, storedName);
    const relativePath = path.join(categoryPath, storedName);
    const url = `${this.publicUrlPrefix}/${categoryPath}/${storedName}`;

    // Ensure directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write file to disk
    await fs.writeFile(filePath, file.buffer);

    // Create database record
    const storedFile = await this.prisma.storedFile.create({
      data: {
        filename: file.originalname,
        storedName,
        mimeType: file.mimetype,
        size: file.size,
        category,
        path: relativePath,
        url,
        uploadedById,
        blogId,
        caseStudyId,
      },
    });

    this.logger.log(`File uploaded: ${storedFile.id} (${file.originalname})`);

    return {
      id: storedFile.id,
      filename: storedFile.filename,
      storedName: storedFile.storedName,
      mimeType: storedFile.mimeType,
      size: storedFile.size,
      category: storedFile.category,
      url: storedFile.url,
      path: storedFile.path,
    };
  }

  async getFile(id: string): Promise<{ file: Buffer; mimeType: string; filename: string }> {
    const storedFile = await this.prisma.storedFile.findUnique({
      where: { id },
    });

    if (!storedFile) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('File', id));
    }

    const filePath = path.join(this.storageRoot, storedFile.path);
    
    try {
      const fileBuffer = await fs.readFile(filePath);
      return {
        file: fileBuffer,
        mimeType: storedFile.mimeType,
        filename: storedFile.filename,
      };
    } catch (error) {
      this.logger.error(`Failed to read file: ${filePath}`, error);
      throw new NotFoundException(ErrorMessages.NOT_FOUND('File', storedFile.filename));
    }
  }

  /**
   * Get the public URL for a file by its ID
   * This is useful when you have a file ID and need to construct the URL
   */
  async getFileUrlById(id: string): Promise<string> {
    const storedFile = await this.prisma.storedFile.findUnique({
      where: { id },
      select: { url: true },
    });

    if (!storedFile) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('File', id));
    }

    return storedFile.url;
  }

  async getFileByPath(category: string, storedName: string): Promise<{ file: Buffer; mimeType: string; filename: string }> {
    const filePath = path.join(this.storageRoot, category, storedName);
    
    try {
      // Try to find in database first
      const storedFile = await this.prisma.storedFile.findFirst({
        where: {
          storedName,
          category: category.toUpperCase() as FileCategory,
        },
      });

      const fileBuffer = await fs.readFile(filePath);
      return {
        file: fileBuffer,
        mimeType: storedFile?.mimeType || 'application/octet-stream',
        filename: storedFile?.filename || storedName,
      };
    } catch (error) {
      this.logger.error(`Failed to read file: ${filePath}`, error);
      throw new NotFoundException(ErrorMessages.NOT_FOUND('File', storedName));
    }
  }

  async deleteFile(id: string): Promise<void> {
    const storedFile = await this.prisma.storedFile.findUnique({
      where: { id },
    });

    if (!storedFile) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('File', id));
    }

    const filePath = path.join(this.storageRoot, storedFile.path);

    // Delete from disk
    try {
      await fs.unlink(filePath);
    } catch (error) {
      this.logger.warn(`Failed to delete file from disk: ${filePath}`, error);
      // Continue with database deletion even if disk deletion fails
    }

    // Delete from database
    await this.prisma.storedFile.delete({
      where: { id },
    });

    this.logger.log(`File deleted: ${id} (${storedFile.filename})`);
  }

  async listFiles(filters: {
    category?: FileCategory;
    blogId?: string;
    caseStudyId?: string;
    uploadedById?: string;
  } = {}): Promise<any[]> {
    const where: Prisma.StoredFileWhereInput = {};

    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.blogId) {
      where.blogId = filters.blogId;
    }
    if (filters.caseStudyId) {
      where.caseStudyId = filters.caseStudyId;
    }
    if (filters.uploadedById) {
      where.uploadedById = filters.uploadedById;
    }

    return this.prisma.storedFile.findMany({
      where,
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
  }
}


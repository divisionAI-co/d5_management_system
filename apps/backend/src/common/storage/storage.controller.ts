import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Res,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiResponse, ApiTags, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { Public } from '../decorators/public.decorator';
import { memoryStorage } from 'multer';

// Configure multer for file uploads (images and documents)
const imageMulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 1,
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files are allowed.'), false);
    }
  },
};

@ApiTags('Storage')
@Controller({ path: 'storage', version: '1' })
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a file (image or document)',
    description: 'Uploads a file and stores it. Returns file metadata including public URL.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File to upload (images: jpg, png, gif, webp, svg; documents: pdf, doc, docx, txt)',
        },
        blogId: {
          type: 'string',
          format: 'uuid',
          description: 'Optional: Associate file with a blog',
        },
        caseStudyId: {
          type: 'string',
          format: 'uuid',
          description: 'Optional: Associate file with a case study',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        filename: { type: 'string' },
        storedName: { type: 'string' },
        mimeType: { type: 'string' },
        size: { type: 'number' },
        category: { type: 'string', enum: ['IMAGE', 'DOCUMENT', 'OTHER'] },
        url: { type: 'string', format: 'uri' },
        path: { type: 'string' },
      },
    },
  })
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
    @CurrentUser('id') userId: string,
  ) {
    // Extract form fields from multipart/form-data request
    const blogId = req.body?.blogId;
    const caseStudyId = req.body?.caseStudyId;
    
    return this.storageService.uploadFile(file, {
      uploadedById: userId,
      blogId: blogId || undefined,
      caseStudyId: caseStudyId || undefined,
    });
  }

  @Get('files/:category/:storedName')
  @Public()
  @ApiOperation({
    summary: 'Get a file by category and stored name (public access)',
    description: 'Retrieves a file for public access. No authentication required.',
  })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFile(
    @Param('category') category: string,
    @Param('storedName') storedName: string,
    @Res() res: Response,
  ) {
    const { file, mimeType, filename } = await this.storageService.getFileByPath(category, storedName);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(file);
  }

  @Get('files/id/:id')
  @Public()
  @ApiOperation({
    summary: 'Get a file by ID (public access)',
    description: 'Retrieves a file by its database ID. No authentication required.',
  })
  @ApiResponse({ status: 200, description: 'File content' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async getFileById(@Param('id') id: string, @Res() res: Response) {
    const { file, mimeType, filename } = await this.storageService.getFile(id);
    
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(file);
  }

  @Get('list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List stored files',
    description: 'Lists files with optional filtering.',
  })
  @ApiQuery({ name: 'category', required: false, enum: ['IMAGE', 'DOCUMENT', 'OTHER'] })
  @ApiQuery({ name: 'blogId', required: false, type: String })
  @ApiQuery({ name: 'caseStudyId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'List of files' })
  async listFiles(
    @Query('category') category?: string,
    @Query('blogId') blogId?: string,
    @Query('caseStudyId') caseStudyId?: string,
  ) {
    return this.storageService.listFiles({
      category: category as any,
      blogId,
      caseStudyId,
    });
  }

  @Delete('files/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a file',
    description: 'Deletes a file from storage and database.',
  })
  @ApiResponse({ status: 200, description: 'File deleted successfully' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(@Param('id') id: string) {
    await this.storageService.deleteFile(id);
    return { message: 'File deleted successfully' };
  }
}


import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CaseStudiesService } from './case-studies.service';
import { CreateCaseStudyDto } from './dto/create-case-study.dto';
import { UpdateCaseStudyDto } from './dto/update-case-study.dto';
import { FilterCaseStudiesDto } from './dto/filter-case-studies.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';
import { StorageService } from '../../../common/storage/storage.service';

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

@ApiTags('Content - Case Studies')
@Controller('content/case-studies')
export class CaseStudiesController {
  constructor(
    private readonly caseStudiesService: CaseStudiesService,
    private readonly storageService: StorageService,
  ) {}

  // ============================================
  // PUBLIC ENDPOINTS (for website showcase)
  // ============================================

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'List published case studies for public website (no authentication required)',
    description: 'Returns only published case studies suitable for public display.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of published case studies',
  })
  findAllPublic(@Query() filters: FilterCaseStudiesDto) {
    // Override status to only show published case studies
    return this.caseStudiesService.findAll({
      ...filters,
      status: 'PUBLISHED' as any,
    });
  }

  @Public()
  @Get('public/:slug')
  @ApiOperation({
    summary: 'Get a specific case study by slug for public website (no authentication required)',
    description: 'Returns case study details suitable for public display. Only returns published case studies.',
  })
  @ApiResponse({
    status: 200,
    description: 'Case study details',
  })
  @ApiResponse({ status: 404, description: 'Case study not found' })
  findOnePublic(@Param('slug') slug: string) {
    return this.caseStudiesService.findBySlug(slug, true);
  }

  // ============================================
  // PROTECTED ENDPOINTS (for content management)
  // ============================================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new case study',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 201,
    description: 'Case study created successfully',
  })
  create(@Body() createDto: CreateCaseStudyDto, @CurrentUser('id') userId: string) {
    return this.caseStudiesService.create(createDto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all case studies (with filters)',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of case studies',
  })
  findAll(@Query() filters: FilterCaseStudiesDto, @CurrentUser('id') userId?: string) {
    return this.caseStudiesService.findAll(filters, userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a specific case study by ID',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Case study details',
  })
  @ApiResponse({ status: 404, description: 'Case study not found' })
  findOne(@Param('id') id: string) {
    return this.caseStudiesService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a case study',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Case study updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Case study not found' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCaseStudyDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.caseStudiesService.update(id, updateDto, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a case study',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Case study deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Case study not found' })
  remove(@Param('id') id: string) {
    return this.caseStudiesService.remove(id);
  }

  @Post(':id/upload-image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file', imageMulterOptions))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload an image for a case study',
    description: 'Uploads an image and associates it with a case study. Returns the file URL.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file to upload',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded successfully',
  })
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    // Verify case study exists
    await this.caseStudiesService.findOne(id);
    
    const result = await this.storageService.uploadFile(file, {
      uploadedById: userId,
      caseStudyId: id,
      allowedMimeTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ],
      maxSizeMB: 10,
    });

    return result;
  }
}


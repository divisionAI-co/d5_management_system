import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { FilterBlogsDto } from './dto/filter-blogs.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Content - Blogs')
@Controller('content/blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  // ============================================
  // PUBLIC ENDPOINTS (for website showcase)
  // ============================================

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'List published blogs for public website (no authentication required)',
    description: 'Returns only published blogs suitable for public display.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of published blogs',
  })
  findAllPublic(@Query() filters: FilterBlogsDto) {
    // Override status to only show published blogs
    return this.blogsService.findAll({
      ...filters,
      status: 'PUBLISHED' as any,
    });
  }

  @Public()
  @Get('public/:slug')
  @ApiOperation({
    summary: 'Get a specific blog by slug for public website (no authentication required)',
    description: 'Returns blog details suitable for public display. Only returns published blogs.',
  })
  @ApiResponse({
    status: 200,
    description: 'Blog details',
  })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  findOnePublic(@Param('slug') slug: string) {
    return this.blogsService.findBySlug(slug, true);
  }

  // ============================================
  // PROTECTED ENDPOINTS (for content management)
  // ============================================

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new blog post',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 201,
    description: 'Blog created successfully',
  })
  create(@Body() createDto: CreateBlogDto, @CurrentUser('id') userId: string) {
    return this.blogsService.create(createDto, userId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all blogs (with filters)',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of blogs',
  })
  findAll(@Query() filters: FilterBlogsDto, @CurrentUser('id') userId?: string) {
    return this.blogsService.findAll(filters, userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get a specific blog by ID',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Blog details',
  })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  findOne(@Param('id') id: string) {
    return this.blogsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a blog post',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Blog updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateBlogDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.blogsService.update(id, updateDto, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CONTENT_EDITOR)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a blog post',
    description: 'Only accessible by ADMIN and CONTENT_EDITOR roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Blog deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Blog not found' })
  remove(@Param('id') id: string) {
    return this.blogsService.remove(id);
  }
}


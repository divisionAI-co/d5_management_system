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
import { OpenPositionsService } from './positions.service';
import { FilterPositionsDto } from './dto/filter-positions.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { ClosePositionDto } from './dto/close-position.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { CreatePositionDto } from './dto/create-position.dto';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Recruitment - Positions')
@Controller('recruitment/positions')
export class OpenPositionsController {
  constructor(private readonly positionsService: OpenPositionsService) {}

  // ============================================
  // PUBLIC ENDPOINTS (for website showcase)
  // ============================================

  @Public()
  @Get('public')
  @ApiOperation({
    summary: 'List open positions for public website (no authentication required)',
    description: 'Returns only open, non-archived positions suitable for public display. No sensitive candidate information is included.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of open positions',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              title: { type: 'string' },
              description: { type: 'string' },
              requirements: { type: 'string', nullable: true },
              status: { type: 'string', enum: ['Open'] },
              recruitmentStatus: { type: 'string', nullable: true },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            pageSize: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  })
  findAllPublic(@Query() filters: FilterPositionsDto) {
    return this.positionsService.findAllPublic(filters);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({
    summary: 'Get a specific position for public website (no authentication required)',
    description: 'Returns position details suitable for public display. No sensitive candidate information is included.',
  })
  @ApiResponse({
    status: 200,
    description: 'Position details',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        description: { type: 'string' },
        requirements: { type: 'string', nullable: true },
        status: { type: 'string', enum: ['Open'] },
        recruitmentStatus: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Position not found or not open' })
  findOnePublic(@Param('id') id: string) {
    return this.positionsService.findOnePublic(id);
  }

  // ============================================
  // PROTECTED ENDPOINTS (require authentication)
  // ============================================

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'List open positions with optional filters and pagination',
  })
  findAll(@Query() filters: FilterPositionsDto) {
    return this.positionsService.findAll(filters);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Create a new job position' })
  create(@Body() createDto: CreatePositionDto) {
    return this.positionsService.create(createDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Get details for a specific position' })
  findOne(@Param('id') id: string) {
    return this.positionsService.findOne(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Update position metadata' })
  update(@Param('id') id: string, @Body() updateDto: UpdatePositionDto) {
    return this.positionsService.update(id, updateDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get(':id/candidates')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'List candidates linked to the specified position',
  })
  getCandidates(@Param('id') id: string) {
    return this.positionsService.getCandidates(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post(':id/close')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Mark a position as filled' })
  close(@Param('id') id: string, @Body() closeDto: ClosePositionDto) {
    return this.positionsService.close(id, closeDto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/archive')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'Archive a job position',
    description: 'Archives a position by setting isArchived to true. Archived positions are excluded from normal queries by default.',
  })
  archive(@Param('id') id: string) {
    return this.positionsService.archive(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch(':id/unarchive')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({
    summary: 'Unarchive a job position',
    description: 'Restores an archived position by setting isArchived to false.',
  })
  unarchive(@Param('id') id: string) {
    return this.positionsService.unarchive(id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.RECRUITER, UserRole.HR)
  @ApiOperation({ summary: 'Delete a job position' })
  remove(@Param('id') id: string) {
    return this.positionsService.remove(id);
  }
}



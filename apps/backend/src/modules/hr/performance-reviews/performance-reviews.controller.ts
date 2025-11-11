import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PerformanceReviewsService } from './performance-reviews.service';
import { CreatePerformanceReviewDto } from './dto/create-performance-review.dto';
import { UpdatePerformanceReviewDto } from './dto/update-performance-review.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('HR - Performance Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/performance-reviews')
export class PerformanceReviewsController {
  constructor(private readonly reviewsService: PerformanceReviewsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new performance review' })
  create(@Body() createReviewDto: CreatePerformanceReviewDto) {
    return this.reviewsService.create(createReviewDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get all performance reviews' })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  findAll(
    @Query('employeeId') employeeId?: string,
  ) {
    const filters: any = {};
    
    if (employeeId) {
      filters.employeeId = employeeId;
    }

    return this.reviewsService.findAll(filters);
  }

  @Get('upcoming')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get employees needing upcoming reviews' })
  @ApiQuery({ name: 'daysAhead', required: false, type: Number })
  getUpcoming(@Query('daysAhead') daysAhead?: string) {
    const days = daysAhead ? parseInt(daysAhead, 10) : 30;
    return this.reviewsService.getUpcomingReviews(days);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Get performance review by ID' })
  findOne(@Param('id') id: string) {
    return this.reviewsService.findOne(id);
  }

  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Download performance review as PDF' })
  async downloadPdf(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const pdf = await this.reviewsService.generatePdf(id);
    const review = await this.reviewsService.findOne(id);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=performance-review-${review.id}.pdf`,
      'Content-Length': pdf.length,
    });

    res.end(pdf);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Update performance review' })
  update(
    @Param('id') id: string,
    @Body() updateReviewDto: UpdatePerformanceReviewDto,
  ) {
    return this.reviewsService.update(id, updateReviewDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Delete performance review' })
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}


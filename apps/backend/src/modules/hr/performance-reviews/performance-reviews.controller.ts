import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Query,
  Res,
  UseGuards,
  Request,
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
import { EmployeesService } from '../employees/employees.service';

@ApiTags('HR - Performance Reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('hr/performance-reviews')
export class PerformanceReviewsController {
  constructor(
    private readonly reviewsService: PerformanceReviewsService,
    private readonly employeesService: EmployeesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new performance review' })
  async create(
    @Request() req: any,
    @Body() createReviewDto: CreatePerformanceReviewDto,
  ) {
    const user = req.user;

    if (user.role === UserRole.ADMIN || user.role === UserRole.HR) {
      return this.reviewsService.create(createReviewDto);
    }

    if (user.role === UserRole.ACCOUNT_MANAGER) {
      const manager = await this.employeesService.findByUserId(user.id);
      const targetEmployee = await this.employeesService.findOne(createReviewDto.employeeId);

      if (targetEmployee.managerId !== manager.id) {
        throw new ForbiddenException('Managers can only review their direct reports.');
      }

      return this.reviewsService.create(createReviewDto);
    }

    throw new ForbiddenException('You are not allowed to create performance reviews.');
  }

  @Get()
  @ApiOperation({ summary: 'Get all performance reviews' })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  async findAll(
    @Request() req: any,
    @Query('employeeId') employeeId?: string,
  ) {
    const user = req.user;

    if (user.role === UserRole.ADMIN || user.role === UserRole.HR) {
      return this.reviewsService.findAll(employeeId ? { employeeId } : undefined);
    }

    let viewer;
    try {
      viewer = await this.employeesService.findByUserId(user.id);
    } catch (error) {
      throw new ForbiddenException('You are not allowed to view performance reviews.');
    }

    if (!employeeId || employeeId === viewer.id) {
      return this.reviewsService.findAll({ employeeId: viewer.id });
    }

    const targetEmployee = await this.employeesService.findOne(employeeId);

    if (targetEmployee.managerId !== viewer.id) {
      throw new ForbiddenException('You are not allowed to view reviews for this employee.');
    }

    return this.reviewsService.findAll({ employeeId });
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
  @ApiOperation({ summary: 'Get performance review by ID' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    const user = req.user;
    const review = await this.reviewsService.findOne(id);

    if (user.role === UserRole.ADMIN || user.role === UserRole.HR) {
      return review;
    }

    let viewer;
    try {
      viewer = await this.employeesService.findByUserId(user.id);
    } catch (error) {
      throw new ForbiddenException('You are not allowed to view this performance review.');
    }

    if (review.employeeId === viewer.id) {
      return review;
    }

    if (review.employee?.managerId === viewer.id) {
      return review;
    }

    throw new ForbiddenException('You are not allowed to view this performance review.');
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


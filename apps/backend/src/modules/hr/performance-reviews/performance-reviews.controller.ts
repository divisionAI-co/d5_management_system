import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
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

  private isPrivileged(role: UserRole) {
    return role === UserRole.ADMIN || role === UserRole.HR;
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new performance review' })
  create(@Body() createReviewDto: CreatePerformanceReviewDto) {
    return this.reviewsService.create(createReviewDto);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON, UserRole.RECRUITER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get performance reviews' })
  @ApiQuery({ name: 'employeeId', required: false, type: String })
  async findAll(@Request() req: any, @Query('employeeId') employeeId?: string) {
    const user = req.user;

    if (this.isPrivileged(user.role)) {
      return this.reviewsService.findAll(employeeId ? { employeeId } : undefined);
    }

    const employee = await this.employeesService.findByUserId(user.id);

    if (employeeId && employeeId !== employee.id) {
      throw new ForbiddenException('You are not allowed to view reviews for this employee.');
    }

    return this.reviewsService.findAll({ employeeId: employee.id });
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
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON, UserRole.RECRUITER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Get performance review by ID' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    const review = await this.reviewsService.findOne(id);

    if (this.isPrivileged(req.user.role)) {
      return review;
    }

    const employee = await this.employeesService.findByUserId(req.user.id);

    if (review.employeeId !== employee.id) {
      throw new ForbiddenException('You are not allowed to view this performance review.');
    }

    return review;
  }

  @Get(':id/pdf')
  @Roles(UserRole.ADMIN, UserRole.HR, UserRole.ACCOUNT_MANAGER, UserRole.SALESPERSON, UserRole.RECRUITER, UserRole.EMPLOYEE)
  @ApiOperation({ summary: 'Download performance review as PDF' })
  async downloadPdf(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const review = await this.reviewsService.findOne(id);

    if (!this.isPrivileged(req.user.role)) {
      const employee = await this.employeesService.findByUserId(req.user.id);

      if (review.employeeId !== employee.id) {
        throw new ForbiddenException('You are not allowed to download this performance review.');
      }
    }

    const pdf = await this.reviewsService.generatePdf(id);

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


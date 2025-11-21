import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  Res,
} from '@nestjs/common';
import { RecruiterPerformanceReportsService } from './recruiter-performance-reports.service';
import { CreateRecruiterPerformanceReportDto } from './dto/create-recruiter-performance-report.dto';
import { UpdateRecruiterPerformanceReportDto } from './dto/update-recruiter-performance-report.dto';
import { FilterRecruiterPerformanceReportsDto } from './dto/filter-recruiter-performance-reports.dto';
import { SendRecruiterPerformanceReportDto } from './dto/send-report.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Recruiter Performance Reports')
@ApiBearerAuth()
@Controller('recruiter-performance-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecruiterPerformanceReportsController {
  constructor(
    private readonly recruiterPerformanceReportsService: RecruiterPerformanceReportsService,
  ) {}

  @Post()
  @Roles(UserRole.RECRUITER, UserRole.ADMIN, UserRole.HR)
  @ApiOperation({ summary: 'Create a new recruiter performance report' })
  create(@Body() createDto: CreateRecruiterPerformanceReportDto, @Request() req: any) {
    // Use the authenticated user's ID as the recruiter ID
    return this.recruiterPerformanceReportsService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all recruiter performance reports',
    description:
      'Recruiters can only see their own reports. Admins and HR can see all reports.',
  })
  findAll(@Query() filters: FilterRecruiterPerformanceReportsDto, @Request() req: any) {
    return this.recruiterPerformanceReportsService.findAll(
      filters,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific recruiter performance report',
    description: 'Recruiters can only view their own reports.',
  })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.recruiterPerformanceReportsService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.RECRUITER, UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Update a recruiter performance report',
    description: 'Recruiters can only update their own reports.',
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateRecruiterPerformanceReportDto,
    @Request() req: any,
  ) {
    return this.recruiterPerformanceReportsService.update(id, updateDto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.RECRUITER, UserRole.ADMIN, UserRole.HR)
  @ApiOperation({
    summary: 'Delete a recruiter performance report',
    description: 'Recruiters can only delete their own reports. Admins and HR can delete any report.',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.recruiterPerformanceReportsService.remove(id, req.user.id, req.user.role);
  }

  @Get(':id/pdf/internal')
  @ApiOperation({ summary: 'Generate internal PDF of the recruiter performance report' })
  async downloadInternalPdf(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.recruiterPerformanceReportsService.generatePdf(
      id,
      req.user.id,
      req.user.role,
      'internal',
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=recruiter-performance-report-internal-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  @Get(':id/pdf/customer')
  @ApiOperation({ summary: 'Generate customer PDF of the recruiter performance report' })
  async downloadCustomerPdf(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.recruiterPerformanceReportsService.generatePdf(
      id,
      req.user.id,
      req.user.role,
      'customer',
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=recruiter-performance-report-customer-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  @Get(':id/preview')
  @ApiQuery({ name: 'templateId', required: false, type: String })
  @ApiQuery({ name: 'type', required: false, enum: ['internal', 'customer'] })
  @ApiOperation({ summary: 'Preview the recruiter performance report as HTML' })
  async preview(
    @Param('id') id: string,
    @Query('templateId') templateId: string | undefined,
    @Query('type') type: 'internal' | 'customer' | undefined,
    @Request() req: any,
  ) {
    return this.recruiterPerformanceReportsService.preview(
      id,
      req.user.id,
      req.user.role,
      templateId,
      type,
    );
  }

  @Post(':id/send')
  @Roles(UserRole.RECRUITER, UserRole.ADMIN, UserRole.HR, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({
    summary: 'Send the recruiter performance report to customer via email',
    description: 'Available to Recruiters, HR, Admins, and Account Managers.',
  })
  async sendToCustomer(
    @Param('id') id: string,
    @Body() sendDto: SendRecruiterPerformanceReportDto,
    @Request() req: any,
  ) {
    return this.recruiterPerformanceReportsService.sendToCustomer(
      id,
      sendDto,
      req.user.id,
      req.user.role,
    );
  }
}


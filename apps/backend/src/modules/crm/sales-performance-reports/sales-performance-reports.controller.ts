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
import { SalesPerformanceReportsService } from './sales-performance-reports.service';
import { CreateSalesPerformanceReportDto } from './dto/create-sales-performance-report.dto';
import { UpdateSalesPerformanceReportDto } from './dto/update-sales-performance-report.dto';
import { FilterSalesPerformanceReportsDto } from './dto/filter-sales-performance-reports.dto';
import { PreviewSalesPerformanceReportDto } from './dto/preview-sales-performance-report.dto';
import { SendSalesPerformanceReportDto } from './dto/send-sales-performance-report.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Sales Performance Reports')
@ApiBearerAuth()
@Controller('sales-performance-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesPerformanceReportsController {
  constructor(
    private readonly salesPerformanceReportsService: SalesPerformanceReportsService,
  ) {}

  @Post()
  @Roles(UserRole.SALESPERSON, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new sales performance report' })
  create(@Body() createDto: CreateSalesPerformanceReportDto, @Request() req: any) {
    // Use the authenticated user's ID as the salesperson ID
    return this.salesPerformanceReportsService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all sales performance reports',
    description:
      'Salespeople can only see their own reports. Admins can see all reports.',
  })
  findAll(@Query() filters: FilterSalesPerformanceReportsDto, @Request() req: any) {
    return this.salesPerformanceReportsService.findAll(
      filters,
      req.user.id,
      req.user.role,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a specific sales performance report',
    description: 'Salespeople can only view their own reports.',
  })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.salesPerformanceReportsService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.SALESPERSON, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a sales performance report',
    description: 'Salespeople can only update their own reports.',
  })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateSalesPerformanceReportDto,
    @Request() req: any,
  ) {
    return this.salesPerformanceReportsService.update(id, updateDto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.SALESPERSON, UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a sales performance report',
    description: 'Salespeople can only delete their own reports. Admins can delete any report.',
  })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.salesPerformanceReportsService.remove(id, req.user.id, req.user.role);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generate PDF of the sales performance report' })
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.salesPerformanceReportsService.generatePdf(
      id,
      req.user.id,
      req.user.role,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=sales-performance-report-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  @Post(':id/preview')
  @ApiOperation({ summary: 'Preview sales performance report HTML based on template' })
  async preview(
    @Param('id') id: string,
    @Body() previewDto: PreviewSalesPerformanceReportDto,
    @Request() req: any,
  ) {
    return this.salesPerformanceReportsService.preview(
      id,
      req.user.id,
      req.user.role,
      previewDto,
    );
  }

  @Post(':id/send')
  @Roles(UserRole.SALESPERSON, UserRole.ADMIN)
  @ApiOperation({ summary: 'Send sales performance report via email' })
  async send(
    @Param('id') id: string,
    @Body() sendDto: SendSalesPerformanceReportDto,
    @Request() req: any,
  ) {
    return this.salesPerformanceReportsService.send(
      id,
      req.user.id,
      req.user.role,
      sendDto,
    );
  }
}


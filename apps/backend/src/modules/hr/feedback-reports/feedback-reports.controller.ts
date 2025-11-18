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
import { FeedbackReportsService } from './feedback-reports.service';
import { CreateFeedbackReportDto } from './dto/create-feedback-report.dto';
import { UpdateHrSectionDto } from './dto/update-hr-section.dto';
import { UpdateAmSectionDto } from './dto/update-am-section.dto';
import { UpdateEmployeeSectionDto } from './dto/update-employee-section.dto';
import { FilterFeedbackReportsDto } from './dto/filter-feedback-reports.dto';
import { SendReportDto } from './dto/send-report.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';

@ApiTags('Feedback Reports')
@ApiBearerAuth()
@Controller('feedback-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FeedbackReportsController {
  constructor(private readonly feedbackReportsService: FeedbackReportsService) {}

  @Post()
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new feedback report (HR only)' })
  create(@Body() createDto: CreateFeedbackReportDto, @Request() req: any) {
    return this.feedbackReportsService.create(createDto, req.user.id);
  }

  @Get()
  @ApiOperation({ 
    summary: 'Get all feedback reports', 
    description: 'Employees can only see their own reports. HR/Admin can see all reports.' 
  })
  findAll(@Query() filters: FilterFeedbackReportsDto, @Request() req: any) {
    return this.feedbackReportsService.findAll(filters, req.user.id, req.user.role);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Get a specific feedback report', 
    description: 'Employees can only view their own reports.' 
  })
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.feedbackReportsService.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id/hr-section')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update HR section of a feedback report (HR only)' })
  updateHrSection(
    @Param('id') id: string,
    @Body() updateDto: UpdateHrSectionDto,
    @Request() req: any,
  ) {
    return this.feedbackReportsService.updateHrSection(id, updateDto, req.user.id);
  }

  @Patch(':id/am-section')
  @Roles(UserRole.ACCOUNT_MANAGER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update Account Manager section of a feedback report (AM only)' })
  updateAmSection(
    @Param('id') id: string,
    @Body() updateDto: UpdateAmSectionDto,
    @Request() req: any,
  ) {
    return this.feedbackReportsService.updateAmSection(id, updateDto, req.user.id);
  }

  @Patch(':id/employee-section')
  @ApiOperation({ summary: 'Update employee section of a feedback report (Employee only)' })
  updateEmployeeSection(
    @Param('id') id: string,
    @Body() updateDto: UpdateEmployeeSectionDto,
    @Request() req: any,
  ) {
    return this.feedbackReportsService.updateEmployeeSection(id, updateDto, req.user.id);
  }

  @Post(':id/submit')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Submit a feedback report for review (HR only)' })
  submit(@Param('id') id: string, @Request() req: any) {
    return this.feedbackReportsService.submit(id, req.user.id, req.user.role);
  }

  @Post(':id/recompile')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Recompile auto-calculated data for a report (HR only)', 
    description: 'Recalculates tasks count, days off, and bank holidays' 
  })
  recompile(@Param('id') id: string, @Request() req: any) {
    return this.feedbackReportsService.recompile(id, req.user.id, req.user.role);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Preview the feedback report as HTML' })
  preview(@Param('id') id: string, @Request() req: any) {
    return this.feedbackReportsService.preview(id, req.user.id, req.user.role);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Generate PDF of the feedback report' })
  async downloadPdf(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.feedbackReportsService.generatePdf(
      id,
      req.user.id,
      req.user.role,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=feedback-report-${id}.pdf`,
      'Content-Length': pdfBuffer.length,
    });

    res.send(pdfBuffer);
  }

  @Post(':id/send')
  @Roles(UserRole.HR, UserRole.ADMIN, UserRole.ACCOUNT_MANAGER)
  @ApiOperation({ 
    summary: 'Send the feedback report to customer via email', 
    description: 'Only submitted reports can be sent. Available to HR and Account Managers.' 
  })
  sendToCustomer(
    @Param('id') id: string,
    @Body() sendDto: SendReportDto,
    @Request() req: any,
  ) {
    return this.feedbackReportsService.sendToCustomer(id, sendDto, req.user.id, req.user.role);
  }

  @Delete(':id')
  @Roles(UserRole.HR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a feedback report (HR only)' })
  remove(@Param('id') id: string, @Request() req: any) {
    return this.feedbackReportsService.remove(id, req.user.id, req.user.role);
  }
}


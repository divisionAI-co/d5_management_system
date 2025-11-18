import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { FeedbackReportStatus, LeaveRequestStatus, TaskStatus, UserRole, Prisma, TemplateType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateFeedbackReportDto } from './dto/create-feedback-report.dto';
import { UpdateHrSectionDto } from './dto/update-hr-section.dto';
import { UpdateAmSectionDto } from './dto/update-am-section.dto';
import { UpdateEmployeeSectionDto } from './dto/update-employee-section.dto';
import { FilterFeedbackReportsDto } from './dto/filter-feedback-reports.dto';
import { SendReportDto } from './dto/send-report.dto';
import { PdfService } from '../../../common/pdf/pdf.service';
import { EmailService } from '../../../common/email/email.service';
import { TemplatesService } from '../../templates/templates.service';

@Injectable()
export class FeedbackReportsService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
    private emailService: EmailService,
    private templatesService: TemplatesService,
  ) {}

  private readonly reportInclude = {
    employee: {
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    },
    hrUpdatedByUser: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    },
    amUpdatedByUser: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    },
  } as const;

  /**
   * Calculate the number of tasks an employee worked on during a specific month
   */
  private async calculateTasksCount(employeeId: string, month: number, year: number): Promise<number> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true },
    });

    if (!employee) {
      return 0;
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Count tasks where the user was assigned or created them and had activity during the month
    const tasksCount = await this.prisma.task.count({
      where: {
        AND: [
          {
            OR: [
              { assignedToId: employee.userId },
              { createdById: employee.userId },
            ],
          },
          {
            OR: [
              {
                // Tasks updated during the month
                updatedAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
              {
                // Tasks completed during the month
                completedAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            ],
          },
        ],
      },
    });

    return tasksCount;
  }

  /**
   * Calculate total days off taken in a specific month
   */
  private async calculateDaysOffTaken(employeeId: string, month: number, year: number): Promise<number> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveRequestStatus.APPROVED,
        OR: [
          {
            AND: [
              { startDate: { lte: endDate } },
              { endDate: { gte: startDate } },
            ],
          },
        ],
      },
      select: {
        startDate: true,
        endDate: true,
        totalDays: true,
      },
    });

    // Calculate overlapping days within the month
    let totalDays = 0;
    for (const request of leaveRequests) {
      const requestStart = new Date(request.startDate);
      const requestEnd = new Date(request.endDate);
      
      const overlapStart = requestStart < startDate ? startDate : requestStart;
      const overlapEnd = requestEnd > endDate ? endDate : requestEnd;
      
      const diffTime = overlapEnd.getTime() - overlapStart.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      totalDays += diffDays;
    }

    return totalDays;
  }

  /**
   * Calculate remaining days off for an employee
   */
  private async calculateRemainingDaysOff(employeeId: string, year: number): Promise<number> {
    const settings = await this.prisma.companySettings.findFirst({
      select: {
        annualLeaveAllowanceDays: true,
      },
    });

    const annualAllowance = settings?.annualLeaveAllowanceDays ?? 20;

    // Get all approved leave requests for the year
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const leaveRequests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveRequestStatus.APPROVED,
        startDate: { gte: startOfYear },
        endDate: { lte: endOfYear },
      },
      select: {
        totalDays: true,
      },
    });

    const usedDays = leaveRequests.reduce((sum, req) => sum + req.totalDays, 0);
    return Math.max(0, annualAllowance - usedDays);
  }

  /**
   * Get bank holidays for the next month
   */
  private async getBankHolidaysForNextMonth(month: number, year: number): Promise<any[]> {
    // Calculate next month
    let nextMonth = month + 1;
    let nextYear = year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }

    const startDate = new Date(nextYear, nextMonth - 1, 1);
    const endDate = new Date(nextYear, nextMonth, 0);

    const holidays = await this.prisma.nationalHoliday.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        name: true,
        date: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    return holidays.map(h => ({
      name: h.name,
      date: h.date.toISOString().split('T')[0],
    }));
  }

  /**
   * Auto-compile all data for a report
   */
  private async autoCompileData(employeeId: string, month: number, year: number) {
    const [tasksCount, totalDaysOffTaken, totalRemainingDaysOff, bankHolidays] = await Promise.all([
      this.calculateTasksCount(employeeId, month, year),
      this.calculateDaysOffTaken(employeeId, month, year),
      this.calculateRemainingDaysOff(employeeId, year),
      this.getBankHolidaysForNextMonth(month, year),
    ]);

    return {
      tasksCount,
      totalDaysOffTaken,
      totalRemainingDaysOff,
      bankHolidays,
    };
  }

  /**
   * Create a new feedback report
   */
  async create(createDto: CreateFeedbackReportDto, userId: string) {
    // Check if employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: createDto.employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${createDto.employeeId} not found`);
    }

    // Check if report already exists for this employee/month/year
    const existing = await this.prisma.feedbackReport.findUnique({
      where: {
        employeeId_month_year: {
          employeeId: createDto.employeeId,
          month: createDto.month,
          year: createDto.year,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A feedback report for this employee in ${createDto.month}/${createDto.year} already exists`,
      );
    }

    // Auto-compile data
    const compiledData = await this.autoCompileData(
      createDto.employeeId,
      createDto.month,
      createDto.year,
    );

    // Create report
    const report = await this.prisma.feedbackReport.create({
      data: {
        employeeId: createDto.employeeId,
        month: createDto.month,
        year: createDto.year,
        tasksCount: compiledData.tasksCount,
        totalDaysOffTaken: compiledData.totalDaysOffTaken,
        totalRemainingDaysOff: compiledData.totalRemainingDaysOff,
        bankHolidays: compiledData.bankHolidays as Prisma.InputJsonValue,
        status: FeedbackReportStatus.DRAFT,
      },
      include: this.reportInclude,
    });

    return report;
  }

  /**
   * Find all feedback reports with filters
   */
  async findAll(filters: FilterFeedbackReportsDto, userId: string, userRole: UserRole) {
    const where: Prisma.FeedbackReportWhereInput = {};

    // Role-based access control
    if (userRole === UserRole.EMPLOYEE) {
      // Employees can only see their own reports
      const employee = await this.prisma.employee.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!employee) {
        return [];
      }

      where.employeeId = employee.id;
    } else if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.month) {
      where.month = filters.month;
    }

    if (filters.year) {
      where.year = filters.year;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    const reports = await this.prisma.feedbackReport.findMany({
      where,
      include: this.reportInclude,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' },
      ],
    });

    return reports;
  }

  /**
   * Find one feedback report by ID
   */
  async findOne(id: string, userId: string, userRole: UserRole) {
    const report = await this.prisma.feedbackReport.findUnique({
      where: { id },
      include: this.reportInclude,
    });

    if (!report) {
      throw new NotFoundException(`Feedback report with ID ${id} not found`);
    }

    // Role-based access control
    if (userRole === UserRole.EMPLOYEE) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId },
        select: { id: true },
      });

      if (!employee || report.employeeId !== employee.id) {
        throw new ForbiddenException('You can only view your own feedback reports');
      }
    }

    return report;
  }

  /**
   * Update HR section (only HR can do this)
   */
  async updateHrSection(id: string, updateDto: UpdateHrSectionDto, userId: string) {
    const report = await this.prisma.feedbackReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Feedback report with ID ${id} not found`);
    }

    if (report.status === FeedbackReportStatus.SENT) {
      throw new ForbiddenException('Cannot update a report that has already been sent');
    }

    const updatedReport = await this.prisma.feedbackReport.update({
      where: { id },
      data: {
        ...updateDto,
        hrUpdatedAt: new Date(),
        hrUpdatedBy: userId,
      },
      include: this.reportInclude,
    });

    return updatedReport;
  }

  /**
   * Update Account Manager section (only Account Manager can do this)
   */
  async updateAmSection(id: string, updateDto: UpdateAmSectionDto, userId: string) {
    const report = await this.prisma.feedbackReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Feedback report with ID ${id} not found`);
    }

    if (report.status === FeedbackReportStatus.SENT) {
      throw new ForbiddenException('Cannot update a report that has already been sent');
    }

    const updatedReport = await this.prisma.feedbackReport.update({
      where: { id },
      data: {
        ...updateDto,
        amUpdatedAt: new Date(),
        amUpdatedBy: userId,
      },
      include: this.reportInclude,
    });

    return updatedReport;
  }

  /**
   * Update Employee section (only the employee can do this)
   */
  async updateEmployeeSection(
    id: string,
    updateDto: UpdateEmployeeSectionDto,
    userId: string,
  ) {
    const report = await this.prisma.feedbackReport.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!report) {
      throw new NotFoundException(`Feedback report with ID ${id} not found`);
    }

    if (report.employee.userId !== userId) {
      throw new ForbiddenException('You can only update your own feedback section');
    }

    if (report.status === FeedbackReportStatus.SENT) {
      throw new ForbiddenException('Cannot update a report that has already been sent');
    }

    const updatedReport = await this.prisma.feedbackReport.update({
      where: { id },
      data: {
        ...updateDto,
        employeeUpdatedAt: new Date(),
      },
      include: this.reportInclude,
    });

    return updatedReport;
  }

  /**
   * Submit a report (mark as submitted)
   */
  async submit(id: string, userId: string, userRole: UserRole) {
    const report = await this.prisma.feedbackReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Feedback report with ID ${id} not found`);
    }

    if (report.status !== FeedbackReportStatus.DRAFT) {
      throw new ForbiddenException('Only draft reports can be submitted');
    }

    // Only HR can submit reports
    if (userRole !== UserRole.HR && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only HR can submit reports');
    }

    const updatedReport = await this.prisma.feedbackReport.update({
      where: { id },
      data: {
        status: FeedbackReportStatus.SUBMITTED,
        submittedAt: new Date(),
      },
      include: this.reportInclude,
    });

    return updatedReport;
  }

  /**
   * Recompile auto-calculated data for a report
   */
  async recompile(id: string, userId: string, userRole: UserRole) {
    // Only HR can recompile data
    if (userRole !== UserRole.HR && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only HR can recompile report data');
    }

    const report = await this.prisma.feedbackReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Feedback report with ID ${id} not found`);
    }

    if (report.status === FeedbackReportStatus.SENT) {
      throw new ForbiddenException('Cannot recompile a report that has already been sent');
    }

    // Auto-compile data
    const compiledData = await this.autoCompileData(
      report.employeeId,
      report.month,
      report.year,
    );

    const updatedReport = await this.prisma.feedbackReport.update({
      where: { id },
      data: {
        tasksCount: compiledData.tasksCount,
        totalDaysOffTaken: compiledData.totalDaysOffTaken,
        totalRemainingDaysOff: compiledData.totalRemainingDaysOff,
        bankHolidays: compiledData.bankHolidays as Prisma.InputJsonValue,
      },
      include: this.reportInclude,
    });

    return updatedReport;
  }

  /**
   * Prepare template data from report
   */
  private prepareTemplateData(report: any) {
    const monthName = new Date(report.year, report.month - 1).toLocaleString('default', {
      month: 'long',
    });
    
    let nextMonth = report.month + 1;
    let nextYear = report.year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextMonthName = new Date(nextYear, nextMonth - 1).toLocaleString('default', {
      month: 'long',
    });

    const employeeName = `${report.employee.user.firstName} ${report.employee.user.lastName}`;
    
    const ratingLabels = ['', 'Unacceptable', 'Needs improvement', 'Meets expectations', 'Exceeds expectations', 'Outstanding'];
    
    const getRatingDisplay = (rating: number | null) => {
      if (!rating) return 'Not rated';
      return `<span class="rating rating-${rating}">${rating} - ${ratingLabels[rating]}</span>`;
    };

    return {
      employeeName,
      jobTitle: report.employee.jobTitle || 'N/A',
      department: report.employee.department || 'N/A',
      monthYear: `${monthName} ${report.year}`,
      monthName,
      nextMonthName,
      nextMonthYear: nextYear.toString(),
      tasksCount: report.tasksCount?.toString() || '0',
      totalDaysOffTaken: report.totalDaysOffTaken?.toString() || '0',
      totalRemainingDaysOff: report.totalRemainingDaysOff?.toString() || '0',
      bankHolidays: report.bankHolidays && Array.isArray(report.bankHolidays) ? report.bankHolidays : [],
      hrFeedback: report.hrFeedback || null,
      hrActionDescription: report.hrActionDescription || null,
      amFeedback: report.amFeedback || null,
      communicationRating: report.communicationRating,
      communicationRatingDisplay: getRatingDisplay(report.communicationRating),
      collaborationRating: report.collaborationRating,
      collaborationRatingDisplay: getRatingDisplay(report.collaborationRating),
      taskEstimationRating: report.taskEstimationRating,
      taskEstimationRatingDisplay: getRatingDisplay(report.taskEstimationRating),
      timelinessRating: report.timelinessRating,
      timelinessRatingDisplay: getRatingDisplay(report.timelinessRating),
      employeeSummary: report.employeeSummary || null,
    };
  }

  /**
   * Generate preview of the report
   */
  async preview(id: string, userId: string, userRole: UserRole) {
    const report = await this.findOne(id, userId, userRole);
    const templateData = this.prepareTemplateData(report);
    
    try {
      const { html } = await this.templatesService.renderDefault(
        TemplateType.CUSTOMER_REPORT,
        templateData
      );
      return { html };
    } catch (error) {
      // Fallback to default template if no template found
      const fallbackTemplate = this.getDefaultTemplate();
      const html = this.renderTemplate(fallbackTemplate, report);
      return { html };
    }
  }

  /**
   * Generate PDF of the report
   */
  async generatePdf(id: string, userId: string, userRole: UserRole): Promise<Buffer> {
    const report = await this.findOne(id, userId, userRole);
    const templateData = this.prepareTemplateData(report);
    
    try {
      const { html } = await this.templatesService.renderDefault(
        TemplateType.CUSTOMER_REPORT,
        templateData
      );
      return this.pdfService.generatePdfFromHtml(html);
    } catch (error) {
      // Fallback to default template if no template found
      const fallbackTemplate = this.getDefaultTemplate();
      const html = this.renderTemplate(fallbackTemplate, report);
      return this.pdfService.generatePdfFromHtml(html);
    }
  }

  /**
   * Send report to customer via email
   */
  async sendToCustomer(id: string, sendDto: SendReportDto, userId: string, userRole: UserRole) {
    // Only HR or Account Manager can send reports
    if (
      userRole !== UserRole.HR &&
      userRole !== UserRole.ADMIN &&
      userRole !== UserRole.ACCOUNT_MANAGER
    ) {
      throw new ForbiddenException('Only HR or Account Manager can send reports to customers');
    }

    const report = await this.findOne(id, userId, userRole);

    if (report.status !== FeedbackReportStatus.SUBMITTED) {
      throw new ForbiddenException('Only submitted reports can be sent');
    }

    // Generate PDF
    const pdfBuffer = await this.generatePdf(id, userId, userRole);

    // Send email
    const employeeName = `${report.employee.user.firstName} ${report.employee.user.lastName}`;
    const monthName = new Date(report.year, report.month - 1).toLocaleString('default', {
      month: 'long',
    });

    await this.emailService.sendEmail({
      to: sendDto.recipientEmail,
      subject: `Monthly Feedback Report - ${employeeName} - ${monthName} ${report.year}`,
      html: `
        <p>Dear Customer,</p>
        <p>Please find attached the monthly feedback report for ${employeeName} for ${monthName} ${report.year}.</p>
        ${sendDto.message ? `<p>${sendDto.message}</p>` : ''}
        <p>Best regards,<br/>Division 5 Team</p>
      `,
      attachments: [
        {
          filename: `feedback-report-${employeeName.replace(/\s+/g, '-')}-${report.month}-${report.year}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    // Update report status
    const updatedReport = await this.prisma.feedbackReport.update({
      where: { id },
      data: {
        status: FeedbackReportStatus.SENT,
        sentAt: new Date(),
        sentTo: sendDto.recipientEmail,
      },
      include: this.reportInclude,
    });

    return updatedReport;
  }

  /**
   * Delete a feedback report
   */
  async remove(id: string, userId: string, userRole: UserRole) {
    // Only HR/Admin can delete reports
    if (userRole !== UserRole.HR && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only HR can delete feedback reports');
    }

    const report = await this.prisma.feedbackReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Feedback report with ID ${id} not found`);
    }

    if (report.status === FeedbackReportStatus.SENT) {
      throw new ForbiddenException('Cannot delete a report that has already been sent');
    }

    await this.prisma.feedbackReport.delete({
      where: { id },
    });

    return { deleted: true };
  }

  /**
   * Get default report template
   */
  private getDefaultTemplate(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 40px;
            color: #333;
          }
          .header { 
            text-align: center; 
            margin-bottom: 40px;
            border-bottom: 2px solid #2563EB;
            padding-bottom: 20px;
          }
          .header h1 {
            color: #2563EB;
            margin: 0;
          }
          .header p {
            color: #666;
            margin: 10px 0 0 0;
          }
          .section { 
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .section h2 {
            color: #2563EB;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .section h3 {
            color: #555;
            margin-bottom: 10px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px;
            margin-bottom: 20px;
          }
          td { 
            padding: 10px; 
            border-bottom: 1px solid #eee;
            vertical-align: top;
          }
          td.label { 
            font-weight: bold;
            width: 40%;
            color: #555;
          }
          .rating {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 4px;
            font-weight: bold;
          }
          .rating-5 { background-color: #10b981; color: white; }
          .rating-4 { background-color: #3b82f6; color: white; }
          .rating-3 { background-color: #f59e0b; color: white; }
          .rating-2 { background-color: #f97316; color: white; }
          .rating-1 { background-color: #ef4444; color: white; }
          .feedback-text {
            background-color: #f9fafb;
            padding: 15px;
            border-radius: 6px;
            margin-top: 10px;
            white-space: pre-wrap;
          }
          .holiday-list {
            list-style: none;
            padding: 0;
          }
          .holiday-list li {
            padding: 8px;
            margin: 4px 0;
            background-color: #f3f4f6;
            border-radius: 4px;
          }
          .note {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin-top: 20px;
            font-size: 0.9em;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Monthly Feedback Report</h1>
          <p>{{employeeName}} - {{monthYear}}</p>
        </div>

        <div class="section">
          <h2>Employee Information</h2>
          <table>
            <tr>
              <td class="label">Employee Name:</td>
              <td>{{employeeName}}</td>
            </tr>
            <tr>
              <td class="label">Job Title:</td>
              <td>{{jobTitle}}</td>
            </tr>
            <tr>
              <td class="label">Department:</td>
              <td>{{department}}</td>
            </tr>
            <tr>
              <td class="label">Reporting Period:</td>
              <td>{{monthYear}}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <h2>Work Summary</h2>
          <table>
            <tr>
              <td class="label">Number of Tasks:</td>
              <td>{{tasksCount}}</td>
            </tr>
            <tr>
              <td class="label">Total Days Off Taken in {{monthName}}:</td>
              <td>{{totalDaysOffTaken}}</td>
            </tr>
            <tr>
              <td class="label">Total Remaining Days Off:</td>
              <td>{{totalRemainingDaysOff}}</td>
            </tr>
          </table>
        </div>

        {{#if bankHolidays}}
        <div class="section">
          <h2>Bank Holidays {{nextMonthName}} {{nextMonthYear}}</h2>
          <ul class="holiday-list">
            {{#each bankHolidays}}
            <li><strong>{{this.name}}</strong> - {{this.date}}</li>
            {{/each}}
          </ul>
          <div class="note">
            * If the public holiday/holidays falls/fall on the day or days of the weekend (Saturday and/or Sunday), 
            the holiday shall be observed on the following working day or days (Monday and Tuesday).
          </div>
        </div>
        {{/if}}

        {{#if hrFeedback}}
        <div class="section">
          <h2>HR Feedback</h2>
          <div class="feedback-text">{{hrFeedback}}</div>
          {{#if hrActionDescription}}
          <h3>Action Taken:</h3>
          <div class="feedback-text">{{hrActionDescription}}</div>
          {{/if}}
        </div>
        {{/if}}

        {{#if amFeedback}}
        <div class="section">
          <h2>Account Manager Feedback</h2>
          <div class="feedback-text">{{amFeedback}}</div>
        </div>
        {{/if}}

        <div class="section">
          <h2>Employee Self-Assessment</h2>
          
          <h3>Performance Ratings</h3>
          <table>
            <tr>
              <td class="label">Communication Effectiveness:</td>
              <td>{{communicationRatingDisplay}}</td>
            </tr>
            <tr>
              <td class="label">Collaboration and Teamwork:</td>
              <td>{{collaborationRatingDisplay}}</td>
            </tr>
            <tr>
              <td class="label">Task Estimation:</td>
              <td>{{taskEstimationRatingDisplay}}</td>
            </tr>
            <tr>
              <td class="label">Timeliness and Meeting Deadlines:</td>
              <td>{{timelinessRatingDisplay}}</td>
            </tr>
          </table>

          <p style="font-size: 0.9em; color: #666; margin-top: 5px;">
            <strong>Rating Scale:</strong> 5 – Outstanding | 4 – Exceeds expectations | 3 – Meets expectations | 2 – Needs improvement | 1 – Unacceptable
          </p>

          {{#if employeeSummary}}
          <h3>Summary Feedback of the Month:</h3>
          <div class="feedback-text">{{employeeSummary}}</div>
          {{/if}}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Render template with data using simple string replacement
   */
  private renderTemplate(template: string, report: any): string {
    const monthName = new Date(report.year, report.month - 1).toLocaleString('default', {
      month: 'long',
    });
    
    let nextMonth = report.month + 1;
    let nextYear = report.year;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    const nextMonthName = new Date(nextYear, nextMonth - 1).toLocaleString('default', {
      month: 'long',
    });

    const employeeName = `${report.employee.user.firstName} ${report.employee.user.lastName}`;
    
    const ratingLabels = ['', 'Unacceptable', 'Needs improvement', 'Meets expectations', 'Exceeds expectations', 'Outstanding'];
    
    const getRatingDisplay = (rating: number | null) => {
      if (!rating) return 'Not rated';
      return `<span class="rating rating-${rating}">${rating} - ${ratingLabels[rating]}</span>`;
    };

    const data: Record<string, string> = {
      employeeName,
      jobTitle: report.employee.jobTitle || 'N/A',
      department: report.employee.department || 'N/A',
      monthYear: `${monthName} ${report.year}`,
      monthName,
      nextMonthName,
      nextMonthYear: nextYear.toString(),
      tasksCount: report.tasksCount?.toString() || '0',
      totalDaysOffTaken: report.totalDaysOffTaken?.toString() || '0',
      totalRemainingDaysOff: report.totalRemainingDaysOff?.toString() || '0',
      hrFeedback: report.hrFeedback || '',
      hrActionDescription: report.hrActionDescription || '',
      amFeedback: report.amFeedback || '',
      communicationRatingDisplay: getRatingDisplay(report.communicationRating),
      collaborationRatingDisplay: getRatingDisplay(report.collaborationRating),
      taskEstimationRatingDisplay: getRatingDisplay(report.taskEstimationRating),
      timelinessRatingDisplay: getRatingDisplay(report.timelinessRating),
      employeeSummary: report.employeeSummary || '',
    };

    let html = template;

    // Replace simple variables
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, data[key] || '');
    });

    // Handle bank holidays list
    if (report.bankHolidays && Array.isArray(report.bankHolidays) && report.bankHolidays.length > 0) {
      const holidayItems = report.bankHolidays
        .map((h: any) => `<li><strong>${h.name}</strong> - ${h.date}</li>`)
        .join('\n            ');
      
      html = html.replace(/{{#if bankHolidays}}[\s\S]*?{{\/if}}/g, (match) => {
        return match
          .replace('{{#if bankHolidays}}', '')
          .replace('{{/if}}', '')
          .replace(/{{#each bankHolidays}}[\s\S]*?{{\/each}}/, holidayItems);
      });
    } else {
      html = html.replace(/{{#if bankHolidays}}[\s\S]*?{{\/if}}/g, '');
    }

    // Handle conditional sections
    const conditionals = ['hrFeedback', 'hrActionDescription', 'amFeedback', 'employeeSummary'];
    conditionals.forEach(field => {
      const regex = new RegExp(`{{#if ${field}}}([\\s\\S]*?){{/if}}`, 'g');
      html = html.replace(regex, (match, content) => {
        return data[field] ? content : '';
      });
    });

    return html;
  }
}


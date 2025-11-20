import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, Prisma, TemplateType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateRecruiterPerformanceReportDto } from './dto/create-recruiter-performance-report.dto';
import { UpdateRecruiterPerformanceReportDto } from './dto/update-recruiter-performance-report.dto';
import { FilterRecruiterPerformanceReportsDto } from './dto/filter-recruiter-performance-reports.dto';
import { SendRecruiterPerformanceReportDto } from './dto/send-report.dto';
import { PdfService } from '../../../common/pdf/pdf.service';
import { TemplatesService } from '../../templates/templates.service';
import { EmailService } from '../../../common/email/email.service';

@Injectable()
export class RecruiterPerformanceReportsService {
  constructor(
    private prisma: PrismaService,
    private pdfService: PdfService,
    private templatesService: TemplatesService,
    private emailService: EmailService,
  ) {}

  private readonly reportInclude = {
    position: {
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
      },
    },
    recruiter: {
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    },
  } as const;

  /**
   * Create a new recruiter performance report
   */
  async create(createDto: CreateRecruiterPerformanceReportDto, recruiterId: string) {
    // Check if position exists
    const position = await this.prisma.openPosition.findUnique({
      where: { id: createDto.positionId },
    });

    if (!position) {
      throw new NotFoundException(`Position with ID ${createDto.positionId} not found`);
    }

    // Check if recruiter exists and has RECRUITER role
    const recruiter = await this.prisma.user.findUnique({
      where: { id: recruiterId },
    });

    if (!recruiter) {
      throw new NotFoundException(`Recruiter with ID ${recruiterId} not found`);
    }

    if (recruiter.role !== UserRole.RECRUITER && recruiter.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only recruiters can create performance reports');
    }

    // Check if report already exists for this position/recruiter/week
    const weekEndingDate = new Date(createDto.weekEnding);
    const existing = await this.prisma.recruiterPerformanceReport.findUnique({
      where: {
        positionId_recruiterId_weekEnding: {
          positionId: createDto.positionId,
          recruiterId: recruiterId,
          weekEnding: weekEndingDate,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A performance report for this position and week ending ${createDto.weekEnding} already exists`,
      );
    }

    // Calculate efficiency ratios if applicable
    const culturalCallsEfficiencyRatio =
      createDto.culturalCallsTarget > 0
        ? (createDto.culturalCallsActual / createDto.culturalCallsTarget) * 100
        : null;

    const technicalCallsEfficiencyRatio =
      createDto.technicalCallsTarget > 0
        ? (createDto.technicalCallsActual / createDto.technicalCallsTarget) * 100
        : null;

    // Create report
    const report = await this.prisma.recruiterPerformanceReport.create({
      data: {
        positionId: createDto.positionId,
        recruiterId: recruiterId,
        weekEnding: weekEndingDate,
        positionTitle: createDto.positionTitle,
        candidatesContactedActual: createDto.candidatesContactedActual,
        candidatesContactedTarget: createDto.candidatesContactedTarget,
        culturalCallsActual: createDto.culturalCallsActual,
        culturalCallsTarget: createDto.culturalCallsTarget,
        culturalCallsEfficiencyRatio: culturalCallsEfficiencyRatio
          ? new Prisma.Decimal(culturalCallsEfficiencyRatio)
          : null,
        technicalCallsActual: createDto.technicalCallsActual,
        technicalCallsTarget: createDto.technicalCallsTarget,
        technicalCallsEfficiencyRatio: technicalCallsEfficiencyRatio
          ? new Prisma.Decimal(technicalCallsEfficiencyRatio)
          : null,
        clientInterviewsScheduledActual: createDto.clientInterviewsScheduledActual,
        clientInterviewsScheduledTarget: createDto.clientInterviewsScheduledTarget,
        submissionToInterviewRatio: createDto.submissionToInterviewRatio
          ? new Prisma.Decimal(createDto.submissionToInterviewRatio)
          : null,
        placementsThisWeek: createDto.placementsThisWeek,
        wins: createDto.wins ? (createDto.wins as unknown as Prisma.InputJsonValue) : undefined,
        challenges: createDto.challenges
          ? (createDto.challenges as unknown as Prisma.InputJsonValue)
          : undefined,
        priorities: createDto.priorities
          ? (createDto.priorities as unknown as Prisma.InputJsonValue)
          : undefined,
        topPerformingSources: createDto.topPerformingSources
          ? (createDto.topPerformingSources as unknown as Prisma.InputJsonValue)
          : undefined,
        pipelineStatus: createDto.pipelineStatus
          ? (createDto.pipelineStatus as unknown as Prisma.InputJsonValue)
          : undefined,
      },
      include: this.reportInclude,
    });

    return report;
  }

  /**
   * Get all recruiter performance reports with filters
   */
  async findAll(
    filters: FilterRecruiterPerformanceReportsDto,
    userId: string,
    userRole: UserRole,
  ) {
    const where: Prisma.RecruiterPerformanceReportWhereInput = {};

    // If user is a recruiter, only show their own reports
    if (userRole === UserRole.RECRUITER) {
      where.recruiterId = userId;
    } else if (filters.recruiterId) {
      where.recruiterId = filters.recruiterId;
    }

    if (filters.positionId) {
      where.positionId = filters.positionId;
    }

    if (filters.weekEndingFrom || filters.weekEndingTo) {
      where.weekEnding = {};
      if (filters.weekEndingFrom) {
        where.weekEnding.gte = new Date(filters.weekEndingFrom);
      }
      if (filters.weekEndingTo) {
        where.weekEnding.lte = new Date(filters.weekEndingTo);
      }
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.recruiterPerformanceReport.findMany({
        where,
        include: this.reportInclude,
        orderBy: { weekEnding: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.recruiterPerformanceReport.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Get a single recruiter performance report
   */
  async findOne(id: string, userId: string, userRole: UserRole) {
    const report = await this.prisma.recruiterPerformanceReport.findUnique({
      where: { id },
      include: this.reportInclude,
    });

    if (!report) {
      throw new NotFoundException(`Recruiter performance report with ID ${id} not found`);
    }

    // If user is a recruiter, only allow access to their own reports
    if (userRole === UserRole.RECRUITER && report.recruiterId !== userId) {
      throw new ForbiddenException('You can only view your own performance reports');
    }

    return report;
  }

  /**
   * Update a recruiter performance report
   */
  async update(
    id: string,
    updateDto: UpdateRecruiterPerformanceReportDto,
    userId: string,
    userRole: UserRole,
  ) {
    const report = await this.prisma.recruiterPerformanceReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Recruiter performance report with ID ${id} not found`);
    }

    // If user is a recruiter, only allow updates to their own reports
    if (userRole === UserRole.RECRUITER && report.recruiterId !== userId) {
      throw new ForbiddenException('You can only update your own performance reports');
    }

    // Calculate efficiency ratios if metrics are being updated
    let culturalCallsEfficiencyRatio = report.culturalCallsEfficiencyRatio;
    let technicalCallsEfficiencyRatio = report.technicalCallsEfficiencyRatio;

    if (
      updateDto.culturalCallsActual !== undefined ||
      updateDto.culturalCallsTarget !== undefined
    ) {
      const actual = updateDto.culturalCallsActual ?? report.culturalCallsActual;
      const target = updateDto.culturalCallsTarget ?? report.culturalCallsTarget;
      culturalCallsEfficiencyRatio =
        target > 0 ? new Prisma.Decimal((actual / target) * 100) : null;
    }

    if (
      updateDto.technicalCallsActual !== undefined ||
      updateDto.technicalCallsTarget !== undefined
    ) {
      const actual = updateDto.technicalCallsActual ?? report.technicalCallsActual;
      const target = updateDto.technicalCallsTarget ?? report.technicalCallsTarget;
      technicalCallsEfficiencyRatio =
        target > 0 ? new Prisma.Decimal((actual / target) * 100) : null;
    }

    const updateData: Prisma.RecruiterPerformanceReportUpdateInput = {
      ...(updateDto.weekEnding && { weekEnding: new Date(updateDto.weekEnding) }),
      ...(updateDto.positionTitle && { positionTitle: updateDto.positionTitle }),
      ...(updateDto.candidatesContactedActual !== undefined && {
        candidatesContactedActual: updateDto.candidatesContactedActual,
      }),
      ...(updateDto.candidatesContactedTarget !== undefined && {
        candidatesContactedTarget: updateDto.candidatesContactedTarget,
      }),
      ...(updateDto.culturalCallsActual !== undefined && {
        culturalCallsActual: updateDto.culturalCallsActual,
      }),
      ...(updateDto.culturalCallsTarget !== undefined && {
        culturalCallsTarget: updateDto.culturalCallsTarget,
      }),
      ...(culturalCallsEfficiencyRatio !== undefined && {
        culturalCallsEfficiencyRatio,
      }),
      ...(updateDto.technicalCallsActual !== undefined && {
        technicalCallsActual: updateDto.technicalCallsActual,
      }),
      ...(updateDto.technicalCallsTarget !== undefined && {
        technicalCallsTarget: updateDto.technicalCallsTarget,
      }),
      ...(technicalCallsEfficiencyRatio !== undefined && {
        technicalCallsEfficiencyRatio,
      }),
      ...(updateDto.clientInterviewsScheduledActual !== undefined && {
        clientInterviewsScheduledActual: updateDto.clientInterviewsScheduledActual,
      }),
      ...(updateDto.clientInterviewsScheduledTarget !== undefined && {
        clientInterviewsScheduledTarget: updateDto.clientInterviewsScheduledTarget,
      }),
      ...(updateDto.submissionToInterviewRatio !== undefined && {
        submissionToInterviewRatio: updateDto.submissionToInterviewRatio
          ? new Prisma.Decimal(updateDto.submissionToInterviewRatio)
          : null,
      }),
      ...(updateDto.placementsThisWeek !== undefined && {
        placementsThisWeek: updateDto.placementsThisWeek,
      }),
      ...(updateDto.wins !== undefined && {
        wins: updateDto.wins ? (updateDto.wins as unknown as Prisma.InputJsonValue) : undefined,
      }),
      ...(updateDto.challenges !== undefined && {
        challenges: updateDto.challenges
          ? (updateDto.challenges as unknown as Prisma.InputJsonValue)
          : undefined,
      }),
      ...(updateDto.priorities !== undefined && {
        priorities: updateDto.priorities
          ? (updateDto.priorities as unknown as Prisma.InputJsonValue)
          : undefined,
      }),
      ...(updateDto.topPerformingSources !== undefined && {
        topPerformingSources: updateDto.topPerformingSources
          ? (updateDto.topPerformingSources as unknown as Prisma.InputJsonValue)
          : undefined,
      }),
      ...(updateDto.pipelineStatus !== undefined && {
        pipelineStatus: updateDto.pipelineStatus
          ? (updateDto.pipelineStatus as unknown as Prisma.InputJsonValue)
          : undefined,
      }),
    };

    const updatedReport = await this.prisma.recruiterPerformanceReport.update({
      where: { id },
      data: updateData,
      include: this.reportInclude,
    });

    return updatedReport;
  }

  /**
   * Delete a recruiter performance report
   */
  async remove(id: string, userId: string, userRole: UserRole) {
    const report = await this.prisma.recruiterPerformanceReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(`Recruiter performance report with ID ${id} not found`);
    }

    // Only admins and HR can delete reports
    if (userRole !== UserRole.ADMIN && userRole !== UserRole.HR) {
      throw new ForbiddenException('Only admins and HR can delete performance reports');
    }

    await this.prisma.recruiterPerformanceReport.delete({
      where: { id },
    });

    return { message: 'Recruiter performance report deleted successfully' };
  }

  /**
   * Prepare template data from report
   */
  private async prepareTemplateData(report: any, isInternal: boolean = true) {
    const weekEndingDate = new Date(report.weekEnding);
    const weekEndingFormatted = weekEndingDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const recruiterName = `${report.recruiter.firstName} ${report.recruiter.lastName}`;

    // Format efficiency ratios
    const formatRatio = (ratio: any) => {
      if (!ratio) return 'N/A';
      return `${Number(ratio).toFixed(1)}%`;
    };

    return {
      recruiterName,
      positionTitle: report.positionTitle,
      weekEnding: weekEndingFormatted,
      weekEndingFull: weekEndingDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      // Performance Metrics
      candidatesContactedActual: report.candidatesContactedActual,
      candidatesContactedTarget: report.candidatesContactedTarget,
      culturalCallsActual: report.culturalCallsActual,
      culturalCallsTarget: report.culturalCallsTarget,
      culturalCallsEfficiencyRatio: formatRatio(report.culturalCallsEfficiencyRatio),
      technicalCallsActual: report.technicalCallsActual,
      technicalCallsTarget: report.technicalCallsTarget,
      technicalCallsEfficiencyRatio: formatRatio(report.technicalCallsEfficiencyRatio),
      clientInterviewsScheduledActual: report.clientInterviewsScheduledActual,
      clientInterviewsScheduledTarget: report.clientInterviewsScheduledTarget,
      submissionToInterviewRatio: formatRatio(report.submissionToInterviewRatio),
      placementsThisWeek: report.placementsThisWeek,
      // Wins
      wins: Array.isArray(report.wins) ? report.wins : [],
      // Challenges
      challenges: Array.isArray(report.challenges) ? report.challenges : [],
      // Priorities
      priorities: Array.isArray(report.priorities) ? report.priorities : [],
      // Pipeline
      topPerformingSources: Array.isArray(report.topPerformingSources)
        ? report.topPerformingSources
        : [],
      pipelineStatus: report.pipelineStatus || null,
      // Internal-only data
      isInternal,
      positionDescription: report.position?.description || '',
    };
  }

  /**
   * Generate PDF of the report (internal or customer version)
   */
  async generatePdf(
    id: string,
    userId: string,
    userRole: UserRole,
    templateType: 'internal' | 'customer' = 'internal',
  ): Promise<Buffer> {
    const report = await this.findOne(id, userId, userRole);
    const templateData = await this.prepareTemplateData(report, templateType === 'internal');

    try {
      // Try to get template from database
      const templateTypeEnum =
        templateType === 'internal'
          ? TemplateType.RECRUITER_PERFORMANCE_REPORT_INTERNAL
          : TemplateType.RECRUITER_PERFORMANCE_REPORT_CUSTOMER;

      const { html } = await this.templatesService.renderDefault(templateTypeEnum, templateData);
      return this.pdfService.generatePdfFromHtml(html, {
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      });
    } catch (error) {
      // Fallback to default template
      const fallbackTemplate = this.getDefaultTemplate(templateType === 'internal');
      const html = await this.renderTemplate(fallbackTemplate, templateData);
      return this.pdfService.generatePdfFromHtml(html, {
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      });
    }
  }

  /**
   * Get default HTML template
   */
  private getDefaultTemplate(isInternal: boolean = true): string {
    if (isInternal) {
      return this.getDefaultInternalTemplate();
    }
    return this.getDefaultCustomerTemplate();
  }

  /**
   * Render template with data
   */
  private async renderTemplate(template: string, data: any): Promise<string> {
    const Handlebars = require('handlebars');
    const compiled = Handlebars.compile(template);
    return compiled(data);
  }

  /**
   * Default internal template
   */
  private getDefaultInternalTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Weekly Recruiter Performance Report - Internal</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
    .header h1 { margin: 0; color: #2563eb; }
    .header p { margin: 5px 0; color: #666; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table th, table td { padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    table th { background-color: #f3f4f6; font-weight: bold; }
    .metric-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .metric-label { font-weight: bold; }
    .win-item, .challenge-item, .priority-item { margin-bottom: 15px; padding: 10px; background-color: #f9fafb; border-left: 3px solid #2563eb; }
    .challenge-item { border-left-color: #f59e0b; }
    .priority-item { border-left-color: #10b981; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Enhanced Weekly Recruiter Performance Report</h1>
    <p><strong>Recruiter:</strong> {{recruiterName}}</p>
    <p><strong>Week Ending:</strong> {{weekEnding}}</p>
  </div>

  <div class="section">
    <h2>1. Performance Funnel & Efficiency Ratios</h2>
    <p><strong>Position:</strong> {{positionTitle}}</p>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Weekly Actual</th>
          <th>Weekly Target</th>
          <th>Efficiency Ratio</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Candidates Contacted</td>
          <td>{{candidatesContactedActual}}</td>
          <td>{{candidatesContactedTarget}}</td>
          <td>-</td>
        </tr>
        <tr>
          <td>Cultural Calls Conducted</td>
          <td>{{culturalCallsActual}}</td>
          <td>{{culturalCallsTarget}}</td>
          <td>{{culturalCallsEfficiencyRatio}}</td>
        </tr>
        <tr>
          <td>Technical Calls Conducted</td>
          <td>{{technicalCallsActual}}</td>
          <td>{{technicalCallsTarget}}</td>
          <td>{{technicalCallsEfficiencyRatio}}</td>
        </tr>
        <tr>
          <td>Client Interviews Scheduled</td>
          <td>{{clientInterviewsScheduledActual}}</td>
          <td>{{clientInterviewsScheduledTarget}}</td>
          <td>{{submissionToInterviewRatio}}</td>
        </tr>
        <tr>
          <td>Placements this Week</td>
          <td>{{placementsThisWeek}}</td>
          <td>-</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>
  </div>

  {{#if wins}}
  <div class="section">
    <h2>2. Key Wins & Accomplishments</h2>
    {{#each wins}}
    <div class="win-item">
      <p><strong>Win {{@index}}:</strong> {{this.description}}</p>
    </div>
    {{/each}}
  </div>
  {{/if}}

  {{#if challenges}}
  <div class="section">
    <h2>3. Challenges & Proposed Solutions</h2>
    {{#each challenges}}
    <div class="challenge-item">
      <p><strong>Challenge:</strong> {{this.challenge}}</p>
      <p><strong>Proposed Solution:</strong> {{this.proposedSolution}}</p>
    </div>
    {{/each}}
  </div>
  {{/if}}

  {{#if priorities}}
  <div class="section">
    <h2>4. S.M.A.R.T. Priorities for Next Week</h2>
    {{#each priorities}}
    <div class="priority-item">
      <p><strong>Priority {{@index}}:</strong> {{this.description}}</p>
    </div>
    {{/each}}
  </div>
  {{/if}}

  {{#if topPerformingSources}}
  <div class="section">
    <h2>5. Pipeline Health & Source Analysis</h2>
    <p><strong>Top Performing Sources this Week:</strong></p>
    <ul>
      {{#each topPerformingSources}}
      <li>{{this.source}} ({{this.count}} screenings)</li>
      {{/each}}
    </ul>
  </div>
  {{/if}}

  {{#if pipelineStatus}}
  <div class="section">
    <h2>Key Role Pipeline Status</h2>
    <p><strong>Role:</strong> {{pipelineStatus.role}}</p>
    <p><strong>Pipeline:</strong> {{pipelineStatus.pipeline}}</p>
    <p><strong>Confidence Level:</strong> {{pipelineStatus.confidenceLevel}}</p>
    {{#if pipelineStatus.notes}}
    <p><strong>Notes:</strong> {{pipelineStatus.notes}}</p>
    {{/if}}
  </div>
  {{/if}}
</body>
</html>
    `;
  }

  /**
   * Default customer template (simplified version)
   */
  private getDefaultCustomerTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Weekly Recruiter Performance Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
    .header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 20px; }
    .header h1 { margin: 0; color: #2563eb; }
    .header p { margin: 5px 0; color: #666; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #2563eb; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    table th, table td { padding: 8px; text-align: left; border-bottom: 1px solid #e5e7eb; }
    table th { background-color: #f3f4f6; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Weekly Recruiter Performance Report</h1>
    <p><strong>Recruiter:</strong> {{recruiterName}}</p>
    <p><strong>Week Ending:</strong> {{weekEnding}}</p>
    <p><strong>Position:</strong> {{positionTitle}}</p>
  </div>

  <div class="section">
    <h2>Performance Summary</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Actual</th>
          <th>Target</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Candidates Contacted</td>
          <td>{{candidatesContactedActual}}</td>
          <td>{{candidatesContactedTarget}}</td>
        </tr>
        <tr>
          <td>Cultural Calls Conducted</td>
          <td>{{culturalCallsActual}}</td>
          <td>{{culturalCallsTarget}}</td>
        </tr>
        <tr>
          <td>Technical Calls Conducted</td>
          <td>{{technicalCallsActual}}</td>
          <td>{{technicalCallsTarget}}</td>
        </tr>
        <tr>
          <td>Client Interviews Scheduled</td>
          <td>{{clientInterviewsScheduledActual}}</td>
          <td>{{clientInterviewsScheduledTarget}}</td>
        </tr>
        <tr>
          <td>Placements this Week</td>
          <td>{{placementsThisWeek}}</td>
          <td>-</td>
        </tr>
      </tbody>
    </table>
  </div>

  {{#if pipelineStatus}}
  <div class="section">
    <h2>Pipeline Status</h2>
    <p><strong>Role:</strong> {{pipelineStatus.role}}</p>
    <p><strong>Status:</strong> {{pipelineStatus.pipeline}}</p>
    <p><strong>Confidence Level:</strong> {{pipelineStatus.confidenceLevel}}</p>
  </div>
  {{/if}}
</body>
      </html>
    `;
  }

  /**
   * Preview the report as HTML
   */
  async preview(
    id: string,
    userId: string,
    userRole: UserRole,
    templateId?: string,
    type: 'internal' | 'customer' = 'customer',
  ): Promise<{ html: string }> {
    const report = await this.findOne(id, userId, userRole);
    const isInternal = type === 'internal';
    const templateData = await this.prepareTemplateData(report, isInternal);

    try {
      let html: string;

      if (templateId) {
        // Use specific template
        const template = await this.prisma.template.findUnique({
          where: { id: templateId },
        });

        if (!template) {
          throw new NotFoundException(`Template with ID ${templateId} not found`);
        }

        html = await this.renderTemplate(template.htmlContent, templateData);
      } else {
        // Use default template based on type
        const templateTypeEnum = isInternal
          ? TemplateType.RECRUITER_PERFORMANCE_REPORT_INTERNAL
          : TemplateType.RECRUITER_PERFORMANCE_REPORT_CUSTOMER;
        const { html: renderedHtml } = await this.templatesService.renderDefault(
          templateTypeEnum,
          templateData,
        );
        html = renderedHtml;
      }

      return { html };
    } catch (error) {
      // Fallback to default template
      const fallbackTemplate = isInternal
        ? this.getDefaultInternalTemplate()
        : this.getDefaultCustomerTemplate();
      const html = await this.renderTemplate(fallbackTemplate, templateData);
      return { html };
    }
  }

  /**
   * Send report to customer via email
   */
  async sendToCustomer(
    id: string,
    sendDto: SendRecruiterPerformanceReportDto,
    userId: string,
    userRole: UserRole,
  ) {
    const report = await this.findOne(id, userId, userRole);

    // Generate PDF using customer template
    const pdfBuffer = await this.generatePdf(id, userId, userRole, 'customer');

    // Send email
    const recruiterName = `${report.recruiter.firstName} ${report.recruiter.lastName}`;
    const weekEndingDate = new Date(report.weekEnding);
    const weekEndingFormatted = weekEndingDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    await this.emailService.sendEmail({
      to: sendDto.recipientEmail,
      subject: `Weekly Recruiter Performance Report - ${recruiterName} - Week Ending ${weekEndingFormatted}`,
      html: `
        <p>Dear Customer,</p>
        <p>Please find attached the weekly recruiter performance report for ${recruiterName} for the week ending ${weekEndingFormatted}.</p>
        ${sendDto.message ? `<p>${sendDto.message}</p>` : ''}
        <p>Best regards,<br/>Division 5 Team</p>
      `,
      attachments: [
        {
          filename: `recruiter-performance-report-${recruiterName.replace(/\s+/g, '-')}-${weekEndingFormatted.replace(/\//g, '-')}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    // Update report with sent information
    const updatedReport = await this.prisma.recruiterPerformanceReport.update({
      where: { id },
      data: {
        customerPdfUrl: `sent-to-${sendDto.recipientEmail}-${new Date().toISOString()}`,
      },
      include: this.reportInclude,
    });

    return updatedReport;
  }
}


import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole, Prisma, TemplateType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { CreateSalesPerformanceReportDto } from './dto/create-sales-performance-report.dto';
import { UpdateSalesPerformanceReportDto } from './dto/update-sales-performance-report.dto';
import { FilterSalesPerformanceReportsDto } from './dto/filter-sales-performance-reports.dto';
import { PdfService } from '../../../common/pdf/pdf.service';
import { TemplatesService } from '../../templates/templates.service';
import { EmailService } from '../../../common/email/email.service';
import { PreviewSalesPerformanceReportDto } from './dto/preview-sales-performance-report.dto';
import { SendSalesPerformanceReportDto } from './dto/send-sales-performance-report.dto';

@Injectable()
export class SalesPerformanceReportsService extends BaseService {
  constructor(
    prisma: PrismaService,
    private pdfService: PdfService,
    private templatesService: TemplatesService,
    private emailService: EmailService,
  ) {
    super(prisma);
  }

  private readonly reportInclude = {
    salesperson: {
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
   * Create a new sales performance report
   */
  async create(createDto: CreateSalesPerformanceReportDto, salespersonId: string) {
    // Check if salesperson exists and has SALESPERSON role
    const salesperson = await this.prisma.user.findUnique({
      where: { id: salespersonId },
    });

    if (!salesperson) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Salesperson', salespersonId));
    }

    if (salesperson.role !== UserRole.SALESPERSON && salesperson.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only salespeople can create performance reports');
    }

    // Check if report already exists for this salesperson/week
    const weekEndingDate = new Date(createDto.weekEnding);
    const existing = await this.prisma.salesPerformanceReport.findUnique({
      where: {
        salespersonId_weekEnding: {
          salespersonId: salespersonId,
          weekEnding: weekEndingDate,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `A performance report for week ending ${createDto.weekEnding} already exists`,
      );
    }

    // Calculate percentages
    const linkedinAcceptedPercentage =
      createDto.linkedinConnectionRequests > 0
        ? (createDto.linkedinAccepted / createDto.linkedinConnectionRequests) * 100
        : null;

    const linkedinMeetingsScheduledPercentage =
      createDto.linkedinAccepted > 0
        ? (createDto.linkedinMeetingsScheduled / createDto.linkedinAccepted) * 100
        : null;

    const inmailRepliesPercentage =
      createDto.inmailSent > 0 ? (createDto.inmailReplies / createDto.inmailSent) * 100 : null;

    const inmailMeetingsScheduledPercentage =
      createDto.inmailReplies > 0
        ? (createDto.inmailMeetingsScheduled / createDto.inmailReplies) * 100
        : null;

    // Create report
    const report = await this.prisma.salesPerformanceReport.create({
      data: {
        salespersonId: salespersonId,
        weekEnding: weekEndingDate,
        linkedinConnectionRequests: createDto.linkedinConnectionRequests,
        linkedinAccepted: createDto.linkedinAccepted,
        linkedinAcceptedPercentage: linkedinAcceptedPercentage
          ? new Prisma.Decimal(linkedinAcceptedPercentage)
          : null,
        linkedinMeetingsScheduled: createDto.linkedinMeetingsScheduled,
        linkedinMeetingsScheduledPercentage: linkedinMeetingsScheduledPercentage
          ? new Prisma.Decimal(linkedinMeetingsScheduledPercentage)
          : null,
        linkedinAccountsCount: createDto.linkedinAccountsCount,
        linkedinMarketsTargeted: createDto.linkedinMarketsTargeted,
        inmailSent: createDto.inmailSent,
        inmailReplies: createDto.inmailReplies,
        inmailRepliesPercentage: inmailRepliesPercentage
          ? new Prisma.Decimal(inmailRepliesPercentage)
          : null,
        inmailMeetingsScheduled: createDto.inmailMeetingsScheduled,
        inmailMeetingsScheduledPercentage: inmailMeetingsScheduledPercentage
          ? new Prisma.Decimal(inmailMeetingsScheduledPercentage)
          : null,
      },
      include: this.reportInclude,
    });

    return report;
  }

  /**
   * Get all sales performance reports with filters
   */
  async findAll(
    filters: FilterSalesPerformanceReportsDto,
    userId: string,
    userRole: UserRole,
  ) {
    // Build base where clause using QueryBuilder
    const baseWhere = QueryBuilder.buildWhereClause<Prisma.SalesPerformanceReportWhereInput>(
      filters,
      {
        dateFields: ['weekEnding'],
        fieldMappings: {
          weekEndingFrom: 'weekEnding',
          weekEndingTo: 'weekEnding',
        },
      },
    );

    // If user is a salesperson, only show their own reports
    if (userRole === UserRole.SALESPERSON) {
      baseWhere.salespersonId = userId;
    } else if (filters.salespersonId) {
      baseWhere.salespersonId = filters.salespersonId;
    }

    // Handle date range filtering
    if (filters.weekEndingFrom || filters.weekEndingTo) {
      const weekEndingFilter: Prisma.DateTimeFilter = {};
      if (filters.weekEndingFrom) {
        weekEndingFilter.gte = new Date(filters.weekEndingFrom);
      }
      if (filters.weekEndingTo) {
        weekEndingFilter.lte = new Date(filters.weekEndingTo);
      }
      baseWhere.weekEnding = weekEndingFilter;
    }

    const where = baseWhere;
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;

    const result = await this.paginate(
      this.prisma.salesPerformanceReport,
      where,
      {
        page,
        pageSize,
        include: this.reportInclude,
        orderBy: { weekEnding: 'desc' },
      },
    );

    return result;
  }

  /**
   * Get a single sales performance report
   */
  async findOne(id: string, userId: string, userRole: UserRole) {
    const report = await this.prisma.salesPerformanceReport.findUnique({
      where: { id },
      include: this.reportInclude,
    });

    if (!report) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Sales performance report', id));
    }

    // If user is a salesperson, only allow access to their own reports
    if (userRole === UserRole.SALESPERSON && report.salespersonId !== userId) {
      throw new ForbiddenException('You can only view your own performance reports');
    }

    return report;
  }

  /**
   * Update a sales performance report
   */
  async update(
    id: string,
    updateDto: UpdateSalesPerformanceReportDto,
    userId: string,
    userRole: UserRole,
  ) {
    const report = await this.prisma.salesPerformanceReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Sales performance report', id));
    }

    // If user is a salesperson, only allow updates to their own reports
    if (userRole === UserRole.SALESPERSON && report.salespersonId !== userId) {
      throw new ForbiddenException('You can only update your own performance reports');
    }

    // Recalculate percentages if metrics are being updated
    let linkedinAcceptedPercentage = report.linkedinAcceptedPercentage;
    let linkedinMeetingsScheduledPercentage = report.linkedinMeetingsScheduledPercentage;
    let inmailRepliesPercentage = report.inmailRepliesPercentage;
    let inmailMeetingsScheduledPercentage = report.inmailMeetingsScheduledPercentage;

    if (
      updateDto.linkedinConnectionRequests !== undefined ||
      updateDto.linkedinAccepted !== undefined
    ) {
      const requests = updateDto.linkedinConnectionRequests ?? report.linkedinConnectionRequests;
      const accepted = updateDto.linkedinAccepted ?? report.linkedinAccepted;
      linkedinAcceptedPercentage =
        requests > 0 ? new Prisma.Decimal((accepted / requests) * 100) : null;
    }

    if (
      updateDto.linkedinAccepted !== undefined ||
      updateDto.linkedinMeetingsScheduled !== undefined
    ) {
      const accepted = updateDto.linkedinAccepted ?? report.linkedinAccepted;
      const meetings = updateDto.linkedinMeetingsScheduled ?? report.linkedinMeetingsScheduled;
      linkedinMeetingsScheduledPercentage =
        accepted > 0 ? new Prisma.Decimal((meetings / accepted) * 100) : null;
    }

    if (updateDto.inmailSent !== undefined || updateDto.inmailReplies !== undefined) {
      const sent = updateDto.inmailSent ?? report.inmailSent;
      const replies = updateDto.inmailReplies ?? report.inmailReplies;
      inmailRepliesPercentage = sent > 0 ? new Prisma.Decimal((replies / sent) * 100) : null;
    }

    if (
      updateDto.inmailReplies !== undefined ||
      updateDto.inmailMeetingsScheduled !== undefined
    ) {
      const replies = updateDto.inmailReplies ?? report.inmailReplies;
      const meetings = updateDto.inmailMeetingsScheduled ?? report.inmailMeetingsScheduled;
      inmailMeetingsScheduledPercentage =
        replies > 0 ? new Prisma.Decimal((meetings / replies) * 100) : null;
    }

    const updateData: Prisma.SalesPerformanceReportUpdateInput = {
      ...(updateDto.weekEnding && { weekEnding: new Date(updateDto.weekEnding) }),
      ...(updateDto.linkedinConnectionRequests !== undefined && {
        linkedinConnectionRequests: updateDto.linkedinConnectionRequests,
      }),
      ...(updateDto.linkedinAccepted !== undefined && {
        linkedinAccepted: updateDto.linkedinAccepted,
      }),
      ...(linkedinAcceptedPercentage !== undefined && {
        linkedinAcceptedPercentage,
      }),
      ...(updateDto.linkedinMeetingsScheduled !== undefined && {
        linkedinMeetingsScheduled: updateDto.linkedinMeetingsScheduled,
      }),
      ...(linkedinMeetingsScheduledPercentage !== undefined && {
        linkedinMeetingsScheduledPercentage,
      }),
      ...(updateDto.linkedinAccountsCount !== undefined && {
        linkedinAccountsCount: updateDto.linkedinAccountsCount,
      }),
      ...(updateDto.linkedinMarketsTargeted !== undefined && {
        linkedinMarketsTargeted: updateDto.linkedinMarketsTargeted,
      }),
      ...(updateDto.inmailSent !== undefined && { inmailSent: updateDto.inmailSent }),
      ...(updateDto.inmailReplies !== undefined && { inmailReplies: updateDto.inmailReplies }),
      ...(inmailRepliesPercentage !== undefined && { inmailRepliesPercentage }),
      ...(updateDto.inmailMeetingsScheduled !== undefined && {
        inmailMeetingsScheduled: updateDto.inmailMeetingsScheduled,
      }),
      ...(inmailMeetingsScheduledPercentage !== undefined && {
        inmailMeetingsScheduledPercentage,
      }),
    };

    const updatedReport = await this.prisma.salesPerformanceReport.update({
      where: { id },
      data: updateData,
      include: this.reportInclude,
    });

    return updatedReport;
  }

  /**
   * Delete a sales performance report
   */
  async remove(id: string, userId: string, userRole: UserRole) {
    const report = await this.prisma.salesPerformanceReport.findUnique({
      where: { id },
    });

    if (!report) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Sales performance report', id));
    }

    // Admins can delete any report
    // Salespeople can only delete their own reports
    if (userRole !== UserRole.ADMIN) {
      if (userRole === UserRole.SALESPERSON && report.salespersonId !== userId) {
        throw new ForbiddenException('You can only delete your own performance reports');
      }
      if (userRole !== UserRole.SALESPERSON) {
        throw new ForbiddenException('Only salespeople and admins can delete performance reports');
      }
    }

    await this.prisma.salesPerformanceReport.delete({
      where: { id },
    });

    return { message: 'Sales performance report deleted successfully' };
  }

  /**
   * Prepare template data from report
   */
  private async prepareTemplateData(report: any) {
    const weekEndingDate = new Date(report.weekEnding);
    const weekEndingFormatted = weekEndingDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const salespersonName = `${report.salesperson.firstName} ${report.salesperson.lastName}`;

    // Format percentages
    const formatPercentage = (value: any) => {
      if (!value) return 'N/A';
      return `${Number(value).toFixed(1)}%`;
    };

    // Parse markets targeted
    let marketsTargeted: string[] = [];
    if (report.linkedinMarketsTargeted) {
      try {
        marketsTargeted = JSON.parse(report.linkedinMarketsTargeted);
      } catch {
        // If not JSON, treat as comma-separated
        marketsTargeted = report.linkedinMarketsTargeted.split(',').map((m: string) => m.trim());
      }
    }

    return {
      salespersonName,
      weekEnding: weekEndingFormatted,
      weekEndingFull: weekEndingDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      // LinkedIn Campaigns
      linkedinConnectionRequests: report.linkedinConnectionRequests,
      linkedinAccepted: report.linkedinAccepted,
      linkedinAcceptedPercentage: formatPercentage(report.linkedinAcceptedPercentage),
      linkedinMeetingsScheduled: report.linkedinMeetingsScheduled,
      linkedinMeetingsScheduledPercentage: formatPercentage(
        report.linkedinMeetingsScheduledPercentage,
      ),
      linkedinAccountsCount: report.linkedinAccountsCount,
      linkedinMarketsTargeted: marketsTargeted,
      // InMail Campaigns
      inmailSent: report.inmailSent,
      inmailReplies: report.inmailReplies,
      inmailRepliesPercentage: formatPercentage(report.inmailRepliesPercentage),
      inmailMeetingsScheduled: report.inmailMeetingsScheduled,
      inmailMeetingsScheduledPercentage: formatPercentage(
        report.inmailMeetingsScheduledPercentage,
      ),
    };
  }

  /**
   * Generate PDF of the report
   */
  async generatePdf(id: string, userId: string, userRole: UserRole): Promise<Buffer> {
    const report = await this.findOne(id, userId, userRole);
    const templateData = await this.prepareTemplateData(report);

    try {
      // Try to get template from database
      const { html } = await this.templatesService.renderDefault(
        TemplateType.SALES_PERFORMANCE_REPORT,
        templateData,
      );
      return this.pdfService.generatePdfFromHtml(html, {
        format: 'A4',
        margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
      });
    } catch (error) {
      // Fallback to default template
      const fallbackTemplate = this.getDefaultTemplate();
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
  private getDefaultTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Weekly Sales Performance Report</title>
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
  </style>
</head>
<body>
  <div class="header">
    <h1>Weekly Sales Performance Report</h1>
    <p><strong>Salesperson:</strong> {{salespersonName}}</p>
    <p><strong>Week Ending:</strong> {{weekEnding}}</p>
  </div>

  <div class="section">
    <h2>LinkedIn Campaigns</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td># of Connection Requests</td>
          <td>{{linkedinConnectionRequests}}</td>
        </tr>
        <tr>
          <td># of Accepted</td>
          <td>{{linkedinAccepted}}</td>
        </tr>
        <tr>
          <td>% Accepted</td>
          <td>{{linkedinAcceptedPercentage}}</td>
        </tr>
        <tr>
          <td># Meetings Scheduled</td>
          <td>{{linkedinMeetingsScheduled}}</td>
        </tr>
        <tr>
          <td>% Meetings Scheduled</td>
          <td>{{linkedinMeetingsScheduledPercentage}}</td>
        </tr>
        <tr>
          <td># LinkedIn Accounts</td>
          <td>{{linkedinAccountsCount}}</td>
        </tr>
        <tr>
          <td>Markets Targeted</td>
          <td>{{#if linkedinMarketsTargeted}}{{#each linkedinMarketsTargeted}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}N/A{{/if}}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>InMail Campaigns</h2>
    <table>
      <thead>
        <tr>
          <th>Metric</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td># InMails Sent</td>
          <td>{{inmailSent}}</td>
        </tr>
        <tr>
          <td># Replies</td>
          <td>{{inmailReplies}}</td>
        </tr>
        <tr>
          <td>% Replied</td>
          <td>{{inmailRepliesPercentage}}</td>
        </tr>
        <tr>
          <td># Meetings Scheduled</td>
          <td>{{inmailMeetingsScheduled}}</td>
        </tr>
        <tr>
          <td>% Meetings Scheduled</td>
          <td>{{inmailMeetingsScheduledPercentage}}</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
    `;
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
   * Preview the report as HTML
   */
  async preview(
    id: string,
    userId: string,
    userRole: UserRole,
    previewDto?: PreviewSalesPerformanceReportDto,
  ): Promise<{ renderedHtml: string; templateId?: string | null }> {
    const report = await this.findOne(id, userId, userRole);
    const templateData = await this.prepareTemplateData(report);

    try {
      // Try to get template from database
      const templateTypeEnum = TemplateType.SALES_PERFORMANCE_REPORT;
      let renderedHtml: string;
      let usedTemplateId: string | null = null;

      if (previewDto?.templateId) {
        // Use specific template
        const template = await this.prisma.template.findUnique({
          where: { id: previewDto.templateId },
        });

        if (!template) {
          throw new NotFoundException(ErrorMessages.NOT_FOUND('Template', previewDto.templateId));
        }

        usedTemplateId = template.id;
        const htmlTemplate = template.cssContent
          ? `<style>${template.cssContent}</style>${template.htmlContent}`
          : template.htmlContent;
        renderedHtml = await this.renderTemplate(htmlTemplate, {
          ...templateData,
          ...(previewDto.templateData || {}),
        });
      } else {
        // Use default template
        const { html } = await this.templatesService.renderDefault(templateTypeEnum, {
          ...templateData,
          ...(previewDto?.templateData || {}),
        });
        renderedHtml = html;
      }

      return {
        renderedHtml,
        templateId: usedTemplateId,
      };
    } catch (error) {
      // Fallback to default template
      const fallbackTemplate = this.getDefaultTemplate();
      const renderedHtml = await this.renderTemplate(fallbackTemplate, {
        ...templateData,
        ...(previewDto?.templateData || {}),
      });
      return {
        renderedHtml,
        templateId: null,
      };
    }
  }

  /**
   * Send report via email
   */
  async send(
    id: string,
    userId: string,
    userRole: UserRole,
    sendDto: SendSalesPerformanceReportDto,
  ) {
    const report = await this.findOne(id, userId, userRole);

    if (!sendDto.to || sendDto.to.length === 0) {
      throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('recipient email addresses'));
    }

    // Generate PDF
    const pdfBuffer = await this.generatePdf(id, userId, userRole);

    // Prepare email
    const salespersonName = `${report.salesperson.firstName} ${report.salesperson.lastName}`;
    const weekEndingDate = new Date(report.weekEnding);
    const weekEndingFormatted = weekEndingDate.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const subject =
      sendDto.subject ||
      `Sales Performance Report - ${salespersonName} - Week Ending ${weekEndingFormatted}`;

    const message =
      sendDto.message ||
      `Dear Team,

Please find attached the weekly sales performance report for ${salespersonName} for the week ending ${weekEndingFormatted}.

Best regards,
Sales Team`;

    // Send email
    await this.emailService.sendEmail({
      to: sendDto.to,
      cc: sendDto.cc,
      subject,
      html: message.replace(/\n/g, '<br/>'),
      attachments: [
        {
          filename: `sales-performance-report-${salespersonName.replace(/\s+/g, '-')}-${weekEndingFormatted.replace(/\//g, '-')}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    // Update report with sent information
    const updatedReport = await this.prisma.salesPerformanceReport.update({
      where: { id },
      data: {
        pdfUrl: `sent-to-${sendDto.to.join(',')}-${new Date().toISOString()}`,
      },
      include: this.reportInclude,
    });

    return updatedReport;
  }
}


import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, LeaveRequestStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { CreateEodReportDto, EodReportTaskDto } from './dto/create-eod-report.dto';
import { UpdateEodReportDto } from './dto/update-eod-report.dto';
import { TemplatesService } from '../../templates/templates.service';
import { EmailService } from '../../../common/email/email.service';
import { TemplateType } from '@prisma/client';

@Injectable()
export class EodReportsService extends BaseService {
  constructor(
    prisma: PrismaService,
    private readonly templatesService: TemplatesService,
    private readonly emailService: EmailService,
  ) {
    super(prisma);
  }

  private async getCompanySettings() {
    return this.prisma.companySettings.findFirst();
  }

  private async getSubmissionDeadline(reportDate: Date) {
    const settings = await this.getCompanySettings();
    const deadline = new Date(reportDate);
    deadline.setHours(
      settings?.eodReportDeadlineHour ?? 23,
      settings?.eodReportDeadlineMin ?? 59,
      59,
      999,
    );

    const graceDays = settings?.eodGraceDays ?? 0;
    const minimumWindowDays = 1;
    const totalWindowDays = Math.max(graceDays, minimumWindowDays);
    if (totalWindowDays > 0) {
      deadline.setDate(deadline.getDate() + totalWindowDays);
    }

    return deadline;
  }

  private async computeIsLate(date: string) {
    const reportDate = new Date(date);
    const submissionDeadline = await this.getSubmissionDeadline(reportDate);
    const submissionTime = new Date();
    return submissionTime.getTime() > submissionDeadline.getTime();
  }

  private async computeIsLateForTimestamp(date: string, submissionTime: Date) {
    const reportDate = new Date(date);
    const submissionDeadline = await this.getSubmissionDeadline(reportDate);
    return submissionTime.getTime() > submissionDeadline.getTime();
  }

  private toDateOnly(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private async isHoliday(date: Date) {
    const result = await this.prisma.nationalHoliday.findFirst({
      where: {
        date: this.toDateOnly(date),
        country: 'AL',
      },
    });

    return !!result;
  }

  private async hasApprovedLeave(userId: string, date: Date) {
    const dateOnly = this.toDateOnly(date);
    const startOfDay = new Date(dateOnly);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateOnly);
    endOfDay.setHours(23, 59, 59, 999);

    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: LeaveRequestStatus.APPROVED,
        startDate: {
          lte: endOfDay,
        },
        endDate: {
          gte: startOfDay,
        },
      },
      select: { id: true },
    });

    return !!leave;
  }

  private async isWorkingDay(userId: string, date: Date) {
    const dateOnly = this.toDateOnly(date);

    const isWeekend = dateOnly.getDay() === 0 || dateOnly.getDay() === 6;
    if (isWeekend) {
      return false;
    }

    if (await this.isHoliday(dateOnly)) {
      return false;
    }

    if (await this.hasApprovedLeave(userId, dateOnly)) {
      return false;
    }

    return true;
  }

  async create(
    userId: string,
    employeeId: string,
    createDto: Omit<CreateEodReportDto, 'employeeId'>,
  ) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!employee) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Employee', employeeId));
    }

    if (employee.userId !== userId) {
      throw new ForbiddenException('EOD report must be linked to the associated employee user');
    }

    const { submit, tasks = [], ...rest } = createDto;
    if (!tasks.length) {
      throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('tasksWorkedOn (must contain at least 1 entry)'));
    }

    this.ensureNotFutureDate(rest.date);

    // Validate that the report date is a working day (not weekend or vacation)
    const reportDate = new Date(rest.date);
    const isWorkingDay = await this.isWorkingDay(userId, reportDate);
    if (!isWorkingDay) {
      throw new BadRequestException(
        ErrorMessages.OPERATION_NOT_ALLOWED('create EOD report', 'EOD reports cannot be created for weekends, holidays, or days when you are on approved leave'),
      );
    }

    let isLate = false;
    let submittedAt: Date | undefined;

    if (submit) {
      isLate = await this.computeIsLate(rest.date);
      submittedAt = new Date();
    }

    try {
      const tasksJson = tasks.map((task) => ({ ...task })) as Prisma.InputJsonValue;

      const report = await this.prisma.eodReport.create({
        data: {
          userId,
          date: new Date(rest.date),
          summary: rest.summary,
          tasksWorkedOn: tasksJson,
          hoursWorked:
            rest.hoursWorked !== undefined && rest.hoursWorked !== null
              ? new Prisma.Decimal(rest.hoursWorked)
              : null,
          isLate,
          submittedAt,
        },
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
      });

      // Send email notification if report was submitted
      if (submit && submittedAt && report.user?.email) {
        this.sendEodReportEmail(report).catch((error) => {
          this.logger.error('[EodReports] Failed to send email notification:', error);
        });
      }

      return report;
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException(ErrorMessages.ALREADY_EXISTS('EOD report', 'date'));
      }
      throw error;
    }
  }

  private async sendEodReportEmail(report: any) {
    const tasks = Array.isArray(report.tasksWorkedOn) ? report.tasksWorkedOn : [];
    const totalHours = tasks.reduce((sum: number, task: any) => {
      // Convert timeSpentOnTicket to number, handling Decimal, string, or number types
      const timeSpent = task.timeSpentOnTicket != null 
        ? (typeof task.timeSpentOnTicket === 'object' && 'toNumber' in task.timeSpentOnTicket
          ? task.timeSpentOnTicket.toNumber()
          : Number(task.timeSpentOnTicket) || 0)
        : 0;
      return sum + timeSpent;
    }, 0);

    const reportDate = new Date(report.date).toLocaleDateString();
    const userName = `${report.user.firstName} ${report.user.lastName}`;
    const hoursWorked = report.hoursWorked ? Number(report.hoursWorked) : totalHours;

    let html: string;
    let text: string;

    try {
      const rendered = await this.templatesService.renderDefault(
        TemplateType.EOD_REPORT_SUBMITTED,
        {
          report: {
            id: report.id,
            date: report.date,
            summary: report.summary,
            hoursWorked,
            isLate: report.isLate,
            submittedAt: report.submittedAt,
            tasks: tasks.map((task: any) => {
              // Convert timeSpentOnTicket to number, handling Decimal, string, or number types
              const timeSpent = task.timeSpentOnTicket != null 
                ? (typeof task.timeSpentOnTicket === 'object' && 'toNumber' in task.timeSpentOnTicket
                  ? task.timeSpentOnTicket.toNumber()
                  : Number(task.timeSpentOnTicket) || 0)
                : 0;
              
              return {
                clientDetails: task.clientDetails,
                ticket: task.ticket,
                typeOfWorkDone: task.typeOfWorkDone,
                timeSpent: timeSpent,
                taskLifecycle: task.taskLifecycle,
                taskStatus: task.taskStatus,
              };
            }),
          },
          user: {
            firstName: report.user.firstName,
            lastName: report.user.lastName,
            email: report.user.email,
          },
        },
      );
      html = rendered.html;
      text = rendered.text;
    } catch (templateError) {
      this.logger.warn(
        `[EodReportsService] Failed to render EOD template, falling back to default HTML:`,
        templateError,
      );
      // Map tasks for fallback template, converting timeSpentOnTicket to timeSpent
      const mappedTasks = tasks.map((task: any) => {
        // Convert timeSpentOnTicket to number, handling Decimal, string, or number types
        const timeSpent = task.timeSpentOnTicket != null 
          ? (typeof task.timeSpentOnTicket === 'object' && 'toNumber' in task.timeSpentOnTicket
            ? task.timeSpentOnTicket.toNumber()
            : Number(task.timeSpentOnTicket) || 0)
          : 0;
        
        return {
          ...task,
          timeSpent: timeSpent,
        };
      });
      
      // Fallback to default HTML template
      html = this.getDefaultEodTemplate({
        userName,
        reportDate,
        hoursWorked,
        summary: report.summary,
        tasks: mappedTasks,
        isLate: report.isLate,
      });
      text = this.getDefaultEodText({
        userName,
        reportDate,
        hoursWorked,
        summary: report.summary,
        tasks: mappedTasks,
        isLate: report.isLate,
      });
    }

    const subject = `EOD Report Submitted - ${reportDate}`;
    try {
      await this.emailService.sendEmail({
        to: report.user.email,
        subject,
        html,
        text,
      });
    } catch (error) {
      this.logger.error('[EodReportsService] Failed to send EOD report email:', error);
      // Don't throw - email failure shouldn't break the report submission
    }
  }

  private getDefaultEodTemplate(data: {
    userName: string;
    reportDate: string;
    hoursWorked: number;
    summary: string;
    tasks: any[];
    isLate: boolean;
  }): string {
    const tasksList = data.tasks
      .map(
        (task) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.ticket || task.clientDetails || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${Array.isArray(task.typeOfWorkDone) ? task.typeOfWorkDone.join(', ') : task.typeOfWorkDone || 'N/A'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${task.timeSpent || 0} hours</td>
      </tr>
    `,
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
          .section { margin-bottom: 20px; }
          .label { font-weight: bold; color: #6b7280; margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; background-color: white; }
          th { background-color: #f3f4f6; padding: 10px; text-align: left; font-weight: bold; border-bottom: 2px solid #e5e7eb; }
          td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
          .late-badge { display: inline-block; background-color: #ef4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">EOD Report Submitted</h1>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">${data.reportDate}${data.isLate ? '<span class="late-badge">LATE</span>' : ''}</p>
        </div>
        <div class="content">
          <div class="section">
            <div class="label">Employee:</div>
            <div>${data.userName}</div>
          </div>
          <div class="section">
            <div class="label">Hours Worked:</div>
            <div><strong>${data.hoursWorked} hours</strong></div>
          </div>
          ${data.summary ? `
          <div class="section">
            <div class="label">Summary:</div>
            <div>${data.summary.replace(/\n/g, '<br>')}</div>
          </div>
          ` : ''}
          ${data.tasks.length > 0 ? `
          <div class="section">
            <div class="label">Tasks Worked On:</div>
            <table>
              <thead>
                <tr>
                  <th>Ticket/Client</th>
                  <th>Type of Work</th>
                  <th>Time Spent</th>
                </tr>
              </thead>
              <tbody>
                ${tasksList}
              </tbody>
            </table>
          </div>
          ` : ''}
        </div>
      </body>
      </html>
    `;
  }

  private getDefaultEodText(data: {
    userName: string;
    reportDate: string;
    hoursWorked: number;
    summary: string;
    tasks: any[];
    isLate: boolean;
  }): string {
    const tasksList = data.tasks
      .map(
        (task) =>
          `- ${task.ticket || task.clientDetails || 'N/A'}: ${Array.isArray(task.typeOfWorkDone) ? task.typeOfWorkDone.join(', ') : task.typeOfWorkDone || 'N/A'} (${task.timeSpent || 0} hours)`,
      )
      .join('\n');

    return `EOD Report Submitted - ${data.reportDate}${data.isLate ? ' [LATE]' : ''}

Employee: ${data.userName}
Hours Worked: ${data.hoursWorked} hours

${data.summary ? `Summary:\n${data.summary}\n\n` : ''}${data.tasks.length > 0 ? `Tasks Worked On:\n${tasksList}` : ''}`;
  }

  async findAll(filters?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(filters?.page ?? 1, 1);
    const rawPageSize = filters?.pageSize ?? 25;
    const pageSize = Math.min(Math.max(rawPageSize, 1), 100);
    const skip = (page - 1) * pageSize;

    // Debug logging
    this.logger.log('EOD findAll called with filters:', {
      page: filters?.page,
      pageSize: filters?.pageSize,
      computedPage: page,
      computedPageSize: pageSize,
      skip,
      userId: filters?.userId,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });

    const baseWhere = QueryBuilder.buildWhereClause<Prisma.EodReportWhereInput>(
      filters || {},
      {
        dateFields: ['date'],
        fieldMappings: {
          startDate: 'date',
          endDate: 'date',
        },
      },
    );

    // Handle date range filtering
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        dateFilter.lte = new Date(filters.endDate);
      }
      baseWhere.date = dateFilter;
    }

    const where = baseWhere;

    const result = await this.paginate(
      this.prisma.eodReport,
      where,
      {
        page,
        pageSize,
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
        orderBy: {
          date: 'desc',
        },
      },
    );

    return result;
  }

  async findOne(id: string) {
    const report = await this.prisma.eodReport.findUnique({
      where: { id },
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
    });

    if (!report) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('EOD report', id));
    }

    return report;
  }

  async update(
    id: string,
    requesterId: string,
    updateDto: UpdateEodReportDto,
    canManageOthers: boolean,
  ) {
    const report = await this.findOne(id);

    if (report.userId !== requesterId && !canManageOthers) {
      throw new ForbiddenException('You can only update your own EOD reports');
    }

    // Regular users can edit submitted reports within grace period (configured in company settings)
    // ADMIN/HR can always edit
    if (!canManageOthers && report.submittedAt) {
      const settings = await this.getCompanySettings();
      const graceDays = settings?.eodGraceDays ?? 1; // Default to 1 day if not set
      
      const reportDate = report.date instanceof Date ? report.date : new Date(report.date);
      
      // Calculate the grace period end (graceDays after the report date)
      // For a report due on Tuesday with graceDays=1, it can be edited until Wednesday
      const gracePeriodEnd = new Date(reportDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + graceDays);
      gracePeriodEnd.setHours(23, 59, 59, 999); // End of the grace period day
      
      const now = new Date();
      
      // Check if we're still within the grace period
      if (now > gracePeriodEnd) {
      throw new BadRequestException(
        ErrorMessages.OPERATION_NOT_ALLOWED('edit EOD report', `can only be edited within ${graceDays} day${graceDays !== 1 ? 's' : ''} after its due date. The grace period ended on ${gracePeriodEnd.toLocaleDateString()}`)
      );
      }
    }

    const { submit, submittedAt, ...rest } = updateDto;
    const data: Prisma.EodReportUpdateInput = {};

    if (rest.summary !== undefined) {
      data.summary = rest.summary;
    }

    // Allow ADMIN/HR to change the report date
    if (rest.date !== undefined && canManageOthers) {
      this.ensureNotFutureDate(rest.date);
      const newDate = new Date(rest.date);
      const currentDate = report.date instanceof Date ? report.date : new Date(report.date);
      
      // Check if date is actually changing
      const dateChanged = newDate.toISOString().split('T')[0] !== currentDate.toISOString().split('T')[0];
      
      if (dateChanged) {
        // Check if another report already exists for this user on the new date
        const existingReport = await this.prisma.eodReport.findUnique({
          where: {
            userId_date: {
              userId: report.userId,
              date: newDate,
            },
          },
        });

        if (existingReport && existingReport.id !== id) {
        throw new BadRequestException(
          ErrorMessages.ALREADY_EXISTS('EOD report', `date ${rest.date}. Please delete or update the existing report first`),
        );
        }
      }
      
      data.date = newDate;
    }

    let nextTasks: EodReportTaskDto[] | undefined;

    if (rest.tasks) {
      if (!rest.tasks.length) {
        throw new BadRequestException(ErrorMessages.MISSING_REQUIRED_FIELD('tasksWorkedOn (must contain at least 1 entry)'));
      }
      nextTasks = rest.tasks;
      data.tasksWorkedOn = rest.tasks.map((task) => ({ ...task })) as Prisma.InputJsonValue;
    }

    if (rest.hoursWorked !== undefined) {
      data.hoursWorked = rest.hoursWorked !== null
        ? new Prisma.Decimal(rest.hoursWorked)
        : null;
    }

    // Allow ADMIN/HR to manually set or clear submittedAt
    if (submittedAt !== undefined && canManageOthers) {
      data.submittedAt = submittedAt ? new Date(submittedAt) : null;
      // Recalculate isLate based on the provided submittedAt and report date
      if (submittedAt) {
        const reportDateToUse = rest.date ? new Date(rest.date) : report.date;
        data.isLate = await this.computeIsLateForTimestamp(
          reportDateToUse.toISOString(),
          new Date(submittedAt),
        );
      }
    }

    if (submit) {
      const reportDate = report.date instanceof Date ? report.date : new Date(report.date);
      const isWorkingDay = await this.isWorkingDay(report.userId, reportDate);
      if (!isWorkingDay && !canManageOthers) {
        throw new BadRequestException('EOD reports are not required on approved leave or holidays.');
      }
      const currentTasks =
        nextTasks ??
        (Array.isArray(report.tasksWorkedOn)
          ? (report.tasksWorkedOn as unknown as EodReportTaskDto[])
          : []);

      if (!currentTasks.length) {
        throw new BadRequestException('Add at least one task before submitting the report.');
      }

      data.submittedAt = new Date();
      data.isLate = await this.computeIsLate(report.date.toISOString());
    } else if (!canManageOthers) {
      const reportDate = report.date instanceof Date ? report.date : new Date(report.date);
      const isWorkingDay = await this.isWorkingDay(report.userId, reportDate);
      if (!isWorkingDay) {
        data.isLate = false;
      }
    }

    const updatedReport = await this.prisma.eodReport.update({
      where: { id },
      data,
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
    });

    // Send email notification if report was just submitted (wasn't submitted before, but is now)
    if (submit && !report.submittedAt && updatedReport.submittedAt && updatedReport.user?.email) {
      this.sendEodReportEmail(updatedReport).catch((error) => {
        this.logger.error('[EodReports] Failed to send email notification:', error);
      });
    }

    return updatedReport;
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.eodReport.delete({
      where: { id },
    });
  }

  private ensureNotFutureDate(dateString: string) {
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('Invalid report date provided.');
    }

    const reportDateUTC = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    if (reportDateUTC > todayUTC) {
      throw new BadRequestException('EOD reports cannot be submitted for future dates.');
    }
  }
}



import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AiCollectionFormat,
  AiCollectionKey,
  AiEntityType,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

interface CollectionFieldSelector<T> {
  key: string;
  label: string;
  description?: string;
  select: (row: T) => unknown;
}

interface CollectionFilterDefinition {
  key: string;
  label: string;
  type: 'date' | 'text' | 'select' | 'boolean' | 'number';
  description?: string;
  options?: Array<{ value: string; label: string }>;
  multi?: boolean;
}

export interface CollectionDefinition<T> {
  key: AiCollectionKey;
  label: string;
  description?: string;
  defaultLimit: number;
  defaultFormat: AiCollectionFormat;
  fields: CollectionFieldSelector<T>[];
  filters?: CollectionFilterDefinition[];
  resolve: (params: { entityId: string; limit: number; filters?: Record<string, unknown> | undefined }) => Promise<T[]>;
  resolveBulk?: (params: { limit: number; filters?: Record<string, unknown> | undefined }) => Promise<T[]>;
  format?: AiCollectionFormat[];
}

export interface CollectionSummary {
  collectionKey: AiCollectionKey;
  label: string;
  description?: string;
  defaultLimit: number;
  defaultFormat: AiCollectionFormat;
  supportedFormats: AiCollectionFormat[];
  filters?: CollectionFilterDefinition[];
}

export interface CollectionFieldMetadata {
  key: string;
  label: string;
  description?: string;
}

type CollectionMap<T> = Partial<Record<AiCollectionKey, CollectionDefinition<T>>>;

type CandidateOpportunityPayload = Prisma.CandidatePositionGetPayload<{
  include: {
    position: {
      include: {
        opportunity: {
          select: {
            id: true;
            title: true;
            stage: true;
            type: true;
            value: true;
            updatedAt: true;
          };
        };
      };
    };
  };
}>;

type OpportunityPayload = Prisma.OpportunityGetPayload<{
  select: {
    id: true;
    title: true;
    stage: true;
    type: true;
    value: true;
    updatedAt: true;
  };
}>;

type LeadPayload = Prisma.LeadGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    expectedCloseDate: true;
    source: true;
    createdAt: true;
  };
}>;

type ActivityPayload = Prisma.ActivityGetPayload<{
  select: {
    id: true;
    subject: true;
    createdAt: true;
    activityType: {
      select: { name: true };
    };
    body: true;
  };
}>;

type TaskPayload = Prisma.TaskGetPayload<{
  select: {
    id: true;
    title: true;
    status: true;
    priority: true;
    dueDate: true;
    createdAt: true;
  };
}>;

type EodReportPayload = Prisma.EodReportGetPayload<{
  select: {
    id: true;
    date: true;
    summary: true;
    hoursWorked: true;
    isLate: true;
    submittedAt: true;
    tasksWorkedOn: true;
  };
}>;

type QuotePayload = Prisma.QuoteGetPayload<{
  select: {
    id: true;
    quoteNumber: true;
    title: true;
    status: true;
    totalValue: true;
    currency: true;
    createdAt: true;
    sentAt: true;
  };
}>;

type FeedbackReportPayload = Prisma.FeedbackReportGetPayload<{
  select: {
    id: true;
    month: true;
    year: true;
    status: true;
    tasksCount: true;
    totalDaysOffTaken: true;
    totalRemainingDaysOff: true;
    hrFeedback: true;
    amFeedback: true;
    communicationRating: true;
    collaborationRating: true;
    taskEstimationRating: true;
    timelinessRating: true;
    employeeSummary: true;
    submittedAt: true;
    sentAt: true;
    sentTo: true;
    createdAt: true;
    amUpdatedBy: true;
  };
}>;

type CheckInOutPayload = Prisma.CheckInOutGetPayload<{
  select: {
    id: true;
    dateTime: true;
    status: true;
    createdAt: true;
  };
}>;

type EodReportWithEmployeePayload = EodReportPayload & {
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

type CheckInOutWithEmployeePayload = CheckInOutPayload & {
  employee?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

@Injectable()
export class CollectionFieldResolver {
  constructor(private readonly prisma: PrismaService) {}

  private formatEodTasks(tasks: Prisma.JsonValue | null | undefined): string | null {
    if (!tasks) {
      return null;
    }

    if (typeof tasks === 'string') {
      return tasks.trim();
    }

    let entries: unknown[] = [];
    if (Array.isArray(tasks)) {
      entries = tasks;
    } else {
      entries = [tasks];
    }

    const lines = entries
      .map((entry) => {
        if (typeof entry === 'string') {
          return entry.trim();
        }

        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          const clientDetails = this.safeString(record.clientDetails);
          const ticket = this.safeString(record.ticket);
          const workType = this.safeString(record.typeOfWorkDone);
          const lifecycle = this.safeString(record.taskLifecycle);
          const status = this.safeString(record.taskStatus);
          const estimated = this.toNumber(record.taskEstimatedTime);
          const spent = this.toNumber(record.timeSpentOnTicket);

          const parts: string[] = [];
          if (clientDetails) {
            parts.push(clientDetails);
          }
          if (ticket) {
            parts.push(`#${ticket}`);
          }
          if (workType) {
            parts.push(workType.replace(/_/g, ' '));
          }
          if (lifecycle) {
            parts.push(`Lifecycle: ${lifecycle.replace(/_/g, ' ')}`);
          }
          if (status) {
            parts.push(`Status: ${status.replace(/_/g, ' ')}`);
          }
          if (estimated !== null) {
            parts.push(`Est: ${estimated}h`);
          }
          if (spent !== null) {
            parts.push(`Spent: ${spent}h`);
          }

          if (parts.length === 0) {
            return null;
          }
          return parts.join(' • ');
        }

        return null;
      })
      .filter((line): line is string => !!line && line.trim().length > 0);

    if (lines.length === 0) {
      return null;
    }

    return lines.map((line, index) => `${index + 1}. ${line}`).join('\n');
  }

  private safeString(value: unknown): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    if (typeof value === 'string') {
      return value.trim();
    }
    return String(value);
  }

  private toNumber(value: unknown): number | null {
    if (value === undefined || value === null) {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
  }

  private parseDate(value: unknown): Date | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return undefined;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private parseBoolean(value: unknown): boolean | undefined {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
        return true;
      }
      if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
        return false;
      }
    }
    return undefined;
  }

  private parseStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry)).filter((entry) => entry.trim().length > 0);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }
    return [];
  }

  private readonly definitions: Partial<Record<AiEntityType, CollectionMap<any>>> = {
    EMPLOYEE: {
      [AiCollectionKey.EOD_REPORTS]: {
        key: AiCollectionKey.EOD_REPORTS,
        label: 'EOD Reports',
        description: 'Recent end-of-day reports submitted by this employee.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Start date',
            type: 'date',
            description: 'Include reports on or after this date',
          },
          {
            key: 'endDate',
            label: 'End date',
            type: 'date',
            description: 'Include reports on or before this date',
          },
          {
            key: 'lateOnly',
            label: 'Late submissions only',
            type: 'boolean',
            description: 'Show only reports submitted after the deadline',
          },
        ],
        fields: [
          {
            key: 'employeeName',
            label: 'Employee',
            description: 'Employee name',
            select: (report: EodReportPayload | EodReportWithEmployeePayload) =>
              (report as EodReportWithEmployeePayload).employee
                ? `${(report as EodReportWithEmployeePayload).employee!.firstName} ${(report as EodReportWithEmployeePayload).employee!.lastName}`
                : null,
          },
          { key: 'date', label: 'Date', description: 'Report date', select: (report: EodReportPayload) => report.date },
          {
            key: 'summary',
            label: 'Summary',
            description: 'Daily summary of accomplishments',
            select: (report: EodReportPayload) => report.summary,
          },
          {
            key: 'tasksWorkedOn',
            label: 'Tasks',
            description: 'Tasks worked on during the day',
            select: (report: EodReportPayload) => this.formatEodTasks(report.tasksWorkedOn),
          },
          {
            key: 'hoursWorked',
            label: 'Hours Worked',
            description: 'Reported hours worked',
            select: (report: EodReportPayload) => report.hoursWorked ? report.hoursWorked.toNumber?.() ?? report.hoursWorked : null,
          },
          {
            key: 'isLate',
            label: 'Late Submission',
            description: 'Whether the report was submitted late',
            select: (report: EodReportPayload) => (report.isLate ? 'Yes' : 'No'),
          },
          {
            key: 'submittedAt',
            label: 'Submitted At',
            description: 'Timestamp when the report was submitted',
            select: (report: EodReportPayload) => report.submittedAt,
          },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);
          const lateOnly = this.parseBoolean(filters?.lateOnly);

          const employee = await this.prisma.employee.findUnique({
            where: { id: entityId },
            select: { userId: true },
          });

          if (!employee?.userId) {
            return [];
          }

          const where: Prisma.EodReportWhereInput = {
            userId: employee.userId,
          };

          if (startDate || endDate) {
            where.date = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          if (lateOnly === true) {
            where.isLate = true;
          }

          return this.prisma.eodReport.findMany({
            where,
            orderBy: { date: 'desc' },
            take: limit,
            select: {
              id: true,
              date: true,
              summary: true,
              hoursWorked: true,
              isLate: true,
              submittedAt: true,
              tasksWorkedOn: true,
            },
          });
        },
        resolveBulk: async ({ limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);
          const lateOnly = this.parseBoolean(filters?.lateOnly);

          const where: Prisma.EodReportWhereInput = {};

          if (startDate || endDate) {
            where.date = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          if (lateOnly === true) {
            where.isLate = true;
          }

          const reports = await this.prisma.eodReport.findMany({
            where,
            orderBy: { date: 'desc' },
            take: limit,
            select: {
              id: true,
              date: true,
              summary: true,
              hoursWorked: true,
              isLate: true,
              submittedAt: true,
              tasksWorkedOn: true,
              userId: true,
            },
          });

          // Fetch employee information for each report
          const userIds = [...new Set(reports.map((r) => r.userId).filter(Boolean))];
          const employees = await this.prisma.employee.findMany({
            where: { userId: { in: userIds } },
            select: {
              id: true,
              userId: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          });

          const employeeMap = new Map(
            employees.map((e) => [
              e.userId,
              e.user
                ? {
                    id: e.id,
                    firstName: e.user.firstName,
                    lastName: e.user.lastName,
                    email: e.user.email,
                  }
                : null,
            ]),
          );

          return reports.map((report) => ({
            ...report,
            employee: report.userId ? employeeMap.get(report.userId) ?? null : null,
          })) as EodReportWithEmployeePayload[];
        },
      },
      [AiCollectionKey.TASKS]: {
        key: AiCollectionKey.TASKS,
        label: 'Assigned Tasks',
        description: 'Current tasks assigned to this employee.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Due on/after',
            type: 'date',
            description: 'Include tasks due on or after this date',
          },
          {
            key: 'endDate',
            label: 'Due on/before',
            type: 'date',
            description: 'Include tasks due on or before this date',
          },
        ],
        fields: [
          { key: 'title', label: 'Title', select: (task: TaskPayload) => task.title },
          { key: 'status', label: 'Status', select: (task: TaskPayload) => task.status },
          { key: 'priority', label: 'Priority', select: (task: TaskPayload) => task.priority },
          { key: 'dueDate', label: 'Due Date', select: (task: TaskPayload) => task.dueDate },
          { key: 'createdAt', label: 'Created', select: (task: TaskPayload) => task.createdAt },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const employee = await this.prisma.employee.findUnique({
            where: { id: entityId },
            select: { userId: true },
          });
          if (!employee?.userId) {
            return [];
          }

          const where: Prisma.TaskWhereInput = {
            assignedToId: employee.userId,
          };

          if (startDate || endDate) {
            where.dueDate = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.task.findMany({
            where,
            orderBy: { dueDate: 'asc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true,
            },
          });
        },
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Most recent activities related to this employee.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
            description: 'Include activities logged on or after this date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
            description: 'Include activities logged on or before this date',
          },
        ],
        fields: [
          { key: 'subject', label: 'Subject', select: (activity: ActivityPayload) => activity.subject },
          {
            key: 'type',
            label: 'Type',
            select: (activity: ActivityPayload) => activity.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (activity: ActivityPayload) => activity.createdAt },
          { key: 'body', label: 'Details', select: (activity: ActivityPayload) => activity.body },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.ActivityWhereInput = {
            employeeId: entityId,
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.activity.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          });
        },
      },
      [AiCollectionKey.FEEDBACK_REPORTS]: {
        key: AiCollectionKey.FEEDBACK_REPORTS,
        label: 'Feedback Reports',
        description: 'Monthly feedback reports for this employee. Accessible by both employee and account manager.',
        defaultLimit: 6,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'year',
            label: 'Year',
            type: 'number',
            description: 'Filter by report year',
          },
          {
            key: 'month',
            label: 'Month',
            type: 'number',
            description: 'Filter by report month (1-12)',
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SUBMITTED', label: 'Submitted' },
              { value: 'SENT', label: 'Sent' },
            ],
          },
          {
            key: 'hasAmFeedback',
            label: 'Has AM feedback',
            type: 'boolean',
            description: 'Show only reports with account manager feedback',
          },
          {
            key: 'hasHrFeedback',
            label: 'Has HR feedback',
            type: 'boolean',
            description: 'Show only reports with HR feedback',
          },
          {
            key: 'amUpdatedBy',
            label: 'Account Manager',
            type: 'text',
            description: 'Filter by account manager user ID who updated the report',
          },
        ],
        fields: [
          {
            key: 'period',
            label: 'Period',
            description: 'Month and year of the report',
            select: (report: FeedbackReportPayload) => {
              const monthNames = [
                'January',
                'February',
                'March',
                'April',
                'May',
                'June',
                'July',
                'August',
                'September',
                'October',
                'November',
                'December',
              ];
              return `${monthNames[report.month - 1]} ${report.year}`;
            },
          },
          { key: 'status', label: 'Status', select: (report: FeedbackReportPayload) => report.status },
          {
            key: 'tasksCount',
            label: 'Tasks Count',
            select: (report: FeedbackReportPayload) => report.tasksCount ?? null,
          },
          {
            key: 'totalDaysOffTaken',
            label: 'Days Off Taken',
            select: (report: FeedbackReportPayload) => report.totalDaysOffTaken ?? null,
          },
          {
            key: 'totalRemainingDaysOff',
            label: 'Remaining Days Off',
            select: (report: FeedbackReportPayload) => report.totalRemainingDaysOff ?? null,
          },
          {
            key: 'hrFeedback',
            label: 'HR Feedback',
            select: (report: FeedbackReportPayload) => report.hrFeedback ?? null,
          },
          {
            key: 'amFeedback',
            label: 'AM Feedback',
            select: (report: FeedbackReportPayload) => report.amFeedback ?? null,
          },
          {
            key: 'communicationRating',
            label: 'Communication Rating',
            select: (report: FeedbackReportPayload) => report.communicationRating ?? null,
          },
          {
            key: 'collaborationRating',
            label: 'Collaboration Rating',
            select: (report: FeedbackReportPayload) => report.collaborationRating ?? null,
          },
          {
            key: 'taskEstimationRating',
            label: 'Task Estimation Rating',
            select: (report: FeedbackReportPayload) => report.taskEstimationRating ?? null,
          },
          {
            key: 'timelinessRating',
            label: 'Timeliness Rating',
            select: (report: FeedbackReportPayload) => report.timelinessRating ?? null,
          },
          {
            key: 'employeeSummary',
            label: 'Employee Summary',
            select: (report: FeedbackReportPayload) => report.employeeSummary ?? null,
          },
          {
            key: 'submittedAt',
            label: 'Submitted At',
            select: (report: FeedbackReportPayload) => (report.submittedAt ? report.submittedAt.toISOString() : null),
          },
          {
            key: 'sentAt',
            label: 'Sent At',
            select: (report: FeedbackReportPayload) => (report.sentAt ? report.sentAt.toISOString() : null),
          },
          {
            key: 'sentTo',
            label: 'Sent To',
            select: (report: FeedbackReportPayload) => report.sentTo ?? null,
          },
          {
            key: 'createdAt',
            label: 'Created',
            select: (report: FeedbackReportPayload) => report.createdAt.toISOString(),
          },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const year = typeof filters?.year === 'number' ? filters.year : undefined;
          const month = typeof filters?.month === 'number' ? filters.month : undefined;
          const status = typeof filters?.status === 'string' ? filters.status : undefined;
          const hasAmFeedback = this.parseBoolean(filters?.hasAmFeedback);
          const hasHrFeedback = this.parseBoolean(filters?.hasHrFeedback);
          const amUpdatedBy = typeof filters?.amUpdatedBy === 'string' && filters.amUpdatedBy.trim().length > 0
            ? filters.amUpdatedBy.trim()
            : undefined;

          const where: Prisma.FeedbackReportWhereInput = {
            employeeId: entityId,
            ...(year ? { year } : {}),
            ...(month ? { month } : {}),
            ...(status ? { status: status as any } : {}),
            ...(hasAmFeedback === true ? { amFeedback: { not: null } } : {}),
            ...(hasHrFeedback === true ? { hrFeedback: { not: null } } : {}),
            ...(amUpdatedBy ? { amUpdatedBy } : {}),
          };

          return this.prisma.feedbackReport.findMany({
            where,
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
            take: limit,
            select: {
              id: true,
              month: true,
              year: true,
              status: true,
              tasksCount: true,
              totalDaysOffTaken: true,
              totalRemainingDaysOff: true,
              hrFeedback: true,
              amFeedback: true,
              communicationRating: true,
              collaborationRating: true,
              taskEstimationRating: true,
              timelinessRating: true,
              employeeSummary: true,
              submittedAt: true,
              sentAt: true,
              sentTo: true,
              createdAt: true,
              amUpdatedBy: true,
            },
          });
        },
      },
      [AiCollectionKey.CHECK_IN_OUTS]: {
        key: AiCollectionKey.CHECK_IN_OUTS,
        label: 'Check-In/Check-Out Records',
        description: 'Recent check-in and check-out records for this employee.',
        defaultLimit: 10,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Start date',
            type: 'date',
            description: 'Include records on or after this date',
          },
          {
            key: 'endDate',
            label: 'End date',
            type: 'date',
            description: 'Include records on or before this date',
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'IN', label: 'Check-In' },
              { value: 'OUT', label: 'Check-Out' },
            ],
            description: 'Filter by check-in or check-out status',
          },
        ],
        fields: [
          {
            key: 'employeeName',
            label: 'Employee',
            description: 'Employee name',
            select: (record: CheckInOutPayload | CheckInOutWithEmployeePayload) =>
              (record as CheckInOutWithEmployeePayload).employee
                ? `${(record as CheckInOutWithEmployeePayload).employee!.firstName} ${(record as CheckInOutWithEmployeePayload).employee!.lastName}`
                : null,
          },
          {
            key: 'dateTime',
            label: 'Date & Time',
            description: 'Check-in or check-out timestamp',
            select: (record: CheckInOutPayload) => record.dateTime.toISOString(),
          },
          {
            key: 'status',
            label: 'Status',
            description: 'Check-in or check-out status',
            select: (record: CheckInOutPayload) => record.status,
          },
          {
            key: 'createdAt',
            label: 'Created',
            description: 'When the record was created',
            select: (record: CheckInOutPayload) => record.createdAt.toISOString(),
          },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);
          const status = typeof filters?.status === 'string' ? filters.status : undefined;

          const where: Prisma.CheckInOutWhereInput = {
            employeeId: entityId,
            ...(status ? { status: status as any } : {}),
          };

          if (startDate || endDate) {
            where.dateTime = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.checkInOut.findMany({
            where,
            orderBy: { dateTime: 'desc' },
            take: limit,
            select: {
              id: true,
              dateTime: true,
              status: true,
              createdAt: true,
            },
          });
        },
        resolveBulk: async ({ limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);
          const status = typeof filters?.status === 'string' ? filters.status : undefined;

          const where: Prisma.CheckInOutWhereInput = {
            ...(status ? { status: status as any } : {}),
          };

          if (startDate || endDate) {
            where.dateTime = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          const records = await this.prisma.checkInOut.findMany({
            where,
            orderBy: { dateTime: 'desc' },
            take: limit,
            select: {
              id: true,
              dateTime: true,
              status: true,
              createdAt: true,
              employeeId: true,
            },
          });

          // Fetch employee information for each record
          const employeeIds = [...new Set(records.map((r) => r.employeeId).filter(Boolean))];
          const employees = await this.prisma.employee.findMany({
            where: { id: { in: employeeIds } },
            select: {
              id: true,
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          });

          const employeeMap = new Map(
            employees.map((e) => [
              e.id,
              e.user
                ? {
                    id: e.id,
                    firstName: e.user.firstName,
                    lastName: e.user.lastName,
                    email: e.user.email,
                  }
                : null,
            ]),
          );

          return records.map((record) => ({
            ...record,
            employee: record.employeeId ? employeeMap.get(record.employeeId) ?? null : null,
          })) as CheckInOutWithEmployeePayload[];
        },
      },
    },
    CUSTOMER: {
      [AiCollectionKey.OPPORTUNITIES]: {
        key: AiCollectionKey.OPPORTUNITIES,
        label: 'Opportunities',
        description: 'Opportunities linked to this customer.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Updated on/after',
            type: 'date',
            description: 'Include opportunities updated on or after this date',
          },
          {
            key: 'endDate',
            label: 'Updated on/before',
            type: 'date',
            description: 'Include opportunities updated on or before this date',
          },
        ],
        fields: [
          { key: 'title', label: 'Title', select: (row: OpportunityPayload) => row.title },
          { key: 'stage', label: 'Stage', select: (row: OpportunityPayload) => row.stage },
          { key: 'type', label: 'Type', select: (row: OpportunityPayload) => row.type },
          {
            key: 'value',
            label: 'Value',
            select: (row: OpportunityPayload) => row.value ? row.value.toNumber?.() ?? row.value : null,
          },
          { key: 'updatedAt', label: 'Updated', select: (row: OpportunityPayload) => row.updatedAt },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.OpportunityWhereInput = {
            customerId: entityId,
          };

          if (startDate || endDate) {
            where.updatedAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.opportunity.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              stage: true,
              type: true,
              value: true,
              updatedAt: true,
            },
          });
        },
      },
      [AiCollectionKey.LEADS]: {
        key: AiCollectionKey.LEADS,
        label: 'Related Leads',
        description: 'Leads converted into this customer.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
            description: 'Include leads created on or after this date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
            description: 'Include leads created on or before this date',
          },
        ],
        fields: [
          { key: 'title', label: 'Title', select: (row: LeadPayload) => row.title },
          { key: 'status', label: 'Status', select: (row: LeadPayload) => row.status },
          {
            key: 'expectedCloseDate',
            label: 'Expected Close',
            select: (row: LeadPayload) => row.expectedCloseDate,
          },
          { key: 'source', label: 'Source', select: (row: LeadPayload) => row.source },
          { key: 'createdAt', label: 'Created', select: (row: LeadPayload) => row.createdAt },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.LeadWhereInput = {
            convertedCustomerId: entityId,
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              expectedCloseDate: true,
              source: true,
              createdAt: true,
            },
          });
        },
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities involving this customer.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
            description: 'Include activities logged on or after this date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
            description: 'Include activities logged on or before this date',
          },
        ],
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.ActivityWhereInput = {
            customerId: entityId,
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.activity.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          });
        },
      },
      [AiCollectionKey.TASKS]: {
        key: AiCollectionKey.TASKS,
        label: 'Customer Tasks',
        description: 'Tasks associated with this customer.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Due on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Due on/before',
            type: 'date',
          },
        ],
        fields: [
          { key: 'title', label: 'Title', select: (row: TaskPayload) => row.title },
          { key: 'status', label: 'Status', select: (row: TaskPayload) => row.status },
          { key: 'priority', label: 'Priority', select: (row: TaskPayload) => row.priority },
          { key: 'dueDate', label: 'Due Date', select: (row: TaskPayload) => row.dueDate },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.TaskWhereInput = {
            customerId: entityId,
          };

          if (startDate || endDate) {
            where.dueDate = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.task.findMany({
            where,
            orderBy: { dueDate: 'asc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              priority: true,
              dueDate: true,
              createdAt: true,
            },
          });
        },
      },
    },
    LEAD: {
      [AiCollectionKey.OPPORTUNITIES]: {
        key: AiCollectionKey.OPPORTUNITIES,
        label: 'Opportunities',
        description: 'Opportunities created from this lead.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Updated on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Updated on/before',
            type: 'date',
          },
        ],
        fields: [
          { key: 'title', label: 'Title', select: (row: OpportunityPayload) => row.title },
          { key: 'stage', label: 'Stage', select: (row: OpportunityPayload) => row.stage },
          {
            key: 'value',
            label: 'Value',
            select: (row: OpportunityPayload) => row.value ? row.value.toNumber?.() ?? row.value : null,
          },
          { key: 'updatedAt', label: 'Updated', select: (row: OpportunityPayload) => row.updatedAt },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.OpportunityWhereInput = {
            leadId: entityId,
          };

          if (startDate || endDate) {
            where.updatedAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.opportunity.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              stage: true,
              type: true,
              value: true,
              updatedAt: true,
            },
          });
        },
      },
      [AiCollectionKey.QUOTES]: {
        key: AiCollectionKey.QUOTES,
        label: 'Quotes',
        description: 'Quotes associated with this lead.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
          },
          {
            key: 'status',
            label: 'Status',
            type: 'select',
            options: [
              { value: 'DRAFT', label: 'Draft' },
              { value: 'SENT', label: 'Sent' },
              { value: 'ACCEPTED', label: 'Accepted' },
              { value: 'REJECTED', label: 'Rejected' },
              { value: 'EXPIRED', label: 'Expired' },
            ],
          },
        ],
        fields: [
          { key: 'quoteNumber', label: 'Quote Number', select: (row: QuotePayload) => row.quoteNumber },
          { key: 'title', label: 'Title', select: (row: QuotePayload) => row.title },
          { key: 'status', label: 'Status', select: (row: QuotePayload) => row.status },
          {
            key: 'totalValue',
            label: 'Total Value',
            select: (row: QuotePayload) =>
              row.totalValue && row.currency
                ? `${row.currency} ${row.totalValue.toString()}`
                : row.totalValue?.toString() ?? null,
          },
          { key: 'createdAt', label: 'Created', select: (row: QuotePayload) => row.createdAt },
          { key: 'sentAt', label: 'Sent At', select: (row: QuotePayload) => row.sentAt },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);
          const status = filters?.status as string | undefined;

          const where: Prisma.QuoteWhereInput = {
            leadId: entityId,
            ...(status ? { status: status as any } : {}),
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.quote.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              quoteNumber: true,
              title: true,
              status: true,
              totalValue: true,
              currency: true,
              createdAt: true,
              sentAt: true,
            },
          });
        },
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities for this lead.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
          },
        ],
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.ActivityWhereInput = {
            leadId: entityId,
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.activity.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          });
        },
      },
    },
    OPPORTUNITY: {
      [AiCollectionKey.LEADS]: {
        key: AiCollectionKey.LEADS,
        label: 'Lead History',
        description: 'Lead records connected to this opportunity.',
        defaultLimit: 3,
        defaultFormat: AiCollectionFormat.TABLE,
        fields: [
          { key: 'title', label: 'Title', select: (row: LeadPayload) => row.title },
          { key: 'status', label: 'Status', select: (row: LeadPayload) => row.status },
          { key: 'createdAt', label: 'Created', select: (row: LeadPayload) => row.createdAt },
        ],
        resolve: async ({ entityId, limit: _limit }) => {
          const opportunity = await this.prisma.opportunity.findUnique({
            where: { id: entityId },
            select: { leadId: true },
          });
          if (!opportunity?.leadId) {
            return [];
          }
          const lead = await this.prisma.lead.findUnique({
            where: { id: opportunity.leadId },
            select: {
              id: true,
              title: true,
              status: true,
              expectedCloseDate: true,
              source: true,
              createdAt: true,
            },
          });
          return lead ? [lead] : [];
        },
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities for this opportunity.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
          },
        ],
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.ActivityWhereInput = {
            opportunityId: entityId,
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.activity.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          });
        },
      },
    },
    CANDIDATE: {
      [AiCollectionKey.OPPORTUNITIES]: {
        key: AiCollectionKey.OPPORTUNITIES,
        label: 'Related Opportunities',
        description: 'Opportunities linked via candidate positions.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Updated on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Updated on/before',
            type: 'date',
          },
        ],
        fields: [
          { key: 'title', label: 'Title', select: (row: OpportunityPayload) => row.title },
          { key: 'stage', label: 'Stage', select: (row: OpportunityPayload) => row.stage },
          { key: 'type', label: 'Type', select: (row: OpportunityPayload) => row.type },
          {
            key: 'value',
            label: 'Value',
            select: (row: OpportunityPayload) => row.value ? row.value.toNumber?.() ?? row.value : null,
          },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const positions: CandidateOpportunityPayload[] = await this.prisma.candidatePosition.findMany({
            where: { candidateId: entityId },
            take: limit,
            include: {
              position: {
                include: {
                  opportunity: {
                    select: {
                      id: true,
                      title: true,
                      stage: true,
                      type: true,
                      value: true,
                      updatedAt: true,
                    },
                  },
                },
              },
            },
          });

          const opportunities = positions
            .map((position) => position.position?.opportunity)
            .filter((opportunity): opportunity is OpportunityPayload => Boolean(opportunity));

          if (!startDate && !endDate) {
            return opportunities;
          }

          return opportunities.filter((opportunity) => {
            if (!opportunity?.updatedAt) {
              return false;
            }
            const updatedAt = new Date(opportunity.updatedAt);
            if (Number.isNaN(updatedAt.getTime())) {
              return false;
            }
            if (startDate && updatedAt < startDate) {
              return false;
            }
            if (endDate && updatedAt > endDate) {
              return false;
            }
            return true;
          });
        },
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities logged for this candidate.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
          },
        ],
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.ActivityWhereInput = {
            candidateId: entityId,
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.activity.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          });
        },
      },
    },
    CONTACT: {
      [AiCollectionKey.LEADS]: {
        key: AiCollectionKey.LEADS,
        label: 'Leads',
        description: 'Leads associated with this contact.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.TABLE,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
          },
        ],
        fields: [
          { key: 'title', label: 'Title', select: (row: LeadPayload) => row.title },
          { key: 'status', label: 'Status', select: (row: LeadPayload) => row.status },
          { key: 'createdAt', label: 'Created', select: (row: LeadPayload) => row.createdAt },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.LeadWhereInput = {
            contactId: entityId,
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.lead.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              title: true,
              status: true,
              expectedCloseDate: true,
              source: true,
              createdAt: true,
            },
          });
        },
      },
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities for this contact.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
          },
        ],
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.ActivityWhereInput = {
            contactId: entityId,
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.activity.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          });
        },
      },
    },
    TASK: {
      [AiCollectionKey.ACTIVITIES]: {
        key: AiCollectionKey.ACTIVITIES,
        label: 'Recent Activities',
        description: 'Latest activities related to this task.',
        defaultLimit: 5,
        defaultFormat: AiCollectionFormat.BULLET_LIST,
        filters: [
          {
            key: 'startDate',
            label: 'Created on/after',
            type: 'date',
          },
          {
            key: 'endDate',
            label: 'Created on/before',
            type: 'date',
          },
        ],
        fields: [
          { key: 'subject', label: 'Subject', select: (row: ActivityPayload) => row.subject },
          {
            key: 'type',
            label: 'Type',
            select: (row: ActivityPayload) => row.activityType?.name ?? 'Activity',
          },
          { key: 'createdAt', label: 'Created', select: (row: ActivityPayload) => row.createdAt },
          { key: 'body', label: 'Details', select: (row: ActivityPayload) => row.body },
        ],
        resolve: async ({ entityId, limit, filters }) => {
          const startDate = this.parseDate(filters?.startDate);
          const endDate = this.parseDate(filters?.endDate);

          const where: Prisma.ActivityWhereInput = {
            taskId: entityId,
          };

          if (startDate || endDate) {
            where.createdAt = {
              ...(startDate ? { gte: startDate } : {}),
              ...(endDate ? { lte: endDate } : {}),
            };
          }

          return this.prisma.activity.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
              id: true,
              subject: true,
              createdAt: true,
              body: true,
              activityType: { select: { name: true } },
            },
          });
        },
      },
    },
  };

  listCollections(entityType: AiEntityType): CollectionSummary[] {
    const definitions = this.definitions[entityType];
    if (!definitions) {
      return [];
    }

    return Object.values(definitions)
      .filter((definition): definition is CollectionDefinition<any> => definition !== undefined)
      .map((definition) => ({
        collectionKey: definition.key,
        label: definition.label,
        description: definition.description,
        defaultLimit: definition.defaultLimit,
        defaultFormat: definition.defaultFormat,
        supportedFormats: definition.format ?? [
          definition.defaultFormat,
          ...Object.values(AiCollectionFormat).filter((format) => format !== definition.defaultFormat),
        ],
        filters: definition.filters ?? [],
      }));
  }

  listCollectionFields(entityType: AiEntityType, collectionKey: AiCollectionKey): CollectionFieldMetadata[] {
    const definition = this.getCollectionDefinition(entityType, collectionKey);
    if (!definition) {
      return [];
    }

    return definition.fields.map((field) => ({
      key: field.key,
      label: field.label,
      description: field.description,
    }));
  }

  ensureCollectionSupported(entityType: AiEntityType, collectionKey: AiCollectionKey) {
    const definition = this.getCollectionDefinition(entityType, collectionKey);
    if (!definition) {
      throw new BadRequestException(`Collection ${collectionKey} is not supported for ${entityType}`);
    }
  }

  ensureCollectionFieldsSupported(
    entityType: AiEntityType,
    collectionKey: AiCollectionKey,
    fieldKeys: string[],
  ) {
    const definition = this.getCollectionDefinition(entityType, collectionKey);
    if (!definition) {
      throw new BadRequestException(`Collection ${collectionKey} is not supported for ${entityType}`);
    }

    const supportedKeys = new Set(definition.fields.map((field) => field.key));
    const unsupported = fieldKeys.filter((key) => !supportedKeys.has(key));
    if (unsupported.length > 0) {
      throw new BadRequestException(
        `Unsupported fields for ${collectionKey}: ${unsupported.join(', ')}`,
      );
    }
  }

  getCollectionDefinition(entityType: AiEntityType, collectionKey: AiCollectionKey) {
    const definitions = this.definitions[entityType];
    return definitions ? definitions[collectionKey] ?? null : null;
  }

  async resolveCollection(params: {
    entityType: AiEntityType;
    entityId?: string; // Optional: if omitted, runs on all records
    collectionKey: AiCollectionKey;
    limit?: number;
    fieldKeys: string[];
    filters?: Record<string, unknown>;
  }): Promise<Array<Record<string, unknown>>> {
    const definition = this.getCollectionDefinition(params.entityType, params.collectionKey);
    if (!definition) {
      return [];
    }

    // For bulk operations (no entityId), check if the definition supports bulk resolution
    if (!params.entityId && !definition.resolveBulk) {
      // Fall back to regular resolution if bulk is not supported
      // This will likely return empty results, but won't break
      return [];
    }

    const rows = params.entityId
      ? await definition.resolve({
          entityId: params.entityId,
          limit: params.limit ?? definition.defaultLimit,
          filters: params.filters,
        })
      : definition.resolveBulk
        ? await definition.resolveBulk({
            limit: params.limit ?? definition.defaultLimit,
            filters: params.filters,
          })
        : [];

    const fieldSelectors = definition.fields.filter((field) => params.fieldKeys.includes(field.key));

    return rows.map((row) => {
      const payload: Record<string, unknown> = {};
      for (const selector of fieldSelectors) {
        payload[selector.key] = selector.select(row);
      }
      return payload;
    });
  }
}



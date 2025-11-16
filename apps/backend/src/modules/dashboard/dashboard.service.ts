import { Injectable, NotFoundException } from '@nestjs/common';
import {
  LeaveRequestStatus,
  Prisma,
  TaskStatus,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface MissingReportContext {
  start: string | null;
  end: string | null;
  count: number;
}

export interface ActivityReminder {
  id: string;
  subject: string;
  body: string | null;
  type: {
    id: string;
    key: string;
    name: string;
    color: string | null;
  };
  dueDate: string;
  related: {
    customer: { id: string; name: string } | null;
    lead: { id: string; title: string } | null;
    opportunity: { id: string; title: string } | null;
    task: { id: string; title: string } | null;
  };
  metadata: Record<string, unknown> | null;
}

@Injectable()
export class DashboardService {
  private readonly DAYS_LOOKBACK_FOR_TASKS = 7;
  private readonly DAYS_LOOKBACK_FOR_ACTIVITIES = 7;
  private readonly DAYS_OVERDUE_WINDOW = 7;
  constructor(private readonly prisma: PrismaService) {}

  async getMyDashboard(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        employee: {
          select: {
            id: true,
            hireDate: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    if (user.role === UserRole.ADMIN) {
      return {
        userRole: user.role,
        isAdminView: true,
        stats: {
          missingReports: 0,
          lateReports: 0,
          totalReports: 0,
        },
        timeframe: null,
        recentReports: [],
        tasksDueSoon: [],
        activitiesDueSoon: [],
      };
    }

    const now = new Date();
    const monthBoundaries = this.getMonthBoundaries(now);
    const referenceForMonth = this.toDateOnly(now) < monthBoundaries.end ? now : monthBoundaries.end;

    // Optimized: Use database-level filtering and aggregation instead of loading all reports
    const [recentReports, lateReportsCount, totalReportsCount, currentMonthReports] =
      await Promise.all([
        // Fetch only the 3 most recent reports
        this.prisma.eodReport.findMany({
          where: { userId },
          orderBy: { date: 'desc' },
          take: 3,
          select: {
            id: true,
            date: true,
            isLate: true,
            hoursWorked: true,
            submittedAt: true,
            summary: true,
          },
        }),
        // Use database aggregation for late reports count
        this.prisma.eodReport.count({
          where: {
            userId,
            isLate: true,
          },
        }),
        // Use database aggregation for total reports count
        this.prisma.eodReport.count({
          where: { userId },
        }),
        // Fetch only current month reports for missing report calculation
        this.prisma.eodReport.findMany({
          where: {
            userId,
            date: {
              gte: monthBoundaries.start,
              lte: monthBoundaries.end,
            },
          },
          select: {
            date: true,
          },
        }),
      ]);

    const formattedRecentReports = recentReports.map((report) => ({
      id: report.id,
      date: report.date.toISOString(),
      isLate: report.isLate,
      submittedAt: report.submittedAt ? report.submittedAt.toISOString() : null,
      summary: report.summary,
      hoursWorked:
        report.hoursWorked !== undefined && report.hoursWorked !== null
          ? Number(report.hoursWorked)
          : null,
    }));

    const tasksDueSoon = await this.getTasksDueSoon(userId, now);
    const activitiesDueSoon = await this.getActivitiesDueSoon(userId, now);

    const missingCurrentMonth = await this.calculateMissingReports(
      userId,
      user.employee?.hireDate ?? null,
      currentMonthReports,
      referenceForMonth,
      {
        startDate: monthBoundaries.start,
        endDate: monthBoundaries.end,
      },
    );

    return {
      userRole: user.role,
      isAdminView: false,
      stats: {
        missingReports: missingCurrentMonth.count,
        lateReports: lateReportsCount,
        totalReports: totalReportsCount,
      },
      timeframe: {
        start: missingCurrentMonth.start,
        end: missingCurrentMonth.end,
      },
      recentReports: formattedRecentReports,
      tasksDueSoon,
      activitiesDueSoon,
    };
  }

  private async calculateMissingReports(
    userId: string,
    hireDate: Date | null,
    reports: Array<{ date: Date }> ,
    referenceDate: Date,
    options?: {
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<MissingReportContext> {
    if (!hireDate && reports.length === 0) {
      return {
        start: null,
        end: null,
        count: 0,
      };
    }

    const today = this.toDateOnly(referenceDate);
    const computedEnd = this.addDays(today, -1); // Only past days should be counted
    const optionalEnd = options?.endDate ? this.toDateOnly(options.endDate) : null;
    const endDate = optionalEnd && optionalEnd < computedEnd ? optionalEnd : computedEnd;

    if (endDate < this.toDateOnly(hireDate ?? today)) {
      return {
        start: null,
        end: null,
        count: 0,
      };
    }

    if (hireDate && this.toDateOnly(hireDate) > endDate) {
      return {
        start: null,
        end: null,
        count: 0,
      };
    }

    const earliestReportDate =
      reports.length > 0 ? this.toDateOnly(reports[0].date) : null;
    const startDateCandidates = [
      hireDate ? this.toDateOnly(hireDate) : null,
      earliestReportDate,
    ].filter((value): value is Date => value !== null);

    const explicitStart = options?.startDate ? this.toDateOnly(options.startDate) : null;
    const startDate =
      explicitStart ??
      (startDateCandidates.length > 0
        ? startDateCandidates.reduce((acc, value) =>
            value < acc ? value : acc,
          )
        : this.addDays(endDate, -30));

    if (startDate > endDate) {
      return {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        count: 0,
      };
    }

    const [holidays, leaveRequests] = await Promise.all([
      this.prisma.nationalHoliday.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: { date: true },
      }),
      this.prisma.leaveRequest.findMany({
        where: {
          userId,
          status: LeaveRequestStatus.APPROVED,
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: {
          startDate: true,
          endDate: true,
        },
      }),
    ]);

    const holidaySet = new Set(
      holidays.map((holiday) => this.toDateKey(holiday.date)),
    );

    const leaveRanges = leaveRequests.map((leave) => ({
      start: this.toDateOnly(leave.startDate),
      end: this.toDateOnly(leave.endDate),
    }));

    const reportDates = new Set(
      reports.map((report) => this.toDateKey(report.date)),
    );

    let missingCount = 0;
    let cursor = new Date(startDate);

    while (cursor <= endDate) {
      if (cursor > this.addDays(today, -1)) {
        break;
      }
      const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;
      const dateKey = this.toDateKey(cursor);
      const isHoliday = holidaySet.has(dateKey);
      const isOnLeave = leaveRanges.some(
        (range) => cursor >= range.start && cursor <= range.end,
      );

      if (!isWeekend && !isHoliday && !isOnLeave) {
        if (!reportDates.has(dateKey)) {
          missingCount += 1;
        }
      }

      cursor = this.addDays(cursor, 1);
    }

    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      count: missingCount,
    };
  }

  private async getTasksDueSoon(userId: string, referenceDate: Date) {
    const upcomingLimit = this.addDays(referenceDate, this.DAYS_LOOKBACK_FOR_TASKS);
    const overdueLimit = this.addDays(referenceDate, -this.DAYS_OVERDUE_WINDOW);

    const tasks = await this.prisma.task.findMany({
      where: {
        assignedToId: userId,
        status: {
          notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
        },
        dueDate: {
          not: null,
          gte: overdueLimit,
          lte: upcomingLimit,
        },
      },
      orderBy: {
        dueDate: 'asc',
      },
      take: 10,
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        priority: true,
        customerId: true,
      },
    });

    return tasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      status: task.status,
      priority: task.priority,
      customerId: task.customerId,
      isOverdue: task.dueDate
        ? this.toDateOnly(task.dueDate) < this.toDateOnly(referenceDate)
        : false,
    }));
  }

  private async getActivitiesDueSoon(userId: string, referenceDate: Date) {
    const upperLimit = this.addDays(referenceDate, this.DAYS_LOOKBACK_FOR_ACTIVITIES);
    const lowerLimit = this.addDays(referenceDate, -this.DAYS_OVERDUE_WINDOW);

    // Optimized: Filter at database level for reminderAt and activityDate
    // Also fetch fewer records since we only need 10 results
    const activities = await this.prisma.activity.findMany({
      where: {
        createdById: userId,
        OR: [
          // Activities with reminderAt in the date range
          {
            reminderAt: {
              gte: lowerLimit,
              lte: upperLimit,
            },
          },
          // Activities with activityDate in the date range
          {
            activityDate: {
              gte: lowerLimit,
              lte: upperLimit,
            },
          },
          // Activities without explicit dates (may have dates in metadata)
          // Fetch recent ones that might have metadata dates
          {
            AND: [
              { reminderAt: null },
              { activityDate: null },
              { createdAt: { gte: this.addDays(referenceDate, -30) } }, // Last 30 days
            ],
          },
        ],
      },
      orderBy: {
        // Order by reminderAt first (nulls will be last), then fall back to activityDate/createdAt in post-processing
        reminderAt: 'asc',
      },
      take: 30, // Reduced from 50 since we only need 10, but fetch extra for metadata filtering
      select: {
        id: true,
        subject: true,
        body: true,
        activityDate: true,
        reminderAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        customerId: true,
        leadId: true,
        opportunityId: true,
        taskId: true,
        activityType: {
          select: {
            id: true,
            key: true,
            name: true,
            color: true,
          },
        },
        // Include related entities directly in the query
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        lead: {
          select: {
            id: true,
            title: true,
          },
        },
        opportunity: {
          select: {
            id: true,
            title: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    const reminders: ActivityReminder[] = activities
      .map((activity) => {
        const metadata = activity.metadata as Prisma.JsonObject | null;
        const normalizedMetadata = metadata
          ? (JSON.parse(JSON.stringify(metadata)) as Record<string, unknown>)
          : null;

        const candidateDueValue =
          activity.reminderAt?.toISOString() ??
          activity.activityDate?.toISOString() ??
          (normalizedMetadata
            ? this.getFirstStringValue(normalizedMetadata, [
                'dueDate',
                'reminderDate',
                'due_at',
                'dueOn',
                'activityDate',
                'reminderAt',
              ])
            : null);

        if (!candidateDueValue) {
          return null;
        }

        const dueDate = new Date(candidateDueValue);

        if (Number.isNaN(dueDate.getTime())) {
          return null;
        }

        const dueDateOnly = this.toDateOnly(dueDate);

        if (dueDateOnly < this.toDateOnly(lowerLimit) || dueDateOnly > upperLimit) {
          return null;
        }

        if (!activity.activityType) {
          return null;
        }

        const reminder: ActivityReminder = {
          id: activity.id,
          subject: activity.subject ?? 'Untitled activity',
          body:
            activity.body ??
            (normalizedMetadata && typeof normalizedMetadata['body'] === 'string'
              ? (normalizedMetadata['body'] as string)
              : normalizedMetadata && typeof normalizedMetadata['notes'] === 'string'
              ? (normalizedMetadata['notes'] as string)
              : null),
          type: {
            id: activity.activityType.id,
            key: activity.activityType.key,
            name: activity.activityType.name,
            color: activity.activityType.color,
          },
          dueDate: dueDate.toISOString(),
          related: {
            customer: activity.customer
              ? {
                  id: activity.customer.id,
                  name: activity.customer.name,
                }
              : null,
            lead: activity.lead
              ? {
                  id: activity.lead.id,
                  title: activity.lead.title,
                }
              : null,
            opportunity: activity.opportunity
              ? {
                  id: activity.opportunity.id,
                  title: activity.opportunity.title,
                }
              : null,
            task: activity.task
              ? {
                  id: activity.task.id,
                  title: activity.task.title,
                }
              : null,
          },
          metadata: normalizedMetadata,
        };

        return reminder;
      })
      .filter(
        (
          reminder,
        ): reminder is ActivityReminder => reminder !== null,
      )
      .sort(
        (a, b) =>
          new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      )
      .slice(0, 10);

    return reminders;
  }

  private toDateOnly(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private toDateKey(date: Date): string {
    return this.toDateOnly(date).toISOString().slice(0, 10);
  }

  private getFirstStringValue(
    metadata: Record<string, unknown>,
    keys: string[],
  ): string | null {
    for (const key of keys) {
      const value = metadata[key];
      if (typeof value === 'string' && value.trim().length) {
        return value;
      }
    }
    return null;
  }

  private getMonthBoundaries(referenceDate: Date) {
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
    return { start: this.toDateOnly(start), end: this.toDateOnly(end) };
  }
}



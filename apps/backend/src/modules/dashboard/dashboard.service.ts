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
    const allReports = await this.prisma.eodReport.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        date: true,
        isLate: true,
        hoursWorked: true,
        submittedAt: true,
        summary: true,
      },
    });

    const recentReports = [...allReports]
      .slice(-3)
      .reverse()
      .map((report) => ({
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

    const lateReportsCount = allReports.filter((report) => report.isLate).length;

    const missingReports = await this.calculateMissingReports(
      userId,
      user.employee?.hireDate ?? null,
      allReports,
      now,
    );

    const tasksDueSoon = await this.getTasksDueSoon(userId, now);
    const activitiesDueSoon = await this.getActivitiesDueSoon(userId, now);

    return {
      userRole: user.role,
      isAdminView: false,
      stats: {
        missingReports: missingReports.count,
        lateReports: lateReportsCount,
        totalReports: allReports.length,
      },
      timeframe: {
        start: missingReports.start,
        end: missingReports.end,
      },
      recentReports,
      tasksDueSoon,
      activitiesDueSoon,
    };
  }

  private async calculateMissingReports(
    userId: string,
    hireDate: Date | null,
    reports: Array<{ date: Date }>,
    referenceDate: Date,
  ): Promise<MissingReportContext> {
    if (!hireDate && reports.length === 0) {
      return {
        start: null,
        end: null,
        count: 0,
      };
    }

    const today = this.toDateOnly(referenceDate);
    const endDate = this.addDays(today, -1); // Only past days should be counted

    if (endDate.getTime() < this.toDateOnly(referenceDate).getTime()) {
      // If today is the first day, nothing to count yet
      if (endDate < today) {
        // still valid, continue
      }
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

    const startDate =
      startDateCandidates.length > 0
        ? startDateCandidates.reduce((acc, value) =>
            value < acc ? value : acc,
          )
        : this.addDays(endDate, -30);

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

    const activities = await this.prisma.activity.findMany({
      where: {
        createdById: userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
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
      },
    });

    const customerIds = Array.from(
      new Set(
        activities
          .map((activity) => activity.customerId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const leadIds = Array.from(
      new Set(
        activities
          .map((activity) => activity.leadId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const opportunityIds = Array.from(
      new Set(
        activities
          .map((activity) => activity.opportunityId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const taskIds = Array.from(
      new Set(
        activities
          .map((activity) => activity.taskId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const [customers, leads, opportunities, tasks] = await Promise.all([
      customerIds.length
        ? this.prisma.customer.findMany({
            where: { id: { in: customerIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      leadIds.length
        ? this.prisma.lead.findMany({
            where: { id: { in: leadIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      opportunityIds.length
        ? this.prisma.opportunity.findMany({
            where: { id: { in: opportunityIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
      taskIds.length
        ? this.prisma.task.findMany({
            where: { id: { in: taskIds } },
            select: { id: true, title: true },
          })
        : Promise.resolve([]),
    ]);

    const customerMap = new Map(customers.map((customer) => [customer.id, customer.name]));
    const leadMap = new Map(leads.map((lead) => [lead.id, lead.title]));
    const opportunityMap = new Map(
      opportunities.map((opportunity) => [opportunity.id, opportunity.title]),
    );
    const taskMap = new Map(tasks.map((task) => [task.id, task.title]));

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
            customer:
              activity.customerId && customerMap.has(activity.customerId)
                ? {
                    id: activity.customerId,
                    name: customerMap.get(activity.customerId)!,
                  }
                : null,
            lead:
              activity.leadId && leadMap.has(activity.leadId)
                ? {
                    id: activity.leadId,
                    title: leadMap.get(activity.leadId)!,
                  }
                : null,
            opportunity:
              activity.opportunityId && opportunityMap.has(activity.opportunityId)
                ? {
                    id: activity.opportunityId,
                    title: opportunityMap.get(activity.opportunityId)!,
                  }
                : null,
            task:
              activity.taskId && taskMap.has(activity.taskId)
                ? {
                    id: activity.taskId,
                    title: taskMap.get(activity.taskId)!,
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
}



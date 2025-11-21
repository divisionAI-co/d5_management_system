import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CustomerStatus,
  CustomerType,
  InvoiceStatus,
  LeaveRequestStatus,
  Prisma,
  TaskStatus,
  UserRole,
  CandidateStage,
  EmploymentStatus,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BaseService } from '../../common/services/base.service';
import { ErrorMessages } from '../../common/constants/error-messages.const';

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
export class DashboardService extends BaseService {
  private readonly DAYS_LOOKBACK_FOR_TASKS = 7;
  private readonly DAYS_LOOKBACK_FOR_ACTIVITIES = 7;
  private readonly DAYS_OVERDUE_WINDOW = 7;
  constructor(prisma: PrismaService) {
    super(prisma);
  }

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
      throw new NotFoundException(ErrorMessages.NOT_FOUND('User', userId));
    }

    if (user.role === UserRole.ADMIN) {
      return {
        userRole: user.role,
        isAdminView: true,
        stats: {
          missingReports: 0,
          lateReports: 0,
          lateReportsBeyondThreshold: 0,
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

    // Fetch company settings to get late reports threshold
    const companySettings = await this.prisma.companySettings.findFirst();
    const lateReportsAllowed = companySettings?.eodLateReportsAllowed ?? 2;

    // Optimized: Use database-level filtering and aggregation instead of loading all reports
    const [recentReports, lateReportsCount, lateReportsThisMonth, totalReportsCount, currentMonthReports] =
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
        // Use database aggregation for total late reports count (all time)
        this.prisma.eodReport.count({
          where: {
            userId,
            isLate: true,
          },
        }),
        // Count late reports for current month only
        this.prisma.eodReport.count({
          where: {
            userId,
            isLate: true,
            date: {
              gte: monthBoundaries.start,
              lte: monthBoundaries.end,
            },
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

    // Calculate how many late reports are beyond the threshold
    const lateReportsBeyondThreshold = Math.max(0, lateReportsThisMonth - lateReportsAllowed);

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
        lateReportsBeyondThreshold,
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

  async getAdminDashboard() {
    const now = new Date();
    const monthBoundaries = this.getMonthBoundaries(now);
    const thisMonthStart = monthBoundaries.start;
    const thisMonthEnd = monthBoundaries.end;

    // Get last 12 months for revenue chart
    const last12Months = Array.from({ length: 12 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      return {
        month: date.toISOString().slice(0, 7), // YYYY-MM
        start: this.toDateOnly(new Date(date.getFullYear(), date.getMonth(), 1)),
        end: this.toDateOnly(new Date(date.getFullYear(), date.getMonth() + 1, 0)),
      };
    }).reverse();

    // Execute all queries in parallel for performance
    const [
      // Financial metrics
      invoices,
      activeCustomers,
      customersByType,
      customersByStatus,
      customersBySentiment,
      atRiskCustomers,
      // HR metrics
      employeesByStatus,
      employeesByDepartment,
      employeesByContractType,
      newHiresThisMonth,
      departuresThisMonth,
      eodReports,
      lateEodReports,
      missingEodReports,
      employeesWithIssues,
      leaveRequests,
      upcomingLeave,
      performanceReviews,
      // Recruitment metrics
      activeCandidates,
      candidatesByStage,
      openPositions,
      positionsByStatus,
      positionsByType,
      topRecruiters,
      // Task metrics
      activeTasks,
      tasksByStatus,
      overdueTasks,
      tasksByPriority,
      completedTasksThisWeek,
      // System metrics
      totalUsers,
      usersByRole,
      accountLockouts,
      failedLogins,
      // Sales metrics
      leadsByStatus,
      opportunitiesByStage,
      quotes,
      topCustomers,
      salesBySalesperson,
      // Recent activities
      recentActivities,
    ] = await Promise.all([
      // Financial - Invoices
      this.prisma.invoice.findMany({
        select: {
          id: true,
          status: true,
          total: true,
          dueDate: true,
          paidDate: true,
          issueDate: true,
          isRecurring: true,
          customer: {
            select: { id: true, name: true, type: true },
          },
        },
      }),
      // Financial - Active customers
      this.prisma.customer.count({
        where: { status: CustomerStatus.ACTIVE },
      }),
      // Financial - Customers by type
      this.prisma.customer.groupBy({
        by: ['type'],
        _count: true,
      }),
      // Financial - Customers by status
      this.prisma.customer.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Financial - Customers by sentiment
      this.prisma.customer.groupBy({
        by: ['sentiment'],
        _count: true,
      }),
      // Financial - At-risk customers
      this.prisma.customer.findMany({
        where: { status: CustomerStatus.AT_RISK },
        take: 10,
        select: {
          id: true,
          name: true,
          status: true,
          sentiment: true,
        },
        orderBy: { updatedAt: 'desc' },
      }),
      // HR - Employees by status
      this.prisma.employee.groupBy({
        by: ['status'],
        _count: true,
      }),
      // HR - Employees by department
      this.prisma.employee.groupBy({
        by: ['department'],
        _count: true,
        where: { department: { not: null } },
      }),
      // HR - Employees by contract type
      this.prisma.employee.groupBy({
        by: ['contractType'],
        _count: true,
      }),
      // HR - New hires this month
      this.prisma.employee.count({
        where: {
          hireDate: {
            gte: thisMonthStart,
            lte: thisMonthEnd,
          },
        },
      }),
      // HR - Departures this month
      this.prisma.employee.count({
        where: {
          OR: [
            { terminationDate: { gte: thisMonthStart, lte: thisMonthEnd } },
            { status: { in: [EmploymentStatus.TERMINATED, EmploymentStatus.RESIGNED] } },
          ],
        },
      }),
      // HR - EOD reports
      this.prisma.eodReport.findMany({
        where: {
          date: {
            gte: thisMonthStart,
            lte: thisMonthEnd,
          },
        },
        select: {
          id: true,
          userId: true,
          isLate: true,
          submittedAt: true,
        },
      }),
      // HR - Late EOD reports
      this.prisma.eodReport.count({
        where: {
          isLate: true,
          date: {
            gte: thisMonthStart,
            lte: thisMonthEnd,
          },
        },
      }),
      // HR - Missing EOD reports (calculated separately)
      this.prisma.eodReport.findMany({
        where: {
          date: {
            gte: thisMonthStart,
            lte: thisMonthEnd,
          },
        },
        select: {
          userId: true,
          date: true,
        },
      }),
      // HR - Employees with issues (late reports > 2)
      this.prisma.eodReport.groupBy({
        by: ['userId'],
        where: {
          isLate: true,
          date: {
            gte: thisMonthStart,
            lte: thisMonthEnd,
          },
        },
        _count: true,
        having: {
          userId: {
            _count: {
              gt: 2,
            },
          },
        },
      }),
      // HR - Leave requests
      this.prisma.leaveRequest.findMany({
        where: {
          status: LeaveRequestStatus.PENDING,
        },
        select: {
          id: true,
          employee: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          startDate: true,
          endDate: true,
          type: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // HR - Upcoming leave
      this.prisma.leaveRequest.findMany({
        where: {
          status: LeaveRequestStatus.APPROVED,
          startDate: {
            lte: this.addDays(now, 7),
            gte: now,
          },
        },
        select: {
          id: true,
          employee: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          startDate: true,
          endDate: true,
        },
        take: 10,
      }),
      // HR - Performance reviews
      this.prisma.performanceReview.findMany({
        where: {
          reviewPeriodEnd: {
            lt: now,
          },
          reviewedAt: null,
        },
        select: {
          id: true,
          employee: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          reviewPeriodEnd: true,
        },
      }),
      // Recruitment - Active candidates
      this.prisma.candidate.count({
        where: { isActive: true, deletedAt: null },
      }),
      // Recruitment - Candidates by stage
      this.prisma.candidate.groupBy({
        by: ['stage'],
        _count: true,
        where: { isActive: true, deletedAt: null },
      }),
      // Recruitment - Open positions
      this.prisma.openPosition.findMany({
        where: {
          status: 'Open',
          isArchived: false,
        },
        select: {
          id: true,
          title: true,
          status: true,
          recruitmentStatus: true,
          candidates: {
            select: { id: true },
          },
        },
      }),
      // Recruitment - Positions by status
      this.prisma.openPosition.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Recruitment - Positions by type
      this.prisma.openPosition.groupBy({
        by: ['recruitmentStatus'],
        _count: true,
        where: { recruitmentStatus: { not: null } },
      }),
      // Recruitment - Top recruiters (by placements this month)
      this.prisma.recruiterPerformanceReport.findMany({
        where: {
          weekEnding: {
            gte: thisMonthStart,
            lte: thisMonthEnd,
          },
        },
        select: {
          recruiter: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          placementsThisWeek: true,
        },
      }),
      // Tasks - Active tasks
      this.prisma.task.count({
        where: {
          status: {
            notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
          },
        },
      }),
      // Tasks - By status
      this.prisma.task.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Tasks - Overdue
      this.prisma.task.count({
        where: {
          status: {
            notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
          },
          dueDate: {
            lt: now,
          },
        },
      }),
      // Tasks - By priority
      this.prisma.task.groupBy({
        by: ['priority'],
        _count: true,
        where: {
          status: {
            notIn: [TaskStatus.DONE, TaskStatus.CANCELLED],
          },
        },
      }),
      // Tasks - Completed this week
      this.prisma.task.count({
        where: {
          status: TaskStatus.DONE,
          completedAt: {
            gte: this.addDays(now, -7),
          },
        },
      }),
      // System - Total users
      this.prisma.user.count(),
      // System - Users by role
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
      }),
      // System - Account lockouts
      this.prisma.accountLockout.count({
        where: {
          lockedUntil: {
            gt: now,
          },
        },
      }),
      // System - Failed logins (last 24 hours)
      this.prisma.failedLoginAttempt.count({
        where: {
          createdAt: {
            gte: this.addDays(now, -1),
          },
        },
      }),
      // Sales - Leads by status
      this.prisma.lead.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Sales - Opportunities by stage
      this.prisma.opportunity.groupBy({
        by: ['stage'],
        _count: true,
        _sum: {
          value: true,
        },
      }),
      // Sales - Quotes
      this.prisma.quote.findMany({
        where: {
          status: 'SENT',
        },
        orderBy: { sentAt: 'desc' },
        take: 10,
        select: {
          id: true,
          title: true,
          totalValue: true,
          sentAt: true,
          lead: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      // Sales - Top customers by revenue
      this.prisma.invoice.groupBy({
        by: ['customerId'],
        where: {
          status: InvoiceStatus.PAID,
        },
        _sum: {
          total: true,
        },
        orderBy: {
          _sum: {
            total: 'desc',
          },
        },
        take: 10,
      }),
      // Sales - Sales by salesperson
      this.prisma.opportunity.findMany({
        where: {
          isWon: true,
        },
        select: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          value: true,
        },
      }),
      // Recent activities (last 30 activities)
      this.prisma.activity.findMany({
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          subject: true,
          activityType: {
            select: {
              id: true,
              name: true,
              key: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
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
          employee: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          createdAt: true,
        },
      }),
    ]);

    // Calculate financial metrics
    const invoiceStatus = {
      draft: { count: 0, value: 0 },
      sent: { count: 0, value: 0 },
      paid: { count: 0, value: 0 },
      overdue: { count: 0, value: 0 },
    };

    let mrr = 0;
    let staffAugValue = 0;
    const today = this.toDateOnly(now);

    invoices.forEach((invoice) => {
      const value = Number(invoice.total);
      if (invoice.status === InvoiceStatus.DRAFT) {
        invoiceStatus.draft.count++;
        invoiceStatus.draft.value += value;
      } else if (invoice.status === InvoiceStatus.SENT) {
        invoiceStatus.sent.count++;
        invoiceStatus.sent.value += value;
        if (invoice.dueDate < today && !invoice.paidDate) {
          invoiceStatus.overdue.count++;
          invoiceStatus.overdue.value += value;
        }
      } else if (invoice.status === InvoiceStatus.PAID) {
        invoiceStatus.paid.count++;
        invoiceStatus.paid.value += value;
        if (invoice.issueDate >= thisMonthStart && invoice.issueDate <= thisMonthEnd) {
          // This month revenue
        }
      }

      // Calculate MRR (recurring subscriptions)
      if (invoice.isRecurring && invoice.status === InvoiceStatus.PAID) {
        mrr += value;
      }

      // Calculate staff aug value from opportunities
      if (invoice.customer?.type === CustomerType.STAFF_AUGMENTATION || invoice.customer?.type === CustomerType.BOTH) {
        staffAugValue += value;
      }
    });

    // Calculate revenue by customer type
    const revenueByType = {
      staffAug: 0,
      subscription: 0,
      both: 0,
    };

    invoices
      .filter((inv) => inv.status === InvoiceStatus.PAID)
      .forEach((invoice) => {
        const value = Number(invoice.total);
        if (invoice.customer?.type === CustomerType.STAFF_AUGMENTATION) {
          revenueByType.staffAug += value;
        } else if (invoice.customer?.type === CustomerType.SOFTWARE_SUBSCRIPTION) {
          revenueByType.subscription += value;
        } else if (invoice.customer?.type === CustomerType.BOTH) {
          revenueByType.both += value;
        }
      });

    // Calculate monthly revenue for last 12 months
    const monthlyRevenue = last12Months.map((month) => {
      const monthInvoices = invoices.filter(
        (inv) =>
          inv.status === InvoiceStatus.PAID &&
          inv.paidDate &&
          inv.paidDate >= month.start &&
          inv.paidDate <= month.end,
      );
      return {
        month: month.month,
        revenue: monthInvoices.reduce((sum, inv) => sum + Number(inv.total), 0),
      };
    });

    // Calculate sales by salesperson
    const salesBySalespersonMap = new Map<string, { name: string; revenue: number }>();
    salesBySalesperson.forEach((opp) => {
      if (opp.assignedTo) {
        const key = opp.assignedTo.id;
        const existing = salesBySalespersonMap.get(key) || {
          name: `${opp.assignedTo.firstName} ${opp.assignedTo.lastName}`,
          revenue: 0,
        };
        existing.revenue += Number(opp.value);
        salesBySalespersonMap.set(key, existing);
      }
    });

    // Calculate top customers
    const topCustomersList = await Promise.all(
      topCustomers.map(async (group) => {
        const customer = await this.prisma.customer.findUnique({
          where: { id: group.customerId },
          select: { id: true, name: true },
        });
        return {
          id: customer?.id || group.customerId,
          name: customer?.name || 'Unknown',
          revenue: Number(group._sum.total || 0),
        };
      }),
    );

    // Calculate EOD compliance
    const totalEodReports = eodReports.length;
    const lateEodCount = lateEodReports;
    const eodComplianceRate = totalEodReports > 0 ? ((totalEodReports - lateEodCount) / totalEodReports) * 100 : 100;

    // Get employees with issues
    const employeesWithIssuesList = await Promise.all(
      employeesWithIssues.map(async (group) => {
        const user = await this.prisma.user.findUnique({
          where: { id: group.userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employee: {
              select: { id: true },
            },
          },
        });
        return {
          id: user?.id || group.userId,
          name: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
          lateCount: group._count,
        };
      }),
    );

    // Calculate win rate
    const totalOpportunities = opportunitiesByStage.reduce((sum, stage) => sum + stage._count, 0);
    const wonOpportunities = opportunitiesByStage.find((stage) => stage.stage.toLowerCase().includes('won'))?._count || 0;
    const winRate = totalOpportunities > 0 ? (wonOpportunities / totalOpportunities) * 100 : 0;

    // Calculate hire rate
    const totalCandidates = candidatesByStage.reduce((sum, stage) => sum + stage._count, 0);
    const hiredCandidates = candidatesByStage.find((stage) => stage.stage === CandidateStage.HIRED)?._count || 0;
    const hireRate = totalCandidates > 0 ? (hiredCandidates / totalCandidates) * 100 : 0;

    // Calculate average time to hire (simplified - would need more data)
    const averageTimeToHire = 0; // TODO: Calculate from candidate created to hired dates

    // Format top recruiters
    const topRecruitersMap = new Map<string, { name: string; placements: number }>();
    topRecruiters.forEach((report) => {
      if (report.recruiter) {
        const key = report.recruiter.id;
        const existing = topRecruitersMap.get(key) || {
          name: `${report.recruiter.firstName} ${report.recruiter.lastName}`,
          placements: 0,
        };
        existing.placements += report.placementsThisWeek;
        topRecruitersMap.set(key, existing);
      }
    });

    // Format recent activities
    const formattedActivities = recentActivities.map((activity) => {
      let entityType = 'unknown';
      let entityName = 'Unknown';
      let entityId = '';

      if (activity.customer) {
        entityType = 'customer';
        entityName = activity.customer.name;
        entityId = activity.customer.id;
      } else if (activity.lead) {
        entityType = 'lead';
        entityName = activity.lead.title;
        entityId = activity.lead.id;
      } else if (activity.opportunity) {
        entityType = 'opportunity';
        entityName = activity.opportunity.title;
        entityId = activity.opportunity.id;
      } else if (activity.task) {
        entityType = 'task';
        entityName = activity.task.title;
        entityId = activity.task.id;
      } else if (activity.employee) {
        entityType = 'employee';
        entityName = `${activity.employee.user.firstName} ${activity.employee.user.lastName}`;
        entityId = activity.employee.id;
      }

      return {
        id: activity.id,
        type: activity.activityType.key,
        typeName: activity.activityType.name,
        user: {
          id: activity.createdBy.id,
          name: `${activity.createdBy.firstName} ${activity.createdBy.lastName}`,
        },
        entity: {
          type: entityType,
          id: entityId,
          name: entityName,
        },
        subject: activity.subject,
        timestamp: activity.createdAt.toISOString(),
      };
    });

    // Format customers by status
    const customerStatusMap: Record<string, number> = {};
    customersByStatus.forEach((group) => {
      customerStatusMap[group.status] = group._count;
    });

    // Format customers by sentiment
    const customerSentimentMap: Record<string, number> = {};
    customersBySentiment.forEach((group) => {
      customerSentimentMap[group.sentiment] = group._count;
    });

    // Format employees by status
    const employeesByStatusMap: Record<string, number> = {};
    employeesByStatus.forEach((group) => {
      employeesByStatusMap[group.status] = group._count;
    });

    // Format employees by department
    const employeesByDepartmentMap: Record<string, number> = {};
    employeesByDepartment.forEach((group) => {
      if (group.department) {
        employeesByDepartmentMap[group.department] = group._count;
      }
    });

    // Format tasks by status
    const tasksByStatusMap: Record<string, number> = {};
    tasksByStatus.forEach((group) => {
      tasksByStatusMap[group.status] = group._count;
    });

    // Format tasks by priority
    const tasksByPriorityMap: Record<string, number> = {};
    tasksByPriority.forEach((group) => {
      tasksByPriorityMap[group.priority] = group._count;
    });

    // Format users by role
    const usersByRoleMap: Record<string, number> = {};
    usersByRole.forEach((group) => {
      usersByRoleMap[group.role] = group._count;
    });

    // Format leads by status
    const leadsByStatusMap: Record<string, number> = {};
    leadsByStatus.forEach((group) => {
      leadsByStatusMap[group.status] = group._count;
    });

    // Format opportunities by stage
    const opportunitiesByStageFormatted = opportunitiesByStage.map((stage) => ({
      stage: stage.stage,
      count: stage._count,
      value: Number(stage._sum.value || 0),
    }));

    // Format candidates by stage
    const candidatesByStageMap: Record<string, number> = {};
    candidatesByStage.forEach((group) => {
      candidatesByStageMap[group.stage] = group._count;
    });

    // Format positions by status
    const positionsByStatusMap: Record<string, number> = {};
    positionsByStatus.forEach((group) => {
      positionsByStatusMap[group.status] = group._count;
    });

    return {
      kpis: {
        mrr: mrr,
        staffAugValue: staffAugValue,
        outstandingInvoices: {
          count: invoiceStatus.sent.count + invoiceStatus.draft.count,
          value: invoiceStatus.sent.value + invoiceStatus.draft.value,
        },
        overdueInvoices: invoiceStatus.overdue,
        activeCustomers: activeCustomers,
        customersAtRisk: customerStatusMap[CustomerStatus.AT_RISK] || 0,
        activeEmployees: employeesByStatusMap[EmploymentStatus.ACTIVE] || 0,
        openPositions: openPositions.length,
        activeCandidates: activeCandidates,
        eodComplianceRate: eodComplianceRate,
        missingEodReports: missingEodReports.length, // Simplified - would need proper calculation
        overdueTasks: overdueTasks,
      },
      financial: {
        revenueByType,
        revenueBySalesperson: Array.from(salesBySalespersonMap.values()).sort((a, b) => b.revenue - a.revenue),
        monthlyRevenue,
        invoiceStatus,
        topCustomers: topCustomersList,
      },
      crm: {
        leadsByStatus: leadsByStatusMap,
        opportunitiesByStage: opportunitiesByStageFormatted,
        winRate,
        customerStatus: customerStatusMap,
        customerSentiment: customerSentimentMap,
        atRiskCustomers: atRiskCustomers.map((c) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          sentiment: c.sentiment,
        })),
      },
      hr: {
        employeesByStatus: employeesByStatusMap,
        employeesByDepartment: employeesByDepartmentMap,
        employeesByContractType: employeesByContractType.reduce((acc, group) => {
          acc[group.contractType] = group._count;
          return acc;
        }, {} as Record<string, number>),
        newHiresThisMonth,
        departuresThisMonth,
        eodCompliance: {
          overallRate: eodComplianceRate,
          missingReports: missingEodReports.length,
          lateReports: lateEodCount,
          employeesWithIssues: employeesWithIssuesList,
        },
        leaveManagement: {
          pending: leaveRequests.length,
          approvedThisMonth: 0, // TODO: Calculate
          upcoming: upcomingLeave.map((leave) => ({
            id: leave.id,
            employeeName: leave.employee?.user
              ? `${leave.employee.user.firstName} ${leave.employee.user.lastName}`
              : 'Unknown',
            startDate: leave.startDate.toISOString(),
            endDate: leave.endDate.toISOString(),
          })),
        },
        performanceReviews: {
          overdue: performanceReviews.length,
          upcoming: 0, // TODO: Calculate
          completionRate: 0, // TODO: Calculate
        },
      },
      recruitment: {
        activeCandidates,
        candidatesByStage: candidatesByStageMap,
        hireRate,
        averageTimeToHire,
        openPositions: {
          total: openPositions.length,
          byStatus: positionsByStatusMap,
          byType: positionsByType.reduce((acc, group) => {
            if (group.recruitmentStatus) {
              acc[group.recruitmentStatus] = group._count;
            }
            return acc;
          }, {} as Record<string, number>),
        },
        topRecruiters: Array.from(topRecruitersMap.values())
          .sort((a, b) => b.placements - a.placements)
          .slice(0, 10),
      },
      tasks: {
        activeTasks,
        tasksByStatus: tasksByStatusMap,
        overdueTasks,
        tasksByPriority: tasksByPriorityMap,
        completedThisWeek: completedTasksThisWeek,
      },
      alerts: {
        accountLockouts: accountLockouts,
        failedLogins: failedLogins,
        systemErrors: 0, // TODO: Implement error tracking
        dataQualityIssues: 0, // TODO: Implement data quality checks
      },
      recentActivities: formattedActivities,
      systemHealth: {
        activeUsers: 0, // TODO: Track active sessions
        totalUsers: totalUsers,
        usersByRole: usersByRoleMap,
      },
    };
  }
}



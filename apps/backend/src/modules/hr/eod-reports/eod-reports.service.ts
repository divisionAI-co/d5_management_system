import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma, LeaveRequestStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateEodReportDto, EodReportTaskDto } from './dto/create-eod-report.dto';
import { UpdateEodReportDto } from './dto/update-eod-report.dto';

@Injectable()
export class EodReportsService {
  constructor(private readonly prisma: PrismaService) {}

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
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    if (employee.userId !== userId) {
      throw new ForbiddenException('EOD report must be linked to the associated employee user');
    }

    const { submit, tasks = [], ...rest } = createDto;
    if (!tasks.length) {
      throw new BadRequestException('tasksWorkedOn must contain at least 1 entry');
    }

    this.ensureNotFutureDate(rest.date);

    // Validate that the report date is a working day (not weekend or vacation)
    const reportDate = new Date(rest.date);
    const isWorkingDay = await this.isWorkingDay(userId, reportDate);
    if (!isWorkingDay) {
      throw new BadRequestException(
        'EOD reports cannot be created for weekends, holidays, or days when you are on approved leave.',
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

      return await this.prisma.eodReport.create({
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
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new BadRequestException('An EOD report already exists for this date');
      }
      throw error;
    }
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
    console.log('EOD findAll called with filters:', {
      page: filters?.page,
      pageSize: filters?.pageSize,
      computedPage: page,
      computedPageSize: pageSize,
      skip,
      userId: filters?.userId,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });

    const where: Prisma.EodReportWhereInput = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.date = {
        gte: filters.startDate ? new Date(filters.startDate) : undefined,
        lte: filters.endDate ? new Date(filters.endDate) : undefined,
      };
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.eodReport.count({ where }),
      this.prisma.eodReport.findMany({
      where,
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
        skip,
        take: pageSize,
      }),
    ]);

    const result = {
      data: items,
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };

    console.log('EOD findAll returning:', {
      dataLength: result.data.length,
      meta: result.meta,
      isArray: Array.isArray(result),
    });

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
      throw new NotFoundException(`EOD report with ID ${id} not found`);
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

    // Regular users cannot edit submitted reports, but ADMIN/HR can
    if (!canManageOthers && report.submittedAt) {
      throw new BadRequestException('This EOD report has already been submitted and cannot be edited.');
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
            `An EOD report already exists for this user on ${rest.date}. Please delete or update the existing report first.`,
          );
        }
      }
      
      data.date = newDate;
    }

    let nextTasks: EodReportTaskDto[] | undefined;

    if (rest.tasks) {
      if (!rest.tasks.length) {
        throw new BadRequestException('tasksWorkedOn must contain at least 1 entry');
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

    return this.prisma.eodReport.update({
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



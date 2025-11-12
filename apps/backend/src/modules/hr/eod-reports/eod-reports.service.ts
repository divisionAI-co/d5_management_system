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
    const leave = await this.prisma.leaveRequest.findFirst({
      where: {
        userId,
        status: LeaveRequestStatus.APPROVED,
        startDate: {
          lte: date,
        },
        endDate: {
          gte: date,
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

    let isLate = false;
    let submittedAt: Date | undefined;

    if (submit) {
      const reportDate = new Date(rest.date);
      const isWorkingDay = await this.isWorkingDay(userId, reportDate);
      if (!isWorkingDay) {
        throw new BadRequestException('EOD reports are not required on approved leave or holidays.');
      }
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

  async findAll(filters?: { userId?: string; startDate?: string; endDate?: string }) {
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

    return this.prisma.eodReport.findMany({
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
    });
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

    if (!canManageOthers && report.submittedAt) {
      throw new BadRequestException('This EOD report has already been submitted.');
    }

    const { submit, ...rest } = updateDto;
    const data: Prisma.EodReportUpdateInput = {};

    if (rest.summary !== undefined) {
      data.summary = rest.summary;
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



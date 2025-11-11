import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    const tasks = createDto.tasks ?? [];
    if (!tasks.length) {
      throw new BadRequestException('tasksWorkedOn must contain at least 1 entry');
    }

    const isLate = await this.computeIsLate(createDto.date);

    try {
      const tasksJson = tasks.map((task) => ({ ...task })) as Prisma.InputJsonValue;

      return await this.prisma.eodReport.create({
        data: {
          userId,
          date: new Date(createDto.date),
          summary: createDto.summary,
          tasksWorkedOn: tasksJson,
          hoursWorked:
            createDto.hoursWorked !== undefined && createDto.hoursWorked !== null
              ? new Prisma.Decimal(createDto.hoursWorked)
              : null,
          isLate,
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

    if (!canManageOthers) {
      const submissionDeadline = await this.getSubmissionDeadline(new Date(report.date));
      if (new Date().getTime() > submissionDeadline.getTime()) {
        throw new ForbiddenException('This EOD report can no longer be edited');
      }
    }

    const data: Prisma.EodReportUpdateInput = {};

    if (updateDto.summary !== undefined) {
      data.summary = updateDto.summary;
    }

    if (updateDto.tasks) {
      if (!updateDto.tasks.length) {
        throw new BadRequestException('tasksWorkedOn must contain at least 1 entry');
      }
      data.tasksWorkedOn = updateDto.tasks.map((task) => ({ ...task })) as Prisma.InputJsonValue;
    }

    if (updateDto.hoursWorked !== undefined) {
      data.hoursWorked = updateDto.hoursWorked !== null
        ? new Prisma.Decimal(updateDto.hoursWorked)
        : null;
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
}



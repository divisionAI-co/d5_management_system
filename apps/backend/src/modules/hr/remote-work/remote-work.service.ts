import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, CompanySettings } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateRemoteWorkLogDto } from './dto/create-remote-work-log.dto';
import {
  RemoteWorkFrequency,
  UpdateRemoteWorkPolicyDto,
} from './dto/update-remote-work-policy.dto';

@Injectable()
export class RemoteWorkService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureCompanySettings(): Promise<CompanySettings> {
    let settings = await this.prisma.companySettings.findFirst();
    if (!settings) {
      settings = await this.prisma.companySettings.create({
        data: {},
      });
    }
    return settings;
  }

  private normalizeDate(date: Date): Date {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }

  private getPeriodBounds(
    targetDate: Date,
    frequency: string,
  ): { start: Date; end: Date } {
    const normalized = this.normalizeDate(targetDate);

    const frequencyUpper = (frequency || RemoteWorkFrequency.WEEKLY).toUpperCase();
    const start = new Date(normalized);
    const end = new Date(normalized);

    switch (frequencyUpper) {
      case RemoteWorkFrequency.MONTHLY: {
        start.setDate(1);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        break;
      }
      case RemoteWorkFrequency.WEEKLY:
      default: {
        const day = normalized.getDay();
        const diff = day === 0 ? 6 : day - 1; // Monday as start of week
        start.setDate(normalized.getDate() - diff);
        end.setDate(start.getDate() + 6);
        break;
      }
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  private async validateRemoteWorkLimit(employeeId: string, date: Date) {
    const settings = await this.ensureCompanySettings();
    const { start, end } = this.getPeriodBounds(date, settings.remoteWorkFrequency);

    const logsCount = await this.prisma.remoteWorkLog.count({
      where: {
        employeeId,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    const limit = settings.remoteWorkLimit ?? 1;
    if (logsCount >= limit) {
      throw new BadRequestException(
        `Remote work limit of ${limit} day(s) reached for the current ${settings.remoteWorkFrequency.toLowerCase()} period`,
      );
    }
  }

  async create(
    userId: string,
    employeeId: string,
    createDto: Omit<CreateRemoteWorkLogDto, 'employeeId'>,
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
      throw new ForbiddenException(
        'Remote work log must be associated with the employee’s user account',
      );
    }

    const targetDate = this.normalizeDate(new Date(createDto.date));
    await this.validateRemoteWorkLimit(employeeId, targetDate);

    try {
      return await this.prisma.remoteWorkLog.create({
        data: {
          userId,
          employeeId,
          date: targetDate,
          reason: createDto.reason,
        },
        include: {
          employee: {
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
          },
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
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'A remote work log already exists for this date',
        );
      }
      throw error;
    }
  }

  async findAll(filters?: {
    employeeId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: Prisma.RemoteWorkLogWhereInput = {};

    if (filters?.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.date = {
        gte: filters.startDate ? this.normalizeDate(new Date(filters.startDate)) : undefined,
        lte: filters.endDate ? this.normalizeDate(new Date(filters.endDate)) : undefined,
      };
    }

    return this.prisma.remoteWorkLog.findMany({
      where,
      include: {
        employee: {
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
        },
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

  async findForUser(userId: string) {
    return this.findAll({ userId });
  }

  async getPolicy() {
    const settings = await this.ensureCompanySettings();
    return {
      frequency: settings.remoteWorkFrequency,
      limit: settings.remoteWorkLimit,
      updatedAt: settings.updatedAt,
    };
  }

  async updatePolicy(updateDto: UpdateRemoteWorkPolicyDto) {
    const settings = await this.ensureCompanySettings();
    const data: Prisma.CompanySettingsUpdateInput = {};

    if (updateDto.frequency) {
      data.remoteWorkFrequency = updateDto.frequency;
    }

    if (updateDto.limit !== undefined) {
      data.remoteWorkLimit = updateDto.limit;
    }

    const updated = await this.prisma.companySettings.update({
      where: { id: settings.id },
      data,
    });

    return {
      frequency: updated.remoteWorkFrequency,
      limit: updated.remoteWorkLimit,
      updatedAt: updated.updatedAt,
    };
  }
}



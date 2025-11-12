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
import { OpenRemoteWindowDto } from './dto/open-remote-window.dto';
import { SetRemotePreferencesDto } from './dto/set-remote-preferences.dto';

type CompanySettingsWithWindow = CompanySettings & {
  remoteWorkWindowOpen?: boolean | null;
  remoteWorkWindowStart?: Date | null;
  remoteWorkWindowEnd?: Date | null;
};

type ExtendedCompanySettings = CompanySettings & {
  remoteWorkWindowOpen: boolean;
  remoteWorkWindowStart: Date | null;
  remoteWorkWindowEnd: Date | null;
};

@Injectable()
export class RemoteWorkService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly MAX_REMOTE_DAYS_PER_WINDOW = 3;
  private readonly defaultWindowState = {
    remoteWorkWindowOpen: false,
    remoteWorkWindowStart: null as Date | null,
    remoteWorkWindowEnd: null as Date | null,
  };

  private withWindowDefaults(settings?: CompanySettingsWithWindow | null): ExtendedCompanySettings {
    const base = (settings ?? {}) as CompanySettingsWithWindow;
    return {
      ...base,
      remoteWorkWindowOpen:
        base.remoteWorkWindowOpen ?? this.defaultWindowState.remoteWorkWindowOpen,
      remoteWorkWindowStart:
        base.remoteWorkWindowStart ?? this.defaultWindowState.remoteWorkWindowStart,
      remoteWorkWindowEnd:
        base.remoteWorkWindowEnd ?? this.defaultWindowState.remoteWorkWindowEnd,
    } as ExtendedCompanySettings;
  }

  private async ensureCompanySettings(): Promise<ExtendedCompanySettings> {
    let settingsRecord = await this.prisma.companySettings.findFirst();
    if (!settingsRecord) {
      settingsRecord = await this.prisma.companySettings.create({
        data: {
          remoteWorkWindowOpen: this.defaultWindowState.remoteWorkWindowOpen,
          remoteWorkWindowStart: this.defaultWindowState.remoteWorkWindowStart,
          remoteWorkWindowEnd: this.defaultWindowState.remoteWorkWindowEnd,
        } as Prisma.CompanySettingsCreateInput,
      });
    }
    return this.withWindowDefaults(settingsRecord as CompanySettingsWithWindow);
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

  private async ensureActiveWindow(
    checkDate?: Date,
    settings?: ExtendedCompanySettings,
  ): Promise<{ settings: ExtendedCompanySettings; start: Date; end: Date; limit: number }> {
    const resolvedSettings = settings ?? (await this.ensureCompanySettings());

    if (
      !resolvedSettings.remoteWorkWindowOpen ||
      !resolvedSettings.remoteWorkWindowStart ||
      !resolvedSettings.remoteWorkWindowEnd
    ) {
      throw new BadRequestException('Remote work submissions are currently closed.');
    }

    const start = this.normalizeDate(resolvedSettings.remoteWorkWindowStart);
    const end = this.normalizeDate(resolvedSettings.remoteWorkWindowEnd);

    if (checkDate) {
      const normalized = this.normalizeDate(checkDate);
      if (normalized < start || normalized > end) {
        throw new BadRequestException(
          'Selected date is outside the active remote work window.',
        );
      }
    }

    const limit = Math.min(
      resolvedSettings.remoteWorkLimit ?? this.MAX_REMOTE_DAYS_PER_WINDOW,
      this.MAX_REMOTE_DAYS_PER_WINDOW,
    );

    return { settings: resolvedSettings, start, end, limit };
  }

  private async validateRemoteWorkLimit(
    employeeId: string,
    date: Date,
    settings?: ExtendedCompanySettings,
  ) {
    const { start, end, limit, settings: resolvedSettings } = await this.ensureActiveWindow(
      date,
      settings,
    );

    const logsCount = await this.prisma.remoteWorkLog.count({
      where: {
        employeeId,
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    if (logsCount >= limit) {
      throw new BadRequestException(
        `Remote work limit of ${limit} day(s) reached for the current ${resolvedSettings.remoteWorkFrequency.toLowerCase()} period`,
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
    const settings = await this.ensureCompanySettings();
    await this.validateRemoteWorkLimit(employeeId, targetDate, settings);

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

  async findForUser(
    userId: string,
    filters?: {
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.findAll({
      userId,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });
  }

  async getPolicy() {
    const settings = await this.ensureCompanySettings();
    return {
      frequency: settings.remoteWorkFrequency,
      limit: settings.remoteWorkLimit,
      updatedAt: settings.updatedAt,
      window: {
        isOpen: settings.remoteWorkWindowOpen ?? false,
        startDate: settings.remoteWorkWindowStart ?? undefined,
        endDate: settings.remoteWorkWindowEnd ?? undefined,
      },
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

    const applied = this.withWindowDefaults(updated as CompanySettingsWithWindow);

    return {
      frequency: applied.remoteWorkFrequency,
      limit: applied.remoteWorkLimit,
      updatedAt: applied.updatedAt,
    };
  }

  async openWindow(openDto: OpenRemoteWindowDto) {
    const start = this.normalizeDate(new Date(openDto.startDate));
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Invalid start date provided.');
    }

    let end: Date;
    if (openDto.endDate) {
      end = this.normalizeDate(new Date(openDto.endDate));
      if (Number.isNaN(end.getTime())) {
        throw new BadRequestException('Invalid end date provided.');
      }
    } else {
      end = new Date(start);
      end.setDate(start.getDate() + 6);
    }

    if (end < start) {
      throw new BadRequestException('Window end date must be on or after the start date.');
    }

    const spanDays = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    if (spanDays > 7) {
      throw new BadRequestException('Remote work window cannot exceed 7 days.');
    }

    const settings = await this.ensureCompanySettings();

    const updated = await this.prisma.companySettings.update({
      where: { id: settings.id },
      data: {
        remoteWorkWindowOpen: true,
        remoteWorkWindowStart: start,
        remoteWorkWindowEnd: end,
      } as any,
    });

    const applied = this.withWindowDefaults(updated as CompanySettingsWithWindow);

    return {
      isOpen: applied.remoteWorkWindowOpen,
      startDate: applied.remoteWorkWindowStart ?? undefined,
      endDate: applied.remoteWorkWindowEnd ?? undefined,
      limit: Math.min(
        applied.remoteWorkLimit ?? this.MAX_REMOTE_DAYS_PER_WINDOW,
        this.MAX_REMOTE_DAYS_PER_WINDOW,
      ),
    };
  }

  async closeWindow() {
    const settings = await this.ensureCompanySettings();

    const updated = await this.prisma.companySettings.update({
      where: { id: settings.id },
      data: {
        remoteWorkWindowOpen: false,
      } as any,
    });

    const applied = this.withWindowDefaults(updated as CompanySettingsWithWindow);

    return {
      isOpen: applied.remoteWorkWindowOpen,
      startDate: applied.remoteWorkWindowStart ?? undefined,
      endDate: applied.remoteWorkWindowEnd ?? undefined,
      limit: Math.min(
        applied.remoteWorkLimit ?? this.MAX_REMOTE_DAYS_PER_WINDOW,
        this.MAX_REMOTE_DAYS_PER_WINDOW,
      ),
    };
  }

  async getWindowState() {
    const settings = await this.ensureCompanySettings();
    return {
      isOpen: settings.remoteWorkWindowOpen ?? false,
      startDate: settings.remoteWorkWindowStart ?? undefined,
      endDate: settings.remoteWorkWindowEnd ?? undefined,
      limit: this.MAX_REMOTE_DAYS_PER_WINDOW,
    };
  }

  async setPreferences(
    userId: string,
    employeeId: string,
    preferencesDto: SetRemotePreferencesDto,
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
      throw new ForbiddenException('You can only manage your own remote work preferences.');
    }

    const settings = await this.ensureCompanySettings();
    const { start, end, limit } = await this.ensureActiveWindow(undefined, settings);

    const uniqueDates = Array.from(new Set(preferencesDto.dates ?? []));

    if (uniqueDates.length > limit) {
      throw new BadRequestException(
        `You can only select up to ${limit} remote day(s) during the current window.`,
      );
    }

    const normalizedDates = uniqueDates.map((date) => {
      const parsed = this.normalizeDate(new Date(date));
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`Invalid date provided: ${date}`);
      }
      if (parsed < start || parsed > end) {
        throw new BadRequestException(
          `Date ${date} is outside the active remote work window (${start.toISOString().slice(0, 10)} - ${end
            .toISOString()
            .slice(0, 10)}).`,
        );
      }
      return parsed;
    });

    const reason = preferencesDto.reason?.trim() || undefined;

    await this.prisma.$transaction(async (tx) => {
      await tx.remoteWorkLog.deleteMany({
        where: {
          employeeId,
          date: {
            gte: start,
            lte: end,
          },
        },
      });

      if (normalizedDates.length === 0) {
        return;
      }

      for (const date of normalizedDates) {
        await tx.remoteWorkLog.create({
          data: {
            userId,
            employeeId,
            date,
            reason,
          },
        });
      }
    });

    return this.findAll({
      employeeId,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    });
  }
}



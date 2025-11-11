import { Injectable } from '@nestjs/common';
import { CompanySettings, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';

@Injectable()
export class CompanySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureSettings(): Promise<CompanySettings> {
    let settings = await this.prisma.companySettings.findFirst();

    if (!settings) {
      try {
        settings = await this.prisma.companySettings.create({
          data: {},
        });
      } catch (error: unknown) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          settings = await this.prisma.companySettings.findFirst();
        } else {
          throw error;
        }
      }
    }

    return settings!;
  }

  async getSettings() {
    return this.ensureSettings();
  }

  async updateSettings(dto: UpdateCompanySettingsDto) {
    const settings = await this.ensureSettings();
    const data: Prisma.CompanySettingsUpdateInput = {};

    if (dto.remoteWorkFrequency !== undefined) {
      data.remoteWorkFrequency = dto.remoteWorkFrequency;
    }

    if (dto.remoteWorkLimit !== undefined) {
      data.remoteWorkLimit = dto.remoteWorkLimit;
    }

    if (dto.eodGraceDays !== undefined) {
      data.eodGraceDays = dto.eodGraceDays;
    }

    if (dto.eodReportDeadlineHour !== undefined) {
      data.eodReportDeadlineHour = dto.eodReportDeadlineHour;
    }

    if (dto.eodReportDeadlineMin !== undefined) {
      data.eodReportDeadlineMin = dto.eodReportDeadlineMin;
    }

    if (dto.reviewCycleDays !== undefined) {
      data.reviewCycleDays = dto.reviewCycleDays;
    }

    return this.prisma.companySettings.update({
      where: { id: settings.id },
      data,
    });
  }
}



import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@Injectable()
export class HolidaysService {
  constructor(private prisma: PrismaService) {}

  async create(createHolidayDto: CreateHolidayDto) {
    const date = new Date(createHolidayDto.date);

    // Check if holiday already exists on this date
    const existing = await this.prisma.nationalHoliday.findFirst({
      where: {
        date,
        country: 'AL',
      },
    });

    if (existing) {
      throw new ConflictException(`A holiday already exists on ${date.toDateString()}`);
    }

    return this.prisma.nationalHoliday.create({
      data: {
        name: createHolidayDto.name,
        date,
        country: 'AL',
        isRecurring: createHolidayDto.isRecurring || false,
      },
    });
  }

  async findAll(year?: number) {
    const where: any = { country: 'AL' };

    if (year) {
      const startOfYear = new Date(year, 0, 1);
      const endOfYear = new Date(year, 11, 31);

      where.date = {
        gte: startOfYear,
        lte: endOfYear,
      };
    }

    return this.prisma.nationalHoliday.findMany({
      where,
      orderBy: {
        date: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const holiday = await this.prisma.nationalHoliday.findUnique({
      where: { id },
    });

    if (!holiday) {
      throw new NotFoundException(`Holiday with ID ${id} not found`);
    }

    return holiday;
  }

  async update(id: string, updateHolidayDto: UpdateHolidayDto) {
    await this.findOne(id);

    const data: any = {};

    if (updateHolidayDto.name) {
      data.name = updateHolidayDto.name;
    }

    if (updateHolidayDto.date) {
      data.date = new Date(updateHolidayDto.date);
    }

    if (updateHolidayDto.isRecurring !== undefined) {
      data.isRecurring = updateHolidayDto.isRecurring;
    }

    return this.prisma.nationalHoliday.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.nationalHoliday.delete({
      where: { id },
    });
  }

  async isHoliday(date: Date): Promise<boolean> {
    const holiday = await this.prisma.nationalHoliday.findFirst({
      where: {
        date: new Date(date.toDateString()),
        country: 'AL',
      },
    });

    return !!holiday;
  }

  async getUpcomingHolidays(daysAhead: number = 30) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    return this.prisma.nationalHoliday.findMany({
      where: {
        country: 'AL',
        date: {
          gte: today,
          lte: futureDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }

  async getHolidaysBetween(startDate: Date, endDate: Date) {
    return this.prisma.nationalHoliday.findMany({
      where: {
        country: 'AL',
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        date: 'asc',
      },
    });
  }
}

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { UpdateCheckInDto } from './dto/update-check-in.dto';
import { FilterCheckInsDto } from './dto/filter-check-ins.dto';

@Injectable()
export class CheckInsService {
  constructor(private prisma: PrismaService) {}

  async create(createCheckInDto: CreateCheckInDto) {
    const date = new Date(createCheckInDto.date);
    const time = new Date(createCheckInDto.time);

    // Verify employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: createCheckInDto.employeeId },
      select: { id: true, cardNumber: true },
    });

    if (!employee) {
      throw new NotFoundException(
        `Employee with ID ${createCheckInDto.employeeId} not found. Check-ins must be linked to an existing employee.`,
      );
    }

    // Optionally verify card number matches if provided
    if (createCheckInDto.employeeCardNumber && employee.cardNumber) {
      if (employee.cardNumber !== createCheckInDto.employeeCardNumber) {
        throw new BadRequestException(
          `Card number ${createCheckInDto.employeeCardNumber} does not match employee's card number ${employee.cardNumber}.`,
        );
      }
    }

    return this.prisma.employeeCheckIn.create({
      data: {
        date,
        time,
        firstName: createCheckInDto.firstName,
        lastName: createCheckInDto.lastName,
        employeeCardNumber: createCheckInDto.employeeCardNumber,
        status: createCheckInDto.status,
        employeeId: createCheckInDto.employeeId,
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
              },
            },
          },
        },
      },
    });
  }

  async findAll(filters: FilterCheckInsDto = {}) {
    const where: any = {};
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 50;
    const skip = (page - 1) * pageSize;

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.employeeCardNumber) {
      where.employeeCardNumber = {
        contains: filters.employeeCardNumber,
        mode: 'insensitive',
      };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) {
        where.date.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.date.lte = new Date(filters.endDate);
      }
    }

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { employeeCardNumber: { contains: filters.search, mode: 'insensitive' } },
        {
          employee: {
            OR: [
              {
                user: {
                  OR: [
                    { firstName: { contains: filters.search, mode: 'insensitive' } },
                    { lastName: { contains: filters.search, mode: 'insensitive' } },
                    { email: { contains: filters.search, mode: 'insensitive' } },
                  ],
                },
              },
              { employeeNumber: { contains: filters.search, mode: 'insensitive' } },
              { cardNumber: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.employeeCheckIn.findMany({
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
                },
              },
            },
          },
        },
        orderBy: {
          time: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.employeeCheckIn.count({ where }),
    ]);

    return {
      data,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const checkIn = await this.prisma.employeeCheckIn.findUnique({
      where: { id },
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!checkIn) {
      throw new NotFoundException(`Check-in with ID ${id} not found`);
    }

    return checkIn;
  }

  async update(id: string, updateCheckInDto: UpdateCheckInDto) {
    await this.findOne(id);

    const data: any = {};

    if (updateCheckInDto.date) {
      data.date = new Date(updateCheckInDto.date);
    }

    if (updateCheckInDto.time) {
      data.time = new Date(updateCheckInDto.time);
    }

    if (updateCheckInDto.firstName !== undefined) {
      data.firstName = updateCheckInDto.firstName;
    }

    if (updateCheckInDto.lastName !== undefined) {
      data.lastName = updateCheckInDto.lastName;
    }

    if (updateCheckInDto.employeeCardNumber !== undefined) {
      data.employeeCardNumber = updateCheckInDto.employeeCardNumber;
    }

    if (updateCheckInDto.status !== undefined) {
      data.status = updateCheckInDto.status;
    }

    if (updateCheckInDto.employeeId !== undefined) {
      // Verify employee exists
      const employee = await this.prisma.employee.findUnique({
        where: { id: updateCheckInDto.employeeId },
        select: { id: true },
      });

      if (!employee) {
        throw new NotFoundException(
          `Employee with ID ${updateCheckInDto.employeeId} not found. Check-ins must be linked to an existing employee.`,
        );
      }

      data.employeeId = updateCheckInDto.employeeId;
    }

    return this.prisma.employeeCheckIn.update({
      where: { id },
      data,
      include: {
        employee: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.employeeCheckIn.delete({
      where: { id },
    });
  }
}


import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, CheckInOutStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { CreateCheckInOutDto } from './dto/create-check-in-out.dto';
import { UpdateCheckInOutDto } from './dto/update-check-in-out.dto';
import { FilterCheckInOutsDto } from './dto/filter-check-in-outs.dto';

@Injectable()
export class CheckInOutsService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(createDto: CreateCheckInOutDto, userId: string) {
    // Verify employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: createDto.employeeId },
      include: { user: true },
    });

    if (!employee) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Employee', createDto.employeeId));
    }

    return this.prisma.checkInOut.create({
      data: {
        employeeId: createDto.employeeId,
        dateTime: new Date(createDto.dateTime),
        status: createDto.status,
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

  async findAll(filters: FilterCheckInOutsDto, requestingUserId: string, canManageOthers: boolean) {
    const { startDate, endDate, ...baseFilters } = filters;
    const page = Math.max(filters.page ?? 1, 1);
    const rawPageSize = filters.pageSize ?? 25;
    const pageSize = Math.min(Math.max(rawPageSize, 1), 100);

    // Build base where clause using QueryBuilder
    const where = QueryBuilder.buildWhereClause<Prisma.CheckInOutWhereInput>(
      baseFilters,
    );

    // If user can't manage others, only show their own records
    if (!canManageOthers) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: requestingUserId },
        select: { id: true },
      });
      if (!employee) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND_BY_FIELD('Employee', 'userId', requestingUserId));
      }
      where.employeeId = employee.id;
    }

    // Handle date range with special end date logic (set to end of day)
    if (startDate || endDate) {
      where.dateTime = {} as Prisma.DateTimeFilter;
      if (startDate) {
        where.dateTime.gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.dateTime.lte = endDateTime;
      }
    }

    const total = await this.prisma.checkInOut.count({ where });
    const pageCount = pageSize > 0 ? Math.ceil(total / pageSize) : 0;
    const currentPage = pageCount > 0 ? Math.min(page, pageCount) : 1;
    const skip = pageCount > 0 ? (currentPage - 1) * pageSize : 0;

    const items = await this.prisma.checkInOut.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { dateTime: 'desc' },
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
        importedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      data: items,
      meta: {
        page: currentPage,
        pageSize,
        total,
        pageCount,
      },
    };
  }

  async findOne(id: string, requestingUserId: string, canManageOthers: boolean) {
    const checkInOut = await this.prisma.checkInOut.findUnique({
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
        importedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!checkInOut) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Check-in/out record', id));
    }

    // Check permissions
    if (!canManageOthers) {
      const employee = await this.prisma.employee.findUnique({
        where: { userId: requestingUserId },
        select: { id: true },
      });
      if (!employee || checkInOut.employeeId !== employee.id) {
        throw new ForbiddenException('You can only view your own check-in/out records');
      }
    }

    return checkInOut;
  }

  async update(id: string, updateDto: UpdateCheckInOutDto, requestingUserId: string, canManageOthers: boolean) {
    const existing = await this.findOne(id, requestingUserId, canManageOthers);

    const updateData: Prisma.CheckInOutUpdateInput = {};

    if (updateDto.employeeId !== undefined) {
      if (!canManageOthers) {
        throw new ForbiddenException('You cannot change the employee for check-in/out records');
      }
      // Verify new employee exists
      const employee = await this.prisma.employee.findUnique({
        where: { id: updateDto.employeeId },
      });
      if (!employee) {
        throw new NotFoundException(ErrorMessages.NOT_FOUND('Employee', updateDto.employeeId));
      }
      updateData.employee = { connect: { id: updateDto.employeeId } };
    }

    if (updateDto.dateTime !== undefined) {
      updateData.dateTime = new Date(updateDto.dateTime);
    }

    if (updateDto.status !== undefined) {
      updateData.status = updateDto.status;
    }

    return this.prisma.checkInOut.update({
      where: { id },
      data: updateData,
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
        importedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async remove(id: string, requestingUserId: string, canManageOthers: boolean) {
    // Verify record exists and user has permission
    await this.findOne(id, requestingUserId, canManageOthers);

    return this.prisma.checkInOut.delete({
      where: { id },
    });
  }
}


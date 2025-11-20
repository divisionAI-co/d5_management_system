import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma, EmploymentStatus } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { QueryBuilder } from '../../../common/utils/query-builder.util';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

interface EmployeeFilters {
  status?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class EmployeesService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async create(createEmployeeDto: CreateEmployeeDto) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createEmployeeDto.userId },
    });

    if (!user) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('User', createEmployeeDto.userId));
    }

    // Check if employee already exists for this user
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { userId: createEmployeeDto.userId },
    });

    if (existingEmployee) {
      throw new ConflictException(ErrorMessages.ALREADY_EXISTS('Employee', 'user'));
    }

    return this.prisma.employee.create({
      data: {
        ...createEmployeeDto,
        hireDate: new Date(createEmployeeDto.hireDate),
        terminationDate: createEmployeeDto.terminationDate ? new Date(createEmployeeDto.terminationDate) : null,
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
  }

  async findAll(filters: EmployeeFilters = {}) {
    const { status, department, search } = filters;
    const page = Math.max(filters.page ?? 1, 1);
    const rawPageSize = filters.pageSize ?? 10;
    const pageSize = Math.min(Math.max(rawPageSize, 1), 100);

    // Build base where clause using QueryBuilder
    const baseWhere = QueryBuilder.buildWhereClause<Prisma.EmployeeWhereInput>(
      { ...filters, search },
      {
        searchFields: ['employeeNumber', 'jobTitle'],
      },
    );

    // Handle status filter (validate enum)
    if (status && Object.values(EmploymentStatus).includes(status as EmploymentStatus)) {
      baseWhere.status = status as EmploymentStatus;
    }

    // Handle search with nested user fields
    if (search && search.trim().length > 0) {
      const term = search.trim();
      baseWhere.OR = [
        { employeeNumber: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { jobTitle: { contains: term, mode: Prisma.QueryMode.insensitive } },
        {
          user: {
            OR: [
              { firstName: { contains: term, mode: Prisma.QueryMode.insensitive } },
              { lastName: { contains: term, mode: Prisma.QueryMode.insensitive } },
              { email: { contains: term, mode: Prisma.QueryMode.insensitive } },
            ],
          },
        },
      ];
    }

    const where = baseWhere;

    const result = await this.paginate(
      this.prisma.employee,
      where,
      {
        page,
        pageSize,
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
          _count: {
            select: {
              leaveRequests: true,
              performanceReviews: true,
            },
          },
        },
        orderBy: {
          hireDate: 'desc',
        },
      },
    );

    return result;
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
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
        leaveRequests: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10,
        },
        performanceReviews: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND('Employee', id));
    }

    const recentEodReports = await this.prisma.eodReport.findMany({
      where: { userId: employee.userId },
      orderBy: { date: 'desc' },
      take: 5,
    });

    return {
      ...employee,
      eodReports: recentEodReports,
    };
  }

  async findByUserId(userId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { userId },
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

    if (!employee) {
      throw new NotFoundException(ErrorMessages.NOT_FOUND_BY_FIELD('Employee', 'userId', userId));
    }

    return employee;
  }

  async update(id: string, updateEmployeeDto: UpdateEmployeeDto) {
    await this.findOne(id);

    const data: any = { ...updateEmployeeDto };

    if (updateEmployeeDto.hireDate) {
      data.hireDate = new Date(updateEmployeeDto.hireDate);
    }

    if (updateEmployeeDto.terminationDate) {
      data.terminationDate = new Date(updateEmployeeDto.terminationDate);
    }

    return this.prisma.employee.update({
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

    return this.prisma.employee.delete({
      where: { id },
    });
  }

  async getDepartments() {
    const employees = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE' },
      select: { department: true },
      distinct: ['department'],
    });

    return employees.map((e) => e.department).filter((d) => d !== null);
  }

  async getEmployeeStats(employeeId: string) {
    const employee = await this.findOne(employeeId);

    const [
      totalLeaveRequests,
      approvedLeaves,
      pendingLeaves,
      performanceReviews,
      eodReports,
    ] = await Promise.all([
      this.prisma.leaveRequest.count({
        where: { employeeId },
      }),
      this.prisma.leaveRequest.count({
        where: { employeeId, status: 'APPROVED' },
      }),
      this.prisma.leaveRequest.count({
        where: { employeeId, status: 'PENDING' },
      }),
      this.prisma.performanceReview.count({
        where: { employeeId },
      }),
      this.prisma.eodReport.count({
        where: { userId: employee.userId },
      }),
    ]);

    return {
      employee,
      stats: {
        totalLeaveRequests,
        approvedLeaves,
        pendingLeaves,
        performanceReviews,
        eodReports,
      },
    };
  }
}

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesService {
  constructor(private prisma: PrismaService) {}

  async create(createEmployeeDto: CreateEmployeeDto) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: createEmployeeDto.userId },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${createEmployeeDto.userId} not found`);
    }

    // Check if employee already exists for this user
    const existingEmployee = await this.prisma.employee.findUnique({
      where: { userId: createEmployeeDto.userId },
    });

    if (existingEmployee) {
      throw new ConflictException(`Employee already exists for user ID ${createEmployeeDto.userId}`);
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

  async findAll(filters?: { status?: string; department?: string }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.department) {
      where.department = filters.department;
    }

    return this.prisma.employee.findMany({
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
    });
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
        directReports: {
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
      throw new NotFoundException(`Employee with ID ${id} not found`);
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
        directReports: {
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
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee for user ID ${userId} not found`);
    }

    return employee;
  }

  async findByUserIdNullable(userId: string) {
    return this.prisma.employee.findUnique({
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
        directReports: {
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
      },
    });
  }

  async getManagedEmployeeIds(managerId: string) {
    const reports = await this.prisma.employee.findMany({
      where: { managerId },
      select: { id: true },
    });

    return reports.map((report) => report.id);
  }

  async isManagerOf(managerId: string, targetEmployeeId: string) {
    const count = await this.prisma.employee.count({
      where: {
        id: targetEmployeeId,
        managerId,
      },
    });

    return count > 0;
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

  async findDirectReports(managerId: string) {
    return this.prisma.employee.findMany({
      where: { managerId },
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
        user: {
          firstName: 'asc',
        },
      },
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

import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';

@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  async create(
    userId: string,
    employeeId: string,
    createLeaveDto: Omit<CreateLeaveRequestDto, 'employeeId'>,
  ) {
    // Verify employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found`);
    }

    const startDate = new Date(createLeaveDto.startDate);
    const endDate = new Date(createLeaveDto.endDate);

    // Validate dates
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    // Check for overlapping leave requests
    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        status: {
          in: ['PENDING', 'APPROVED'],
        },
        OR: [
          {
            startDate: {
              lte: endDate,
            },
            endDate: {
              gte: startDate,
            },
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException('Leave request overlaps with existing request');
    }

    return this.prisma.leaveRequest.create({
      data: {
        userId,
        employeeId,
        type: createLeaveDto.type,
        startDate,
        endDate,
        totalDays: createLeaveDto.totalDays,
        reason: createLeaveDto.reason,
        status: createLeaveDto.status || 'PENDING',
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
        user: {
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

  async findAll(filters?: { employeeId?: string; status?: string; startDate?: string; endDate?: string }) {
    const where: any = {};

    if (filters?.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.OR = [
        {
          startDate: {
            gte: filters?.startDate ? new Date(filters.startDate) : undefined,
            lte: filters?.endDate ? new Date(filters.endDate) : undefined,
          },
        },
      ];
    }

    return this.prisma.leaveRequest.findMany({
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
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({
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
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!leaveRequest) {
      throw new NotFoundException(`Leave request with ID ${id} not found`);
    }

    return leaveRequest;
  }

  async update(id: string, employeeId: string, updateLeaveDto: UpdateLeaveRequestDto) {
    const leaveRequest = await this.findOne(id);

    // Only allow employee to update their own pending requests
    if (leaveRequest.employeeId !== employeeId) {
      throw new ForbiddenException('You can only update your own leave requests');
    }

    if (leaveRequest.status !== 'PENDING') {
      throw new BadRequestException('Can only update pending leave requests');
    }

    const data: any = {};

    if (updateLeaveDto.startDate) {
      data.startDate = new Date(updateLeaveDto.startDate);
    }

    if (updateLeaveDto.endDate) {
      data.endDate = new Date(updateLeaveDto.endDate);
    }

    if (updateLeaveDto.type) {
      data.type = updateLeaveDto.type;
    }

    if (updateLeaveDto.totalDays) {
      data.totalDays = updateLeaveDto.totalDays;
    }

    if (updateLeaveDto.reason !== undefined) {
      data.reason = updateLeaveDto.reason;
    }

    return this.prisma.leaveRequest.update({
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
        user: {
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

  async approve(id: string, approverId: string, approveDto: ApproveLeaveDto) {
    const leaveRequest = await this.findOne(id);

    if (leaveRequest.status !== 'PENDING') {
      throw new BadRequestException('Can only review pending leave requests');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: approveDto.status,
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectionReason: approveDto.rejectionReason,
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
        user: {
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

  async cancel(id: string, employeeId: string) {
    const leaveRequest = await this.findOne(id);

    // Only allow employee to cancel their own requests
    if (leaveRequest.employeeId !== employeeId) {
      throw new ForbiddenException('You can only cancel your own leave requests');
    }

    if (leaveRequest.status === 'CANCELLED') {
      throw new BadRequestException('Leave request is already cancelled');
    }

    return this.prisma.leaveRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
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

  async getEmployeeLeaveBalance(employeeId: string, year?: number) {
    const targetYear = year || new Date().getFullYear();
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31);

    const approvedLeaves = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: 'APPROVED',
        startDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
    });

    // Calculate total days taken
    const totalDays = approvedLeaves.reduce((sum, leave) => sum + leave.totalDays, 0);

    // Assume 20 days annual leave (configurable in production)
    const annualAllowance = 20;
    const remaining = annualAllowance - totalDays;

    return {
      year: targetYear,
      totalAllowance: annualAllowance,
      used: totalDays,
      remaining: remaining > 0 ? remaining : 0,
      leaveRequests: approvedLeaves,
    };
  }

  async getPendingRequests() {
    return this.prisma.leaveRequest.findMany({
      where: {
        status: 'PENDING',
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
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
}

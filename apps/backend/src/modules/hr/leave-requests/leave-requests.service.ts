import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { LeaveType } from '@prisma/client';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';

@Injectable()
export class LeaveRequestsService {
  constructor(private prisma: PrismaService) {}

  private readonly FALLBACK_ANNUAL_LEAVE_ALLOWANCE = 20;

  private async getAnnualLeaveAllowance(): Promise<number> {
    const settings = await this.prisma.companySettings.findFirst({
      select: {
        annualLeaveAllowanceDays: true,
      },
    });

    return settings?.annualLeaveAllowanceDays ?? this.FALLBACK_ANNUAL_LEAVE_ALLOWANCE;
  }

  private async getYearlyLeaveUsage(
    employeeId: string,
    year: number,
    excludeRequestId?: string,
  ): Promise<{
    approvedDays: number;
    committedDays: number;
  }> {
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31);

    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        id: excludeRequestId ? { not: excludeRequestId } : undefined,
        startDate: {
          gte: startOfYear,
          lte: endOfYear,
        },
        status: {
          in: ['APPROVED', 'PENDING'],
        },
        type: {
          not: LeaveType.SICK,
        },
      },
    });

    const approvedDays = requests
      .filter((request) => request.status === 'APPROVED')
      .reduce((sum, request) => sum + request.totalDays, 0);

    const committedDays = requests.reduce((sum, request) => sum + request.totalDays, 0);

    return { approvedDays, committedDays };
  }

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validate dates
    if (startDate > endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    if (startDate < today) {
      throw new BadRequestException('Leave requests must start today or later.');
    }

    if (createLeaveDto.totalDays <= 0) {
      throw new BadRequestException('Requested leave days must be greater than zero.');
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

    if (createLeaveDto.type !== LeaveType.SICK) {
      const annualAllowance = await this.getAnnualLeaveAllowance();
      const { committedDays } = await this.getYearlyLeaveUsage(
        employeeId,
        startDate.getFullYear(),
      );

      const remainingAllowance = Math.max(annualAllowance - committedDays, 0);

      if (createLeaveDto.totalDays > remainingAllowance) {
        throw new BadRequestException(
          `Requested leave exceeds the remaining PTO balance of ${remainingAllowance} day(s).`,
        );
      }
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

    if (updateLeaveDto.totalDays !== undefined) {
      data.totalDays = updateLeaveDto.totalDays;
    }

    if (updateLeaveDto.reason !== undefined) {
      data.reason = updateLeaveDto.reason;
    }

    const nextStartDate = data.startDate ?? leaveRequest.startDate;
    const nextEndDate = data.endDate ?? leaveRequest.endDate;
    const nextType = data.type ?? leaveRequest.type;
    const nextTotalDays = data.totalDays ?? leaveRequest.totalDays;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (nextStartDate > nextEndDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    if (nextStartDate < today) {
      throw new BadRequestException('Leave requests must start today or later.');
    }

    if (nextTotalDays <= 0) {
      throw new BadRequestException('Requested leave days must be greater than zero.');
    }

    const overlapping = await this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        id: { not: leaveRequest.id },
        status: {
          in: ['PENDING', 'APPROVED'],
        },
        OR: [
          {
            startDate: {
              lte: nextEndDate,
            },
            endDate: {
              gte: nextStartDate,
            },
          },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException('Leave request overlaps with existing request');
    }

    if (nextType !== LeaveType.SICK) {
      const annualAllowance = await this.getAnnualLeaveAllowance();
      const { committedDays } = await this.getYearlyLeaveUsage(
        employeeId,
        nextStartDate.getFullYear(),
        leaveRequest.id,
      );

      const remainingAllowance = Math.max(annualAllowance - committedDays, 0);

      if (nextTotalDays > remainingAllowance) {
        throw new BadRequestException(
          `Requested leave exceeds the remaining PTO balance of ${remainingAllowance} day(s).`,
        );
      }
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

    if (approveDto.status === 'APPROVED' && leaveRequest.type !== LeaveType.SICK) {
      const annualAllowance = await this.getAnnualLeaveAllowance();
      const { approvedDays } = await this.getYearlyLeaveUsage(
        leaveRequest.employeeId,
        leaveRequest.startDate.getFullYear(),
        leaveRequest.id,
      );

      if (approvedDays + leaveRequest.totalDays > annualAllowance) {
        throw new BadRequestException(
          `Approving this request would exceed the annual allowance of ${annualAllowance} days.`,
        );
      }
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

    const annualAllowance = await this.getAnnualLeaveAllowance();
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

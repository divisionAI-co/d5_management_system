import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { LeaveRequestsService } from './leave-requests.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { HolidaysService } from '../holidays/holidays.service';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { ApproveLeaveDto } from './dto/approve-leave.dto';
import { LeaveType, LeaveRequestStatus, EmploymentStatus } from '@prisma/client';

describe('LeaveRequestsService', () => {
  let service: LeaveRequestsService;
  let prismaService: any;
  let notificationsService: any;
  let holidaysService: any;

  const mockEmployee = {
    id: 'emp-1',
    userId: 'user-1',
    employeeNumber: 'EMP001',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    status: EmploymentStatus.ACTIVE,
  };

  const mockUser = {
    id: 'user-1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const getMockLeaveRequest = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 4);

    return {
      id: 'leave-1',
      userId: 'user-1',
      employeeId: 'emp-1',
      type: LeaveType.ANNUAL,
      startDate: today,
      endDate: endDate,
      totalDays: 5,
      reason: 'Vacation',
      status: LeaveRequestStatus.PENDING,
      approvedBy: null,
      approvedAt: null,
      rejectionReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      employee: {
        ...mockEmployee,
        user: mockUser,
      },
      user: mockUser,
    };
  };

  beforeEach(async () => {
    const mockPrismaService = {
      employee: {
        findUnique: jest.fn(),
      },
      leaveRequest: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      companySettings: {
        findFirst: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
    };

    const mockNotificationsService = {
      createNotificationsForUsers: jest.fn(),
      createNotification: jest.fn(),
    };

    const mockHolidaysService = {
      getHolidaysBetween: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveRequestsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: HolidaysService,
          useValue: mockHolidaysService,
        },
      ],
    }).compile();

    service = module.get<LeaveRequestsService>(LeaveRequestsService);
    prismaService = module.get(PrismaService);
    notificationsService = module.get(NotificationsService);
    holidaysService = module.get(HolidaysService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    let createLeaveDto: Omit<CreateLeaveRequestDto, 'employeeId'>;

    beforeEach(() => {
      // Set dates to today and 4 days from today
      // We'll recalculate in each test to ensure dates are always current
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() + 4);

      createLeaveDto = {
        startDate: today.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        type: LeaveType.ANNUAL,
        totalDays: 5,
        reason: 'Vacation',
        status: LeaveRequestStatus.PENDING,
      };
    });


    it('should create a leave request successfully', async () => {
      // Use tomorrow to avoid timezone issues (service requires startDate >= today)
      // Using tomorrow ensures it's definitely >= today regardless of timezone
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const endDate = new Date(tomorrow);
      endDate.setDate(endDate.getDate() + 4);
      
      const testDto = {
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        type: LeaveType.ANNUAL,
        totalDays: 5,
        reason: 'Vacation',
        status: LeaveRequestStatus.PENDING,
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      holidaysService.getHolidaysBetween.mockResolvedValue([]);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.companySettings.findFirst.mockResolvedValue({
        annualLeaveAllowanceDays: 20,
      });
      prismaService.leaveRequest.findMany.mockResolvedValue([]);
      prismaService.leaveRequest.create.mockResolvedValue(getMockLeaveRequest());
      prismaService.user.findMany.mockResolvedValue([]);

      const result = await service.create('user-1', 'emp-1', testDto);

      expect(result).toBeDefined();
      expect(result.type).toBe(LeaveType.ANNUAL);
      expect(prismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
      });
      expect(prismaService.leaveRequest.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', 'emp-1', createLeaveDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when start date is after end date', async () => {
      const invalidDto = {
        ...createLeaveDto,
        startDate: '2024-06-05',
        endDate: '2024-06-01',
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      await expect(service.create('user-1', 'emp-1', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when start date is in the past', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const invalidDto = {
        ...createLeaveDto,
        startDate: pastDate.toISOString().split('T')[0],
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      await expect(service.create('user-1', 'emp-1', invalidDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when dates contain only weekends/holidays', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      holidaysService.getHolidaysBetween.mockResolvedValue([
        { date: new Date('2024-06-01') },
        { date: new Date('2024-06-02') },
        { date: new Date('2024-06-03') },
        { date: new Date('2024-06-04') },
        { date: new Date('2024-06-05') },
      ]);

      await expect(service.create('user-1', 'emp-1', createLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when leave request overlaps with existing request', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      holidaysService.getHolidaysBetween.mockResolvedValue([]);
      prismaService.leaveRequest.findFirst.mockResolvedValue({
        id: 'existing-leave',
        startDate: new Date('2024-06-03'),
        endDate: new Date('2024-06-07'),
      });

      await expect(service.create('user-1', 'emp-1', createLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when leave exceeds remaining allowance', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      holidaysService.getHolidaysBetween.mockResolvedValue([]);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.companySettings.findFirst.mockResolvedValue({
        annualLeaveAllowanceDays: 20,
      });
      prismaService.leaveRequest.findMany.mockResolvedValue([
        { totalDays: 18, status: LeaveRequestStatus.PENDING },
      ]);

      const largeLeaveDto = {
        ...createLeaveDto,
        totalDays: 5,
      };

      await expect(service.create('user-1', 'emp-1', largeLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should not check allowance for sick leave', async () => {
      // Use tomorrow to avoid timezone issues (service requires startDate >= today)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const endDate = new Date(tomorrow);
      endDate.setDate(endDate.getDate() + 4);

      const sickLeaveDto = {
        startDate: tomorrow.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        type: LeaveType.SICK,
        totalDays: 5,
        reason: 'Sick',
        status: LeaveRequestStatus.PENDING,
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      holidaysService.getHolidaysBetween.mockResolvedValue([]);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.create.mockResolvedValue({
        ...getMockLeaveRequest(),
        type: LeaveType.SICK,
      });
      prismaService.user.findMany.mockResolvedValue([]);

      await service.create('user-1', 'emp-1', sickLeaveDto);

      expect(prismaService.leaveRequest.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all leave requests', async () => {
      const mockLeaveRequests = [getMockLeaveRequest()];
      prismaService.leaveRequest.findMany.mockResolvedValue(mockLeaveRequests);

      const result = await service.findAll();

      expect(result).toEqual(mockLeaveRequests);
      expect(prismaService.leaveRequest.findMany).toHaveBeenCalled();
    });

    it('should filter by employeeId', async () => {
      prismaService.leaveRequest.findMany.mockResolvedValue([getMockLeaveRequest()]);

      await service.findAll({ employeeId: 'emp-1' });

      expect(prismaService.leaveRequest.findMany).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      prismaService.leaveRequest.findMany.mockResolvedValue([getMockLeaveRequest()]);

      await service.findAll({ status: LeaveRequestStatus.PENDING });

      expect(prismaService.leaveRequest.findMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return leave request by id', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue(getMockLeaveRequest());

      const result = await service.findOne('leave-1');

      expect(result).toEqual(getMockLeaveRequest());
      expect(prismaService.leaveRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'leave-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when leave request does not exist', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateLeaveDto: UpdateLeaveRequestDto = {
      reason: 'Updated reason',
    };

    it('should update leave request successfully', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue(getMockLeaveRequest());
      holidaysService.getHolidaysBetween.mockResolvedValue([]);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.companySettings.findFirst.mockResolvedValue({
        annualLeaveAllowanceDays: 20,
      });
      prismaService.leaveRequest.findMany.mockResolvedValue([]);
      prismaService.leaveRequest.update.mockResolvedValue({
        ...getMockLeaveRequest(),
        ...updateLeaveDto,
      });

      const result = await service.update('leave-1', 'emp-1', updateLeaveDto);

      expect(result.reason).toBe(updateLeaveDto.reason);
      expect(prismaService.leaveRequest.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when employee tries to update another employee leave', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue({
        ...getMockLeaveRequest(),
        employeeId: 'emp-2',
      });

      await expect(service.update('leave-1', 'emp-1', updateLeaveDto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw BadRequestException when updating non-pending request', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue({
        ...getMockLeaveRequest(),
        status: LeaveRequestStatus.APPROVED,
      });

      await expect(service.update('leave-1', 'emp-1', updateLeaveDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('approve', () => {
    const approveDto: ApproveLeaveDto = {
      status: LeaveRequestStatus.APPROVED,
    };

    it('should approve leave request successfully', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue(getMockLeaveRequest());
      prismaService.companySettings.findFirst.mockResolvedValue({
        annualLeaveAllowanceDays: 20,
      });
      prismaService.leaveRequest.findMany.mockResolvedValue([]);
      prismaService.leaveRequest.update.mockResolvedValue({
        ...getMockLeaveRequest(),
        status: LeaveRequestStatus.APPROVED,
        approvedBy: 'approver-1',
        approvedAt: new Date(),
      });
      notificationsService.createNotification.mockResolvedValue(undefined);

      const result = await service.approve('leave-1', 'approver-1', approveDto);

      expect(result.status).toBe(LeaveRequestStatus.APPROVED);
      expect(prismaService.leaveRequest.update).toHaveBeenCalled();
    });

    it('should reject leave request successfully', async () => {
      const rejectDto: ApproveLeaveDto = {
        status: LeaveRequestStatus.REJECTED,
        rejectionReason: 'Insufficient coverage',
      };

      prismaService.leaveRequest.findUnique.mockResolvedValue(getMockLeaveRequest());
      prismaService.leaveRequest.update.mockResolvedValue({
        ...getMockLeaveRequest(),
        status: LeaveRequestStatus.REJECTED,
        approvedBy: 'approver-1',
        approvedAt: new Date(),
        rejectionReason: rejectDto.rejectionReason,
      });
      notificationsService.createNotification.mockResolvedValue(undefined);

      const result = await service.approve('leave-1', 'approver-1', rejectDto);

      expect(result.status).toBe(LeaveRequestStatus.REJECTED);
      expect(result.rejectionReason).toBe(rejectDto.rejectionReason);
    });

    it('should throw BadRequestException when approving non-pending request', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue({
        ...getMockLeaveRequest(),
        status: LeaveRequestStatus.APPROVED,
      });

      await expect(service.approve('leave-1', 'approver-1', approveDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when approval would exceed annual allowance', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue(getMockLeaveRequest());
      prismaService.companySettings.findFirst.mockResolvedValue({
        annualLeaveAllowanceDays: 20,
      });
      prismaService.leaveRequest.findMany.mockResolvedValue([
        { totalDays: 18, status: LeaveRequestStatus.APPROVED },
      ]);

      await expect(service.approve('leave-1', 'approver-1', approveDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel leave request successfully', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue(getMockLeaveRequest());
      prismaService.leaveRequest.update.mockResolvedValue({
        ...getMockLeaveRequest(),
        status: LeaveRequestStatus.CANCELLED,
      });

      const result = await service.cancel('leave-1', 'emp-1');

      expect(result.status).toBe(LeaveRequestStatus.CANCELLED);
      expect(prismaService.leaveRequest.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when employee tries to cancel another employee leave', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue({
        ...getMockLeaveRequest(),
        employeeId: 'emp-2',
      });

      await expect(service.cancel('leave-1', 'emp-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when leave is already cancelled', async () => {
      prismaService.leaveRequest.findUnique.mockResolvedValue({
        ...getMockLeaveRequest(),
        status: LeaveRequestStatus.CANCELLED,
      });

      await expect(service.cancel('leave-1', 'emp-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEmployeeLeaveBalance', () => {
    it('should return leave balance for current year', async () => {
      const approvedLeaves = [
        { totalDays: 5 },
        { totalDays: 3 },
        { totalDays: 2 },
      ];

      prismaService.leaveRequest.findMany.mockResolvedValue(approvedLeaves);
      prismaService.companySettings.findFirst.mockResolvedValue({
        annualLeaveAllowanceDays: 20,
      });

      const result = await service.getEmployeeLeaveBalance('emp-1');

      expect(result.totalAllowance).toBe(20);
      expect(result.used).toBe(10);
      expect(result.remaining).toBe(10);
      expect(result.leaveRequests).toEqual(approvedLeaves);
    });

    it('should return leave balance for specific year', async () => {
      const approvedLeaves = [{ totalDays: 5 }];

      prismaService.leaveRequest.findMany.mockResolvedValue(approvedLeaves);
      prismaService.companySettings.findFirst.mockResolvedValue({
        annualLeaveAllowanceDays: 20,
      });

      const result = await service.getEmployeeLeaveBalance('emp-1', 2023);

      expect(result.year).toBe(2023);
      expect(prismaService.leaveRequest.findMany).toHaveBeenCalled();
    });
  });

  describe('getPendingRequests', () => {
    it('should return all pending leave requests', async () => {
      const pendingRequests = [getMockLeaveRequest()];
      prismaService.leaveRequest.findMany.mockResolvedValue(pendingRequests);

      const result = await service.getPendingRequests();

      expect(result).toEqual(pendingRequests);
      expect(prismaService.leaveRequest.findMany).toHaveBeenCalledWith({
        where: { status: LeaveRequestStatus.PENDING },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});


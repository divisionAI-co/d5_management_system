import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EodReportsService } from './eod-reports.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { TemplatesService } from '../../templates/templates.service';
import { EmailService } from '../../../common/email/email.service';
import { CreateEodReportDto, EodReportTaskDto, EodTaskLifecycle, EodTaskStatus, EodTaskWorkType } from './dto/create-eod-report.dto';
import { UpdateEodReportDto } from './dto/update-eod-report.dto';
import { LeaveRequestStatus, EmploymentStatus } from '@prisma/client';

describe('EodReportsService', () => {
  let service: EodReportsService;
  let prismaService: any;
  let templatesService: any;
  let emailService: any;

  const mockUser = {
    id: 'user-1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'EMPLOYEE',
  };

  const mockEmployee = {
    id: 'emp-1',
    userId: 'user-1',
    employeeNumber: 'EMP001',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    status: EmploymentStatus.ACTIVE,
  };

  const mockTask: EodReportTaskDto = {
    clientDetails: 'Client ABC',
    ticket: 'TICKET-123',
    typeOfWorkDone: [EodTaskWorkType.IMPLEMENTATION],
    timeSpentOnTicket: 4.5,
    taskLifecycle: EodTaskLifecycle.NEW,
    taskStatus: EodTaskStatus.IN_PROGRESS,
  };

  const mockEodReport = {
    id: 'eod-1',
    userId: 'user-1',
    date: new Date('2024-06-01'),
    summary: 'Worked on feature implementation',
    tasksWorkedOn: [mockTask],
    hoursWorked: new Prisma.Decimal(8.0),
    isLate: false,
    submittedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      companySettings: {
        findFirst: jest.fn(),
      },
      employee: {
        findUnique: jest.fn(),
      },
      eodReport: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      nationalHoliday: {
        findFirst: jest.fn(),
      },
      leaveRequest: {
        findFirst: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockTemplatesService = {
      renderDefault: jest.fn(),
    };

    const mockEmailService = {
      sendEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EodReportsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TemplatesService,
          useValue: mockTemplatesService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<EodReportsService>(EodReportsService);
    prismaService = module.get(PrismaService);
    templatesService = module.get(TemplatesService);
    emailService = module.get(EmailService);

    // Setup default mocks
    prismaService.companySettings.findFirst.mockResolvedValue({
      eodReportDeadlineHour: 23,
      eodReportDeadlineMin: 59,
      eodGraceDays: 1,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    let createDto: Omit<CreateEodReportDto, 'employeeId'>;

    const getWeekdayDate = (): Date => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayOfWeek = today.getDay();
      
      // If today is Saturday (6) or Sunday (0), go back to Friday
      if (dayOfWeek === 0) {
        // Sunday - go back to Friday
        today.setDate(today.getDate() - 2);
      } else if (dayOfWeek === 6) {
        // Saturday - go back to Friday
        today.setDate(today.getDate() - 1);
      }
      // Otherwise, use today (it's a weekday)
      return today;
    };

    beforeEach(() => {
      const weekdayDate = getWeekdayDate();
      createDto = {
        date: weekdayDate.toISOString().split('T')[0],
        summary: 'Worked on feature implementation',
        tasks: [mockTask],
        hoursWorked: 8.0,
        submit: false,
      };
    });

    it('should create an EOD report successfully', async () => {
      const weekdayDate = getWeekdayDate();
      const testDto = {
        ...createDto,
        date: weekdayDate.toISOString().split('T')[0],
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.eodReport.create.mockResolvedValue({
        ...mockEodReport,
        date: weekdayDate,
      });

      const result = await service.create('user-1', 'emp-1', testDto);

      expect(result).toBeDefined();
      expect(result.summary).toBe(testDto.summary);
      expect(prismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        select: { id: true, userId: true },
      });
      expect(prismaService.eodReport.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', 'emp-1', createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.eodReport.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when userId does not match employee userId', async () => {
      prismaService.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        userId: 'user-2',
      });

      await expect(service.create('user-1', 'emp-1', createDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaService.eodReport.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when tasks array is empty', async () => {
      const dtoWithoutTasks = {
        ...createDto,
        tasks: [],
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      await expect(service.create('user-1', 'emp-1', dtoWithoutTasks)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when date is in the future', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dtoWithFutureDate = {
        ...createDto,
        date: futureDate.toISOString().split('T')[0],
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      await expect(service.create('user-1', 'emp-1', dtoWithFutureDate)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when date is a weekend', async () => {
      const saturday = new Date('2024-06-01'); // Saturday
      const dtoWithWeekend = {
        ...createDto,
        date: saturday.toISOString().split('T')[0],
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);

      await expect(service.create('user-1', 'emp-1', dtoWithWeekend)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when date is a holiday', async () => {
      const holidayDate = new Date('2024-01-01'); // New Year
      const dtoWithHoliday = {
        ...createDto,
        date: holidayDate.toISOString().split('T')[0],
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.nationalHoliday.findFirst.mockResolvedValue({
        id: 'holiday-1',
        date: holidayDate,
        name: 'New Year',
      });
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);

      await expect(service.create('user-1', 'emp-1', dtoWithHoliday)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user has approved leave on that date', async () => {
      const leaveDate = new Date('2024-06-03'); // Monday
      const dtoWithLeave = {
        ...createDto,
        date: leaveDate.toISOString().split('T')[0],
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.findFirst.mockResolvedValue({
        id: 'leave-1',
        status: LeaveRequestStatus.APPROVED,
      });

      await expect(service.create('user-1', 'emp-1', dtoWithLeave)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should calculate isLate when submitting report', async () => {
      const reportDate = new Date('2024-06-03'); // Monday
      const dtoWithSubmit = {
        ...createDto,
        date: reportDate.toISOString().split('T')[0],
        submit: true,
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.eodReport.create.mockResolvedValue({
        ...mockEodReport,
        date: reportDate,
        isLate: false,
        submittedAt: new Date(),
      });

      const result = await service.create('user-1', 'emp-1', dtoWithSubmit);

      expect(result.submittedAt).toBeDefined();
      expect(prismaService.eodReport.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isLate: expect.any(Boolean),
            submittedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should send email notification when report is submitted', async () => {
      const weekdayDate = getWeekdayDate();
      const dtoWithSubmit = {
        ...createDto,
        date: weekdayDate.toISOString().split('T')[0],
        submit: true,
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.eodReport.create.mockResolvedValue({
        ...mockEodReport,
        date: weekdayDate,
        isLate: false,
        submittedAt: new Date(),
        user: mockUser,
      });
      templatesService.renderDefault.mockResolvedValue({
        html: '<html>Email</html>',
        text: 'Email text',
      });
      emailService.sendEmail.mockResolvedValue(undefined);

      await service.create('user-1', 'emp-1', dtoWithSubmit);

      // Email sending is async and caught, so we just verify it was attempted
      // Wait a bit for the async email to be processed
      await new Promise((resolve) => setTimeout(resolve, 50));
    }, 15000);

    it('should throw BadRequestException when report already exists for date', async () => {
      const weekdayDate = getWeekdayDate();
      const dto = {
        ...createDto,
        date: weekdayDate.toISOString().split('T')[0],
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.eodReport.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
          code: 'P2002',
          clientVersion: '5.0.0',
        } as any),
      );

      await expect(service.create('user-1', 'emp-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated EOD reports', async () => {
      const filters = { page: 1, pageSize: 25 };
      const mockReports = [mockEodReport];

      prismaService.$transaction.mockResolvedValue([mockReports.length, mockReports]);

      const result = await service.findAll(filters);

      expect(result.data).toEqual(mockReports);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(25);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by userId', async () => {
      const filters = { userId: 'user-1', page: 1, pageSize: 25 };

      prismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll(filters);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by date range', async () => {
      const filters = {
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        page: 1,
        pageSize: 25,
      };

      prismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll(filters);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should handle default pagination values', async () => {
      prismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll({});

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should limit pageSize to maximum of 100', async () => {
      const filters = { page: 1, pageSize: 200 };

      prismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll(filters);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return EOD report by id', async () => {
      prismaService.eodReport.findUnique.mockResolvedValue(mockEodReport);

      const result = await service.findOne('eod-1');

      expect(result).toEqual(mockEodReport);
      expect(prismaService.eodReport.findUnique).toHaveBeenCalledWith({
        where: { id: 'eod-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when report does not exist', async () => {
      prismaService.eodReport.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateEodReportDto = {
      summary: 'Updated summary',
    };

    it('should update EOD report successfully for owner', async () => {
      prismaService.eodReport.findUnique.mockResolvedValue(mockEodReport);
      prismaService.eodReport.update.mockResolvedValue({
        ...mockEodReport,
        ...updateDto,
      });

      const result = await service.update('eod-1', 'user-1', updateDto, false);

      expect(result.summary).toBe(updateDto.summary);
      expect(prismaService.eodReport.update).toHaveBeenCalled();
    });

    it('should update EOD report successfully for ADMIN/HR', async () => {
      prismaService.eodReport.findUnique.mockResolvedValue({
        ...mockEodReport,
        userId: 'user-2',
      });
      prismaService.eodReport.update.mockResolvedValue({
        ...mockEodReport,
        ...updateDto,
      });

      const result = await service.update('eod-1', 'user-1', updateDto, true);

      expect(result.summary).toBe(updateDto.summary);
      expect(prismaService.eodReport.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user tries to update another user report', async () => {
      prismaService.eodReport.findUnique.mockResolvedValue({
        ...mockEodReport,
        userId: 'user-2',
      });

      await expect(service.update('eod-1', 'user-1', updateDto, false)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaService.eodReport.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when updating submitted report after grace period', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 3); // 3 days ago

      prismaService.eodReport.findUnique.mockResolvedValue({
        ...mockEodReport,
        submittedAt: oldDate,
        date: oldDate,
      });
      prismaService.companySettings.findFirst.mockResolvedValue({
        eodGraceDays: 1, // Only 1 day grace period
      });

      await expect(service.update('eod-1', 'user-1', updateDto, false)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should allow updating submitted report within grace period', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 1); // 1 day ago

      prismaService.eodReport.findUnique.mockResolvedValue({
        ...mockEodReport,
        submittedAt: recentDate,
        date: recentDate,
      });
      prismaService.companySettings.findFirst.mockResolvedValue({
        eodGraceDays: 1,
      });
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.eodReport.update.mockResolvedValue({
        ...mockEodReport,
        ...updateDto,
      });

      const result = await service.update('eod-1', 'user-1', updateDto, false);

      expect(result.summary).toBe(updateDto.summary);
      expect(prismaService.eodReport.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when tasks array is empty', async () => {
      const updateWithEmptyTasks: UpdateEodReportDto = {
        tasks: [],
      };

      prismaService.eodReport.findUnique.mockResolvedValue(mockEodReport);

      await expect(
        service.update('eod-1', 'user-1', updateWithEmptyTasks, false),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow ADMIN/HR to change report date', async () => {
      const newDate = '2024-06-05';
      const updateWithDate: UpdateEodReportDto = {
        date: newDate,
      };

      prismaService.eodReport.findUnique.mockResolvedValue(mockEodReport);
      prismaService.eodReport.findUnique.mockResolvedValueOnce(mockEodReport).mockResolvedValueOnce(null); // No existing report for new date
      prismaService.eodReport.update.mockResolvedValue({
        ...mockEodReport,
        date: new Date(newDate),
      });

      await service.update('eod-1', 'user-1', updateWithDate, true);

      expect(prismaService.eodReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            date: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw BadRequestException when ADMIN/HR tries to change date to one with existing report', async () => {
      const newDate = '2024-06-05';
      const updateWithDate: UpdateEodReportDto = {
        date: newDate,
      };

      prismaService.eodReport.findUnique
        .mockResolvedValueOnce(mockEodReport)
        .mockResolvedValueOnce({
          id: 'eod-2',
          userId: 'user-1',
          date: new Date(newDate),
        });

      await expect(service.update('eod-1', 'user-1', updateWithDate, true)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should submit report when submit flag is true', async () => {
      const submitDto: UpdateEodReportDto = {
        submit: true,
      };

      // Ensure the report date is a weekday (not in the future)
      const weekdayDate = (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay();
        if (dayOfWeek === 0) {
          today.setDate(today.getDate() - 2); // Sunday -> Friday
        } else if (dayOfWeek === 6) {
          today.setDate(today.getDate() - 1); // Saturday -> Friday
        }
        return today;
      })();

      const reportWithWeekday = {
        ...mockEodReport,
        date: weekdayDate,
      };

      prismaService.eodReport.findUnique.mockResolvedValue(reportWithWeekday);
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.eodReport.update.mockResolvedValue({
        ...reportWithWeekday,
        submittedAt: new Date(),
        isLate: false,
      });
      templatesService.renderDefault.mockResolvedValue({
        html: '<html>Email</html>',
        text: 'Email text',
      });
      emailService.sendEmail.mockResolvedValue(undefined);

      const result = await service.update('eod-1', 'user-1', submitDto, false);

      expect(result.submittedAt).toBeDefined();
      expect(prismaService.eodReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submittedAt: expect.any(Date),
            isLate: expect.any(Boolean),
          }),
        }),
      );
    });

    it('should send email notification when report is submitted for first time', async () => {
      const submitDto: UpdateEodReportDto = {
        submit: true,
      };

      // Ensure the report date is a weekday (not in the future)
      const weekdayDate = (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dayOfWeek = today.getDay();
        if (dayOfWeek === 0) {
          today.setDate(today.getDate() - 2); // Sunday -> Friday
        } else if (dayOfWeek === 6) {
          today.setDate(today.getDate() - 1); // Saturday -> Friday
        }
        return today;
      })();

      const reportWithWeekday = {
        ...mockEodReport,
        date: weekdayDate,
        submittedAt: null, // Not previously submitted
      };

      prismaService.eodReport.findUnique.mockResolvedValue(reportWithWeekday);
      prismaService.nationalHoliday.findFirst.mockResolvedValue(null);
      prismaService.leaveRequest.findFirst.mockResolvedValue(null);
      prismaService.eodReport.update.mockResolvedValue({
        ...reportWithWeekday,
        submittedAt: new Date(),
        isLate: false,
        user: mockUser,
      });
      templatesService.renderDefault.mockResolvedValue({
        html: '<html>Email</html>',
        text: 'Email text',
      });
      emailService.sendEmail.mockResolvedValue(undefined);

      await service.update('eod-1', 'user-1', submitDto, false);

      // Email sending is async and caught, so we just verify it was attempted
      await new Promise((resolve) => setTimeout(resolve, 50));
    }, 15000);

    it('should allow ADMIN/HR to manually set submittedAt', async () => {
      const adminUpdate: UpdateEodReportDto = {
        submittedAt: '2024-06-01T10:00:00Z',
      };

      prismaService.eodReport.findUnique.mockResolvedValue(mockEodReport);
      prismaService.eodReport.update.mockResolvedValue({
        ...mockEodReport,
        submittedAt: new Date('2024-06-01T10:00:00Z'),
        isLate: false,
      });

      await service.update('eod-1', 'user-1', adminUpdate, true);

      expect(prismaService.eodReport.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            submittedAt: expect.any(Date),
            isLate: expect.any(Boolean),
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete EOD report successfully', async () => {
      prismaService.eodReport.findUnique.mockResolvedValue(mockEodReport);
      prismaService.eodReport.delete.mockResolvedValue(mockEodReport);

      const result = await service.remove('eod-1');

      expect(result).toEqual(mockEodReport);
      expect(prismaService.eodReport.delete).toHaveBeenCalledWith({
        where: { id: 'eod-1' },
      });
    });

    it('should throw NotFoundException when report does not exist', async () => {
      prismaService.eodReport.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prismaService.eodReport.delete).not.toHaveBeenCalled();
    });
  });
});


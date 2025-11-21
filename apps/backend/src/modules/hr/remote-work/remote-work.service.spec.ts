import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RemoteWorkService } from './remote-work.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateRemoteWorkLogDto } from './dto/create-remote-work-log.dto';
import {
  UpdateRemoteWorkPolicyDto,
  RemoteWorkFrequency,
} from './dto/update-remote-work-policy.dto';
import { OpenRemoteWindowDto } from './dto/open-remote-window.dto';
import { SetRemotePreferencesDto } from './dto/set-remote-preferences.dto';
import { EmploymentStatus } from '@prisma/client';

describe('RemoteWorkService', () => {
  let service: RemoteWorkService;
  let prismaService: any;
  let notificationsService: any;

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

  const mockRemoteWorkLog = {
    id: 'log-1',
    userId: 'user-1',
    employeeId: 'emp-1',
    date: new Date('2024-11-20'),
    reason: 'Working from home',
    createdAt: new Date(),
    updatedAt: new Date(),
    employee: {
      ...mockEmployee,
      user: mockUser,
    },
    user: mockUser,
  };

  const mockCompanySettings = {
    id: 'settings-1',
    remoteWorkFrequency: RemoteWorkFrequency.WEEKLY,
    remoteWorkLimit: 3,
    remoteWorkWindowOpen: true,
    remoteWorkWindowStart: new Date('2024-11-18'),
    remoteWorkWindowEnd: new Date('2024-11-24'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      employee: {
        findUnique: jest.fn(),
      },
      remoteWorkLog: {
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
        deleteMany: jest.fn(),
      },
      companySettings: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockNotificationsService = {
      createNotificationsForUsers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RemoteWorkService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<RemoteWorkService>(RemoteWorkService);
    prismaService = module.get(PrismaService);
    notificationsService = module.get(NotificationsService);

    // Setup default mocks
    prismaService.companySettings.findFirst.mockResolvedValue(mockCompanySettings);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: Omit<CreateRemoteWorkLogDto, 'employeeId'> = {
      date: '2024-11-20',
      reason: 'Working from home',
    };

    it('should create a remote work log successfully', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.remoteWorkLog.count.mockResolvedValue(0);
      prismaService.remoteWorkLog.create.mockResolvedValue(mockRemoteWorkLog);

      const result = await service.create('user-1', 'emp-1', createDto);

      expect(result).toBeDefined();
      expect(result.reason).toBe(createDto.reason);
      expect(prismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        select: { id: true, userId: true },
      });
      expect(prismaService.remoteWorkLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', 'emp-1', createDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.remoteWorkLog.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException when userId does not match employee userId', async () => {
      prismaService.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        userId: 'user-2',
      });

      await expect(service.create('user-1', 'emp-1', createDto)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaService.remoteWorkLog.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when window is closed', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.companySettings.findFirst.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkWindowOpen: false,
      });

      await expect(service.create('user-1', 'emp-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when date is outside window', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.companySettings.findFirst.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkWindowStart: new Date('2024-11-18'),
        remoteWorkWindowEnd: new Date('2024-11-24'),
      });

      const dtoOutsideWindow = {
        ...createDto,
        date: '2024-11-25', // Outside window
      };

      await expect(service.create('user-1', 'emp-1', dtoOutsideWindow)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when remote work limit is reached', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.remoteWorkLog.count.mockResolvedValue(3); // Limit reached

      await expect(service.create('user-1', 'emp-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaService.remoteWorkLog.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when log already exists for date', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.remoteWorkLog.count.mockResolvedValue(0);
      prismaService.remoteWorkLog.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
          code: 'P2002',
          clientVersion: '5.0.0',
        } as any),
      );

      await expect(service.create('user-1', 'emp-1', createDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all remote work logs', async () => {
      const mockLogs = [mockRemoteWorkLog];
      prismaService.remoteWorkLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.findAll();

      expect(result).toEqual(mockLogs);
      expect(prismaService.remoteWorkLog.findMany).toHaveBeenCalled();
    });

    it('should filter by employeeId', async () => {
      prismaService.remoteWorkLog.findMany.mockResolvedValue([mockRemoteWorkLog]);

      await service.findAll({ employeeId: 'emp-1' });

      expect(prismaService.remoteWorkLog.findMany).toHaveBeenCalled();
    });

    it('should filter by userId', async () => {
      prismaService.remoteWorkLog.findMany.mockResolvedValue([mockRemoteWorkLog]);

      await service.findAll({ userId: 'user-1' });

      expect(prismaService.remoteWorkLog.findMany).toHaveBeenCalled();
    });

    it('should filter by date range', async () => {
      prismaService.remoteWorkLog.findMany.mockResolvedValue([mockRemoteWorkLog]);

      await service.findAll({
        startDate: '2024-11-01',
        endDate: '2024-11-30',
      });

      expect(prismaService.remoteWorkLog.findMany).toHaveBeenCalled();
    });
  });

  describe('findForUser', () => {
    it('should return remote work logs for a specific user', async () => {
      const mockLogs = [mockRemoteWorkLog];
      prismaService.remoteWorkLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.findForUser('user-1');

      expect(result).toEqual(mockLogs);
      expect(prismaService.remoteWorkLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        }),
      );
    });

    it('should filter by date range for user', async () => {
      prismaService.remoteWorkLog.findMany.mockResolvedValue([mockRemoteWorkLog]);

      await service.findForUser('user-1', {
        startDate: '2024-11-01',
        endDate: '2024-11-30',
      });

      expect(prismaService.remoteWorkLog.findMany).toHaveBeenCalled();
    });
  });

  describe('getPolicy', () => {
    it('should return remote work policy', async () => {
      const result = await service.getPolicy();

      expect(result).toBeDefined();
      expect(result.frequency).toBe(RemoteWorkFrequency.WEEKLY);
      expect(result.limit).toBe(3);
      expect(result.window).toBeDefined();
      expect(result.window.isOpen).toBe(true);
    });

    it('should create company settings if they do not exist', async () => {
      prismaService.companySettings.findFirst.mockResolvedValue(null);
      prismaService.companySettings.create.mockResolvedValue(mockCompanySettings);

      await service.getPolicy();

      expect(prismaService.companySettings.create).toHaveBeenCalled();
    });
  });

  describe('updatePolicy', () => {
    const updateDto: UpdateRemoteWorkPolicyDto = {
      frequency: RemoteWorkFrequency.MONTHLY,
      limit: 5,
    };

    it('should update remote work policy successfully', async () => {
      const updatedSettings = {
        ...mockCompanySettings,
        remoteWorkFrequency: RemoteWorkFrequency.MONTHLY,
        remoteWorkLimit: 5,
      };
      prismaService.companySettings.update.mockResolvedValue(updatedSettings);

      const result = await service.updatePolicy(updateDto);

      expect(result.frequency).toBe(RemoteWorkFrequency.MONTHLY);
      expect(result.limit).toBe(5);
      expect(prismaService.companySettings.update).toHaveBeenCalled();
    });

    it('should update only frequency when provided', async () => {
      const frequencyOnly: UpdateRemoteWorkPolicyDto = {
        frequency: RemoteWorkFrequency.MONTHLY,
      };

      const updatedSettings = {
        ...mockCompanySettings,
        remoteWorkFrequency: RemoteWorkFrequency.MONTHLY,
      };
      prismaService.companySettings.update.mockResolvedValue(updatedSettings);

      const result = await service.updatePolicy(frequencyOnly);

      expect(result.frequency).toBe(RemoteWorkFrequency.MONTHLY);
      expect(result.limit).toBe(mockCompanySettings.remoteWorkLimit);
    });

    it('should update only limit when provided', async () => {
      const limitOnly: UpdateRemoteWorkPolicyDto = {
        limit: 5,
      };

      prismaService.companySettings.update.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkLimit: 5,
      });

      const result = await service.updatePolicy(limitOnly);

      expect(result.limit).toBe(5);
      expect(result.frequency).toBe(mockCompanySettings.remoteWorkFrequency);
    });
  });

  describe('openWindow', () => {
    const openDto: OpenRemoteWindowDto = {
      startDate: '2024-11-18',
      endDate: '2024-11-24',
    };

    it('should open remote work window successfully', async () => {
      prismaService.companySettings.update.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkWindowOpen: true,
        remoteWorkWindowStart: new Date('2024-11-18'),
        remoteWorkWindowEnd: new Date('2024-11-24'),
      });
      prismaService.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
      notificationsService.createNotificationsForUsers.mockResolvedValue(undefined);

      const result = await service.openWindow(openDto);

      expect(result.isOpen).toBe(true);
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
      expect(prismaService.companySettings.update).toHaveBeenCalled();
    });

    it('should default endDate to 6 days after startDate when not provided', async () => {
      const openDtoWithoutEnd: OpenRemoteWindowDto = {
        startDate: '2024-11-18',
      };

      prismaService.companySettings.update.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkWindowOpen: true,
        remoteWorkWindowStart: new Date('2024-11-18'),
        remoteWorkWindowEnd: new Date('2024-11-24'),
      });
      prismaService.user.findMany.mockResolvedValue([]);
      notificationsService.createNotificationsForUsers.mockResolvedValue(undefined);

      await service.openWindow(openDtoWithoutEnd);

      expect(prismaService.companySettings.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when endDate is before startDate', async () => {
      const invalidDto: OpenRemoteWindowDto = {
        startDate: '2024-11-24',
        endDate: '2024-11-18',
      };

      await expect(service.openWindow(invalidDto)).rejects.toThrow(BadRequestException);
      expect(prismaService.companySettings.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when window exceeds 7 days', async () => {
      const invalidDto: OpenRemoteWindowDto = {
        startDate: '2024-11-18',
        endDate: '2024-11-26', // 9 days
      };

      await expect(service.openWindow(invalidDto)).rejects.toThrow(BadRequestException);
      expect(prismaService.companySettings.update).not.toHaveBeenCalled();
    });

    it('should send notifications to all users when window opens', async () => {
      prismaService.companySettings.update.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkWindowOpen: true,
        remoteWorkWindowStart: new Date('2024-11-18'),
        remoteWorkWindowEnd: new Date('2024-11-24'),
      });
      prismaService.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ]);
      notificationsService.createNotificationsForUsers.mockResolvedValue(undefined);

      await service.openWindow(openDto);

      expect(notificationsService.createNotificationsForUsers).toHaveBeenCalled();
    });
  });

  describe('closeWindow', () => {
    it('should close remote work window successfully', async () => {
      prismaService.companySettings.update.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkWindowOpen: false,
      });

      const result = await service.closeWindow();

      expect(result.isOpen).toBe(false);
      expect(prismaService.companySettings.update).toHaveBeenCalledWith({
        where: { id: mockCompanySettings.id },
        data: {
          remoteWorkWindowOpen: false,
        },
      });
    });
  });

  describe('getWindowState', () => {
    it('should return current window state', async () => {
      const result = await service.getWindowState();

      expect(result).toBeDefined();
      expect(result.isOpen).toBe(true);
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
      expect(result.limit).toBe(3);
    });

    it('should return closed window state when window is closed', async () => {
      prismaService.companySettings.findFirst.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkWindowOpen: false,
      });

      const result = await service.getWindowState();

      expect(result.isOpen).toBe(false);
    });
  });

  describe('setPreferences', () => {
    const preferencesDto: SetRemotePreferencesDto = {
      dates: ['2024-11-20', '2024-11-21'],
      reason: 'Personal preference',
    };

    beforeEach(() => {
      // Mock transaction
      prismaService.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        return callback(prismaService);
      });
      prismaService.remoteWorkLog.deleteMany.mockResolvedValue({ count: 0 });
      prismaService.remoteWorkLog.create.mockResolvedValue(mockRemoteWorkLog);
      prismaService.remoteWorkLog.findMany.mockResolvedValue([mockRemoteWorkLog]);
    });

    it('should set remote work preferences successfully', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      const result = await service.setPreferences('user-1', 'emp-1', preferencesDto);

      expect(result).toBeDefined();
      expect(prismaService.employee.findUnique).toHaveBeenCalled();
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.setPreferences('user-1', 'emp-1', preferencesDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when userId does not match employee userId', async () => {
      prismaService.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        userId: 'user-2',
      });

      await expect(
        service.setPreferences('user-1', 'emp-1', preferencesDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when window is closed', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.companySettings.findFirst.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkWindowOpen: false,
      });

      await expect(
        service.setPreferences('user-1', 'emp-1', preferencesDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when dates exceed limit', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.companySettings.findFirst.mockResolvedValue({
        ...mockCompanySettings,
        remoteWorkLimit: 2,
      });

      const tooManyDates: SetRemotePreferencesDto = {
        dates: ['2024-11-20', '2024-11-21', '2024-11-22', '2024-11-23'],
        reason: 'Too many dates',
      };

      await expect(
        service.setPreferences('user-1', 'emp-1', tooManyDates),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when date is outside window', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      const outsideWindow: SetRemotePreferencesDto = {
        dates: ['2024-11-25'], // Outside window
        reason: 'Outside window',
      };

      await expect(
        service.setPreferences('user-1', 'emp-1', outsideWindow),
      ).rejects.toThrow(BadRequestException);
    });

    it('should remove duplicate dates', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      const withDuplicates: SetRemotePreferencesDto = {
        dates: ['2024-11-20', '2024-11-20', '2024-11-21'],
        reason: 'With duplicates',
      };

      await service.setPreferences('user-1', 'emp-1', withDuplicates);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should delete existing logs and create new ones in transaction', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      await service.setPreferences('user-1', 'emp-1', preferencesDto);

      expect(prismaService.remoteWorkLog.deleteMany).toHaveBeenCalled();
      expect(prismaService.remoteWorkLog.create).toHaveBeenCalledTimes(2);
    });

    it('should handle empty dates array', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      const emptyDates: SetRemotePreferencesDto = {
        dates: [],
      };

      await service.setPreferences('user-1', 'emp-1', emptyDates);

      expect(prismaService.remoteWorkLog.deleteMany).toHaveBeenCalled();
      expect(prismaService.remoteWorkLog.create).not.toHaveBeenCalled();
    });
  });
});


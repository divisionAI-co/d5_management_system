import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CompanySettingsService } from './company-settings.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateCompanySettingsDto } from './dto/update-company-settings.dto';
import { RemoteWorkFrequency } from '../hr/remote-work/dto/update-remote-work-policy.dto';

describe('CompanySettingsService', () => {
  let service: CompanySettingsService;
  let prismaService: any;

  const mockSettings = {
    id: 'settings-1',
    remoteWorkFrequency: RemoteWorkFrequency.WEEKLY,
    remoteWorkLimit: 2,
    eodGraceDays: 1,
    eodLateReportsAllowed: 3,
    eodReportDeadlineHour: 18,
    eodReportDeadlineMin: 0,
    reviewCycleDays: 180,
    annualLeaveAllowanceDays: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      companySettings: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanySettingsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CompanySettingsService>(CompanySettingsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return existing settings', async () => {
      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);

      const result = await service.getSettings();

      expect(result).toBeDefined();
      expect(result.id).toBe('settings-1');
      expect(prismaService.companySettings.findFirst).toHaveBeenCalled();
      expect(prismaService.companySettings.create).not.toHaveBeenCalled();
    });

    it('should create settings if none exist', async () => {
      prismaService.companySettings.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSettings);
      prismaService.companySettings.create.mockResolvedValue(mockSettings);

      const result = await service.getSettings();

      expect(result).toBeDefined();
      expect(prismaService.companySettings.create).toHaveBeenCalledWith({
        data: {},
      });
    });

    it('should handle race condition when creating settings', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint violation', {
        code: 'P2002',
        clientVersion: '5.0.0',
      });

      prismaService.companySettings.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSettings);
      prismaService.companySettings.create.mockRejectedValue(prismaError);

      const result = await service.getSettings();

      expect(result).toBeDefined();
      expect(prismaService.companySettings.findFirst).toHaveBeenCalledTimes(2);
    });

    it('should throw error if creation fails for non-race condition', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Database error', {
        code: 'P2000',
        clientVersion: '5.0.0',
      });

      prismaService.companySettings.findFirst.mockResolvedValue(null);
      prismaService.companySettings.create.mockRejectedValue(prismaError);

      await expect(service.getSettings()).rejects.toThrow();
    });
  });

  describe('updateSettings', () => {
    const updateDto: UpdateCompanySettingsDto = {
      remoteWorkFrequency: RemoteWorkFrequency.MONTHLY,
      remoteWorkLimit: 4,
    };

    it('should update settings successfully', async () => {
      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        ...updateDto,
      });

      const result = await service.updateSettings(updateDto);

      expect(result).toBeDefined();
      expect(result.remoteWorkFrequency).toBe(RemoteWorkFrequency.MONTHLY);
      expect(result.remoteWorkLimit).toBe(4);
      expect(prismaService.companySettings.update).toHaveBeenCalled();
    });

    it('should update remoteWorkFrequency', async () => {
      const dto: UpdateCompanySettingsDto = {
        remoteWorkFrequency: RemoteWorkFrequency.MONTHLY,
      };

      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        remoteWorkFrequency: RemoteWorkFrequency.MONTHLY,
      });

      await service.updateSettings(dto);

      expect(prismaService.companySettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            remoteWorkFrequency: RemoteWorkFrequency.MONTHLY,
          }),
        }),
      );
    });

    it('should update remoteWorkLimit', async () => {
      const dto: UpdateCompanySettingsDto = {
        remoteWorkLimit: 5,
      };

      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        remoteWorkLimit: 5,
      });

      await service.updateSettings(dto);

      expect(prismaService.companySettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            remoteWorkLimit: 5,
          }),
        }),
      );
    });

    it('should update eodGraceDays', async () => {
      const dto: UpdateCompanySettingsDto = {
        eodGraceDays: 2,
      };

      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        eodGraceDays: 2,
      });

      await service.updateSettings(dto);

      expect(prismaService.companySettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eodGraceDays: 2,
          }),
        }),
      );
    });

    it('should update eodLateReportsAllowed', async () => {
      const dto: UpdateCompanySettingsDto = {
        eodLateReportsAllowed: 5,
      };

      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        eodLateReportsAllowed: 5,
      });

      await service.updateSettings(dto);

      expect(prismaService.companySettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eodLateReportsAllowed: 5,
          }),
        }),
      );
    });

    it('should update eodReportDeadlineHour', async () => {
      const dto: UpdateCompanySettingsDto = {
        eodReportDeadlineHour: 17,
      };

      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        eodReportDeadlineHour: 17,
      });

      await service.updateSettings(dto);

      expect(prismaService.companySettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eodReportDeadlineHour: 17,
          }),
        }),
      );
    });

    it('should update eodReportDeadlineMin', async () => {
      const dto: UpdateCompanySettingsDto = {
        eodReportDeadlineMin: 30,
      };

      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        eodReportDeadlineMin: 30,
      });

      await service.updateSettings(dto);

      expect(prismaService.companySettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eodReportDeadlineMin: 30,
          }),
        }),
      );
    });

    it('should update reviewCycleDays', async () => {
      const dto: UpdateCompanySettingsDto = {
        reviewCycleDays: 365,
      };

      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        reviewCycleDays: 365,
      });

      await service.updateSettings(dto);

      expect(prismaService.companySettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewCycleDays: 365,
          }),
        }),
      );
    });

    it('should update annualLeaveAllowanceDays', async () => {
      const dto: UpdateCompanySettingsDto = {
        annualLeaveAllowanceDays: 25,
      };

      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        annualLeaveAllowanceDays: 25,
      });

      await service.updateSettings(dto);

      expect(prismaService.companySettings.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            annualLeaveAllowanceDays: 25,
          }),
        }),
      );
    });

    it('should update multiple fields at once', async () => {
      const dto: UpdateCompanySettingsDto = {
        remoteWorkFrequency: RemoteWorkFrequency.MONTHLY,
        remoteWorkLimit: 8,
        eodGraceDays: 2,
        reviewCycleDays: 90,
      };

      prismaService.companySettings.findFirst.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        ...dto,
      });

      const result = await service.updateSettings(dto);

      expect(result.remoteWorkFrequency).toBe(RemoteWorkFrequency.MONTHLY);
      expect(result.remoteWorkLimit).toBe(8);
      expect(result.eodGraceDays).toBe(2);
      expect(result.reviewCycleDays).toBe(90);
    });

    it('should create settings if none exist before update', async () => {
      prismaService.companySettings.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockSettings);
      prismaService.companySettings.create.mockResolvedValue(mockSettings);
      prismaService.companySettings.update.mockResolvedValue({
        ...mockSettings,
        ...updateDto,
      });

      await service.updateSettings(updateDto);

      expect(prismaService.companySettings.create).toHaveBeenCalled();
      expect(prismaService.companySettings.update).toHaveBeenCalled();
    });
  });
});


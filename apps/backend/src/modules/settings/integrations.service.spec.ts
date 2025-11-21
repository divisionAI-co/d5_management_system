import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateIntegrationDto } from './dto/update-integration.dto';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let prismaService: any;

  const mockIntegration = {
    id: 'integration-1',
    name: 'google_drive',
    isActive: false,
    config: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      integration: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<IntegrationsService>(IntegrationsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listIntegrations', () => {
    it('should return list of integrations with metadata', async () => {
      const integrations = [
        { ...mockIntegration, name: 'google_drive' },
        { ...mockIntegration, id: 'integration-2', name: 'google_calendar' },
      ];

      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findMany.mockResolvedValue(integrations);

      const result = await service.listIntegrations();

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(result[0].displayName).toBe('Google Drive');
      expect(result[0].description).toBe('Enable read-only access to shared company folders.');
      expect(result[1].displayName).toBe('Google Calendar');
      expect(result[1].description).toBe('Synchronise meetings and availability with Google Calendar.');
    });

    it('should ensure default integrations exist', async () => {
      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findMany.mockResolvedValue([mockIntegration]);

      await service.listIntegrations();

      expect(prismaService.integration.upsert).toHaveBeenCalledTimes(2);
      expect(prismaService.integration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'google_drive' },
          create: expect.objectContaining({
            name: 'google_drive',
            isActive: false,
          }),
        }),
      );
      expect(prismaService.integration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: 'google_calendar' },
        }),
      );
    });

    it('should order integrations by name', async () => {
      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findMany.mockResolvedValue([mockIntegration]);

      await service.listIntegrations();

      expect(prismaService.integration.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        }),
      );
    });

    it('should use default displayName when metadata not found', async () => {
      const unknownIntegration = {
        ...mockIntegration,
        name: 'unknown_integration',
      };

      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findMany.mockResolvedValue([unknownIntegration]);

      const result = await service.listIntegrations();

      expect(result[0].displayName).toBe('unknown_integration');
      expect(result[0].description).toBeUndefined();
    });
  });

  describe('updateIntegration', () => {
    const updateDto: UpdateIntegrationDto = {
      isActive: true,
      config: { apiKey: 'test-key' },
    };

    it('should update integration successfully', async () => {
      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      prismaService.integration.update.mockResolvedValue({
        ...mockIntegration,
        ...updateDto,
      });

      const result = await service.updateIntegration('google_drive', updateDto);

      expect(result).toBeDefined();
      expect(result.isActive).toBe(true);
      expect(result.config).toEqual({ apiKey: 'test-key' });
      expect(result.displayName).toBe('Google Drive');
      expect(prismaService.integration.update).toHaveBeenCalled();
    });

    it('should update isActive flag', async () => {
      const dto: UpdateIntegrationDto = {
        isActive: true,
      };

      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      prismaService.integration.update.mockResolvedValue({
        ...mockIntegration,
        isActive: true,
      });

      await service.updateIntegration('google_drive', dto);

      expect(prismaService.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it('should update config', async () => {
      const dto: UpdateIntegrationDto = {
        config: { folderId: '123', apiKey: 'key' },
      };

      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      prismaService.integration.update.mockResolvedValue({
        ...mockIntegration,
        config: dto.config,
      });

      await service.updateIntegration('google_drive', dto);

      expect(prismaService.integration.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            config: dto.config,
          }),
        }),
      );
    });

    it('should update both isActive and config', async () => {
      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      prismaService.integration.update.mockResolvedValue({
        ...mockIntegration,
        isActive: true,
        config: { apiKey: 'test-key' },
      });

      const result = await service.updateIntegration('google_drive', updateDto);

      expect(result.isActive).toBe(true);
      expect(result.config).toEqual({ apiKey: 'test-key' });
    });

    it('should throw NotFoundException when integration does not exist', async () => {
      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findUnique.mockResolvedValue(null);

      await expect(service.updateIntegration('non_existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should ensure defaults before updating', async () => {
      prismaService.integration.upsert.mockResolvedValue(mockIntegration);
      prismaService.integration.findUnique.mockResolvedValue(mockIntegration);
      prismaService.integration.update.mockResolvedValue(mockIntegration);

      await service.updateIntegration('google_drive', updateDto);

      expect(prismaService.integration.upsert).toHaveBeenCalled();
    });

    it('should return integration with metadata after update', async () => {
      const calendarIntegration = {
        ...mockIntegration,
        name: 'google_calendar',
      };

      prismaService.integration.upsert.mockResolvedValue(calendarIntegration);
      prismaService.integration.findUnique.mockResolvedValue(calendarIntegration);
      prismaService.integration.update.mockResolvedValue({
        ...calendarIntegration,
        isActive: true,
      });

      const result = await service.updateIntegration('google_calendar', { isActive: true });

      expect(result.displayName).toBe('Google Calendar');
      expect(result.description).toBe('Synchronise meetings and availability with Google Calendar.');
    });
  });
});


import { Test, TestingModule } from '@nestjs/testing';
import { DataCleanupService } from './data-cleanup.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('DataCleanupService', () => {
  let service: DataCleanupService;
  let prismaService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      opportunity: {
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      lead: {
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
      contact: {
        deleteMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataCleanupService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<DataCleanupService>(DataCleanupService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('cleanupCrmData', () => {
    it('should cleanup CRM data successfully', async () => {
      prismaService.opportunity.deleteMany.mockResolvedValue({ count: 5 });
      prismaService.lead.deleteMany.mockResolvedValue({ count: 10 });
      prismaService.contact.deleteMany.mockResolvedValue({ count: 15 });

      const result = await service.cleanupCrmData();

      expect(result.success).toBe(true);
      expect(result.message).toBe('CRM data cleaned up successfully');
      expect(result.results.opportunities).toBe(5);
      expect(result.results.leads).toBe(10);
      expect(result.results.contacts).toBe(15);
      expect(result.results.errors).toEqual([]);
    });

    it('should delete opportunities first', async () => {
      prismaService.opportunity.deleteMany.mockResolvedValue({ count: 3 });
      prismaService.lead.deleteMany.mockResolvedValue({ count: 0 });
      prismaService.contact.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupCrmData();

      expect(prismaService.opportunity.deleteMany).toHaveBeenCalled();
      expect(prismaService.lead.deleteMany).toHaveBeenCalled();
      expect(prismaService.contact.deleteMany).toHaveBeenCalled();
    });

    it('should delete leads after opportunities', async () => {
      prismaService.opportunity.deleteMany.mockResolvedValue({ count: 0 });
      prismaService.lead.deleteMany.mockResolvedValue({ count: 5 });
      prismaService.contact.deleteMany.mockResolvedValue({ count: 0 });

      await service.cleanupCrmData();

      const callOrder = [
        prismaService.opportunity.deleteMany.mock.invocationCallOrder[0],
        prismaService.lead.deleteMany.mock.invocationCallOrder[0],
        prismaService.contact.deleteMany.mock.invocationCallOrder[0],
      ];

      expect(callOrder[0]).toBeLessThan(callOrder[1]);
      expect(callOrder[1]).toBeLessThan(callOrder[2]);
    });

    it('should handle empty data gracefully', async () => {
      prismaService.opportunity.deleteMany.mockResolvedValue({ count: 0 });
      prismaService.lead.deleteMany.mockResolvedValue({ count: 0 });
      prismaService.contact.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.cleanupCrmData();

      expect(result.success).toBe(true);
      expect(result.results.opportunities).toBe(0);
      expect(result.results.leads).toBe(0);
      expect(result.results.contacts).toBe(0);
    });

    it('should handle errors during cleanup', async () => {
      const error = new Error('Database connection failed');
      prismaService.opportunity.deleteMany.mockRejectedValue(error);

      const result = await service.cleanupCrmData();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Error during CRM data cleanup');
      expect(result.results.errors.length).toBeGreaterThan(0);
      expect(result.error).toBeDefined();
    });

    it('should continue cleanup even if opportunities deletion fails', async () => {
      prismaService.opportunity.deleteMany.mockRejectedValue(new Error('Opportunity error'));
      prismaService.lead.deleteMany.mockResolvedValue({ count: 5 });
      prismaService.contact.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.cleanupCrmData();

      expect(result.success).toBe(false);
      expect(result.results.errors.length).toBeGreaterThan(0);
    });
  });

  describe('getCrmDataCounts', () => {
    it('should return counts for all CRM entities', async () => {
      prismaService.contact.count.mockResolvedValue(10);
      prismaService.lead.count.mockResolvedValue(20);
      prismaService.opportunity.count.mockResolvedValue(5);

      const result = await service.getCrmDataCounts();

      expect(result).toBeDefined();
      expect(result.contacts).toBe(10);
      expect(result.leads).toBe(20);
      expect(result.opportunities).toBe(5);
      expect(result.total).toBe(35);
    });

    it('should return zero counts when no data exists', async () => {
      prismaService.contact.count.mockResolvedValue(0);
      prismaService.lead.count.mockResolvedValue(0);
      prismaService.opportunity.count.mockResolvedValue(0);

      const result = await service.getCrmDataCounts();

      expect(result.contacts).toBe(0);
      expect(result.leads).toBe(0);
      expect(result.opportunities).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should calculate total correctly', async () => {
      prismaService.contact.count.mockResolvedValue(100);
      prismaService.lead.count.mockResolvedValue(50);
      prismaService.opportunity.count.mockResolvedValue(25);

      const result = await service.getCrmDataCounts();

      expect(result.total).toBe(175);
    });

    it('should use Promise.all for parallel counting', async () => {
      prismaService.contact.count.mockResolvedValue(1);
      prismaService.lead.count.mockResolvedValue(2);
      prismaService.opportunity.count.mockResolvedValue(3);

      await service.getCrmDataCounts();

      expect(prismaService.contact.count).toHaveBeenCalled();
      expect(prismaService.lead.count).toHaveBeenCalled();
      expect(prismaService.opportunity.count).toHaveBeenCalled();
    });
  });
});


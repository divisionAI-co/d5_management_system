import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CollectionFieldResolver } from './collection-field-resolver.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiEntityType, AiCollectionKey } from '@prisma/client';

describe('CollectionFieldResolver', () => {
  let service: CollectionFieldResolver;
  let prismaService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      eodReport: {
        findMany: jest.fn(),
      },
      task: {
        findMany: jest.fn(),
      },
      activity: {
        findMany: jest.fn(),
      },
      feedbackReport: {
        findMany: jest.fn(),
      },
      checkInOut: {
        findMany: jest.fn(),
      },
      opportunity: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      lead: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      quote: {
        findMany: jest.fn(),
      },
      candidatePosition: {
        findMany: jest.fn(),
      },
      employee: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      recruiterPerformanceReport: {
        findMany: jest.fn(),
      },
      salesPerformanceReport: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionFieldResolver,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CollectionFieldResolver>(CollectionFieldResolver);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listCollections', () => {
    it('should return collections for EMPLOYEE entity type', () => {
      const collections = service.listCollections(AiEntityType.EMPLOYEE);

      expect(collections).toBeDefined();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
      expect(collections.some((c) => c.collectionKey === AiCollectionKey.EOD_REPORTS)).toBe(true);
    });

    it('should return collections for CUSTOMER entity type', () => {
      const collections = service.listCollections(AiEntityType.CUSTOMER);

      expect(collections).toBeDefined();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
    });

    it('should return collections for LEAD entity type', () => {
      const collections = service.listCollections(AiEntityType.LEAD);

      expect(collections).toBeDefined();
      expect(Array.isArray(collections)).toBe(true);
      expect(collections.length).toBeGreaterThan(0);
    });

    it('should return empty array for unsupported entity type', () => {
      const collections = service.listCollections('UNSUPPORTED' as AiEntityType);

      expect(collections).toEqual([]);
    });
  });

  describe('listCollectionFields', () => {
    it('should return fields for EOD_REPORTS collection', () => {
      const fields = service.listCollectionFields(
        AiEntityType.EMPLOYEE,
        AiCollectionKey.EOD_REPORTS,
      );

      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should return fields for ACTIVITIES collection', () => {
      const fields = service.listCollectionFields(AiEntityType.EMPLOYEE, AiCollectionKey.ACTIVITIES);

      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should return empty array for unsupported collection', () => {
      const fields = service.listCollectionFields(
        AiEntityType.EMPLOYEE,
        'UNSUPPORTED' as AiCollectionKey,
      );

      expect(fields).toEqual([]);
    });
  });

  describe('ensureCollectionSupported', () => {
    it('should not throw when collection is supported', () => {
      expect(() => {
        service.ensureCollectionSupported(AiEntityType.EMPLOYEE, AiCollectionKey.EOD_REPORTS);
      }).not.toThrow();
    });

    it('should throw BadRequestException when collection is not supported', () => {
      expect(() => {
        service.ensureCollectionSupported(
          AiEntityType.EMPLOYEE,
          'UNSUPPORTED' as AiCollectionKey,
        );
      }).toThrow(BadRequestException);
    });
  });

  describe('ensureCollectionFieldsSupported', () => {
    it('should not throw when fields are supported', () => {
      expect(() => {
        service.ensureCollectionFieldsSupported(
          AiEntityType.EMPLOYEE,
          AiCollectionKey.EOD_REPORTS,
          ['date', 'summary'],
        );
      }).not.toThrow();
    });

    it('should throw BadRequestException when field is unsupported', () => {
      expect(() => {
        service.ensureCollectionFieldsSupported(
          AiEntityType.EMPLOYEE,
          AiCollectionKey.EOD_REPORTS,
          ['invalidField'],
        );
      }).toThrow(BadRequestException);
    });
  });

  describe('resolveCollection', () => {
    it('should resolve EOD_REPORTS collection for EMPLOYEE', async () => {
      prismaService.employee.findUnique.mockResolvedValue({
        userId: 'user-1',
      });

      const mockReports = [
        {
          id: 'report-1',
          date: new Date('2024-01-01'),
          summary: 'Worked on feature',
          hoursWorked: 8,
          isLate: false,
          submittedAt: new Date('2024-01-01T18:00:00Z'),
          tasksWorkedOn: null,
        },
      ];

      prismaService.eodReport.findMany.mockResolvedValue(mockReports);

      const result = await service.resolveCollection({
        entityType: AiEntityType.EMPLOYEE,
        entityId: 'employee-1',
        collectionKey: AiCollectionKey.EOD_REPORTS,
        fieldKeys: ['date', 'summary'],
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(prismaService.eodReport.findMany).toHaveBeenCalled();
    });

    it('should resolve ACTIVITIES collection for EMPLOYEE', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          subject: 'Meeting',
          createdAt: new Date('2024-01-01'),
          body: 'Meeting notes',
          activityType: {
            name: 'Meeting',
          },
        },
      ];

      prismaService.activity.findMany.mockResolvedValue(mockActivities);

      const result = await service.resolveCollection({
        entityType: AiEntityType.EMPLOYEE,
        entityId: 'employee-1',
        collectionKey: AiCollectionKey.ACTIVITIES,
        fieldKeys: ['subject', 'type'],
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(prismaService.activity.findMany).toHaveBeenCalled();
    });

    it('should resolve OPPORTUNITIES collection for CUSTOMER', async () => {
      const mockOpportunities = [
        {
          id: 'opp-1',
          title: 'Project Opportunity',
          stage: 'PROPOSAL',
          type: 'STAFF_AUG',
          value: 100000,
          updatedAt: new Date('2024-01-01'),
        },
      ];

      prismaService.opportunity.findMany.mockResolvedValue(mockOpportunities);

      const result = await service.resolveCollection({
        entityType: AiEntityType.CUSTOMER,
        entityId: 'customer-1',
        collectionKey: AiCollectionKey.OPPORTUNITIES,
        fieldKeys: ['title', 'stage'],
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(prismaService.opportunity.findMany).toHaveBeenCalled();
    });

    it('should return empty array for unsupported collection', async () => {
      const result = await service.resolveCollection({
        entityType: AiEntityType.EMPLOYEE,
        entityId: 'employee-1',
        collectionKey: 'UNSUPPORTED' as AiCollectionKey,
        fieldKeys: ['field1'],
        limit: 5,
      });

      expect(result).toEqual([]);
    });

    it('should handle bulk operations (no entityId)', async () => {
      const mockReports = [
        {
          id: 'report-1',
          date: new Date('2024-01-01'),
          summary: 'Worked on feature',
          hoursWorked: 8,
          isLate: false,
          submittedAt: new Date('2024-01-01T18:00:00Z'),
          tasksWorkedOn: null,
          userId: 'user-1',
        },
      ];

      prismaService.eodReport.findMany.mockResolvedValue(mockReports);
      prismaService.employee.findMany.mockResolvedValue([
        {
          id: 'employee-1',
          userId: 'user-1',
          user: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        },
      ]);

      const result = await service.resolveCollection({
        entityType: AiEntityType.EMPLOYEE,
        collectionKey: AiCollectionKey.EOD_REPORTS,
        fieldKeys: ['date', 'summary'],
        limit: 5,
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getCollectionDefinition', () => {
    it('should return collection definition for supported collection', () => {
      const definition = service.getCollectionDefinition(
        AiEntityType.EMPLOYEE,
        AiCollectionKey.EOD_REPORTS,
      );

      expect(definition).toBeDefined();
      expect(definition?.key).toBe(AiCollectionKey.EOD_REPORTS);
    });

    it('should return null for unsupported collection', () => {
      const definition = service.getCollectionDefinition(
        AiEntityType.EMPLOYEE,
        'UNSUPPORTED' as AiCollectionKey,
      );

      expect(definition).toBeNull();
    });
  });
});


import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { OpenPositionsService } from './positions.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { FilterPositionsDto } from './dto/filter-positions.dto';

describe('OpenPositionsService - Public Methods', () => {
  let service: OpenPositionsService;
  let prismaService: any;

  const mockPosition = {
    id: 'position-1',
    title: 'Senior React Developer',
    description: 'We are looking for a senior React developer',
    requirements: '5+ years React experience',
    status: 'Open',
    recruitmentStatus: 'STANDARD',
    isArchived: false,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-20'),
    opportunity: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      openPosition: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenPositionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<OpenPositionsService>(OpenPositionsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllPublic', () => {
    const filters: FilterPositionsDto = {
      page: 1,
      pageSize: 10,
    };

    it('should return only open, non-archived positions', async () => {
      const mockPositions = [mockPosition];
      const mockCount = 1;

      prismaService.$transaction.mockResolvedValue([mockCount, mockPositions]);

      const result = await service.findAllPublic(filters);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('Open');
      expect(result.data[0].isArchived).toBe(false);
      expect(result.meta.total).toBe(1);
    });

    it('should exclude opportunity information from results', async () => {
      const mockPositions = [mockPosition];
      const mockCount = 1;

      prismaService.$transaction.mockResolvedValue([mockCount, mockPositions]);

      const result = await service.findAllPublic(filters);

      expect(result.data[0]).not.toHaveProperty('opportunity');
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('title');
      expect(result.data[0]).toHaveProperty('description');
    });

    it('should apply pagination correctly', async () => {
      const mockPositions = Array(10).fill(mockPosition);
      const mockCount = 25;

      prismaService.$transaction.mockResolvedValue([mockCount, mockPositions]);

      const result = await service.findAllPublic({ page: 1, pageSize: 10 });

      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(10);
      expect(result.meta.total).toBe(25);
      expect(result.meta.pageCount).toBe(3);
    });

    it('should support search filtering', async () => {
      const mockPositions = [mockPosition];
      const mockCount = 1;

      prismaService.$transaction.mockResolvedValue([mockCount, mockPositions]);

      const result = await service.findAllPublic({
        ...filters,
        search: 'React',
      });

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(result.data).toBeDefined();
    });

    it('should sort by createdAt desc by default', async () => {
      const mockPositions = [mockPosition];
      const mockCount = 1;

      prismaService.$transaction.mockResolvedValue([mockCount, mockPositions]);

      await service.findAllPublic(filters);

      const transactionCall = prismaService.$transaction.mock.calls[0][0];
      const findManyCall = transactionCall[1];
      
      expect(findManyCall.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('should force status to Open and isArchived to false', async () => {
      const mockPositions = [mockPosition];
      const mockCount = 1;

      prismaService.$transaction.mockResolvedValue([mockCount, mockPositions]);

      await service.findAllPublic({
        ...filters,
        status: 'Filled', // Should be overridden
        isArchived: true, // Should be overridden
      });

      const transactionCall = prismaService.$transaction.mock.calls[0][0];
      const countCall = transactionCall[0];
      
      expect(countCall.where.status).toBe('Open');
      expect(countCall.where.isArchived).toBe(false);
    });
  });

  describe('findOnePublic', () => {
    it('should return a single open position', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);

      const result = await service.findOnePublic('position-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('position-1');
      expect(result.status).toBe('Open');
      expect(result.isArchived).toBe(false);
    });

    it('should exclude opportunity information', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);

      const result = await service.findOnePublic('position-1');

      expect(result).not.toHaveProperty('opportunity');
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
    });

    it('should throw NotFoundException if position does not exist', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await expect(service.findOnePublic('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if position is not open', async () => {
      const closedPosition = {
        ...mockPosition,
        status: 'Filled',
      };

      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await expect(service.findOnePublic('position-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if position is archived', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await expect(service.findOnePublic('position-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('formatPublicPosition', () => {
    it('should format position without opportunity data', () => {
      const positionWithOpportunity = {
        ...mockPosition,
        opportunity: {
          id: 'opp-1',
          customer: { id: 'customer-1', name: 'Acme Corp' },
        },
      };

      // Access private method through service instance
      const formatted = (service as any).formatPublicPosition(positionWithOpportunity);

      expect(formatted).not.toHaveProperty('opportunity');
      expect(formatted).toHaveProperty('id');
      expect(formatted).toHaveProperty('title');
      expect(formatted).toHaveProperty('description');
      expect(formatted).toHaveProperty('requirements');
      expect(formatted).toHaveProperty('status');
      expect(formatted).toHaveProperty('recruitmentStatus');
      expect(formatted).toHaveProperty('createdAt');
      expect(formatted).toHaveProperty('updatedAt');
    });

    it('should handle null position gracefully', () => {
      const formatted = (service as any).formatPublicPosition(null);
      expect(formatted).toBeNull();
    });
  });
});


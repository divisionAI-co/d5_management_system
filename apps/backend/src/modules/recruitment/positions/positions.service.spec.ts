import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OpenPositionsService } from './positions.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';
import { ClosePositionDto } from './dto/close-position.dto';
import { FilterPositionsDto } from './dto/filter-positions.dto';

describe('OpenPositionsService', () => {
  let service: OpenPositionsService;
  let prismaService: any;

  const mockOpportunity = {
    id: 'opp-1',
    title: 'New Project',
    value: new Prisma.Decimal(100000),
    customer: {
      id: 'customer-1',
      name: 'Acme Corp',
    },
    lead: {
      id: 'lead-1',
      title: 'New Lead',
    },
    openPosition: null,
  };

  const mockPosition = {
    id: 'position-1',
    title: 'Senior React Developer',
    description: 'We are looking for a senior React developer',
    requirements: '5+ years React experience',
    status: 'Open',
    recruitmentStatus: null,
    isArchived: false,
    opportunityId: 'opp-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    filledAt: null,
    opportunity: mockOpportunity,
    candidates: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      openPosition: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      opportunity: {
        findUnique: jest.fn(),
      },
      candidatePosition: {
        count: jest.fn(),
        findMany: jest.fn(),
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

  describe('create', () => {
    const createDto: CreatePositionDto = {
      title: 'Senior React Developer',
      description: 'We are looking for a senior React developer',
      requirements: '5+ years React experience',
      status: 'Open',
    };

    it('should create a position successfully', async () => {
      prismaService.openPosition.create.mockResolvedValue(mockPosition);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.title).toBe('Senior React Developer');
      expect(prismaService.openPosition.create).toHaveBeenCalled();
    });

    it('should link position to opportunity', async () => {
      const dtoWithOpportunity: CreatePositionDto = {
        ...createDto,
        opportunityId: 'opp-1',
      };

      prismaService.opportunity.findUnique.mockResolvedValue({
        ...mockOpportunity,
        openPosition: null,
      });
      prismaService.openPosition.create.mockResolvedValue({
        ...mockPosition,
        opportunityId: 'opp-1',
      });

      const result = await service.create(dtoWithOpportunity);

      expect(result).toBeDefined();
      expect(prismaService.opportunity.findUnique).toHaveBeenCalled();
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      const dtoWithOpportunity: CreatePositionDto = {
        ...createDto,
        opportunityId: 'non-existent',
      };

      prismaService.opportunity.findUnique.mockResolvedValue(null);

      await expect(service.create(dtoWithOpportunity)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when opportunity already has position', async () => {
      const opportunityWithPosition = {
        ...mockOpportunity,
        openPosition: {
          id: 'position-existing',
        },
      };

      const dtoWithOpportunity: CreatePositionDto = {
        ...createDto,
        opportunityId: 'opp-1',
      };

      prismaService.opportunity.findUnique.mockResolvedValue(opportunityWithPosition);

      await expect(service.create(dtoWithOpportunity)).rejects.toThrow(BadRequestException);
    });

    it('should use default description when not provided', async () => {
      const dtoWithoutDescription: CreatePositionDto = {
        title: 'Senior Developer',
      };

      prismaService.openPosition.create.mockResolvedValue({
        ...mockPosition,
        description: 'TBD',
      });

      await service.create(dtoWithoutDescription);

      expect(prismaService.openPosition.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: 'TBD',
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated positions', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockPosition]]);

      const filters: Partial<FilterPositionsDto> = {};
      const result = await service.findAll(filters as FilterPositionsDto);

      expect(result.data).toBeDefined();
      expect(result.meta.total).toBe(1);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockPosition]]);

      await service.findAll({ status: 'Open' } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by customerId', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockPosition]]);

      await service.findAll({ customerId: 'customer-1' } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by candidateId', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockPosition]]);

      await service.findAll({ candidateId: 'candidate-1' } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by keywords', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockPosition]]);

      await service.findAll({ keywords: ['React', 'Node.js'] } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should exclude archived positions by default', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockPosition]]);

      await service.findAll({});

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should search across title, description, requirements, and customer name', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockPosition]]);

      await service.findAll({ search: 'React' } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid sort field', async () => {
      const filters: Partial<FilterPositionsDto> = {
        sortBy: 'invalidField' as any,
      };

      await expect(service.findAll(filters as FilterPositionsDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a position with relations', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);

      const result = await service.findOne('position-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('position-1');
      expect(result.opportunity).toBeDefined();
      expect(prismaService.openPosition.findUnique).toHaveBeenCalled();
    });

    it('should format opportunity value as number', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);

      const result = await service.findOne('position-1');

      expect(result.opportunity.value).toBe(100000);
    });

    it('should throw NotFoundException when position does not exist', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdatePositionDto = {
      title: 'Updated Position Title',
      description: 'Updated description',
    };

    it('should update a position successfully', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.openPosition.update.mockResolvedValue({
        ...mockPosition,
        ...updateDto,
      });

      const result = await service.update('position-1', updateDto);

      expect(result).toBeDefined();
      expect(result.title).toBe('Updated Position Title');
      expect(prismaService.openPosition.update).toHaveBeenCalled();
    });

    it('should update opportunity link', async () => {
      const updateWithOpportunity: UpdatePositionDto = {
        opportunityId: 'opp-2',
      };

      const newOpportunity = {
        ...mockOpportunity,
        id: 'opp-2',
        openPosition: null,
      };

      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.opportunity.findUnique.mockResolvedValue(newOpportunity);
      prismaService.openPosition.update.mockResolvedValue({
        ...mockPosition,
        opportunityId: 'opp-2',
      });

      await service.update('position-1', updateWithOpportunity);

      expect(prismaService.opportunity.findUnique).toHaveBeenCalled();
      expect(prismaService.openPosition.update).toHaveBeenCalled();
    });

    it('should unlink opportunity when opportunityId is null', async () => {
      const unlinkDto: UpdatePositionDto = {
        opportunityId: null as any,
      };

      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.openPosition.update.mockResolvedValue({
        ...mockPosition,
        opportunityId: null,
      });

      await service.update('position-1', unlinkDto);

      expect(prismaService.openPosition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            opportunityId: null,
          }),
        }),
      );
    });

    it('should throw BadRequestException when opportunity already linked to different position', async () => {
      const opportunityWithPosition = {
        ...mockOpportunity,
        openPosition: {
          id: 'position-other',
        },
      };

      const updateWithOpportunity: UpdatePositionDto = {
        opportunityId: 'opp-1',
      };

      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.opportunity.findUnique.mockResolvedValue(opportunityWithPosition);

      await expect(service.update('position-1', updateWithOpportunity)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      const updateWithOpportunity: UpdatePositionDto = {
        opportunityId: 'non-existent',
      };

      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.opportunity.findUnique.mockResolvedValue(null);

      await expect(service.update('position-1', updateWithOpportunity)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when position does not exist', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('close', () => {
    const closeDto: ClosePositionDto = {
      filledAt: '2024-01-15',
    };

    it('should close a position successfully', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.openPosition.update.mockResolvedValue({
        ...mockPosition,
        status: 'Filled',
        filledAt: new Date('2024-01-15'),
      });

      const result = await service.close('position-1', closeDto);

      expect(result).toBeDefined();
      expect(result.status).toBe('Filled');
      expect(result.filledAt).toBeDefined();
      expect(prismaService.openPosition.update).toHaveBeenCalled();
    });

    it('should use current date when filledAt not provided', async () => {
      const dtoWithoutDate: ClosePositionDto = {};

      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.openPosition.update.mockResolvedValue({
        ...mockPosition,
        status: 'Filled',
        filledAt: new Date(),
      });

      await service.close('position-1', dtoWithoutDate);

      expect(prismaService.openPosition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            filledAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundException when position does not exist', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await expect(service.close('non-existent', closeDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCandidates', () => {
    it('should return candidates for a position', async () => {
      const mockCandidates = [
        {
          id: 'link-1',
          candidateId: 'candidate-1',
          positionId: 'position-1',
          appliedAt: new Date(),
          candidate: {
            id: 'candidate-1',
            firstName: 'John',
            lastName: 'Doe',
            expectedSalary: new Prisma.Decimal(80000),
          },
        },
      ];

      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.candidatePosition.findMany.mockResolvedValue(mockCandidates);

      const result = await service.getCandidates('position-1');

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(result[0].candidate?.expectedSalary).toBe(80000);
      expect(prismaService.candidatePosition.findMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException when position does not exist', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await expect(service.getCandidates('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('archive', () => {
    it('should archive a position successfully', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.openPosition.update.mockResolvedValue({
        ...mockPosition,
        isArchived: true,
      });

      const result = await service.archive('position-1');

      expect(result).toBeDefined();
      expect(result.isArchived).toBe(true);
      expect(prismaService.openPosition.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException when position is already archived', async () => {
      const archivedPosition = {
        ...mockPosition,
        isArchived: true,
      };

      prismaService.openPosition.findUnique.mockResolvedValue(archivedPosition);

      await expect(service.archive('position-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unarchive', () => {
    it('should unarchive a position successfully', async () => {
      const archivedPosition = {
        ...mockPosition,
        isArchived: true,
      };

      prismaService.openPosition.findUnique.mockResolvedValue(archivedPosition);
      prismaService.openPosition.update.mockResolvedValue({
        ...archivedPosition,
        isArchived: false,
      });

      const result = await service.unarchive('position-1');

      expect(result).toBeDefined();
      expect(result.isArchived).toBe(false);
    });

    it('should throw BadRequestException when position is not archived', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);

      await expect(service.unarchive('position-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a position successfully', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.candidatePosition.count.mockResolvedValue(0);
      prismaService.openPosition.delete.mockResolvedValue(mockPosition);

      const result = await service.remove('position-1');

      expect(result).toBeDefined();
      expect(result.message).toBe('Position deleted successfully');
      expect(prismaService.openPosition.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException when position has linked candidates', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(mockPosition);
      prismaService.candidatePosition.count.mockResolvedValue(2);

      await expect(service.remove('position-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when position does not exist', async () => {
      prismaService.openPosition.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});


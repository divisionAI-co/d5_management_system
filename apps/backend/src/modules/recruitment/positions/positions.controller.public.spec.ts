import { Test, TestingModule } from '@nestjs/testing';
import { OpenPositionsController } from './positions.controller';
import { OpenPositionsService } from './positions.service';
import { FilterPositionsDto } from './dto/filter-positions.dto';

describe('OpenPositionsController - Public Endpoints', () => {
  let controller: OpenPositionsController;
  let service: OpenPositionsService;

  const mockPosition = {
    id: 'position-1',
    title: 'Senior React Developer',
    description: 'We are looking for a senior React developer',
    requirements: '5+ years React experience',
    status: 'Open',
    recruitmentStatus: 'STANDARD',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockListResponse = {
    data: [mockPosition],
    pagination: {
      page: 1,
      pageSize: 10,
      total: 1,
      totalPages: 1,
    },
  };

  beforeEach(async () => {
    const mockPositionsService = {
      findAllPublic: jest.fn(),
      findOnePublic: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpenPositionsController],
      providers: [
        {
          provide: OpenPositionsService,
          useValue: mockPositionsService,
        },
      ],
    }).compile();

    controller = module.get<OpenPositionsController>(OpenPositionsController);
    service = module.get<OpenPositionsService>(OpenPositionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllPublic', () => {
    it('should call service.findAllPublic with filters', async () => {
      const filters: FilterPositionsDto = {
        page: 1,
        pageSize: 10,
      };

      (service.findAllPublic as jest.Mock).mockResolvedValue(mockListResponse);

      const result = await controller.findAllPublic(filters);

      expect(service.findAllPublic).toHaveBeenCalledWith(filters);
      expect(result).toEqual(mockListResponse);
    });

    it('should return paginated list of positions', async () => {
      (service.findAllPublic as jest.Mock).mockResolvedValue(mockListResponse);

      const result = await controller.findAllPublic({});

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('pagination');
      expect(result.data).toBeInstanceOf(Array);
    });
  });

  describe('findOnePublic', () => {
    it('should call service.findOnePublic with id', async () => {
      (service.findOnePublic as jest.Mock).mockResolvedValue(mockPosition);

      const result = await controller.findOnePublic('position-1');

      expect(service.findOnePublic).toHaveBeenCalledWith('position-1');
      expect(result).toEqual(mockPosition);
    });

    it('should return single position', async () => {
      (service.findOnePublic as jest.Mock).mockResolvedValue(mockPosition);

      const result = await controller.findOnePublic('position-1');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('description');
    });
  });
});


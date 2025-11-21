import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BaseService } from './base.service';
import { Prisma } from '@prisma/client';

// Create a concrete implementation for testing
class TestService extends BaseService {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // Expose protected methods for testing
  async testHandlePrismaError<T>(
    operation: () => Promise<T>,
    errorMessage: string,
  ): Promise<T> {
    return this.handlePrismaError(operation, errorMessage);
  }

  async testPaginate<T>(
    model: any,
    where: Prisma.Enumerable<T>,
    options: {
      page: number;
      pageSize: number;
      orderBy?: any;
      include?: any;
      select?: any;
    },
  ) {
    return this.paginate(model, where, options);
  }
}

describe('BaseService', () => {
  let service: TestService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TestService>(TestService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handlePrismaError', () => {
    it('should return result when operation succeeds', async () => {
      const mockResult = { id: '1', name: 'Test' };
      const operation = jest.fn().mockResolvedValue(mockResult);

      const result = await service.testHandlePrismaError(
        operation,
        'Test operation',
      );

      expect(result).toEqual(mockResult);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw BadRequestException for P2002 (unique constraint)', async () => {
      const error = {
        code: 'P2002',
        meta: { target: ['email'] },
      };
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        service.testHandlePrismaError(operation, 'Create user'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.testHandlePrismaError(operation, 'Create user'),
      ).rejects.toThrow('Create user: Record with this email already exists');
    });

    it('should throw BadRequestException for P2002 without target field', async () => {
      const error = {
        code: 'P2002',
        meta: {},
      };
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        service.testHandlePrismaError(operation, 'Create record'),
      ).rejects.toThrow('Create record: Record with this record already exists');
    });

    it('should throw NotFoundException for P2025 (record not found)', async () => {
      const error = {
        code: 'P2025',
      };
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        service.testHandlePrismaError(operation, 'Update user'),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.testHandlePrismaError(operation, 'Update user'),
      ).rejects.toThrow('Update user: Record not found');
    });

    it('should throw BadRequestException for P2003 (foreign key constraint)', async () => {
      const error = {
        code: 'P2003',
      };
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        service.testHandlePrismaError(operation, 'Create order'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.testHandlePrismaError(operation, 'Create order'),
      ).rejects.toThrow('Create order: Referenced record does not exist');
    });

    it('should rethrow unknown errors', async () => {
      const error = new Error('Unknown error');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(
        service.testHandlePrismaError(operation, 'Test operation'),
      ).rejects.toThrow('Unknown error');
    });

    it('should log error for unknown error codes', async () => {
      const error = new Error('Database connection failed');
      const operation = jest.fn().mockRejectedValue(error);
      const errorSpy = jest.spyOn(service['logger'], 'error');

      await expect(
        service.testHandlePrismaError(operation, 'Test operation'),
      ).rejects.toThrow();

      expect(errorSpy).toHaveBeenCalledWith('Test operation', error);
    });
  });

  describe('paginate', () => {
    const mockModel = {
      count: jest.fn(),
      findMany: jest.fn(),
    };

    beforeEach(() => {
      mockModel.count.mockClear();
      mockModel.findMany.mockClear();
    });

    it('should paginate results correctly', async () => {
      const mockData = [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ];
      const mockTotal = 10;

      prismaService.$transaction.mockResolvedValue([mockTotal, mockData]);

      const where = { status: 'active' };
      const result = await service.testPaginate(mockModel, where, {
        page: 1,
        pageSize: 25,
      });

      expect(result).toEqual({
        data: mockData,
        meta: {
          page: 1,
          pageSize: 25,
          total: mockTotal,
          pageCount: 1,
        },
      });

      expect(prismaService.$transaction).toHaveBeenCalledWith([
        mockModel.count({ where }),
        mockModel.findMany({
          where,
          skip: 0,
          take: 25,
          orderBy: undefined,
          include: undefined,
          select: undefined,
        }),
      ]);
    });

    it('should calculate skip correctly for page 2', async () => {
      const mockData = [{ id: '3', name: 'Item 3' }];
      const mockTotal = 30;

      prismaService.$transaction.mockResolvedValue([mockTotal, mockData]);

      const where = {};
      const result = await service.testPaginate(mockModel, where, {
        page: 2,
        pageSize: 25,
      });

      expect(result.meta.page).toBe(2);
      expect(result.meta.pageCount).toBe(2);
      expect(result.meta.total).toBe(30);

      expect(prismaService.$transaction).toHaveBeenCalledWith([
        mockModel.count({ where }),
        mockModel.findMany({
          where,
          skip: 25, // (2 - 1) * 25
          take: 25,
          orderBy: undefined,
          include: undefined,
          select: undefined,
        }),
      ]);
    });

    it('should calculate pageCount correctly', async () => {
      const mockData: any[] = [];
      const mockTotal = 100;

      prismaService.$transaction.mockResolvedValue([mockTotal, mockData]);

      const result = await service.testPaginate(mockModel, {}, {
        page: 1,
        pageSize: 25,
      });

      expect(result.meta.pageCount).toBe(4); // Math.ceil(100 / 25)
    });

    it('should handle empty results', async () => {
      const mockData: any[] = [];
      const mockTotal = 0;

      prismaService.$transaction.mockResolvedValue([mockTotal, mockData]);

      const result = await service.testPaginate(mockModel, {}, {
        page: 1,
        pageSize: 25,
      });

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.pageCount).toBe(0);
    });

    it('should pass orderBy to findMany', async () => {
      const mockData: any[] = [];
      const mockTotal = 0;
      const orderBy = { createdAt: 'desc' };

      prismaService.$transaction.mockResolvedValue([mockTotal, mockData]);

      await service.testPaginate(mockModel, {}, {
        page: 1,
        pageSize: 25,
        orderBy,
      });

      expect(prismaService.$transaction).toHaveBeenCalledWith([
        mockModel.count({ where: {} }),
        mockModel.findMany({
          where: {},
          skip: 0,
          take: 25,
          orderBy,
          include: undefined,
          select: undefined,
        }),
      ]);
    });

    it('should pass include to findMany', async () => {
      const mockData: any[] = [];
      const mockTotal = 0;
      const include = { customer: true };

      prismaService.$transaction.mockResolvedValue([mockTotal, mockData]);

      await service.testPaginate(mockModel, {}, {
        page: 1,
        pageSize: 25,
        include,
      });

      expect(prismaService.$transaction).toHaveBeenCalledWith([
        mockModel.count({ where: {} }),
        mockModel.findMany({
          where: {},
          skip: 0,
          take: 25,
          orderBy: undefined,
          include,
          select: undefined,
        }),
      ]);
    });

    it('should pass select to findMany', async () => {
      const mockData: any[] = [];
      const mockTotal = 0;
      const select = { id: true, name: true };

      prismaService.$transaction.mockResolvedValue([mockTotal, mockData]);

      await service.testPaginate(mockModel, {}, {
        page: 1,
        pageSize: 25,
        select,
      });

      expect(prismaService.$transaction).toHaveBeenCalledWith([
        mockModel.count({ where: {} }),
        mockModel.findMany({
          where: {},
          skip: 0,
          take: 25,
          orderBy: undefined,
          include: undefined,
          select,
        }),
      ]);
    });

    it('should handle pageCount for partial last page', async () => {
      const mockData: any[] = [{ id: '1' }];
      const mockTotal = 26; // 26 items, 25 per page = 2 pages

      prismaService.$transaction.mockResolvedValue([mockTotal, mockData]);

      const result = await service.testPaginate(mockModel, {}, {
        page: 2,
        pageSize: 25,
      });

      expect(result.meta.pageCount).toBe(2); // Math.ceil(26 / 25)
    });
  });

  describe('logger initialization', () => {
    it('should initialize logger with service name', () => {
      expect(service['logger']).toBeDefined();
      expect(service['logger'].constructor.name).toBe('Logger');
    });
  });
});


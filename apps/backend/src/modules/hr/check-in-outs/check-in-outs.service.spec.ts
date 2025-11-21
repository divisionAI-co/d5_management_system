import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { CheckInOutsService } from './check-in-outs.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateCheckInOutDto } from './dto/create-check-in-out.dto';
import { UpdateCheckInOutDto } from './dto/update-check-in-out.dto';
import { FilterCheckInOutsDto } from './dto/filter-check-in-outs.dto';
import { CheckInOutStatus, EmploymentStatus } from '@prisma/client';

describe('CheckInOutsService', () => {
  let service: CheckInOutsService;
  let prismaService: any;

  const mockEmployee = {
    id: 'emp-1',
    userId: 'user-1',
    employeeNumber: 'EMP001',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    status: EmploymentStatus.ACTIVE,
    user: {
      id: 'user-1',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
    },
  };

  const mockCheckInOut = {
    id: 'check-1',
    employeeId: 'emp-1',
    dateTime: new Date('2024-06-01T09:00:00Z'),
    status: CheckInOutStatus.IN,
    createdAt: new Date(),
    updatedAt: new Date(),
    employee: mockEmployee,
    importedByUser: null,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      employee: {
        findUnique: jest.fn(),
      },
      checkInOut: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInOutsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CheckInOutsService>(CheckInOutsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCheckInOutDto = {
      employeeId: 'emp-1',
      dateTime: '2024-06-01T09:00:00Z',
      status: CheckInOutStatus.IN,
    };

    it('should create a check-in/out record successfully', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.checkInOut.create.mockResolvedValue(mockCheckInOut);

      const result = await service.create(createDto, 'user-1');

      expect(result).toBeDefined();
      expect(result.employeeId).toBe(createDto.employeeId);
      expect(result.status).toBe(createDto.status);
      expect(prismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { id: createDto.employeeId },
        include: { user: true },
      });
      expect(prismaService.checkInOut.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(NotFoundException);
      expect(prismaService.checkInOut.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated check-in/out records for users who can manage others', async () => {
      const filters: FilterCheckInOutsDto = { page: 1, pageSize: 25 };
      const mockRecords = [mockCheckInOut];

      prismaService.checkInOut.count.mockResolvedValue(1);
      prismaService.checkInOut.findMany.mockResolvedValue(mockRecords);

      const result = await service.findAll(filters, 'user-1', true);

      expect(result.data).toEqual(mockRecords);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(25);
      expect(prismaService.checkInOut.count).toHaveBeenCalled();
      expect(prismaService.checkInOut.findMany).toHaveBeenCalled();
    });

    it('should filter by employeeId when user cannot manage others', async () => {
      const filters: FilterCheckInOutsDto = { page: 1, pageSize: 25 };

      prismaService.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      prismaService.checkInOut.count.mockResolvedValue(1);
      prismaService.checkInOut.findMany.mockResolvedValue([mockCheckInOut]);

      await service.findAll(filters, 'user-1', false);

      expect(prismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { id: true },
      });
      expect(prismaService.checkInOut.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp-1',
          }),
        }),
      );
    });

    it('should throw NotFoundException when employee not found for restricted user', async () => {
      const filters: FilterCheckInOutsDto = { page: 1, pageSize: 25 };

      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.findAll(filters, 'user-1', false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should filter by date range', async () => {
      const filters: FilterCheckInOutsDto = {
        page: 1,
        pageSize: 25,
        startDate: '2024-06-01',
        endDate: '2024-06-30',
      };

      prismaService.checkInOut.count.mockResolvedValue(1);
      prismaService.checkInOut.findMany.mockResolvedValue([mockCheckInOut]);

      await service.findAll(filters, 'user-1', true);

      expect(prismaService.checkInOut.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dateTime: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should handle default pagination values', async () => {
      prismaService.checkInOut.count.mockResolvedValue(0);
      prismaService.checkInOut.findMany.mockResolvedValue([]);

      await service.findAll({}, 'user-1', true);

      expect(prismaService.checkInOut.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 25,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return check-in/out record by id for users who can manage others', async () => {
      prismaService.checkInOut.findUnique.mockResolvedValue(mockCheckInOut);

      const result = await service.findOne('check-1', 'user-1', true);

      expect(result).toEqual(mockCheckInOut);
      expect(prismaService.checkInOut.findUnique).toHaveBeenCalledWith({
        where: { id: 'check-1' },
        include: expect.any(Object),
      });
    });

    it('should return check-in/out record for own employee when user cannot manage others', async () => {
      prismaService.checkInOut.findUnique.mockResolvedValue(mockCheckInOut);
      prismaService.employee.findUnique.mockResolvedValue({ id: 'emp-1' });

      const result = await service.findOne('check-1', 'user-1', false);

      expect(result).toEqual(mockCheckInOut);
    });

    it('should throw NotFoundException when record does not exist', async () => {
      prismaService.checkInOut.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent', 'user-1', true)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException when user tries to access another employee record', async () => {
      prismaService.checkInOut.findUnique.mockResolvedValue({
        ...mockCheckInOut,
        employeeId: 'emp-2',
      });
      prismaService.employee.findUnique.mockResolvedValue({ id: 'emp-1' });

      await expect(service.findOne('check-1', 'user-1', false)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateCheckInOutDto = {
      status: CheckInOutStatus.OUT,
    };

    it('should update check-in/out record successfully for users who can manage others', async () => {
      prismaService.checkInOut.findUnique.mockResolvedValue(mockCheckInOut);
      prismaService.checkInOut.update.mockResolvedValue({
        ...mockCheckInOut,
        ...updateDto,
      });

      const result = await service.update('check-1', updateDto, 'user-1', true);

      expect(result.status).toBe(updateDto.status);
      expect(prismaService.checkInOut.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when user tries to change employeeId without permission', async () => {
      const updateWithEmployee: UpdateCheckInOutDto = {
        employeeId: 'emp-2',
      };

      prismaService.checkInOut.findUnique.mockResolvedValue(mockCheckInOut);
      prismaService.employee.findUnique.mockResolvedValue({ id: 'emp-1' });

      await expect(
        service.update('check-1', updateWithEmployee, 'user-1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow changing employeeId for users who can manage others', async () => {
      const updateWithEmployee: UpdateCheckInOutDto = {
        employeeId: 'emp-2',
      };

      prismaService.checkInOut.findUnique.mockResolvedValue(mockCheckInOut);
      prismaService.employee.findUnique.mockResolvedValue({ id: 'emp-2' });
      prismaService.checkInOut.update.mockResolvedValue({
        ...mockCheckInOut,
        employeeId: 'emp-2',
      });

      await service.update('check-1', updateWithEmployee, 'user-1', true);

      expect(prismaService.checkInOut.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when new employee does not exist', async () => {
      const updateWithEmployee: UpdateCheckInOutDto = {
        employeeId: 'nonexistent',
      };

      prismaService.checkInOut.findUnique.mockResolvedValue(mockCheckInOut);
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(
        service.update('check-1', updateWithEmployee, 'user-1', true),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle dateTime updates', async () => {
      const updateWithDate: UpdateCheckInOutDto = {
        dateTime: '2024-06-01T17:00:00Z',
      };

      prismaService.checkInOut.findUnique.mockResolvedValue(mockCheckInOut);
      prismaService.checkInOut.update.mockResolvedValue({
        ...mockCheckInOut,
        dateTime: new Date('2024-06-01T17:00:00Z'),
      });

      await service.update('check-1', updateWithDate, 'user-1', true);

      expect(prismaService.checkInOut.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dateTime: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete check-in/out record successfully for users who can manage others', async () => {
      prismaService.checkInOut.findUnique.mockResolvedValue(mockCheckInOut);
      prismaService.checkInOut.delete.mockResolvedValue(mockCheckInOut);

      const result = await service.remove('check-1', 'user-1', true);

      expect(result).toEqual(mockCheckInOut);
      expect(prismaService.checkInOut.delete).toHaveBeenCalledWith({
        where: { id: 'check-1' },
      });
    });

    it('should throw ForbiddenException when user tries to delete another employee record', async () => {
      prismaService.checkInOut.findUnique.mockResolvedValue({
        ...mockCheckInOut,
        employeeId: 'emp-2',
      });
      prismaService.employee.findUnique.mockResolvedValue({ id: 'emp-1' });

      await expect(service.remove('check-1', 'user-1', false)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaService.checkInOut.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when record does not exist', async () => {
      prismaService.checkInOut.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent', 'user-1', true)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.checkInOut.delete).not.toHaveBeenCalled();
    });
  });
});


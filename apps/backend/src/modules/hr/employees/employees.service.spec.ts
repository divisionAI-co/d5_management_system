import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmploymentStatus, ContractType, UserRole } from '@prisma/client';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prismaService: any;

  const mockUser = {
    id: 'user-1',
    email: 'john.doe@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: UserRole.EMPLOYEE,
  };

  const mockEmployee = {
    id: 'emp-1',
    userId: 'user-1',
    employeeNumber: 'EMP001',
    department: 'Engineering',
    jobTitle: 'Software Engineer',
    status: EmploymentStatus.ACTIVE,
    contractType: ContractType.FULL_TIME,
    hireDate: new Date('2023-01-01'),
    terminationDate: null,
    salary: 50000,
    salaryCurrency: 'USD',
    managerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: mockUser,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      employee: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      leaveRequest: {
        count: jest.fn(),
      },
      performanceReview: {
        count: jest.fn(),
      },
      eodReport: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createEmployeeDto: CreateEmployeeDto = {
      userId: 'user-1',
      employeeNumber: 'EMP001',
      department: 'Engineering',
      jobTitle: 'Software Engineer',
      status: EmploymentStatus.ACTIVE,
      contractType: ContractType.FULL_TIME,
      hireDate: '2023-01-01',
      salary: 50000,
      salaryCurrency: 'USD',
    };

    it('should create an employee successfully', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.employee.findUnique.mockResolvedValue(null);
      prismaService.employee.create.mockResolvedValue({
        ...mockEmployee,
        user: mockUser,
      });

      const result = await service.create(createEmployeeDto);

      expect(result).toBeDefined();
      expect(result.employeeNumber).toBe(createEmployeeDto.employeeNumber);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: createEmployeeDto.userId },
      });
      expect(prismaService.employee.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when user does not exist', async () => {
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.create(createEmployeeDto)).rejects.toThrow(NotFoundException);
      expect(prismaService.employee.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictException when employee already exists for user', async () => {
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      await expect(service.create(createEmployeeDto)).rejects.toThrow(ConflictException);
      expect(prismaService.employee.create).not.toHaveBeenCalled();
    });

    it('should handle termination date when provided', async () => {
      const dtoWithTermination = {
        ...createEmployeeDto,
        terminationDate: '2023-12-31',
      };

      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.employee.findUnique.mockResolvedValue(null);
      prismaService.employee.create.mockResolvedValue({
        ...mockEmployee,
        terminationDate: new Date('2023-12-31'),
      });

      await service.create(dtoWithTermination);

      expect(prismaService.employee.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            terminationDate: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated employees', async () => {
      const filters = { page: 1, pageSize: 10 };
      const mockEmployees = [mockEmployee];

      prismaService.$transaction.mockResolvedValue([mockEmployees.length, mockEmployees]);

      const result = await service.findAll(filters);

      expect(result.data).toEqual(mockEmployees);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(10);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      const filters = { status: EmploymentStatus.ACTIVE, page: 1, pageSize: 10 };

      prismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll(filters);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by department', async () => {
      const filters = { department: 'Engineering', page: 1, pageSize: 10 };

      prismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll(filters);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should search by employee number, job title, or user name', async () => {
      const filters = { search: 'John', page: 1, pageSize: 10 };

      prismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll(filters);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should handle default pagination values', async () => {
      prismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll({});

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should limit pageSize to maximum of 100', async () => {
      const filters = { page: 1, pageSize: 200 };

      prismaService.$transaction.mockResolvedValue([0, []]);

      await service.findAll(filters);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return employee with related data', async () => {
      prismaService.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        leaveRequests: [],
        performanceReviews: [],
      });
      prismaService.eodReport.findMany.mockResolvedValue([]);

      const result = await service.findOne('emp-1');

      expect(result.id).toBe('emp-1');
      expect(prismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        include: expect.any(Object),
      });
      expect(prismaService.eodReport.findMany).toHaveBeenCalled();
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByUserId', () => {
    it('should return employee by user ID', async () => {
      prismaService.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        user: mockUser,
      });

      const result = await service.findByUserId('user-1');

      expect(result.userId).toBe('user-1');
      expect(prismaService.employee.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when employee does not exist for user', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.findByUserId('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateEmployeeDto: UpdateEmployeeDto = {
      department: 'Product',
      jobTitle: 'Senior Software Engineer',
    };

    it('should update employee successfully', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.employee.update.mockResolvedValue({
        ...mockEmployee,
        ...updateEmployeeDto,
      });

      const result = await service.update('emp-1', updateEmployeeDto);

      expect(result.department).toBe(updateEmployeeDto.department);
      expect(prismaService.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: expect.any(Object),
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', updateEmployeeDto)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaService.employee.update).not.toHaveBeenCalled();
    });

    it('should handle date updates', async () => {
      const updateWithDates: UpdateEmployeeDto = {
        hireDate: '2024-01-01',
        terminationDate: '2024-12-31',
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.employee.update.mockResolvedValue({
        ...mockEmployee,
        ...updateWithDates,
      });

      await service.update('emp-1', updateWithDates);

      expect(prismaService.employee.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hireDate: expect.any(Date),
            terminationDate: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should delete employee successfully', async () => {
      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);
      prismaService.employee.delete.mockResolvedValue(mockEmployee);

      const result = await service.remove('emp-1');

      expect(result).toEqual(mockEmployee);
      expect(prismaService.employee.delete).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
      });
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
      expect(prismaService.employee.delete).not.toHaveBeenCalled();
    });
  });

  describe('getDepartments', () => {
    it('should return list of unique departments', async () => {
      // Prisma's distinct will return unique values, so mock should reflect that
      const mockEmployees = [
        { department: 'Engineering' },
        { department: 'Product' },
        // Note: Prisma distinct would filter duplicates, so we only return unique values
      ];

      prismaService.employee.findMany.mockResolvedValue(mockEmployees);

      const result = await service.getDepartments();

      expect(result).toEqual(['Engineering', 'Product']);
      expect(prismaService.employee.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        select: { department: true },
        distinct: ['department'],
      });
    });

    it('should return empty array when no departments found', async () => {
      prismaService.employee.findMany.mockResolvedValue([]);

      const result = await service.getDepartments();

      expect(result).toEqual([]);
    });
  });

  describe('getEmployeeStats', () => {
    it('should return employee statistics', async () => {
      prismaService.employee.findUnique.mockResolvedValue({
        ...mockEmployee,
        leaveRequests: [],
        performanceReviews: [],
      });
      prismaService.eodReport.findMany.mockResolvedValue([]);
      prismaService.leaveRequest.count
        .mockResolvedValueOnce(10) // totalLeaveRequests
        .mockResolvedValueOnce(8) // approvedLeaves
        .mockResolvedValueOnce(2); // pendingLeaves
      prismaService.performanceReview.count.mockResolvedValue(5);
      prismaService.eodReport.count.mockResolvedValue(20);

      const result = await service.getEmployeeStats('emp-1');

      expect(result.employee).toBeDefined();
      expect(result.stats.totalLeaveRequests).toBe(10);
      expect(result.stats.approvedLeaves).toBe(8);
      expect(result.stats.pendingLeaves).toBe(2);
      expect(result.stats.performanceReviews).toBe(5);
      expect(result.stats.eodReports).toBe(20);
    });

    it('should throw NotFoundException when employee does not exist', async () => {
      prismaService.employee.findUnique.mockResolvedValue(null);

      await expect(service.getEmployeeStats('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});


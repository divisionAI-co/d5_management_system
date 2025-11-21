import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityFieldResolver } from './entity-field-resolver.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiEntityType } from '@prisma/client';

describe('EntityFieldResolver', () => {
  let service: EntityFieldResolver;
  let prismaService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      candidate: {
        findUnique: jest.fn(),
      },
      opportunity: {
        findUnique: jest.fn(),
      },
      employee: {
        findUnique: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      contact: {
        findUnique: jest.fn(),
      },
      lead: {
        findUnique: jest.fn(),
      },
      task: {
        findUnique: jest.fn(),
      },
      quote: {
        findUnique: jest.fn(),
      },
      recruiterPerformanceReport: {
        findUnique: jest.fn(),
      },
      salesPerformanceReport: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntityFieldResolver,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EntityFieldResolver>(EntityFieldResolver);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('listFields', () => {
    it('should return fields for CANDIDATE entity type', () => {
      const fields = service.listFields(AiEntityType.CANDIDATE);

      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
      expect(fields.some((f) => f.key === 'fullName')).toBe(true);
    });

    it('should return fields for EMPLOYEE entity type', () => {
      const fields = service.listFields(AiEntityType.EMPLOYEE);

      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should return fields for CUSTOMER entity type', () => {
      const fields = service.listFields(AiEntityType.CUSTOMER);

      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });

    it('should return fields for OPPORTUNITY entity type', () => {
      const fields = service.listFields(AiEntityType.OPPORTUNITY);

      expect(fields).toBeDefined();
      expect(Array.isArray(fields)).toBe(true);
      expect(fields.length).toBeGreaterThan(0);
    });
  });

  describe('ensureFieldKeysSupported', () => {
    it('should not throw when field keys are supported', () => {
      expect(() => {
        service.ensureFieldKeysSupported(AiEntityType.CANDIDATE, ['fullName', 'email']);
      }).not.toThrow();
    });

    it('should throw BadRequestException when field keys are empty', () => {
      expect(() => {
        service.ensureFieldKeysSupported(AiEntityType.CANDIDATE, []);
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException when field key is unsupported', () => {
      expect(() => {
        service.ensureFieldKeysSupported(AiEntityType.CANDIDATE, ['invalidField']);
      }).toThrow(BadRequestException);
    });
  });

  describe('ensureEntityExists', () => {
    it('should not throw when CANDIDATE exists', async () => {
      prismaService.candidate.findUnique.mockResolvedValue({
        id: 'candidate-1',
        firstName: 'John',
        lastName: 'Doe',
      });

      await expect(
        service.ensureEntityExists(AiEntityType.CANDIDATE, 'candidate-1'),
      ).resolves.not.toThrow();
    });

    it('should throw NotFoundException when CANDIDATE does not exist', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(null);

      await expect(
        service.ensureEntityExists(AiEntityType.CANDIDATE, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should not throw when EMPLOYEE exists', async () => {
      prismaService.employee.findUnique.mockResolvedValue({
        id: 'employee-1',
      });

      await expect(
        service.ensureEntityExists(AiEntityType.EMPLOYEE, 'employee-1'),
      ).resolves.not.toThrow();
    });

    it('should not throw when CUSTOMER exists', async () => {
      prismaService.customer.findUnique.mockResolvedValue({
        id: 'customer-1',
      });

      await expect(
        service.ensureEntityExists(AiEntityType.CUSTOMER, 'customer-1'),
      ).resolves.not.toThrow();
    });

    it('should throw BadRequestException for unsupported entity type', async () => {
      await expect(
        service.ensureEntityExists('UNSUPPORTED' as AiEntityType, 'id-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveFields', () => {
    it('should resolve fields for CANDIDATE', async () => {
      const mockCandidate = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        currentTitle: 'Developer',
        yearsOfExperience: 5,
        skills: ['JavaScript', 'TypeScript'],
        resume: null,
        linkedinUrl: null,
        githubUrl: null,
        portfolioUrl: null,
        stage: 'VALIDATION',
        rating: 5,
        notes: 'Great candidate',
      };

      prismaService.candidate.findUnique.mockResolvedValue(mockCandidate);

      const result = await service.resolveFields(AiEntityType.CANDIDATE, 'candidate-1', [
        'fullName',
        'email',
        'phone',
      ]);

      expect(result).toBeDefined();
      expect(result.fullName).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.phone).toBe('1234567890');
    });

    it('should throw NotFoundException when CANDIDATE does not exist', async () => {
      prismaService.candidate.findUnique.mockResolvedValue(null);

      await expect(
        service.resolveFields(AiEntityType.CANDIDATE, 'non-existent', ['fullName']),
      ).rejects.toThrow(NotFoundException);
    });

    it('should resolve fields for EMPLOYEE', async () => {
      const mockEmployee = {
        department: 'Engineering',
        jobTitle: 'Senior Developer',
        status: 'ACTIVE',
        contractType: 'FULL_TIME',
        hireDate: new Date('2020-01-01'),
        terminationDate: null,
        salary: '100000',
        salaryCurrency: 'USD',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '9876543210',
        emergencyContactRelation: 'Spouse',
        user: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '1234567890',
        },
        manager: {
          jobTitle: 'Engineering Manager',
          user: {
            firstName: 'Manager',
            lastName: 'Name',
            email: 'manager@example.com',
          },
        },
      };

      prismaService.employee.findUnique.mockResolvedValue(mockEmployee);

      const result = await service.resolveFields(AiEntityType.EMPLOYEE, 'employee-1', [
        'fullName',
        'email',
        'department',
      ]);

      expect(result).toBeDefined();
      expect(result.fullName).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.department).toBe('Engineering');
    });

    it('should resolve fields for CUSTOMER', async () => {
      const mockCustomer = {
        name: 'Acme Corp',
        email: 'contact@acme.com',
        phone: '1234567890',
        website: 'https://acme.com',
        industry: 'Technology',
        type: 'STAFF_AUG',
        status: 'ACTIVE',
        sentiment: 'HAPPY',
        address: '123 Main St',
        city: 'New York',
        country: 'USA',
        postalCode: '10001',
        monthlyValue: '50000',
        currency: 'USD',
        notes: 'Great customer',
        tags: ['premium', 'enterprise'],
      };

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      const result = await service.resolveFields(AiEntityType.CUSTOMER, 'customer-1', [
        'name',
        'email',
        'industry',
      ]);

      expect(result).toBeDefined();
      expect(result.name).toBe('Acme Corp');
      expect(result.email).toBe('contact@acme.com');
      expect(result.industry).toBe('Technology');
    });

    it('should throw BadRequestException for unsupported entity type', async () => {
      await expect(
        service.resolveFields('UNSUPPORTED' as AiEntityType, 'id-1', ['field1']),
      ).rejects.toThrow(BadRequestException);
    });
  });
});


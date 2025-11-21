import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CustomersService } from './customers.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EncryptionService } from '../../../common/encryption/encryption.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCustomerStatusDto } from './dto/update-customer-status.dto';
import { FilterCustomersDto } from './dto/filter-customers.dto';
import {
  CustomerStatus,
  CustomerSentiment,
  CustomerType,
} from '@prisma/client';

describe('CustomersService', () => {
  let service: CustomersService;
  let prismaService: any;
  let encryptionService: any;

  const mockCustomer = {
    id: 'customer-1',
    name: 'Acme Corp',
    email: 'contact@acme.com',
    phone: '+1234567890',
    website: 'https://acme.com',
    industry: 'Technology',
    type: CustomerType.STAFF_AUGMENTATION,
    status: CustomerStatus.ACTIVE,
    sentiment: CustomerSentiment.HAPPY,
    address: '123 Main St',
    city: 'New York',
    country: 'USA',
    postalCode: '10001',
    taxId: 'encrypted-tax-id',
    registrationId: 'encrypted-reg-id',
    monthlyValue: new Prisma.Decimal(5000),
    currency: 'USD',
    notes: 'Test notes',
    tags: ['enterprise', 'priority'],
    driveFolderId: '1A2b3C4D5E6F7G8H',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      customer: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      contact: {
        findMany: jest.fn(),
      },
      activity: {
        findMany: jest.fn(),
      },
      opportunity: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockEncryptionService = {
      encrypt: jest.fn((value) => (value ? `encrypted-${value}` : null)),
      decrypt: jest.fn((value) => (value ? value.replace('encrypted-', '') : null)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
    prismaService = module.get(PrismaService);
    encryptionService = module.get(EncryptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateCustomerDto = {
      name: 'Acme Corp',
      email: 'contact@acme.com',
      type: CustomerType.STAFF_AUGMENTATION,
      monthlyValue: 5000,
    };

    it('should create a customer successfully', async () => {
      prismaService.customer.create.mockResolvedValue(mockCustomer);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(prismaService.customer.create).toHaveBeenCalled();
      expect(encryptionService.encrypt).toHaveBeenCalledWith(undefined);
    });

    it('should encrypt sensitive fields', async () => {
      const dtoWithSensitive: CreateCustomerDto = {
        ...createDto,
        taxId: 'TAX123',
        registrationId: 'REG456',
      };

      prismaService.customer.create.mockResolvedValue(mockCustomer);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      await service.create(dtoWithSensitive);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('TAX123');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('REG456');
    });

    it('should lowercase email', async () => {
      const dtoWithUppercaseEmail: CreateCustomerDto = {
        ...createDto,
        email: 'CONTACT@ACME.COM',
      };

      prismaService.customer.create.mockResolvedValue(mockCustomer);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      await service.create(dtoWithUppercaseEmail);

      expect(prismaService.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'contact@acme.com',
          }),
        }),
      );
    });

    it('should set default status and sentiment', async () => {
      prismaService.customer.create.mockResolvedValue(mockCustomer);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      await service.create(createDto);

      expect(prismaService.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CustomerStatus.ONBOARDING,
            sentiment: CustomerSentiment.NEUTRAL,
          }),
        }),
      );
    });

    it('should extract driveFolderId from folder ID', async () => {
      const dtoWithFolderId: CreateCustomerDto = {
        ...createDto,
        driveFolderId: '1A2b3C4D5E6F7G8H',
      };

      prismaService.customer.create.mockResolvedValue(mockCustomer);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      await service.create(dtoWithFolderId);

      expect(prismaService.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driveFolderId: '1A2b3C4D5E6F7G8H',
          }),
        }),
      );
    });

    it('should extract driveFolderId from folder URL', async () => {
      const dtoWithFolderUrl: CreateCustomerDto = {
        ...createDto,
        driveFolderUrl: 'https://drive.google.com/drive/folders/1A2b3C4D5E6F7G8H',
      };

      prismaService.customer.create.mockResolvedValue(mockCustomer);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);

      await service.create(dtoWithFolderUrl);

      expect(prismaService.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driveFolderId: '1A2b3C4D5E6F7G8H',
          }),
        }),
      );
    });

    it('should throw BadRequestException for invalid drive folder URL', async () => {
      const dtoWithInvalidUrl: CreateCustomerDto = {
        ...createDto,
        driveFolderUrl: 'https://drive.google.com/file/d/invalid',
      };

      await expect(service.create(dtoWithInvalidUrl)).rejects.toThrow(BadRequestException);
    });

    it('should generate driveFolderUrl from driveFolderId', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.findOne('customer-1');

      expect(result.driveFolderId).toBe('1A2b3C4D5E6F7G8H');
      expect(result.driveFolderUrl).toBe('https://drive.google.com/drive/folders/1A2b3C4D5E6F7G8H');
    });
  });

  describe('findAll', () => {
    it('should return paginated customers', async () => {
      const mockCustomers = [mockCustomer];
      prismaService.$transaction.mockResolvedValue([1, mockCustomers]);

      const filters: FilterCustomersDto = { page: 1, pageSize: 25, sortBy: 'createdAt', sortOrder: 'desc' };
      const result = await service.findAll(filters);

      expect(result.data).toBeDefined();
      expect(result.meta.total).toBe(1);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by country', async () => {
      prismaService.$transaction.mockResolvedValue([1, [mockCustomer]]);

      const filters: Partial<FilterCustomersDto> = {
        country: 'USA',
      };

      await service.findAll(filters as FilterCustomersDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by tags', async () => {
      prismaService.$transaction.mockResolvedValue([1, [mockCustomer]]);

      const filters: Partial<FilterCustomersDto> = {
        tags: ['enterprise'],
      };

      await service.findAll(filters as FilterCustomersDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid sort field', async () => {
      const filters: Partial<FilterCustomersDto> = {
        sortBy: 'invalidField' as any,
      };

      await expect(service.findAll(filters as FilterCustomersDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return a customer with relations', async () => {
      const customerWithRelations = {
        ...mockCustomer,
        _count: {
          opportunities: 2,
          invoices: 1,
          activities: 5,
          meetings: 3,
        },
        opportunities: [],
        invoices: [],
      };

      prismaService.customer.findUnique.mockResolvedValue(customerWithRelations);
      prismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.findOne('customer-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('customer-1');
      expect(prismaService.customer.findUnique).toHaveBeenCalled();
      expect(prismaService.contact.findMany).toHaveBeenCalled();
    });

    it('should decrypt sensitive fields', async () => {
      const customerWithEncrypted = {
        ...mockCustomer,
        taxId: 'encrypted-tax-id',
        registrationId: 'encrypted-reg-id',
      };

      prismaService.customer.findUnique.mockResolvedValue(customerWithEncrypted);
      prismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.findOne('customer-1');

      expect(encryptionService.decrypt).toHaveBeenCalledWith('encrypted-tax-id');
      expect(encryptionService.decrypt).toHaveBeenCalledWith('encrypted-reg-id');
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateCustomerDto = {
      name: 'Updated Acme Corp',
      monthlyValue: 6000,
    };

    it('should update a customer successfully', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.customer.update.mockResolvedValue({
        ...mockCustomer,
        ...updateDto,
      });
      prismaService.customer.findUnique.mockResolvedValueOnce(mockCustomer).mockResolvedValueOnce({
        ...mockCustomer,
        ...updateDto,
      });
      prismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.update('customer-1', updateDto);

      expect(result).toBeDefined();
      expect(prismaService.customer.update).toHaveBeenCalled();
    });

    it('should encrypt sensitive fields on update', async () => {
      const updateWithSensitive: UpdateCustomerDto = {
        taxId: 'NEWTAX123',
        registrationId: 'NEWREG456',
      };

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.customer.update.mockResolvedValue(mockCustomer);
      prismaService.customer.findUnique.mockResolvedValueOnce(mockCustomer).mockResolvedValueOnce(mockCustomer);
      prismaService.contact.findMany.mockResolvedValue([]);

      await service.update('customer-1', updateWithSensitive);

      expect(encryptionService.encrypt).toHaveBeenCalledWith('NEWTAX123');
      expect(encryptionService.encrypt).toHaveBeenCalledWith('NEWREG456');
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should update driveFolderId from folder ID', async () => {
      const updateWithFolderId: UpdateCustomerDto = {
        driveFolderId: 'newFolderId',
      };

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.customer.update.mockResolvedValue({
        ...mockCustomer,
        driveFolderId: 'newFolderId',
      });
      prismaService.customer.findUnique.mockResolvedValueOnce(mockCustomer).mockResolvedValueOnce({
        ...mockCustomer,
        driveFolderId: 'newFolderId',
      });
      prismaService.contact.findMany.mockResolvedValue([]);

      await service.update('customer-1', updateWithFolderId);

      expect(prismaService.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driveFolderId: 'newFolderId',
          }),
        }),
      );
    });

    it('should update driveFolderId from folder URL', async () => {
      const updateWithFolderUrl: UpdateCustomerDto = {
        driveFolderUrl: 'https://drive.google.com/drive/folders/newFolderId',
      };

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.customer.update.mockResolvedValue({
        ...mockCustomer,
        driveFolderId: 'newFolderId',
      });
      prismaService.customer.findUnique.mockResolvedValueOnce(mockCustomer).mockResolvedValueOnce({
        ...mockCustomer,
        driveFolderId: 'newFolderId',
      });
      prismaService.contact.findMany.mockResolvedValue([]);

      await service.update('customer-1', updateWithFolderUrl);

      expect(prismaService.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driveFolderId: 'newFolderId',
          }),
        }),
      );
    });

    it('should clear driveFolderId when empty string provided', async () => {
      const updateToClear: UpdateCustomerDto = {
        driveFolderId: '',
      };

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.customer.update.mockResolvedValue({
        ...mockCustomer,
        driveFolderId: null,
      });
      prismaService.customer.findUnique.mockResolvedValueOnce(mockCustomer).mockResolvedValueOnce({
        ...mockCustomer,
        driveFolderId: null,
      });
      prismaService.contact.findMany.mockResolvedValue([]);

      await service.update('customer-1', updateToClear);

      expect(prismaService.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driveFolderId: null,
          }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    const statusDto: UpdateCustomerStatusDto = {
      status: CustomerStatus.AT_RISK,
      sentiment: CustomerSentiment.UNHAPPY,
      note: 'Customer expressing concerns',
    };

    it('should update customer status and sentiment', async () => {
      prismaService.customer.update.mockResolvedValue({
        ...mockCustomer,
        ...statusDto,
      });
      prismaService.customer.findUnique.mockResolvedValue({
        ...mockCustomer,
        ...statusDto,
      });
      prismaService.contact.findMany.mockResolvedValue([]);

      const result = await service.updateStatus('customer-1', statusDto);

      expect(result).toBeDefined();
      expect(prismaService.customer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: CustomerStatus.AT_RISK,
            sentiment: CustomerSentiment.UNHAPPY,
            notes: 'Customer expressing concerns',
          }),
        }),
      );
    });

    it('should throw BadRequestException when neither status nor sentiment provided', async () => {
      const emptyDto: UpdateCustomerStatusDto = {};

      await expect(service.updateStatus('customer-1', emptyDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a customer successfully', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.customer.delete.mockResolvedValue(mockCustomer);

      const result = await service.remove('customer-1');

      expect(result.deleted).toBe(true);
      expect(prismaService.customer.delete).toHaveBeenCalled();
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCustomerActivities', () => {
    it('should return customer activities', async () => {
      const mockActivities = [
        {
          id: 'activity-1',
          type: 'CALL',
          description: 'Follow-up call',
          createdAt: new Date(),
          updatedAt: new Date(),
          createdById: 'user-1',
          createdBy: {
            id: 'user-1',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
          },
        },
      ];

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.activity.findMany.mockResolvedValue(mockActivities);

      const result = await service.getCustomerActivities('customer-1');

      expect(result).toBeDefined();
      expect(prismaService.activity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'customer-1' },
        }),
      );
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.getCustomerActivities('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCustomerOpportunities', () => {
    it('should return customer opportunities', async () => {
      const mockOpportunities = [
        {
          id: 'opp-1',
          title: 'New Project',
          value: new Prisma.Decimal(10000),
          stage: 'Proposal',
        },
      ];

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.opportunity.findMany.mockResolvedValue(mockOpportunities);

      const result = await service.getCustomerOpportunities('customer-1');

      expect(result).toBeDefined();
      expect(result[0].value).toBe(10000);
      expect(prismaService.opportunity.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'customer-1' },
        }),
      );
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.getCustomerOpportunities('non-existent')).rejects.toThrow(NotFoundException);
    });
  });
});


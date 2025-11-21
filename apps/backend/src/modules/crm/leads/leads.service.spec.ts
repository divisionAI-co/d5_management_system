import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LeadsService } from './leads.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadStatusDto } from './dto/update-lead-status.dto';
import { ConvertLeadDto } from './dto/convert-lead.dto';
import {
  LeadStatus,
  CustomerType,
  CustomerStatus,
  CustomerSentiment,
} from '@prisma/client';

describe('LeadsService', () => {
  let service: LeadsService;
  let prismaService: any;

  const mockContact = {
    id: 'contact-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    role: 'CTO',
    companyName: 'Acme Corp',
    customerId: null,
  };

  const mockLead = {
    id: 'lead-1',
    contactId: 'contact-1',
    title: 'New Business Opportunity',
    description: 'Interested in our services',
    status: LeadStatus.NEW,
    value: new Prisma.Decimal(50000),
    probability: 50,
    assignedToId: 'user-1',
    source: 'Website',
    expectedCloseDate: new Date('2024-12-31'),
    prospectCompanyName: 'Acme Corp',
    createdAt: new Date(),
    updatedAt: new Date(),
    contacts: [
      {
        contact: mockContact,
      },
    ],
    assignedTo: {
      id: 'user-1',
      firstName: 'Sales',
      lastName: 'Person',
      email: 'sales@example.com',
    },
    convertedCustomer: null,
    opportunities: [],
    activities: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      contact: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      lead: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<LeadsService>(LeadsService);
    prismaService = module.get(PrismaService);

    // Setup transaction mock
    prismaService.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
      return callback(prismaService);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateLeadDto = {
      title: 'New Business Opportunity',
      description: 'Interested in our services',
      contactIds: ['contact-1'],
    };

    it('should create a lead with contactIds', async () => {
      prismaService.contact.findMany.mockResolvedValue([mockContact]);
      prismaService.lead.create.mockResolvedValue(mockLead);
      prismaService.lead.findUnique.mockResolvedValue(mockLead);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('lead-1');
      expect(prismaService.lead.create).toHaveBeenCalled();
    });

    it('should create a lead with legacy contactId', async () => {
      const dtoWithLegacyContact: CreateLeadDto = {
        ...createDto,
        contactIds: undefined,
        contactId: 'contact-1',
      };

      prismaService.contact.findUnique.mockResolvedValue(mockContact);
      prismaService.lead.create.mockResolvedValue(mockLead);
      prismaService.lead.findUnique.mockResolvedValue(mockLead);

      const result = await service.create(dtoWithLegacyContact);

      expect(result).toBeDefined();
      expect(prismaService.contact.findUnique).toHaveBeenCalledWith({
        where: { id: 'contact-1' },
      });
    });

    it('should create a lead with new contact', async () => {
      const dtoWithNewContact: CreateLeadDto = {
        ...createDto,
        contactIds: undefined,
        contact: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          companyName: 'New Corp',
        },
      };

      const newContact = {
        ...mockContact,
        id: 'contact-2',
        ...dtoWithNewContact.contact,
      };

      prismaService.contact.findUnique.mockResolvedValue(null);
      prismaService.contact.create.mockResolvedValue(newContact);
      prismaService.lead.create.mockResolvedValue({
        ...mockLead,
        contactId: newContact.id,
      });
      prismaService.lead.findUnique.mockResolvedValue(mockLead);

      const result = await service.create(dtoWithNewContact);

      expect(result).toBeDefined();
      expect(prismaService.contact.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException when contactIds do not exist', async () => {
      prismaService.contact.findMany.mockResolvedValue([]);

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when no contact provided', async () => {
      const dtoWithoutContact: CreateLeadDto = {
        title: 'New Lead',
        description: 'No contact',
      };

      await expect(service.create(dtoWithoutContact)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated leads', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockLead]]);

      const result = await service.findAll({} as any);

      expect(result.data).toBeDefined();
      expect(result.meta.total).toBe(1);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockLead]]);

      await service.findAll({ status: LeadStatus.NEW } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should search in contacts', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockLead]]);

      await service.findAll({ search: 'John' } as any);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a lead with relations', async () => {
      prismaService.lead.findUnique.mockResolvedValue(mockLead);

      const result = await service.findOne('lead-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('lead-1');
      expect(result.contacts).toBeDefined();
      expect(prismaService.lead.findUnique).toHaveBeenCalled();
    });

    it('should format value as number', async () => {
      prismaService.lead.findUnique.mockResolvedValue(mockLead);

      const result = await service.findOne('lead-1');

      expect(result.value).toBe(50000);
    });

    it('should throw NotFoundException when lead does not exist', async () => {
      prismaService.lead.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateLeadDto = {
      title: 'Updated Opportunity',
      value: 60000,
    };

    it('should update a lead successfully', async () => {
      const existingLead = {
        ...mockLead,
        contacts: [{ contact: mockContact }],
      };

      prismaService.lead.findUnique.mockResolvedValue(existingLead);
      prismaService.lead.update.mockResolvedValue({
        ...mockLead,
        ...updateDto,
      });
      prismaService.lead.findUnique.mockResolvedValueOnce(existingLead).mockResolvedValueOnce({
        ...mockLead,
        ...updateDto,
      });

      const result = await service.update('lead-1', updateDto);

      expect(result).toBeDefined();
      expect(prismaService.lead.update).toHaveBeenCalled();
    });

    it('should update contactIds', async () => {
      const existingLead = {
        ...mockLead,
        contacts: [{ contact: mockContact }],
      };

      const newContact = {
        ...mockContact,
        id: 'contact-2',
      };

      const updateWithContacts: UpdateLeadDto = {
        contactIds: ['contact-2'],
      };

      prismaService.lead.findUnique.mockResolvedValue(existingLead);
      prismaService.contact.findMany.mockResolvedValue([newContact]);
      prismaService.lead.update.mockResolvedValue(mockLead);
      prismaService.lead.findUnique.mockResolvedValueOnce(existingLead).mockResolvedValueOnce(mockLead);

      await service.update('lead-1', updateWithContacts);

      expect(prismaService.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            contacts: expect.objectContaining({
              deleteMany: {},
              create: [{ contactId: 'contact-2' }],
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException when lead does not exist', async () => {
      prismaService.lead.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    const statusDto: UpdateLeadStatusDto = {
      status: LeadStatus.QUALIFIED,
      probability: 75,
    };

    it('should update lead status', async () => {
      prismaService.lead.update.mockResolvedValue({
        ...mockLead,
        ...statusDto,
      });
      prismaService.lead.findUnique.mockResolvedValue({
        ...mockLead,
        ...statusDto,
      });

      const result = await service.updateStatus('lead-1', statusDto);

      expect(result).toBeDefined();
      expect(result.status).toBe(LeadStatus.QUALIFIED);
      expect(prismaService.lead.update).toHaveBeenCalled();
    });

    it('should set actualCloseDate when provided', async () => {
      const statusWithDate: UpdateLeadStatusDto = {
        ...statusDto,
        actualCloseDate: '2024-12-31',
      };

      prismaService.lead.update.mockResolvedValue(mockLead);
      prismaService.lead.findUnique.mockResolvedValue(mockLead);

      await service.updateStatus('lead-1', statusWithDate);

      expect(prismaService.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            actualCloseDate: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('convert', () => {
    const convertDto: ConvertLeadDto = {
      customerName: 'Acme Corp',
      customerEmail: 'contact@acme.com',
      customerType: CustomerType.STAFF_AUGMENTATION,
    };

    it('should convert lead to customer successfully', async () => {
      const leadWithContacts = {
        ...mockLead,
        contacts: [{ contact: mockContact }],
        convertedCustomerId: null,
      };

      const mockCustomer = {
        id: 'customer-1',
        name: 'Acme Corp',
        email: 'contact@acme.com',
      };

      prismaService.lead.findUnique.mockResolvedValue(leadWithContacts);
      prismaService.customer.create.mockResolvedValue(mockCustomer);
      prismaService.lead.update.mockResolvedValue({
        ...leadWithContacts,
        convertedCustomerId: 'customer-1',
      });
      prismaService.contact.updateMany.mockResolvedValue({ count: 1 });
      prismaService.lead.findUnique.mockResolvedValueOnce(leadWithContacts).mockResolvedValueOnce({
        ...leadWithContacts,
        convertedCustomerId: 'customer-1',
      });

      const result = await service.convert('lead-1', convertDto);

      expect(result).toBeDefined();
      expect(prismaService.customer.create).toHaveBeenCalled();
      expect(prismaService.lead.update).toHaveBeenCalled();
    });

    it('should use existing customer when customerId provided', async () => {
      const leadWithContacts = {
        ...mockLead,
        contacts: [{ contact: mockContact }],
        convertedCustomerId: null,
      };

      const mockCustomer = {
        id: 'customer-1',
        name: 'Acme Corp',
      };

      const convertWithCustomerId: ConvertLeadDto = {
        ...convertDto,
        customerId: 'customer-1',
      };

      prismaService.lead.findUnique.mockResolvedValue(leadWithContacts);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.lead.update.mockResolvedValue({
        ...leadWithContacts,
        convertedCustomerId: 'customer-1',
      });
      prismaService.contact.updateMany.mockResolvedValue({ count: 1 });
      prismaService.lead.findUnique.mockResolvedValueOnce(leadWithContacts).mockResolvedValueOnce({
        ...leadWithContacts,
        convertedCustomerId: 'customer-1',
      });

      await service.convert('lead-1', convertWithCustomerId);

      expect(prismaService.customer.findUnique).toHaveBeenCalledWith({
        where: { id: 'customer-1' },
      });
      expect(prismaService.customer.create).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when lead does not exist', async () => {
      prismaService.lead.findUnique.mockResolvedValue(null);

      await expect(service.convert('non-existent', convertDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when lead already converted', async () => {
      const convertedLead = {
        ...mockLead,
        convertedCustomerId: 'customer-1',
      };

      prismaService.lead.findUnique.mockResolvedValue(convertedLead);

      await expect(service.convert('lead-1', convertDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when lead has no contacts', async () => {
      const leadWithoutContacts = {
        ...mockLead,
        contacts: [],
        contactId: null,
      };

      prismaService.lead.findUnique.mockResolvedValue(leadWithoutContacts);

      await expect(service.convert('lead-1', convertDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete a lead successfully', async () => {
      prismaService.lead.delete.mockResolvedValue(mockLead);

      const result = await service.remove('lead-1');

      expect(result.deleted).toBe(true);
      expect(prismaService.lead.delete).toHaveBeenCalled();
    });
  });

  describe('listContacts', () => {
    it('should return contacts with search', async () => {
      prismaService.contact.findMany.mockResolvedValue([mockContact]);

      const result = await service.listContacts('John', 50);

      expect(result).toBeDefined();
      expect(prismaService.contact.findMany).toHaveBeenCalled();
    });

    it('should return contacts without search', async () => {
      prismaService.contact.findMany.mockResolvedValue([mockContact]);

      const result = await service.listContacts(undefined, 50);

      expect(result).toBeDefined();
      expect(prismaService.contact.findMany).toHaveBeenCalled();
    });
  });
});


import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { FilterContactsDto } from './dto/filter-contacts.dto';
import { ConvertContactToLeadDto } from './dto/convert-contact-to-lead.dto';
import { LeadStatus } from '@prisma/client';

describe('ContactsService', () => {
  let service: ContactsService;
  let prismaService: any;

  const mockContact = {
    id: 'contact-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    role: 'CTO',
    companyName: 'Acme Corp',
    linkedinUrl: 'https://linkedin.com/in/johndoe',
    notes: 'Test notes',
    customerId: 'customer-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: {
      id: 'customer-1',
      name: 'Acme Corp',
      email: 'contact@acme.com',
      phone: '+1234567890',
    },
    leadContacts: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      contact: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      lead: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateContactDto = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      role: 'CTO',
      companyName: 'Acme Corp',
      customerId: 'customer-1',
    };

    it('should create a contact successfully', async () => {
      prismaService.contact.create.mockResolvedValue(mockContact);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(prismaService.contact.create).toHaveBeenCalled();
    });

    it('should create contact without customer', async () => {
      const dtoWithoutCustomer: CreateContactDto = {
        ...createDto,
        customerId: undefined,
      };

      const contactWithoutCustomer = {
        ...mockContact,
        customerId: null,
        customer: null,
      };

      prismaService.contact.create.mockResolvedValue(contactWithoutCustomer);

      const result = await service.create(dtoWithoutCustomer);

      expect(result).toBeDefined();
      expect(result.customer).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated contacts', async () => {
      const mockContacts = [mockContact];
      prismaService.$transaction = jest.fn().mockResolvedValue([1, mockContacts]);

      const filters: Partial<FilterContactsDto> = { page: 1, pageSize: 25 };
      const result = await service.findAll(filters as FilterContactsDto);

      expect(result.data).toBeDefined();
      expect(result.meta.total).toBe(1);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by unassigned contacts', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockContact]]);

      const filters: Partial<FilterContactsDto> = {
        unassigned: true,
      };

      await service.findAll(filters as FilterContactsDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should include customer information', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockContact]]);

      const result = await service.findAll({} as FilterContactsDto);

      expect(result.data[0].customer).toBeDefined();
    });
  });

  describe('findOne', () => {
    it('should return a contact with relations', async () => {
      const contactWithRelations = {
        ...mockContact,
        leadContacts: [
          {
            lead: {
              id: 'lead-1',
              title: 'New Lead',
              status: LeadStatus.NEW,
              value: null,
            },
          },
        ],
        activities: [],
      };

      prismaService.contact.findUnique.mockResolvedValue(contactWithRelations);

      const result = await service.findOne('contact-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('contact-1');
      expect(result.leads).toBeDefined();
      expect(prismaService.contact.findUnique).toHaveBeenCalled();
    });

    it('should format leads from leadContacts', async () => {
      const contactWithLeads = {
        ...mockContact,
        leadContacts: [
          {
            lead: {
              id: 'lead-1',
              title: 'New Lead',
              status: LeadStatus.NEW,
              value: null,
            },
          },
        ],
        activities: [],
      };

      prismaService.contact.findUnique.mockResolvedValue(contactWithLeads);

      const result = await service.findOne('contact-1');

      expect(result.leads).toBeDefined();
      expect(result.leads[0].id).toBe('lead-1');
      expect(result.leadContacts).toBeUndefined();
    });

    it('should throw NotFoundException when contact does not exist', async () => {
      prismaService.contact.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateContactDto = {
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
    };

    it('should update a contact successfully', async () => {
      const updatedContact = {
        ...mockContact,
        ...updateDto,
      };

      prismaService.contact.update.mockResolvedValue(updatedContact);

      const result = await service.update('contact-1', updateDto);

      expect(result).toBeDefined();
      expect(result.firstName).toBe('Jane');
      expect(prismaService.contact.update).toHaveBeenCalled();
    });

    it('should update customer association', async () => {
      const updateWithCustomer: UpdateContactDto = {
        customerId: 'customer-2',
      };

      const updatedContact = {
        ...mockContact,
        customerId: 'customer-2',
      };

      prismaService.contact.update.mockResolvedValue(updatedContact);

      const result = await service.update('contact-1', updateWithCustomer);

      expect(result.customerId).toBe('customer-2');
    });
  });

  describe('remove', () => {
    it('should delete a contact successfully', async () => {
      prismaService.contact.delete.mockResolvedValue(mockContact);

      const result = await service.remove('contact-1');

      expect(result.deleted).toBe(true);
      expect(prismaService.contact.delete).toHaveBeenCalled();
    });
  });

  describe('convertToLead', () => {
    const convertDto: ConvertContactToLeadDto = {
      title: 'New Business Opportunity',
      description: 'Interested in our services',
      status: LeadStatus.NEW,
      value: 50000,
      probability: 50,
      assignedToId: 'user-1',
      source: 'Website',
      expectedCloseDate: '2024-12-31',
    };

    it('should convert contact to lead successfully', async () => {
      const mockLead = {
        id: 'lead-1',
        contactId: 'contact-1',
        ...convertDto,
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
      };

      prismaService.contact.findUnique.mockResolvedValue(mockContact);
      prismaService.lead.create.mockResolvedValue(mockLead);
      prismaService.lead.findUnique.mockResolvedValue(mockLead);

      const result = await service.convertToLead('contact-1', convertDto);

      expect(result).toBeDefined();
      expect(result.id).toBe('lead-1');
      expect(prismaService.lead.create).toHaveBeenCalled();
    });

    it('should use contact company name as prospect company name', async () => {
      const mockLead = {
        id: 'lead-1',
        contactId: 'contact-1',
        prospectCompanyName: 'Acme Corp',
        contacts: [
          {
            contact: mockContact,
          },
        ],
        assignedTo: null,
      };

      prismaService.contact.findUnique.mockResolvedValue(mockContact);
      prismaService.lead.create.mockResolvedValue(mockLead);
      prismaService.lead.findUnique.mockResolvedValue(mockLead);

      const dtoWithoutCompany: ConvertContactToLeadDto = {
        ...convertDto,
        prospectCompanyName: undefined,
      };

      await service.convertToLead('contact-1', dtoWithoutCompany);

      expect(prismaService.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prospectCompanyName: 'Acme Corp',
          }),
        }),
      );
    });

    it('should throw NotFoundException when contact does not exist', async () => {
      prismaService.contact.findUnique.mockResolvedValue(null);

      await expect(service.convertToLead('non-existent', convertDto)).rejects.toThrow(NotFoundException);
    });
  });
});


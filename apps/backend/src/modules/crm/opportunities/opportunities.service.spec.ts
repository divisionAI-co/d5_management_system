import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OpportunitiesService } from './opportunities.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { EmailService } from '../../../common/email/email.service';
import { TemplatesService } from '../../templates/templates.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { UsersService } from '../../users/users.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { CloseOpportunityDto } from './dto/close-opportunity.dto';
import { SendOpportunityEmailDto } from './dto/send-email.dto';
import {
  CustomerType,
  UserRole,
  NotificationType,
} from '@prisma/client';

describe('OpportunitiesService', () => {
  let service: OpportunitiesService;
  let prismaService: any;
  let emailService: any;
  let templatesService: any;
  let notificationsService: any;
  let usersService: any;

  const mockContact = {
    id: 'contact-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1234567890',
    role: 'CTO',
    companyName: 'Acme Corp',
    customerId: 'customer-1',
  };

  const mockLead = {
    id: 'lead-1',
    title: 'New Business Opportunity',
    status: 'NEW',
    convertedCustomerId: null,
    contacts: [
      {
        contact: mockContact,
      },
    ],
  };

  const mockCustomer = {
    id: 'customer-1',
    name: 'Acme Corp',
    email: 'contact@acme.com',
  };

  const mockUser = {
    id: 'user-1',
    firstName: 'Sales',
    lastName: 'Person',
    email: 'sales@example.com',
    role: UserRole.SALESPERSON,
    isActive: true,
  };

  const mockOpportunity = {
    id: 'opp-1',
    leadId: 'lead-1',
    customerId: 'customer-1',
    title: 'New Project',
    description: 'Project description',
    type: CustomerType.STAFF_AUGMENTATION,
    value: new Prisma.Decimal(100000),
    assignedToId: 'user-1',
    stage: 'Proposal',
    isClosed: false,
    isWon: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: mockCustomer,
    assignedTo: mockUser,
    lead: {
      ...mockLead,
      contacts: [{ contact: mockContact }],
    },
    openPosition: null,
    activities: [],
  };

  beforeEach(async () => {
    const mockPrismaService = {
      opportunity: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      lead: {
        findUnique: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      openPosition: {
        create: jest.fn(),
        update: jest.fn(),
      },
      notification: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockEmailService = {
      sendEmail: jest.fn(),
    };

    const mockTemplatesService = {
      render: jest.fn(),
    };

    const mockNotificationsService = {
      createNotificationsForUsers: jest.fn(),
    };

    const mockUsersService = {
      findUsersByMentions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpportunitiesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: TemplatesService,
          useValue: mockTemplatesService,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    service = module.get<OpportunitiesService>(OpportunitiesService);
    prismaService = module.get(PrismaService);
    emailService = module.get(EmailService);
    templatesService = module.get(TemplatesService);
    notificationsService = module.get(NotificationsService);
    usersService = module.get(UsersService);

    // Setup transaction mock
    prismaService.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
      return callback(prismaService);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateOpportunityDto = {
      leadId: 'lead-1',
      customerId: 'customer-1',
      title: 'New Project',
      description: 'Project description',
      type: CustomerType.STAFF_AUGMENTATION,
      value: 100000,
      assignedToId: 'user-1',
      stage: 'Proposal',
    };

    it('should create an opportunity successfully', async () => {
      prismaService.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.opportunity.create.mockResolvedValue(mockOpportunity);
      prismaService.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      prismaService.user.findMany.mockResolvedValue([]);

      const result = await service.create(createDto, 'user-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('opp-1');
      expect(prismaService.opportunity.create).toHaveBeenCalled();
    });

    it('should use converted customer from lead', async () => {
      const leadWithConvertedCustomer = {
        ...mockLead,
        convertedCustomerId: 'customer-2',
        contacts: [
          {
            contact: {
              ...mockContact,
              customerId: 'customer-2',
            },
          },
        ],
      };

      prismaService.lead.findUnique.mockResolvedValue(leadWithConvertedCustomer);
      prismaService.customer.findUnique.mockResolvedValue({
        ...mockCustomer,
        id: 'customer-2',
      });
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.opportunity.create.mockResolvedValue({
        ...mockOpportunity,
        customerId: 'customer-2',
      });
      prismaService.opportunity.findUnique.mockResolvedValue({
        ...mockOpportunity,
        customerId: 'customer-2',
      });
      prismaService.user.findMany.mockResolvedValue([]);

      const dtoWithoutCustomer: CreateOpportunityDto = {
        ...createDto,
        customerId: undefined,
      };

      await service.create(dtoWithoutCustomer, 'user-1');

      expect(prismaService.opportunity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'customer-2',
          }),
        }),
      );
    });

    it('should create open position for staff augmentation', async () => {
      const dtoWithPosition: CreateOpportunityDto = {
        ...createDto,
        positionTitle: 'Senior Developer',
        positionDescription: 'Full-stack developer position',
        positionRequirements: '5+ years experience',
      };

      prismaService.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.opportunity.create.mockResolvedValue(mockOpportunity);
      prismaService.openPosition.create.mockResolvedValue({
        id: 'position-1',
        opportunityId: 'opp-1',
        title: 'Senior Developer',
      });
      prismaService.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      prismaService.user.findMany.mockResolvedValue([]);

      await service.create(dtoWithPosition, 'user-1');

      expect(prismaService.openPosition.create).toHaveBeenCalled();
    });

    it('should notify recruiters for staff augmentation', async () => {
      const recruiter = {
        id: 'recruiter-1',
        role: UserRole.RECRUITER,
        isActive: true,
      };

      prismaService.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.user.findUnique.mockResolvedValue(mockUser);
      prismaService.opportunity.create.mockResolvedValue(mockOpportunity);
      prismaService.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      prismaService.user.findMany.mockResolvedValue([recruiter]);
      prismaService.notification.createMany.mockResolvedValue({ count: 1 });

      await service.create(createDto, 'user-1');

      expect(prismaService.notification.createMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException when lead converted to different customer', async () => {
      const leadWithConvertedCustomer = {
        ...mockLead,
        convertedCustomerId: 'customer-2',
      };

      prismaService.lead.findUnique.mockResolvedValue(leadWithConvertedCustomer);

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when assigned user is not eligible', async () => {
      const inactiveUser = {
        ...mockUser,
        isActive: false,
      };

      prismaService.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.user.findUnique.mockResolvedValue(inactiveUser);

      await expect(service.create(createDto, 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated opportunities', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockOpportunity]]);

      const result = await service.findAll({});

      expect(result.data).toBeDefined();
      expect(result.meta.total).toBe(1);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by stage', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockOpportunity]]);

      await service.findAll({ stage: 'Proposal' });

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should search across relations', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockOpportunity]]);

      await service.findAll({ search: 'Acme' });

      expect(prismaService.$transaction).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return an opportunity with relations', async () => {
      prismaService.opportunity.findUnique.mockResolvedValue(mockOpportunity);

      const result = await service.findOne('opp-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('opp-1');
      expect(result.value).toBe(100000);
      expect(prismaService.opportunity.findUnique).toHaveBeenCalled();
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      prismaService.opportunity.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateOpportunityDto = {
      title: 'Updated Project',
      value: 120000,
    };

    it('should update an opportunity successfully', async () => {
      const existingOpportunity = {
        ...mockOpportunity,
        openPosition: null,
      };

      prismaService.opportunity.findUnique.mockResolvedValue(existingOpportunity);
      prismaService.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.opportunity.update.mockResolvedValue({
        ...mockOpportunity,
        ...updateDto,
      });
      prismaService.opportunity.findUnique.mockResolvedValueOnce(existingOpportunity).mockResolvedValueOnce({
        ...mockOpportunity,
        ...updateDto,
      });

      const result = await service.update('opp-1', updateDto, 'user-1');

      expect(result).toBeDefined();
      expect(prismaService.opportunity.update).toHaveBeenCalled();
    });

    it('should update open position when position fields provided', async () => {
      const existingOpportunity = {
        ...mockOpportunity,
        openPosition: {
          id: 'position-1',
          title: 'Old Title',
        },
      };

      const updateWithPosition: UpdateOpportunityDto = {
        positionTitle: 'New Position Title',
      };

      prismaService.opportunity.findUnique.mockResolvedValue(existingOpportunity);
      prismaService.lead.findUnique.mockResolvedValue(mockLead);
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.opportunity.update.mockResolvedValue(mockOpportunity);
      prismaService.openPosition.update.mockResolvedValue({
        ...existingOpportunity.openPosition,
        title: 'New Position Title',
      });
      prismaService.opportunity.findUnique.mockResolvedValueOnce(existingOpportunity).mockResolvedValueOnce(mockOpportunity);

      await service.update('opp-1', updateWithPosition, 'user-1');

      expect(prismaService.openPosition.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      prismaService.opportunity.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto, 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('close', () => {
    const closeDto: CloseOpportunityDto = {
      isWon: true,
      stage: 'Closed Won',
    };

    it('should close an opportunity successfully', async () => {
      const existingOpportunity = {
        ...mockOpportunity,
        openPosition: null,
      };

      prismaService.opportunity.findUnique.mockResolvedValue(existingOpportunity);
      prismaService.opportunity.update.mockResolvedValue({
        ...mockOpportunity,
        isClosed: true,
        isWon: true,
        stage: 'Closed Won',
      });
      prismaService.opportunity.findUnique.mockResolvedValueOnce(existingOpportunity).mockResolvedValueOnce({
        ...mockOpportunity,
        isClosed: true,
        isWon: true,
      });

      const result = await service.close('opp-1', closeDto);

      expect(result).toBeDefined();
      expect(result.isClosed).toBe(true);
      expect(result.isWon).toBe(true);
      expect(prismaService.opportunity.update).toHaveBeenCalled();
    });

    it('should cancel open position when opportunity is lost', async () => {
      const existingOpportunity = {
        ...mockOpportunity,
        openPosition: {
          id: 'position-1',
          status: 'Open',
        },
      };

      const closeAsLost: CloseOpportunityDto = {
        isWon: false,
        stage: 'Closed Lost',
      };

      prismaService.opportunity.findUnique.mockResolvedValue(existingOpportunity);
      prismaService.opportunity.update.mockResolvedValue({
        ...mockOpportunity,
        isClosed: true,
        isWon: false,
      });
      prismaService.openPosition.update.mockResolvedValue({
        ...existingOpportunity.openPosition,
        status: 'Cancelled',
      });
      prismaService.opportunity.findUnique.mockResolvedValueOnce(existingOpportunity).mockResolvedValueOnce({
        ...mockOpportunity,
        isClosed: true,
        isWon: false,
      });

      await service.close('opp-1', closeAsLost);

      expect(prismaService.openPosition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'Cancelled',
          }),
        }),
      );
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      prismaService.opportunity.findUnique.mockResolvedValue(null);

      await expect(service.close('non-existent', closeDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('sendEmail', () => {
    const emailDto: SendOpportunityEmailDto = {
      to: 'client@example.com',
      subject: 'Project Proposal',
      htmlContent: '<p>Proposal content</p>',
      textContent: 'Proposal content',
    };

    it('should send email successfully', async () => {
      prismaService.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      emailService.sendEmail.mockResolvedValue(true);

      const result = await service.sendEmail('opp-1', emailDto);

      expect(result.success).toBe(true);
      expect(emailService.sendEmail).toHaveBeenCalled();
    });

    it('should render template when templateId provided', async () => {
      const emailWithTemplate: SendOpportunityEmailDto = {
        ...emailDto,
        templateId: 'template-1',
        htmlContent: undefined,
      };

      const renderedTemplate = {
        html: '<p>Rendered template</p>',
        text: 'Rendered template',
      };

      prismaService.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      templatesService.render.mockResolvedValue(renderedTemplate);
      emailService.sendEmail.mockResolvedValue(true);

      await service.sendEmail('opp-1', emailWithTemplate);

      expect(templatesService.render).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: renderedTemplate.html,
          text: renderedTemplate.text,
        }),
      );
    });

    it('should throw NotFoundException when opportunity does not exist', async () => {
      prismaService.opportunity.findUnique.mockResolvedValue(null);

      await expect(service.sendEmail('non-existent', emailDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when email sending fails', async () => {
      prismaService.opportunity.findUnique.mockResolvedValue(mockOpportunity);
      emailService.sendEmail.mockResolvedValue(false);

      await expect(service.sendEmail('opp-1', emailDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete an opportunity successfully', async () => {
      prismaService.opportunity.delete.mockResolvedValue(mockOpportunity);

      const result = await service.remove('opp-1');

      expect(result.deleted).toBe(true);
      expect(prismaService.opportunity.delete).toHaveBeenCalled();
    });
  });
});


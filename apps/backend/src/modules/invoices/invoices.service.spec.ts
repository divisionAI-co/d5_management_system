import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { PdfService } from '../../common/pdf/pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';
import {
  InvoiceStatus,
  TemplateType,
} from '@prisma/client';

describe('InvoicesService', () => {
  let service: InvoicesService;
  let prismaService: any;
  let emailService: any;
  let pdfService: any;

  const mockCustomer = {
    id: 'customer-1',
    name: 'Acme Corp',
    email: 'billing@acme.com',
    currency: 'USD',
  };

  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  };

  const mockInvoice = {
    id: 'invoice-1',
    invoiceNumber: 'INV/2024/00001',
    customerId: 'customer-1',
    subtotal: new Prisma.Decimal(1000),
    taxRate: new Prisma.Decimal(10),
    taxAmount: new Prisma.Decimal(100),
    total: new Prisma.Decimal(1100),
    currency: 'USD',
    issueDate: new Date('2024-01-01'),
    dueDate: new Date('2024-01-31'),
    status: InvoiceStatus.DRAFT,
    items: [
      {
        description: 'Service 1',
        quantity: 1,
        unitPrice: 1000,
        lineTotal: 1000,
      },
    ],
    notes: null,
    isRecurring: false,
    recurringDay: null,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    customer: mockCustomer,
    createdBy: mockUser,
  };

  beforeEach(async () => {
    const mockPrismaService = {
      invoice: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      customer: {
        findUnique: jest.fn(),
      },
      template: {
        findFirst: jest.fn(),
      },
      notification: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const mockEmailService = {
      sendEmail: jest.fn(),
    };

    const mockPdfService = {
      generatePdfFromTemplate: jest.fn(),
      generatePdfFromHtml: jest.fn(),
      registerHelpers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: PdfService,
          useValue: mockPdfService,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
    prismaService = module.get(PrismaService);
    emailService = module.get(EmailService);
    pdfService = module.get(PdfService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateInvoiceDto = {
      customerId: 'customer-1',
      dueDate: '2024-01-31',
      items: [
        {
          description: 'Service 1',
          quantity: 1,
          unitPrice: 1000,
        },
      ],
      taxRate: 10,
    };

    it('should create an invoice successfully', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.invoice.findMany.mockResolvedValue([]);
      prismaService.invoice.create.mockResolvedValue(mockInvoice);

      const result = await service.create('user-1', createDto);

      expect(result).toBeDefined();
      expect(result.invoiceNumber).toBeDefined();
      expect(prismaService.invoice.create).toHaveBeenCalled();
    });

    it('should generate invoice number automatically', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.invoice.findMany.mockResolvedValue([]);
      prismaService.invoice.create.mockResolvedValue(mockInvoice);

      await service.create('user-1', createDto);

      expect(prismaService.invoice.findMany).toHaveBeenCalled();
      expect(prismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoiceNumber: expect.stringMatching(/^INV\/\d{4}\/\d{5}$/),
          }),
        }),
      );
    });

    it('should calculate totals correctly', async () => {
      const dtoWithMultipleItems: CreateInvoiceDto = {
        ...createDto,
        items: [
          { description: 'Item 1', quantity: 2, unitPrice: 500 },
          { description: 'Item 2', quantity: 1, unitPrice: 1000 },
        ],
        taxRate: 10,
      };

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.invoice.findMany.mockResolvedValue([]);
      prismaService.invoice.create.mockResolvedValue({
        ...mockInvoice,
        subtotal: new Prisma.Decimal(2000),
        taxAmount: new Prisma.Decimal(200),
        total: new Prisma.Decimal(2200),
      });

      await service.create('user-1', dtoWithMultipleItems);

      expect(prismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: expect.any(Prisma.Decimal),
            taxAmount: expect.any(Prisma.Decimal),
            total: expect.any(Prisma.Decimal),
          }),
        }),
      );
    });

    it('should set default due date to 30 days after issue date', async () => {
      const dtoWithoutDueDate: CreateInvoiceDto = {
        ...createDto,
        issueDate: '2024-01-01',
        dueDate: undefined as any,
      };

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.invoice.findMany.mockResolvedValue([]);
      prismaService.invoice.create.mockResolvedValue(mockInvoice);

      await service.create('user-1', dtoWithoutDueDate);

      expect(prismaService.invoice.create).toHaveBeenCalled();
    });

    it('should use customer currency when not provided', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.invoice.findMany.mockResolvedValue([]);
      prismaService.invoice.create.mockResolvedValue(mockInvoice);

      await service.create('user-1', createDto);

      expect(prismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            currency: 'USD',
          }),
        }),
      );
    });

    it('should throw NotFoundException when customer does not exist', async () => {
      prismaService.customer.findUnique.mockResolvedValue(null);

      await expect(service.create('user-1', createDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when invoice number already exists', async () => {
      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.invoice.findMany.mockResolvedValue([]);
      prismaService.invoice.create.mockRejectedValue({
        code: 'P2002',
        meta: { target: ['invoiceNumber'] },
      });

      const dtoWithInvoiceNumber: CreateInvoiceDto = {
        ...createDto,
        invoiceNumber: 'INV/2024/00001',
      };

      await expect(service.create('user-1', dtoWithInvoiceNumber)).rejects.toThrow(BadRequestException);
    });

    it('should handle recurring invoice creation', async () => {
      const recurringDto: CreateInvoiceDto = {
        ...createDto,
        isRecurring: true,
        recurringDay: 15,
      };

      prismaService.customer.findUnique.mockResolvedValue(mockCustomer);
      prismaService.invoice.findMany.mockResolvedValue([]);
      prismaService.invoice.create.mockResolvedValue({
        ...mockInvoice,
        isRecurring: true,
        recurringDay: 15,
      });

      const result = await service.create('user-1', recurringDto);

      expect(result).toBeDefined();
      expect(prismaService.invoice.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isRecurring: true,
            recurringDay: 15,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated invoices', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockInvoice]]);

      const filters: Partial<FilterInvoicesDto> = {};
      const result = await service.findAll(filters as FilterInvoicesDto);

      expect(result.data).toBeDefined();
      expect(result.meta.total).toBe(1);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by status', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockInvoice]]);

      const filters: Partial<FilterInvoicesDto> = {
        status: InvoiceStatus.DRAFT,
      };

      await service.findAll(filters as FilterInvoicesDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by overdue', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockInvoice]]);

      const filters: Partial<FilterInvoicesDto> = {
        overdue: true,
      };

      await service.findAll(filters as FilterInvoicesDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should search by invoice number or customer name', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockInvoice]]);

      const filters: Partial<FilterInvoicesDto> = {
        search: 'INV',
      };

      await service.findAll(filters as FilterInvoicesDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should filter by date ranges', async () => {
      prismaService.$transaction = jest.fn().mockResolvedValue([1, [mockInvoice]]);

      const filters: Partial<FilterInvoicesDto> = {
        issueDateFrom: '2024-01-01',
        issueDateTo: '2024-12-31',
        dueDateFrom: '2024-01-01',
        dueDateTo: '2024-12-31',
      };

      await service.findAll(filters as FilterInvoicesDto);

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid sort field', async () => {
      const filters: Partial<FilterInvoicesDto> = {
        sortBy: 'invalidField' as any,
      };

      await expect(service.findAll(filters as FilterInvoicesDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    it('should return an invoice with relations', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.findOne('invoice-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('invoice-1');
      expect(result.subtotal).toBe(1000);
      expect(result.taxAmount).toBe(100);
      expect(result.total).toBe(1100);
      expect(prismaService.invoice.findUnique).toHaveBeenCalled();
    });

    it('should format decimal values as numbers', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await service.findOne('invoice-1');

      expect(typeof result.subtotal).toBe('number');
      expect(typeof result.taxAmount).toBe('number');
      expect(typeof result.total).toBe('number');
    });

    it('should throw NotFoundException when invoice does not exist', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateInvoiceDto = {
      items: [
        {
          description: 'Updated Service',
          quantity: 2,
          unitPrice: 500,
        },
      ],
      taxRate: 15,
    };

    it('should update an invoice successfully', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.invoice.update.mockResolvedValue({
        ...mockInvoice,
        ...updateDto,
      });

      const result = await service.update('invoice-1', updateDto);

      expect(result).toBeDefined();
      expect(prismaService.invoice.update).toHaveBeenCalled();
    });

    it('should recalculate totals when items are updated', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.invoice.update.mockResolvedValue(mockInvoice);

      await service.update('invoice-1', updateDto);

      expect(prismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: expect.any(Prisma.Decimal),
            taxAmount: expect.any(Prisma.Decimal),
            total: expect.any(Prisma.Decimal),
          }),
        }),
      );
    });

    it('should recalculate totals when tax rate is updated', async () => {
      const taxRateUpdate: UpdateInvoiceDto = {
        taxRate: 20,
      };

      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.invoice.update.mockResolvedValue(mockInvoice);

      await service.update('invoice-1', taxRateUpdate);

      expect(prismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taxRate: expect.any(Prisma.Decimal),
            taxAmount: expect.any(Prisma.Decimal),
            total: expect.any(Prisma.Decimal),
          }),
        }),
      );
    });

    it('should throw BadRequestException when trying to change status of paid invoice', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
      };

      prismaService.invoice.findUnique.mockResolvedValue(paidInvoice);

      const statusUpdate: UpdateInvoiceDto = {
        status: InvoiceStatus.DRAFT,
      };

      await expect(service.update('invoice-1', statusUpdate)).rejects.toThrow(BadRequestException);
    });

    it('should update recurring settings', async () => {
      const recurringUpdate: UpdateInvoiceDto = {
        isRecurring: true,
        recurringDay: 15,
      };

      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.invoice.update.mockResolvedValue({
        ...mockInvoice,
        isRecurring: true,
        recurringDay: 15,
      });

      await service.update('invoice-1', recurringUpdate);

      expect(prismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isRecurring: true,
            recurringDay: 15,
          }),
        }),
      );
    });

    it('should throw NotFoundException when invoice does not exist', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete an invoice successfully', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.invoice.delete.mockResolvedValue(mockInvoice);

      const result = await service.remove('invoice-1');

      expect(result.deleted).toBe(true);
      expect(prismaService.invoice.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to delete paid invoice', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
      };

      prismaService.invoice.findUnique.mockResolvedValue(paidInvoice);

      await expect(service.remove('invoice-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when invoice does not exist', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('markPaid', () => {
    const markPaidDto: MarkInvoicePaidDto = {
      paidDate: '2024-01-15',
      note: 'Payment received via bank transfer',
    };

    it('should mark invoice as paid successfully', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.invoice.update.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        paidDate: new Date('2024-01-15'),
      });

      const result = await service.markPaid('invoice-1', markPaidDto);

      expect(result).toBeDefined();
      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(prismaService.invoice.update).toHaveBeenCalled();
    });

    it('should use current date when paidDate not provided', async () => {
      const dtoWithoutDate: MarkInvoicePaidDto = {};

      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.invoice.update.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        paidDate: new Date(),
      });

      await service.markPaid('invoice-1', dtoWithoutDate);

      expect(prismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paidDate: expect.any(Date),
          }),
        }),
      );
    });

    it('should add payment note to invoice notes', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.invoice.update.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.PAID,
        notes: `\n\n[${new Date().toISOString()}] Payment note: ${markPaidDto.note}`,
      });

      await service.markPaid('invoice-1', markPaidDto);

      expect(prismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: expect.stringContaining('Payment note:'),
          }),
        }),
      );
    });

    it('should reset reminders when marking as paid', async () => {
      const invoiceWithReminders = {
        ...mockInvoice,
        remindersSent: 2,
        lastReminderAt: new Date(),
      };

      prismaService.invoice.findUnique.mockResolvedValue(invoiceWithReminders);
      prismaService.invoice.update.mockResolvedValue({
        ...invoiceWithReminders,
        status: InvoiceStatus.PAID,
        remindersSent: 0,
        lastReminderAt: null,
      });

      await service.markPaid('invoice-1', markPaidDto);

      expect(prismaService.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            remindersSent: 0,
            lastReminderAt: null,
          }),
        }),
      );
    });

    it('should return invoice if already paid', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
      };

      prismaService.invoice.findUnique.mockResolvedValue(paidInvoice);

      const result = await service.markPaid('invoice-1', markPaidDto);

      expect(result.status).toBe(InvoiceStatus.PAID);
      expect(prismaService.invoice.update).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when invoice is cancelled', async () => {
      const cancelledInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.CANCELLED,
      };

      prismaService.invoice.findUnique.mockResolvedValue(cancelledInvoice);

      await expect(service.markPaid('invoice-1', markPaidDto)).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when invoice does not exist', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.markPaid('non-existent', markPaidDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateInvoicePdf', () => {
    it('should generate PDF from template when template exists', async () => {
      const mockTemplate = {
        id: 'template-1',
        htmlContent: '<html>Template</html>',
        cssContent: 'body { color: black; }',
        type: TemplateType.INVOICE,
        isActive: true,
      };

      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.template.findFirst.mockResolvedValue(mockTemplate);
      pdfService.generatePdfFromTemplate.mockResolvedValue(Buffer.from('PDF content'));

      const result = await service.generateInvoicePdf('invoice-1', 'template-1');

      expect(result).toBeDefined();
      expect(pdfService.generatePdfFromTemplate).toHaveBeenCalled();
    });

    it('should generate PDF from default HTML when no template', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.template.findFirst.mockResolvedValue(null);
      pdfService.generatePdfFromHtml.mockResolvedValue(Buffer.from('PDF content'));

      const result = await service.generateInvoicePdf('invoice-1');

      expect(result).toBeDefined();
      expect(pdfService.generatePdfFromHtml).toHaveBeenCalled();
    });
  });

  describe('previewInvoice', () => {
    it('should preview invoice with template', async () => {
      const mockTemplate = {
        id: 'template-1',
        htmlContent: '<html>Template</html>',
        cssContent: 'body { color: black; }',
        type: TemplateType.INVOICE,
        isActive: true,
      };

      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.template.findFirst.mockResolvedValue(mockTemplate);

      const result = await service.previewInvoice('invoice-1', 'template-1');

      expect(result).toBeDefined();
      expect(result.invoiceId).toBe('invoice-1');
      expect(result.templateId).toBe('template-1');
      expect(result.renderedHtml).toBeDefined();
    });

    it('should preview invoice without template', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      prismaService.template.findFirst.mockResolvedValue(null);

      const result = await service.previewInvoice('invoice-1');

      expect(result).toBeDefined();
      expect(result.templateId).toBeNull();
      expect(result.renderedHtml).toBeDefined();
    });
  });

  describe('sendInvoice', () => {
    const sendDto: SendInvoiceDto = {
      to: ['billing@acme.com'],
      subject: 'Invoice Payment Due',
      message: 'Please find attached invoice',
    };

    it('should send invoice email successfully', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      pdfService.generatePdfFromHtml.mockResolvedValue(Buffer.from('PDF content'));
      emailService.sendEmail.mockResolvedValue(true);
      prismaService.invoice.update.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.SENT,
      });

      const result = await service.sendInvoice('invoice-1', 'user-1', sendDto);

      expect(result).toBeDefined();
      expect(result.status).toBe(InvoiceStatus.SENT);
      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['billing@acme.com'],
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: expect.stringContaining('INV'),
            }),
          ]),
        }),
      );
    });

    it('should use customer email when to is not provided', async () => {
      const dtoWithoutTo: SendInvoiceDto = {
        subject: 'Invoice Payment Due',
      };

      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      pdfService.generatePdfFromHtml.mockResolvedValue(Buffer.from('PDF content'));
      emailService.sendEmail.mockResolvedValue(true);
      prismaService.invoice.update.mockResolvedValue({
        ...mockInvoice,
        status: InvoiceStatus.SENT,
      });

      await service.sendInvoice('invoice-1', 'user-1', dtoWithoutTo);

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['billing@acme.com'],
        }),
      );
    });

    it('should throw BadRequestException when no recipient email available', async () => {
      const invoiceWithoutEmail = {
        ...mockInvoice,
        customer: {
          ...mockCustomer,
          email: null,
        },
      };

      prismaService.invoice.findUnique.mockResolvedValue(invoiceWithoutEmail);

      const dtoWithoutTo: SendInvoiceDto = {};

      await expect(service.sendInvoice('invoice-1', 'user-1', dtoWithoutTo)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when email sending fails', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(mockInvoice);
      pdfService.generatePdfFromHtml.mockResolvedValue(Buffer.from('PDF content'));
      emailService.sendEmail.mockResolvedValue(false);

      await expect(service.sendInvoice('invoice-1', 'user-1', sendDto)).rejects.toThrow(BadRequestException);
    });

    it('should preserve PAID status when sending paid invoice', async () => {
      const paidInvoice = {
        ...mockInvoice,
        status: InvoiceStatus.PAID,
      };

      prismaService.invoice.findUnique.mockResolvedValue(paidInvoice);
      pdfService.generatePdfFromHtml.mockResolvedValue(Buffer.from('PDF content'));
      emailService.sendEmail.mockResolvedValue(true);
      prismaService.invoice.update.mockResolvedValue({
        ...paidInvoice,
        status: InvoiceStatus.PAID,
      });

      const result = await service.sendInvoice('invoice-1', 'user-1', sendDto);

      expect(result.status).toBe(InvoiceStatus.PAID);
    });

    it('should throw NotFoundException when invoice does not exist', async () => {
      prismaService.invoice.findUnique.mockResolvedValue(null);

      await expect(service.sendInvoice('non-existent', 'user-1', sendDto)).rejects.toThrow(NotFoundException);
    });
  });
});


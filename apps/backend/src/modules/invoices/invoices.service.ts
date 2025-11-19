import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  InvoiceStatus,
  NotificationType,
  Prisma,
  TemplateType,
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { PdfService } from '../../common/pdf/pdf.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { FilterInvoicesDto } from './dto/filter-invoices.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MarkInvoicePaidDto } from './dto/mark-invoice-paid.dto';

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
  };
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  private readonly reminderSchedule = [3, 15, 30];

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly pdfService: PdfService,
  ) {
    this.pdfService.registerHelpers();
  }

  private normalizeItems(items: any[]): InvoiceLineItem[] {
    return items.map((item) => {
      const quantity = Number(item.quantity ?? 0);
      const unitPrice = Number(item.unitPrice ?? 0);
      const lineTotal = quantity * unitPrice;

      return {
        description: item.description,
        quantity,
        unitPrice,
        lineTotal,
        ...(item.metadata ? { metadata: item.metadata } : {}),
      };
    });
  }

  private calculateTotals(items: InvoiceLineItem[], taxRate: number) {
    const subtotal = items.reduce(
      (acc, item) =>
        acc.plus(
          new Prisma.Decimal(item.quantity).mul(item.unitPrice),
        ),
      new Prisma.Decimal(0),
    );

    const taxAmount = subtotal
      .mul(new Prisma.Decimal(taxRate ?? 0))
      .div(100);

    const total = subtotal.plus(taxAmount);

    return {
      subtotal,
      taxAmount,
      total,
    };
  }

  private formatInvoice(invoice: any) {
    if (!invoice) {
      return invoice;
    }

    return {
      ...invoice,
      subtotal: invoice.subtotal ? Number(invoice.subtotal) : 0,
      taxRate: invoice.taxRate ? Number(invoice.taxRate) : 0,
      taxAmount: invoice.taxAmount ? Number(invoice.taxAmount) : 0,
      total: invoice.total ? Number(invoice.total) : 0,
      items: Array.isArray(invoice.items)
        ? invoice.items
        : [],
    };
  }

  private async generateInvoiceNumber(year?: number): Promise<string> {
    const targetYear = year ?? new Date().getFullYear();
    const prefix = `INV/${targetYear}/`;

    // Find all invoices for this year to determine the next sequence
    const existingInvoices = await this.prisma.invoice.findMany({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      select: {
        invoiceNumber: true,
      },
    });

    let maxSequence = 0;

    // Extract sequence numbers from all matching invoices
    for (const invoice of existingInvoices) {
      const match = invoice.invoiceNumber.match(/^INV\/\d{4}\/(\d+)$/);
      if (match) {
        const sequence = parseInt(match[1], 10);
        if (sequence > maxSequence) {
          maxSequence = sequence;
        }
      }
    }

    // Next sequence is max + 1, or 1 if no invoices found
    const nextSequence = maxSequence + 1;

    // Format as 5-digit zero-padded number
    const sequence = nextSequence.toString().padStart(5, '0');

    return `${prefix}${sequence}`;
  }

  private buildInvoiceWhere(filters: FilterInvoicesDto): Prisma.InvoiceWhereInput {
    const where: Prisma.InvoiceWhereInput = {};

    if (filters.search) {
      where.OR = [
        {
          invoiceNumber: {
            contains: filters.search,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          customer: {
            name: {
              contains: filters.search,
              mode: Prisma.QueryMode.insensitive,
            },
          },
        },
      ];
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.customerId) {
      where.customerId = filters.customerId;
    }

    if (filters.isRecurring !== undefined) {
      where.isRecurring = filters.isRecurring;
    }

    if (filters.overdue) {
      const currentAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
        ? [where.AND]
        : [];
      where.AND = [
        ...currentAnd,
        {
          dueDate: {
            lt: new Date(),
          },
        },
        {
          status: {
            in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE],
          },
        },
      ];
    }

    if (filters.issueDateFrom || filters.issueDateTo) {
      where.issueDate = {
        gte: filters.issueDateFrom ? new Date(filters.issueDateFrom) : undefined,
        lte: filters.issueDateTo ? new Date(filters.issueDateTo) : undefined,
      };
    }

    if (filters.dueDateFrom || filters.dueDateTo) {
      where.dueDate = {
        gte: filters.dueDateFrom ? new Date(filters.dueDateFrom) : undefined,
        lte: filters.dueDateTo ? new Date(filters.dueDateTo) : undefined,
      };
    }

    return where;
  }

  async findAll(filters: FilterInvoicesDto): Promise<PaginatedResult<any>> {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const sortBy = filters.sortBy ?? 'issueDate';
    const sortOrder = filters.sortOrder ?? 'desc';

    if (!['issueDate', 'dueDate', 'total', 'invoiceNumber', 'createdAt', 'status'].includes(sortBy)) {
      throw new BadRequestException(`Unsupported sort field: ${sortBy}`);
    }

    const where = this.buildInvoiceWhere(filters);

    const [total, invoices] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              address: true,
              city: true,
              country: true,
              postalCode: true,
              taxId: true,
              registrationId: true,
              currency: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: {
          [sortBy]: sortOrder,
        },
      }),
    ]);

    return {
      data: invoices.map((invoice) => this.formatInvoice(invoice)),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  private async ensureCustomerExists(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        currency: true,
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${customerId} not found`);
    }

    return customer;
  }

  private getDueDate(issueDate: Date, providedDueDate?: string) {
    if (providedDueDate) {
      return new Date(providedDueDate);
    }

    const due = new Date(issueDate);
    due.setDate(due.getDate() + 30);
    return due;
  }

  async create(userId: string, createDto: CreateInvoiceDto) {
    const customer = await this.ensureCustomerExists(createDto.customerId);

    const items = this.normalizeItems(createDto.items);
    const taxRate = createDto.taxRate ?? 0;
    const { subtotal, taxAmount, total } = this.calculateTotals(items, taxRate);

    const issueDate = createDto.issueDate ? new Date(createDto.issueDate) : new Date();
    const dueDate = this.getDueDate(issueDate, createDto.dueDate);

    // Use the issue date year for invoice number generation
    const issueYear = issueDate.getFullYear();
    const invoiceNumber =
      createDto.invoiceNumber ?? (await this.generateInvoiceNumber(issueYear));

    try {
      const invoice = await this.prisma.invoice.create({
        data: {
          invoiceNumber,
          customerId: createDto.customerId,
          subtotal,
          taxRate: new Prisma.Decimal(taxRate ?? 0),
          taxAmount,
          total,
          currency: createDto.currency ?? customer.currency ?? 'USD',
          issueDate,
          dueDate,
          status: createDto.status ?? InvoiceStatus.DRAFT,
          items: items as unknown as Prisma.InputJsonValue,
          notes: createDto.notes,
          isRecurring: createDto.isRecurring ?? false,
          recurringDay:
            createDto.isRecurring ?? false
              ? createDto.recurringDay ??
                (issueDate.getDate() > 28 ? 28 : issueDate.getDate())
              : null,
          createdById: userId,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return this.formatInvoice(invoice);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException(
          'Invoice number already exists. Please provide a unique invoice number.',
        );
      }

      this.logger.error('Failed to create invoice', error);
      throw error;
    }
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true,
            postalCode: true,
            taxId: true,
            registrationId: true,
            currency: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    return this.formatInvoice(invoice);
  }

  async update(id: string, updateDto: UpdateInvoiceDto) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (existing.status === InvoiceStatus.PAID && updateDto.status && updateDto.status !== InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot change status of a paid invoice');
    }

    const data: Prisma.InvoiceUpdateInput = {};

    if (updateDto.items) {
      const items = this.normalizeItems(updateDto.items);
      const taxRate =
        updateDto.taxRate !== undefined
          ? updateDto.taxRate
          : Number(existing.taxRate);
      const { subtotal, taxAmount, total } = this.calculateTotals(items, taxRate);

      data.items = items as unknown as Prisma.InputJsonValue;
      data.subtotal = subtotal;
      data.taxAmount = taxAmount;
      data.total = total;
      data.taxRate = new Prisma.Decimal(taxRate);
    } else if (updateDto.taxRate !== undefined) {
      const taxRate = updateDto.taxRate;
      const subtotal = new Prisma.Decimal(existing.subtotal);
      const taxAmount = subtotal.mul(new Prisma.Decimal(taxRate)).div(100);
      data.taxRate = new Prisma.Decimal(taxRate);
      data.taxAmount = taxAmount;
      data.total = subtotal.plus(taxAmount);
    }

    if (updateDto.invoiceNumber && updateDto.invoiceNumber !== existing.invoiceNumber) {
      data.invoiceNumber = updateDto.invoiceNumber;
    }

    if (updateDto.issueDate) {
      data.issueDate = new Date(updateDto.issueDate);
    }

    if (updateDto.dueDate) {
      data.dueDate = new Date(updateDto.dueDate);
    }

    if (updateDto.currency) {
      data.currency = updateDto.currency;
    }

    if (updateDto.status) {
      data.status = updateDto.status;
      if (updateDto.status === InvoiceStatus.CANCELLED) {
        data.paidDate = null;
      }
    }

    if (updateDto.isRecurring !== undefined) {
      data.isRecurring = updateDto.isRecurring;
      data.recurringDay = updateDto.isRecurring
        ? updateDto.recurringDay ??
          (existing.issueDate.getDate() > 28
            ? 28
            : existing.issueDate.getDate())
        : null;
    } else if (updateDto.recurringDay !== undefined) {
      data.recurringDay = updateDto.recurringDay;
    }

    if (updateDto.notes !== undefined || updateDto.statusNote) {
      const initialNotes =
        updateDto.notes !== undefined
          ? updateDto.notes
          : existing.notes ?? '';

      const combinedNotes = updateDto.statusNote
        ? [
            initialNotes ?? '',
            `\n\n[${new Date().toISOString()}] ${updateDto.statusNote}`,
          ]
            .filter(Boolean)
            .join('')
        : initialNotes;

      data.notes = combinedNotes ?? null;
    }

    try {
      const invoice = await this.prisma.invoice.update({
        where: { id },
        data,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      return this.formatInvoice(invoice);
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new BadRequestException(
          'Invoice number already exists. Please provide a unique invoice number.',
        );
      }

      this.logger.error(`Failed to update invoice ${id}`, error);
      throw error;
    }
  }

  async remove(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot delete a paid invoice');
    }

    await this.prisma.invoice.delete({
      where: { id },
    });

    return { deleted: true };
  }

  async markPaid(id: string, dto: MarkInvoicePaidDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot mark a cancelled invoice as paid');
    }

    if (invoice.status === InvoiceStatus.PAID) {
      return this.formatInvoice(invoice);
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status: InvoiceStatus.PAID,
        paidDate: dto.paidDate ? new Date(dto.paidDate) : new Date(),
        remindersSent: 0,
        lastReminderAt: null,
        notes:
          dto.note && dto.note.trim().length
            ? [
                invoice.notes ?? '',
                `\n\n[${new Date().toISOString()}] Payment note: ${dto.note}`,
              ]
                .filter(Boolean)
                .join('')
            : invoice.notes,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return this.formatInvoice(updated);
  }

  private async getInvoiceTemplate(templateId?: string) {
    if (templateId) {
      const template = await this.prisma.template.findFirst({
        where: {
          id: templateId,
          type: TemplateType.INVOICE,
          isActive: true,
        },
      });

      if (!template) {
        throw new NotFoundException(
          `Invoice template with ID ${templateId} not found or inactive`,
        );
      }

      return template;
    }

    return this.prisma.template.findFirst({
      where: {
        type: TemplateType.INVOICE,
        isActive: true,
      },
      orderBy: [
        {
          isDefault: 'desc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
  }

  private mergeTemplateHtmlAndCss(html: string, css?: string | null) {
    if (!css || !css.trim()) {
      return html;
    }

    const styleTag = `<style>\n${css.trim()}\n</style>`;
    
    // First, try to inject before </head> tag (most common case)
    if (html.includes('</head>')) {
      return html.replace('</head>', `${styleTag}\n</head>`);
    }
    
    // If no </head>, try to inject after <head> tag
    const headTagRegex = /<head([^>]*)>/i;
    if (headTagRegex.test(html)) {
      return html.replace(headTagRegex, (match) => `${match}\n${styleTag}`);
    }
    
    // If no <head> tag at all, prepend the style tag
    return `${styleTag}\n${html}`;
  }

  private buildInvoiceTemplateData(
    invoice: any,
    templateData?: Record<string, any>,
  ) {
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const normalizedItems = items.map((item: any) => {
      const quantity = Number(
        item.quantity ?? item.qty ?? item.amount ?? 0,
      );
      const unitPrice = Number(
        item.unitPrice ?? item.price ?? item.rate ?? 0,
      );
      const lineTotal =
        item.lineTotal !== undefined && item.lineTotal !== null
          ? Number(item.lineTotal)
          : quantity * unitPrice;

      return {
        description: item.description,
        quantity,
        unitPrice,
        price: unitPrice,
        total: lineTotal,
        lineTotal,
        metadata: item.metadata ?? {},
      };
    });

    const customerInfo = invoice.customer
      ? {
          ...invoice.customer,
          address: invoice.customer.address ?? '',
          city: invoice.customer.city ?? '',
          country: invoice.customer.country ?? '',
          postalCode: invoice.customer.postalCode ?? '',
          taxId: invoice.customer.taxId ?? '',
          registrationId: invoice.customer.registrationId ?? '',
        }
      : {};

    const baseData = {
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      status: invoice.status,
      subtotal: Number(invoice.subtotal ?? 0),
      taxRate: Number(invoice.taxRate ?? 0),
      taxAmount: Number(invoice.taxAmount ?? 0),
      total: Number(invoice.total ?? 0),
      currency: invoice.currency ?? 'USD',
      notes: invoice.notes,
      items: normalizedItems,
      customer: customerInfo,
      createdBy: invoice.createdBy ?? {},
      invoice,
    };

    return {
      ...baseData,
      ...(templateData ?? {}),
    };
  }

  private buildInvoiceHtml(invoice: any): string {
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    const currency = invoice.currency ?? 'USD';

    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    });

    const issueDate = new Date(invoice.issueDate).toLocaleDateString();
    const dueDate = new Date(invoice.dueDate).toLocaleDateString();

    const itemsRows = items
      .map((item: InvoiceLineItem) => {
        const quantity = Number(item.quantity ?? 0);
        const unitPrice = Number(item.unitPrice ?? 0);
        const lineTotal =
          item.lineTotal !== undefined
            ? Number(item.lineTotal)
            : quantity * unitPrice;

        return `
        <tr>
          <td>${item.description}</td>
          <td style="text-align:center;">${quantity}</td>
          <td style="text-align:right;">${formatter.format(unitPrice)}</td>
          <td style="text-align:right;">${formatter.format(lineTotal)}</td>
        </tr>
      `;
      })
      .join('');

    return `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; color: #1f2937; }
            .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; }
            .summary { margin-bottom: 24px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { padding: 12px; border: 1px solid #e5e7eb; }
            th { text-align: left; background-color: #f9fafb; }
            .totals { margin-top: 24px; width: 300px; margin-left: auto; }
            .totals table { border: none; }
            .totals td { border: none; padding: 8px 0; }
            .totals tr:last-child td { font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1>Invoice ${invoice.invoiceNumber}</h1>
              <p>Issue Date: ${issueDate}</p>
              <p>Due Date: ${dueDate}</p>
            </div>
            <div style="text-align:right;">
              <p><strong>Bill To:</strong></p>
              <p>${invoice.customer?.name ?? ''}</p>
              <p>${invoice.customer?.email ?? ''}</p>
            </div>
          </div>

          <div class="summary">
            <p>Status: <strong>${invoice.status}</strong></p>
            ${
              invoice.notes
                ? `<p style="margin-top:12px;"><strong>Notes:</strong><br />${invoice.notes
                    .replace(/\n/g, '<br />')
                    .trim()}</p>`
                : ''
            }
          </div>

          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Unit Price</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr>
                <td>Subtotal</td>
                <td style="text-align:right;">${formatter.format(invoice.subtotal ?? 0)}</td>
              </tr>
              <tr>
                <td>Tax (${invoice.taxRate ?? 0}%)</td>
                <td style="text-align:right;">${formatter.format(invoice.taxAmount ?? 0)}</td>
              </tr>
              <tr>
                <td>Total</td>
                <td style="text-align:right;">${formatter.format(invoice.total ?? 0)}</td>
              </tr>
            </table>
          </div>
        </body>
      </html>
    `;
  }

  async previewInvoice(
    id: string,
    templateId?: string,
    templateData?: Record<string, any>,
  ) {
    const invoice = await this.findOne(id);
    const template = await this.getInvoiceTemplate(templateId);

    let renderedHtml: string;
    let usedTemplateId: string | null = null;

    if (template) {
      usedTemplateId = template.id;
      const htmlTemplate = this.mergeTemplateHtmlAndCss(
        template.htmlContent,
        template.cssContent,
      );
      const data = this.buildInvoiceTemplateData(invoice, templateData);
      const handlebars = (await import('handlebars')).default;
      const compiledTemplate = handlebars.compile(htmlTemplate);
      renderedHtml = compiledTemplate(data);
    } else {
      renderedHtml = this.buildInvoiceHtml(invoice);
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      templateId: usedTemplateId,
      renderedHtml,
    };
  }

  async generateInvoicePdf(
    id: string,
    templateId?: string,
    templateData?: Record<string, any>,
  ) {
    const invoice = await this.findOne(id);
    const template = await this.getInvoiceTemplate(templateId);

    if (template) {
      const htmlTemplate = this.mergeTemplateHtmlAndCss(
        template.htmlContent,
        template.cssContent,
      );
      const data = this.buildInvoiceTemplateData(invoice, templateData);
      return this.pdfService.generatePdfFromTemplate(htmlTemplate, data);
    }

    const fallbackHtml = this.buildInvoiceHtml(invoice);
    return this.pdfService.generatePdfFromHtml(fallbackHtml);
  }

  async sendInvoice(id: string, userId: string, sendDto: SendInvoiceDto) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true,
            postalCode: true,
            taxId: true,
            registrationId: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice with ID ${id} not found`);
    }

    const recipients = sendDto.to?.length
      ? sendDto.to
      : invoice.customer?.email
      ? [invoice.customer.email]
      : [];

    if (!recipients.length) {
      throw new BadRequestException(
        'No recipient email addresses provided and customer has no billing email.',
      );
    }

    const invoiceData = this.formatInvoice(invoice);
    const pdfBuffer = await this.generateInvoicePdf(
      id,
      sendDto.templateId,
      sendDto.templateData,
    );

    const subject =
      sendDto.subject ??
      `Invoice ${invoice.invoiceNumber} from division5`;

    const message =
      sendDto.message ??
      `Dear ${invoice.customer?.name ?? 'customer'},<br /><br />Please find attached invoice ${invoice.invoiceNumber} for the recent services provided.<br /><br />Total due: <strong>${invoiceData.total?.toLocaleString('en-US', {
        style: 'currency',
        currency: invoiceData.currency ?? 'USD',
      })}</strong><br />Due date: <strong>${new Date(
        invoice.dueDate,
      ).toLocaleDateString()}</strong><br /><br />Thank you for your business.`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.5;">
        ${message}
        <br /><br />
        <table style="border-collapse: collapse; width: 100%; max-width: 360px;">
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">Invoice Number</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${invoice.invoiceNumber}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">Amount Due</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${new Intl.NumberFormat(
              'en-US',
              {
                style: 'currency',
                currency: invoice.currency ?? 'USD',
              },
            ).format(invoiceData.total ?? 0)}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">Due Date</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${new Date(
              invoice.dueDate,
            ).toLocaleDateString()}</td>
          </tr>
        </table>
      </div>
    `;

    const success = await this.emailService.sendEmail({
      to: recipients,
      cc: sendDto.cc,
      subject,
      html: htmlBody,
      attachments: [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (!success) {
      throw new BadRequestException('Failed to send invoice email');
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: {
        status:
          invoice.status === InvoiceStatus.PAID
            ? InvoiceStatus.PAID
            : InvoiceStatus.SENT,
        remindersSent: 0,
        lastReminderAt: null,
        pdfUrl: invoice.pdfUrl ?? null,
        createdById: invoice.createdById ?? userId,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return this.formatInvoice(updated);
  }

  private async sendOverdueReminder(invoice: any, daysOverdue: number) {
    const invoiceData = this.formatInvoice(invoice);
    const customerEmail = invoice.customer?.email;

    if (!customerEmail) {
      this.logger.warn(
        `Invoice ${invoice.id} is overdue but customer has no email`,
      );
      return false;
    }

    const subject = `Invoice ${invoice.invoiceNumber} is ${daysOverdue} day(s) overdue`;
    const currency = invoice.currency ?? 'USD';
    const totalFormatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(invoiceData.total ?? 0);

    const html = `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <p>Dear ${invoice.customer?.name ?? 'customer'},</p>
        <p>This is a friendly reminder that invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${totalFormatted}</strong> was due on <strong>${new Date(
          invoice.dueDate,
        ).toLocaleDateString()}</strong>.</p>
        <p>The invoice is now ${daysOverdue} day(s) overdue. Please arrange payment at your earliest convenience or let us know if there are any questions.</p>
        <p>Thank you,<br />Finance Team</p>
      </div>
    `;

    return this.emailService.sendEmail({
      to: customerEmail,
      subject,
      html,
    });
  }

  private async notifyOverdue(invoice: any, daysOverdue: number) {
    const creatorId = invoice.createdById;

    if (!creatorId) {
      return;
    }

    await this.prisma.notification.create({
      data: {
        userId: creatorId,
        type: NotificationType.INVOICE_OVERDUE,
        title: `Invoice ${invoice.invoiceNumber} overdue`,
        message: `Invoice ${invoice.invoiceNumber} for customer ${invoice.customer?.name ?? ''} is ${daysOverdue} day(s) overdue.`,
        entityType: 'invoice',
        entityId: invoice.id,
      },
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleOverdueInvoices() {
    const now = new Date();
    const invoices = await this.prisma.invoice.findMany({
      where: {
        status: {
          in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE],
        },
        dueDate: {
          lt: now,
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    for (const invoice of invoices) {
      const dueDate = new Date(invoice.dueDate).getTime();
      const daysOverdue = Math.floor(
        (now.getTime() - dueDate) / (1000 * 60 * 60 * 24),
      );

      if (invoice.status !== InvoiceStatus.OVERDUE) {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: InvoiceStatus.OVERDUE },
        });
      }

      if (invoice.remindersSent >= this.reminderSchedule.length) {
        continue;
      }

      const nextReminderThreshold =
        this.reminderSchedule[invoice.remindersSent];

      if (
        daysOverdue >= nextReminderThreshold &&
        (!invoice.lastReminderAt ||
          now.getTime() - new Date(invoice.lastReminderAt).getTime() >
            24 * 60 * 60 * 1000)
      ) {
        const sent = await this.sendOverdueReminder(invoice, daysOverdue);

        if (sent) {
          await this.notifyOverdue(invoice, daysOverdue);

          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              remindersSent: invoice.remindersSent + 1,
              lastReminderAt: now,
            },
          });
        }
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async generateRecurringInvoices() {
    const today = new Date();
    const currentDay = today.getDate();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const recurringInvoices = await this.prisma.invoice.findMany({
      where: {
        isRecurring: true,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true,
            postalCode: true,
            taxId: true,
            registrationId: true,
            currency: true,
          },
        },
      },
    });

    for (const invoice of recurringInvoices) {
      const targetDay =
        invoice.recurringDay ??
        Math.min(new Date(invoice.issueDate).getDate(), 28);

      if (targetDay !== currentDay) {
        continue;
      }

      const existingForMonth = await this.prisma.invoice.findFirst({
        where: {
          isRecurring: true,
          customerId: invoice.customerId,
          recurringDay: invoice.recurringDay,
          issueDate: {
            gte: startOfMonth,
            lt: endOfMonth,
          },
        },
      });

      if (existingForMonth) {
        continue;
      }

      const issueDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        targetDay,
      );

      const previousIssueDate = new Date(invoice.issueDate);
      const previousDueDate = new Date(invoice.dueDate);
      const dayOffset = Math.max(
        0,
        Math.round(
          (previousDueDate.getTime() - previousIssueDate.getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      );

      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + dayOffset);

      const items = Array.isArray(invoice.items)
        ? this.normalizeItems(invoice.items as any[])
        : [];
      const taxRate = Number(invoice.taxRate ?? 0);
      const { subtotal, taxAmount, total } = this.calculateTotals(
        items,
        taxRate,
      );

      try {
        const issueYear = issueDate.getFullYear();
        await this.prisma.invoice.create({
          data: {
            invoiceNumber: await this.generateInvoiceNumber(issueYear),
            customerId: invoice.customerId,
            subtotal,
            taxRate: new Prisma.Decimal(taxRate),
            taxAmount,
            total,
            currency: invoice.currency,
            issueDate,
            dueDate,
            status: InvoiceStatus.DRAFT,
          items: items as unknown as Prisma.InputJsonValue,
            notes: invoice.notes,
            isRecurring: true,
            recurringDay: invoice.recurringDay,
            createdById: invoice.createdById,
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to generate recurring invoice for customer ${invoice.customerId}`,
          error,
        );
      }
    }
  }
}



import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { QuoteStatus, Prisma, TemplateType } from '@prisma/client';
import { format } from 'date-fns';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { PdfService } from '../../../common/pdf/pdf.service';
import { EmailService } from '../../../common/email/email.service';
import { TemplatesService } from '../../templates/templates.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { FilterQuotesDto } from './dto/filter-quotes.dto';
import { SendQuoteDto } from './dto/send-quote.dto';

@Injectable()
export class QuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
    private readonly templatesService: TemplatesService,
  ) {}

  private readonly quoteInclude = {
    lead: {
      include: {
        contacts: {
          include: {
            contact: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                companyName: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    },
    opportunity: {
      select: {
        id: true,
        title: true,
        description: true,
        value: true,
        stage: true,
        isClosed: true,
        isWon: true,
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    },
    sentByUser: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    },
    template: {
      select: {
        id: true,
        name: true,
        type: true,
      },
    },
    activities: {
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        activityType: {
          select: {
            id: true,
            name: true,
            key: true,
            color: true,
            icon: true,
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
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    },
  } as const;

  private async generateQuoteNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.quote.count({
      where: {
        quoteNumber: {
          startsWith: `QT-${year}-`,
        },
      },
    });
    return `QT-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async create(createQuoteDto: CreateQuoteDto) {
    // Verify lead exists
    const lead = await this.prisma.lead.findUnique({
      where: { id: createQuoteDto.leadId },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID ${createQuoteDto.leadId} not found`);
    }

    // Verify opportunity exists if provided
    if (createQuoteDto.opportunityId) {
      const opportunity = await this.prisma.opportunity.findUnique({
        where: { id: createQuoteDto.opportunityId },
      });

      if (!opportunity) {
        throw new NotFoundException(`Opportunity with ID ${createQuoteDto.opportunityId} not found`);
      }
    }

    // Generate quote number if not provided
    const quoteNumber = createQuoteDto.quoteNumber || await this.generateQuoteNumber();

    // Check if quote number already exists
    const existing = await this.prisma.quote.findUnique({
      where: { quoteNumber },
    });

    if (existing) {
      throw new BadRequestException(`Quote number ${quoteNumber} already exists`);
    }

    const quote = await this.prisma.quote.create({
      data: {
        leadId: createQuoteDto.leadId,
        opportunityId: createQuoteDto.opportunityId,
        quoteNumber,
        title: createQuoteDto.title,
        description: createQuoteDto.description,
        overview: createQuoteDto.overview,
        functionalProposal: createQuoteDto.functionalProposal,
        technicalProposal: createQuoteDto.technicalProposal,
        teamComposition: createQuoteDto.teamComposition,
        milestones: createQuoteDto.milestones,
        paymentTerms: createQuoteDto.paymentTerms,
        warrantyPeriod: createQuoteDto.warrantyPeriod,
        totalValue:
          createQuoteDto.totalValue !== undefined && createQuoteDto.totalValue !== null
            ? new Prisma.Decimal(createQuoteDto.totalValue)
            : undefined,
        currency: createQuoteDto.currency || 'USD',
        status: createQuoteDto.status || QuoteStatus.DRAFT,
        templateId: createQuoteDto.templateId,
      },
      include: this.quoteInclude,
    });

    return this.formatQuote(quote);
  }

  async findAll(filters: FilterQuotesDto) {
    const { page = 1, pageSize = 25 } = filters;
    const skip = (page - 1) * pageSize;

    const where = this.buildWhereClause(filters);

    const orderBy: any = {
      [filters.sortBy ?? 'createdAt']: filters.sortOrder ?? 'desc',
    };

    const [total, quotes] = await this.prisma.$transaction([
      this.prisma.quote.count({ where }),
      this.prisma.quote.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: this.quoteInclude,
      }),
    ]);

    return {
      data: quotes.map((quote: any) => this.formatQuote(quote)),
      meta: {
        page,
        pageSize,
        total,
        pageCount: Math.ceil(total / pageSize),
      },
    };
  }

  async findOne(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      include: this.quoteInclude,
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }

    return this.formatQuote(quote);
  }

  async update(id: string, updateDto: UpdateQuoteDto) {
    const existing = await this.prisma.quote.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }

    // Check if quote number is being updated and if it already exists
    if (updateDto.quoteNumber && updateDto.quoteNumber !== existing.quoteNumber) {
      const existingWithNumber = await this.prisma.quote.findUnique({
        where: { quoteNumber: updateDto.quoteNumber },
      });

      if (existingWithNumber) {
        throw new BadRequestException(`Quote number ${updateDto.quoteNumber} already exists`);
      }
    }

    // Verify lead exists if being updated
    if (updateDto.leadId) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: updateDto.leadId },
      });

      if (!lead) {
        throw new NotFoundException(`Lead with ID ${updateDto.leadId} not found`);
      }
    }

    // Verify opportunity exists if being updated
    if (updateDto.opportunityId !== undefined) {
      if (updateDto.opportunityId) {
        const opportunity = await this.prisma.opportunity.findUnique({
          where: { id: updateDto.opportunityId },
        });

        if (!opportunity) {
          throw new NotFoundException(`Opportunity with ID ${updateDto.opportunityId} not found`);
        }
      }
    }

    const quote = await this.prisma.quote.update({
      where: { id },
      data: {
        leadId: updateDto.leadId,
        opportunityId: updateDto.opportunityId !== undefined ? updateDto.opportunityId : undefined,
        quoteNumber: updateDto.quoteNumber,
        title: updateDto.title,
        description: updateDto.description,
        overview: updateDto.overview,
        functionalProposal: updateDto.functionalProposal,
        technicalProposal: updateDto.technicalProposal,
        teamComposition: updateDto.teamComposition,
        milestones: updateDto.milestones,
        paymentTerms: updateDto.paymentTerms,
        warrantyPeriod: updateDto.warrantyPeriod,
        totalValue:
          updateDto.totalValue !== undefined && updateDto.totalValue !== null
            ? new Prisma.Decimal(updateDto.totalValue)
            : undefined,
        currency: updateDto.currency,
        status: updateDto.status,
        templateId: updateDto.templateId !== undefined ? updateDto.templateId : undefined,
      },
      include: this.quoteInclude,
    });

    return this.formatQuote(quote);
  }

  async remove(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }

    await this.prisma.quote.delete({
      where: { id },
    });

    return { deleted: true };
  }

  async generatePdf(id: string): Promise<Buffer> {
    const quote = await this.findOne(id);

    // Prepare data for template
    const data = this.prepareTemplateData(quote);

    // Use templatesService to render the template with proper helpers
    let renderedHtml: string;
    try {
      // Use selected template if available, otherwise use default
      if (quote.templateId) {
        const rendered = await this.templatesService.render(quote.templateId, data);
        renderedHtml = rendered.html;
      } else {
        const rendered = await this.templatesService.renderDefault(TemplateType.QUOTE, data);
        renderedHtml = rendered.html;
      }
    } catch (error) {
      // Fallback to default template if no template found or rendering fails
      const templateHtml = this.getDefaultTemplate();
      const Handlebars = require('handlebars');
      const handlebars = Handlebars.create();
      
      // Register helpers for fallback template
      handlebars.registerHelper('formatDate', (value: unknown, dateFormat = 'PPP') => {
        if (!value) {
          return '';
        }
        const date = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(date.getTime())) {
          return '';
        }
        return format(date, dateFormat);
      });

      handlebars.registerHelper('formatCurrency', (value: unknown, currency = 'USD') => {
        const amount = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(amount)) {
          return '';
        }
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(amount);
      });

      const template = handlebars.compile(templateHtml);
      renderedHtml = template(data);
    }

    return this.pdfService.generatePdfFromHtml(renderedHtml);
  }

  async preview(id: string): Promise<{ html: string }> {
    const quote = await this.findOne(id);

    // Prepare data for template
    const data = this.prepareTemplateData(quote);

    // Use templatesService to render the template with proper helpers
    try {
      // Use selected template if available, otherwise use default
      if (quote.templateId) {
        const rendered = await this.templatesService.render(quote.templateId, data);
        return { html: rendered.html };
      } else {
        const rendered = await this.templatesService.renderDefault(TemplateType.QUOTE, data);
        return { html: rendered.html };
      }
    } catch (error) {
      // Fallback to default template if no template found or rendering fails
      const templateHtml = this.getDefaultTemplate();
      const Handlebars = require('handlebars');
      const handlebars = Handlebars.create();
      
      // Register helpers for fallback template
      handlebars.registerHelper('formatDate', (value: unknown, dateFormat = 'PPP') => {
        if (!value) {
          return '';
        }
        const date = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(date.getTime())) {
          return '';
        }
        return format(date, dateFormat);
      });

      handlebars.registerHelper('formatCurrency', (value: unknown, currency = 'USD') => {
        const amount = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(amount)) {
          return '';
        }
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency,
        }).format(amount);
      });

      const template = handlebars.compile(templateHtml);
      const html = template(data);
      return { html };
    }
  }

  async send(id: string, sendDto: SendQuoteDto, userId: string) {
    const quote = await this.findOne(id);

    // Generate PDF
    const pdfBuffer = await this.generatePdf(id);

    // Get customer email from lead contacts
    const lead = quote.lead;
    const contacts = lead.contacts || [];
    const primaryContact = contacts[0]?.contact || null;

    if (!primaryContact && !sendDto.to) {
      throw new BadRequestException(
        'No contact email found for this lead. Please provide a recipient email address.',
      );
    }

    const recipientEmail = sendDto.to || primaryContact?.email;
    if (!recipientEmail) {
      throw new BadRequestException('Recipient email address is required');
    }

    // Prepare email content
    const quoteTitle = quote.title || `Quote ${quote.quoteNumber}`;
    const subject =
      sendDto.subject || `Quote: ${quoteTitle} - ${quote.quoteNumber}`;

    // Try to get email template, fallback to default
    let emailHtml: string;
    let emailText: string;
    try {
      const templateData = this.prepareTemplateData(quote);
      const rendered = await this.templatesService.renderDefault(TemplateType.EMAIL, {
        ...templateData,
        recipientName: primaryContact
          ? `${primaryContact.firstName} ${primaryContact.lastName}`
          : 'Customer',
        message: sendDto.message || '',
      });
      emailHtml = rendered.html;
      emailText = rendered.text;
    } catch (error) {
      // Fallback to simple email template
      emailHtml = `
        <p>Dear ${primaryContact ? `${primaryContact.firstName} ${primaryContact.lastName}` : 'Customer'},</p>
        <p>Please find attached the quote for your review.</p>
        ${sendDto.message ? `<p>${sendDto.message}</p>` : ''}
        <p>Quote Number: ${quote.quoteNumber}</p>
        <p>Quote Title: ${quoteTitle}</p>
        ${quote.totalValue ? `<p>Total Value: ${quote.currency || 'USD'} ${Number(quote.totalValue).toFixed(2)}</p>` : ''}
        <p>Best regards,<br/>Division 5 Team</p>
      `;
      emailText = emailHtml.replace(/<[^>]*>/g, '');
    }

    // Send email
    await this.emailService.sendEmail({
      to: recipientEmail,
      cc: sendDto.cc ? sendDto.cc.split(',').map((e) => e.trim()) : undefined,
      bcc: sendDto.bcc ? sendDto.bcc.split(',').map((e) => e.trim()) : undefined,
      subject,
      html: emailHtml,
      text: emailText,
      attachments: [
        {
          filename: `quote-${quote.quoteNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    // Update quote status
    const updatedQuote = await this.prisma.quote.update({
      where: { id },
      data: {
        status: QuoteStatus.SENT,
        sentAt: new Date(),
        sentTo: recipientEmail,
        sentBy: userId,
      },
      include: this.quoteInclude,
    });

    return this.formatQuote(updatedQuote);
  }

  async getActivities(id: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!quote) {
      throw new NotFoundException(`Quote with ID ${id} not found`);
    }

    const activities = await this.prisma.activity.findMany({
      where: { quoteId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        activityType: {
          select: {
            id: true,
            name: true,
            key: true,
            color: true,
            icon: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return activities.map((activity) => ({
      id: activity.id,
      activityTypeId: activity.activityTypeId,
      type: activity.activityType?.key ?? 'CUSTOM',
      typeLabel: activity.activityType?.name ?? 'Custom',
      typeColor: activity.activityType?.color ?? null,
      subject: activity.subject,
      title: activity.subject,
      body: activity.body ?? null,
      description: activity.body ?? null,
      activityDate: activity.activityDate ? activity.activityDate.toISOString() : null,
      reminderAt: activity.reminderAt ? activity.reminderAt.toISOString() : null,
      isReminderSent: activity.isReminderSent,
      isPinned: activity.isPinned,
      isCompleted: activity.isCompleted,
      visibility: activity.visibility,
      metadata: activity.metadata && typeof activity.metadata === 'object' ? activity.metadata : null,
      quoteId: activity.quoteId ?? null,
      assignedToId: activity.assignedToId ?? null,
      createdById: activity.createdById,
      createdAt: activity.createdAt.toISOString(),
      updatedAt: activity.updatedAt.toISOString(),
      createdBy: {
        id: activity.createdBy.id,
        firstName: activity.createdBy.firstName,
        lastName: activity.createdBy.lastName,
        email: activity.createdBy.email,
        avatar: activity.createdBy.avatar ?? null,
      },
      assignedTo: activity.assignedTo
        ? {
            id: activity.assignedTo.id,
            firstName: activity.assignedTo.firstName,
            lastName: activity.assignedTo.lastName,
            email: activity.assignedTo.email,
            avatar: activity.assignedTo.avatar ?? null,
          }
        : null,
      activityType: activity.activityType
        ? {
            id: activity.activityType.id,
            key: activity.activityType.key,
            name: activity.activityType.name,
            color: activity.activityType.color,
            icon: activity.activityType.icon,
          }
        : undefined,
    }));
  }

  private buildWhereClause(filters: FilterQuotesDto): any {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        { quoteNumber: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    if (filters.leadId) {
      where.leadId = filters.leadId;
    }

    if (filters.opportunityId) {
      where.opportunityId = filters.opportunityId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return where;
  }

  private formatQuote(quote: any) {
    if (!quote) return quote;

    const formatted = {
      ...quote,
      totalValue: quote?.totalValue ? Number(quote.totalValue) : null,
      milestones: quote?.milestones || null,
    };

    // Format lead contacts
    if (quote.lead?.contacts) {
      formatted.lead.contacts = quote.lead.contacts.map((lc: any) => lc.contact);
    }

    return formatted;
  }

  private prepareTemplateData(quote: any) {
    const lead = quote.lead || {};
    const contacts = lead.contacts || [];
    const primaryContact = contacts[0] || null;

    return {
      quote: {
        quoteNumber: quote.quoteNumber,
        title: quote.title,
        description: quote.description || '',
        overview: quote.overview || '',
        functionalProposal: quote.functionalProposal || '',
        technicalProposal: quote.technicalProposal || '',
        teamComposition: quote.teamComposition || '',
        milestones: quote.milestones || '',
        paymentTerms: quote.paymentTerms || '',
        warrantyPeriod: quote.warrantyPeriod || '',
        totalValue: quote.totalValue ? Number(quote.totalValue) : null,
        currency: quote.currency || 'USD',
        status: quote.status,
        createdAt: quote.createdAt,
        updatedAt: quote.updatedAt,
        lead: {
          title: lead.title || '',
          description: lead.description || '',
          prospectCompanyName: lead.prospectCompanyName || '',
          prospectWebsite: lead.prospectWebsite || '',
          prospectIndustry: lead.prospectIndustry || '',
        },
        contact: primaryContact
          ? {
              firstName: primaryContact.firstName || '',
              lastName: primaryContact.lastName || '',
              email: primaryContact.email || '',
              phone: primaryContact.phone || '',
              companyName: primaryContact.companyName || '',
            }
          : null,
      },
    };
  }

  private getDefaultTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      border-bottom: 3px solid #0066cc;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #0066cc;
      margin: 0;
    }
    .quote-info {
      background-color: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 20px;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #0066cc;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 10px;
    }
    .milestone {
      background-color: #f9f9f9;
      padding: 10px;
      margin-bottom: 10px;
      border-left: 4px solid #0066cc;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #eee;
      text-align: center;
      color: #666;
    }
    .total-value {
      font-size: 24px;
      font-weight: bold;
      color: #0066cc;
      text-align: right;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>QUOTE</h1>
    <p><strong>Quote Number:</strong> {{quote.quoteNumber}}</p>
    <p><strong>Date:</strong> {{formatDate quote.createdAt}}</p>
  </div>

  <div class="quote-info">
    <h2>{{quote.title}}</h2>
    {{#if quote.description}}
    <p>{{quote.description}}</p>
    {{/if}}
  </div>

  {{#if quote.contact}}
  <div class="section">
    <h2>Customer Information</h2>
    <p><strong>Name:</strong> {{quote.contact.firstName}} {{quote.contact.lastName}}</p>
    {{#if quote.contact.companyName}}
    <p><strong>Company:</strong> {{quote.contact.companyName}}</p>
    {{/if}}
    <p><strong>Email:</strong> {{quote.contact.email}}</p>
    {{#if quote.contact.phone}}
    <p><strong>Phone:</strong> {{quote.contact.phone}}</p>
    {{/if}}
  </div>
  {{/if}}

  {{#if quote.functionalProposal}}
  <div class="section">
    <h2>Functional Proposal</h2>
    <p>{{{quote.functionalProposal}}}</p>
  </div>
  {{/if}}

  {{#if quote.technicalProposal}}
  <div class="section">
    <h2>Technical Proposal</h2>
    <p>{{{quote.technicalProposal}}}</p>
  </div>
  {{/if}}

  {{#if quote.teamComposition}}
  <div class="section">
    <h2>Team Composition</h2>
    <p>{{{quote.teamComposition}}}</p>
  </div>
  {{/if}}

  {{#if quote.milestones}}
  <div class="section">
    <h2>Milestones</h2>
    {{#each quote.milestones}}
    <div class="milestone">
      <h3>{{name}}</h3>
      {{#if description}}
      <p>{{description}}</p>
      {{/if}}
      {{#if dueDate}}
      <p><strong>Due Date:</strong> {{dueDate}}</p>
      {{/if}}
      {{#if value}}
      <p><strong>Value:</strong> {{formatCurrency value ../quote.currency}}</p>
      {{/if}}
    </div>
    {{/each}}
  </div>
  {{/if}}

  {{#if quote.paymentTerms}}
  <div class="section">
    <h2>Payment Terms</h2>
    <p>{{{quote.paymentTerms}}}</p>
  </div>
  {{/if}}

  {{#if quote.warrantyPeriod}}
  <div class="section">
    <h2>Warranty Period</h2>
    <p>{{quote.warrantyPeriod}}</p>
  </div>
  {{/if}}

  {{#if quote.totalValue}}
  <div class="total-value">
    Total Value: {{formatCurrency quote.totalValue quote.currency}}
  </div>
  {{/if}}

  <div class="footer">
    <p>Thank you for your consideration.</p>
    <p>Division 5 Team</p>
  </div>
</body>
</html>
    `;
  }
}


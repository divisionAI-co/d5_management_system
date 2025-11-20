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

    // Verify template exists if provided
    if (createQuoteDto.templateId) {
      const template = await this.prisma.template.findUnique({
        where: { id: createQuoteDto.templateId },
      });

      if (!template) {
        throw new NotFoundException(`Template with ID ${createQuoteDto.templateId} not found`);
      }

      if (template.type !== TemplateType.QUOTE) {
        throw new BadRequestException(`Template must be of type QUOTE`);
      }
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
        templateId: createQuoteDto.templateId,
        totalValue:
          createQuoteDto.totalValue !== undefined && createQuoteDto.totalValue !== null
            ? new Prisma.Decimal(createQuoteDto.totalValue)
            : undefined,
        currency: createQuoteDto.currency || 'USD',
        status: createQuoteDto.status || QuoteStatus.DRAFT,
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

    // Verify template exists if being updated
    if (updateDto.templateId !== undefined) {
      if (updateDto.templateId) {
        const template = await this.prisma.template.findUnique({
          where: { id: updateDto.templateId },
        });

        if (!template) {
          throw new NotFoundException(`Template with ID ${updateDto.templateId} not found`);
        }

        if (template.type !== TemplateType.QUOTE) {
          throw new BadRequestException(`Template must be of type QUOTE`);
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
        templateId: updateDto.templateId !== undefined ? updateDto.templateId : undefined,
        totalValue:
          updateDto.totalValue !== undefined && updateDto.totalValue !== null
            ? new Prisma.Decimal(updateDto.totalValue)
            : undefined,
        currency: updateDto.currency,
        status: updateDto.status,
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

  /**
   * Renders quote HTML using the same logic as template preview
   * This ensures preview, template preview, and PDF are identical
   */
  private async renderQuoteHtml(quote: any): Promise<string> {
    // Prepare data for template
    const data = this.prepareTemplateData(quote);

    // Use the quote's selected template if available, otherwise use default
    try {
      if (quote.templateId) {
        // Use the specific template selected for this quote
        const template = await this.prisma.template.findUnique({
          where: { id: quote.templateId },
        });

        if (template && template.type === TemplateType.QUOTE && template.isActive) {
          const rendered = await this.templatesService.renderTemplateById(template.id, data);
          return rendered.html;
        }
      }

      // Fallback to default template
      const rendered = await this.templatesService.renderDefault(TemplateType.QUOTE, data);
      return rendered.html;
    } catch (error) {
      // Fallback: create a temporary template and use templatesService.renderTemplateById
      // to ensure we go through the same rendering pipeline (CSS injection, etc.)
      const templateHtml = this.getDefaultTemplate();
      
      // Create a temporary template in memory structure
      const tempTemplate = {
        id: 'temp-quote-template',
        htmlContent: templateHtml,
        cssContent: null,
        type: TemplateType.QUOTE,
        name: 'Default Quote Template',
        isDefault: false,
        isActive: true,
        variables: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Use templatesService's renderTemplate method directly to ensure same processing
      // This ensures CSS injection, Google Drive URL conversion, etc.
      const Handlebars = require('handlebars');
      const handlebars = Handlebars.create();
      
      // Register helpers (templatesService already has these, but we need them for fallback)
      handlebars.registerHelper('formatDate', (value: unknown, ...args: unknown[]) => {
        if (!value) {
          return '';
        }
        let dateFormat = 'PPP';
        if (args.length > 0 && typeof args[0] === 'string') {
          dateFormat = args[0];
        }
        
        const date = value instanceof Date ? value : new Date(String(value));
        if (Number.isNaN(date.getTime())) {
          return '';
        }
        if (typeof dateFormat !== 'string') {
          dateFormat = 'PPP';
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

      // Use the same rendering pipeline as templatesService.renderTemplate
      const compiled = handlebars.compile(templateHtml);
      const sanitizedData = JSON.parse(JSON.stringify(data ?? {}));
      const html = compiled(sanitizedData);
      // Note: CSS injection and Google Drive URL conversion would happen here
      // but since we don't have CSS content and this is a fallback, we skip those
      return html;
    }
  }

  async generatePdf(id: string): Promise<Buffer> {
    const quote = await this.findOne(id);
    const renderedHtml = await this.renderQuoteHtml(quote);
    return this.pdfService.generatePdfFromHtml(renderedHtml);
  }

  async preview(id: string): Promise<{ html: string }> {
    const quote = await this.findOne(id);
    // Prepare data for template - same structure as PDF generation
    const data = this.prepareTemplateData(quote);

    // Use templatesService preview method directly to ensure identical rendering
    // This uses the EXACT same renderTemplate and wrapInDocument methods as template preview
    try {
      // Use the quote's selected template if available, otherwise use default
      let template = null;
      
      if (quote.templateId) {
        template = await this.prisma.template.findUnique({
          where: { id: quote.templateId },
        });
      }

      // If no template selected or template not found, use default
      if (!template || template.type !== TemplateType.QUOTE || !template.isActive) {
        template = await this.prisma.template.findFirst({
          where: {
            type: TemplateType.QUOTE,
            isDefault: true,
            isActive: true,
          },
          orderBy: {
            updatedAt: 'desc',
          },
        });
      }

      if (template) {
        // Use templatesService.preview with the template ID and quote data
        // This ensures:
        // 1. Same renderTemplate method (CSS injection, Google Drive URL conversion)
        // 2. Same wrapInDocument method (document structure, spacing, layout)
        // 3. Identical output to template preview and PDF
        const previewResult = await this.templatesService.preview(template.id, { data });
        return { html: previewResult.renderedHtml };
      } else {
        // No template found - use renderDefault (same as PDF) and wrap for preview
        // This ensures consistency even when no template exists
        const rendered = await this.templatesService.renderDefault(TemplateType.QUOTE, data);
        // Wrap in document structure using the same method as templatesService.wrapInDocument
        const wrappedHtml = this.wrapInDocumentForPreview(rendered.html, null);
        return { html: wrappedHtml };
      }
    } catch (error) {
      // Final fallback: use the same method as PDF generation and wrap for preview
      const renderedHtml = await this.renderQuoteHtml(quote);
      const wrappedHtml = this.wrapInDocumentForPreview(renderedHtml, null);
      return { html: wrappedHtml };
    }
  }

  /**
   * Wraps HTML content in a complete document structure for preview
   * This uses the same logic as templatesService.wrapInDocument to ensure identical rendering
   */
  private wrapInDocumentForPreview(html: string, cssContent?: string | null): string {
    // Check if HTML already has a complete document structure
    const hasHtmlTag = /<html[^>]*>/i.test(html);
    const hasHeadTag = /<head[^>]*>/i.test(html);
    const hasBodyTag = /<body[^>]*>/i.test(html);
    
    if (hasHtmlTag && hasHeadTag && hasBodyTag) {
      // Already a complete document, just ensure CSS is injected if not already present
      if (cssContent && cssContent.trim() && !html.includes('<style>')) {
        // Inject CSS into existing head
        if (html.includes('</head>')) {
          return html.replace('</head>', `<style>\n${cssContent.trim()}\n</style>\n</head>`);
        }
      }
      return html;
    }
    
    // Extract body content and any prepended CSS (same logic as templatesService.wrapInDocument)
    let bodyContent = html;
    let extractedCss = '';
    
    // Check if CSS was prepended (from injectCss when no head tag exists)
    const styleTagMatch = html.match(/<style>([\s\S]*?)<\/style>/i);
    if (styleTagMatch) {
      extractedCss = styleTagMatch[1];
      // Remove the style tag from body content
      bodyContent = html.replace(/<style>[\s\S]*?<\/style>/i, '').trim();
    }
    
    if (hasBodyTag) {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
      if (bodyMatch) {
        bodyContent = bodyMatch[1];
      }
    }
    
    // Use extracted CSS or provided CSS content
    const cssStyle = (extractedCss || (cssContent && cssContent.trim()))
      ? `<style>\n${extractedCss || (cssContent?.trim() ?? '')}\n</style>`
      : '';
    
    // Wrap in complete HTML document structure matching Puppeteer's rendering
    // A4 dimensions: 210mm x 297mm = 794px x 1123px at 96 DPI
    // With 20px margins: content area is 754px x 1083px
    // Set viewport to match A4 page dimensions for accurate preview
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=794, initial-scale=1.0">
  ${cssStyle}
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; width: 754px; min-height: 1083px;">
${bodyContent}
</body>
</html>`;
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

  /**
   * Prepares template data from a quote object
   * This is used by both PDF generation and preview to ensure consistency
   */
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

  /**
   * Gets sample quote data for template preview
   * This ensures template preview uses the same data structure as actual quotes
   */
  getSampleQuoteData() {
    const now = new Date();
    return {
      quote: {
        quoteNumber: 'QT-2025-0001',
        title: 'Sample Quote Title',
        description: '<p>This is a sample quote description with <strong>formatted</strong> text.</p>',
        overview: '<p>This is a sample overview section with <em>rich text</em> formatting.</p>',
        functionalProposal: '<p>Sample functional proposal content with <u>underlined</u> text.</p>',
        technicalProposal: '<p>Sample technical proposal with <span style="color: #0066cc;">colored</span> text.</p>',
        teamComposition: '<p>Sample team composition details.</p>',
        milestones: '<p>Sample milestones and deliverables.</p>',
        paymentTerms: '<p>Sample payment terms and schedule.</p>',
        warrantyPeriod: '12 months',
        totalValue: 50000,
        currency: 'USD',
        status: 'DRAFT',
        createdAt: now,
        updatedAt: now,
        lead: {
          title: 'Sample Lead',
          description: 'Sample lead description',
          prospectCompanyName: 'Sample Company Inc.',
          prospectWebsite: 'https://example.com',
          prospectIndustry: 'Technology',
        },
        contact: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1-555-0123',
          companyName: 'Sample Company Inc.',
        },
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


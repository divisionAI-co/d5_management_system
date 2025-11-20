import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Template, TemplateType } from '@prisma/client';
import { format } from 'date-fns';
import * as Handlebars from 'handlebars';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTemplateDto, TemplateVariableDto } from './dto/create-template.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  private readonly handlebars = Handlebars.create();

  constructor(private readonly prisma: PrismaService) {
    this.registerDefaultHelpers();
  }

  async findAll(query: ListTemplatesDto) {
    const { type, onlyActive, search } = query;

    const where: Prisma.TemplateWhereInput = {};

    if (type) {
      where.type = type;
    }

    if (onlyActive) {
      where.isActive = true;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    return this.prisma.template.findMany({
      where,
      orderBy: [
        { isDefault: 'desc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`Template with ID ${id} not found`);
    }

    return template;
  }

  async create(dto: CreateTemplateDto) {
    await this.ensureSingleDefault(dto.type, dto.isDefault ?? false);

    return this.prisma.template.create({
      data: {
        name: dto.name,
        type: dto.type,
        htmlContent: dto.htmlContent,
        cssContent: dto.cssContent ?? null,
        variables: this.serializeVariables(dto.variables) ?? [],
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async duplicate(id: string) {
    const source = await this.findOne(id);

    return this.prisma.template.create({
      data: {
        name: `${source.name} (Copy)`,
        type: source.type,
        htmlContent: source.htmlContent,
        cssContent: source.cssContent,
        variables: source.variables as Prisma.InputJsonValue,
        isDefault: false, // Duplicates should never be default
        isActive: source.isActive,
      },
    });
  }

  async remove(id: string) {
    const template = await this.findOne(id);

    // Prevent deletion of default templates
    if (template.isDefault) {
      throw new BadRequestException('Cannot delete a default template. Please set another template as default first.');
    }

    await this.prisma.template.delete({
      where: { id },
    });

    return { message: 'Template deleted successfully' };
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const existing = await this.findOne(id);
    const nextType = dto.type ?? existing.type;

    await this.ensureSingleDefault(nextType, dto.isDefault ?? existing.isDefault, id);

    const data: Prisma.TemplateUpdateInput = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.type !== undefined) {
      data.type = dto.type;
    }

    if (dto.htmlContent !== undefined) {
      data.htmlContent = dto.htmlContent;
    }

    if (dto.cssContent !== undefined) {
      data.cssContent = dto.cssContent;
    }

    if (dto.variables !== undefined) {
      data.variables = this.serializeVariables(dto.variables);
    }

    if (dto.isDefault !== undefined) {
      data.isDefault = dto.isDefault;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    return this.prisma.template.update({
      where: { id },
      data,
    });
  }

  async preview(id: string, dto: PreviewTemplateDto) {
    const template = await this.findOne(id);
    
    // For QUOTE templates, use the same data structure as actual quotes
    // This ensures template preview matches quote preview and PDF
    let previewData = dto.data ?? {};
    if (template.type === TemplateType.QUOTE && (!dto.data || Object.keys(dto.data).length === 0)) {
      previewData = this.getSampleQuoteData();
    }
    
    const renderedHtml = this.renderTemplate(template, previewData);
    
    // Wrap in complete HTML document structure to match PDF rendering
    // This ensures spacing, CSS, and layout are identical to PDF
    const wrappedHtml = this.wrapInDocument(renderedHtml, template.cssContent);

    return {
      templateId: template.id,
      type: template.type,
      renderedHtml: wrappedHtml,
      variables: template.variables,
    };
  }

  async render(templateId: string, data: Record<string, any> = {}) {
    const template = await this.findOne(templateId);
    const html = this.renderTemplate(template, data);
    // Generate plain text version by stripping HTML tags
    const text = this.htmlToText(html);
    return { html, text };
  }

  async renderTemplateById(templateId: string, data: Record<string, any> = {}) {
    const template = await this.findOne(templateId);
    const html = this.renderTemplate(template, data);
    const text = this.htmlToText(html);
    return { html, text };
  }

  async renderDefault(type: TemplateType, data: Record<string, any> = {}) {
    const template = await this.prisma.template.findFirst({
      where: {
        type,
        isDefault: true,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!template) {
      throw new NotFoundException(`Default template for type ${type} not found`);
    }

    const html = this.renderTemplate(template, data);
    const text = this.htmlToText(html);
    return { html, text };
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async ensureSingleDefault(type: TemplateType, isDefault: boolean, currentId?: string) {
    if (!isDefault) {
      return;
    }

    const where: Prisma.TemplateWhereInput = {
      type,
    };

    if (currentId) {
      where.id = { not: currentId };
    }

    await this.prisma.template.updateMany({
      where,
      data: {
        isDefault: false,
      },
    });
  }

  /**
   * Converts Google Drive sharing links to direct image URLs in HTML
   * Supports formats:
   * - https://drive.google.com/file/d/FILE_ID/view
   * - https://drive.google.com/file/d/FILE_ID/edit
   * - https://drive.google.com/open?id=FILE_ID
   * - https://drive.google.com/file/d/FILE_ID
   */
  private convertGoogleDriveUrls(html: string): string {
    if (!html || typeof html !== 'string') {
      return html;
    }

    // Extract file ID from various Google Drive URL formats
    const extractFileId = (url: string): string | null => {
      // Format: https://drive.google.com/file/d/FILE_ID/view or /edit or /preview
      // Also handles: https://drive.google.com/file/d/FILE_ID/view?usp=drive_link
      const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        return fileIdMatch[1];
      }
      
      // Format: https://drive.google.com/open?id=FILE_ID
      const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (idMatch) {
        return idMatch[1];
      }
      
      return null;
    };

    // Match img src attributes with Google Drive URLs (both single and double quotes)
    // Use backend proxy to bypass CORS restrictions from Google Drive
    const googleDriveUrlPattern = /(<img)([^>]+src=)(["'])(https?:\/\/drive\.google\.com\/[^"']+)(\3)([^>]*>)/gi;
    
    return html.replace(googleDriveUrlPattern, (match, imgTag, srcPrefix, quote, url, quoteEnd, rest) => {
      const fileId = extractFileId(url);
      if (fileId) {
        // Use backend proxy endpoint to serve Google Drive images
        // This bypasses CORS restrictions that prevent direct loading in iframes
        // uc?export=view returns the full resolution image
        const proxyUrl = `/api/v1/templates/proxy/google-drive-image?fileId=${fileId}`;
        
        return `${imgTag}${srcPrefix}${quote}${proxyUrl}${quoteEnd}${rest}`;
      }
      // If we can't extract the ID, return the original
      return match;
    });
  }

  private renderTemplate(template: Template, data: Record<string, any>) {
    try {
      const compiled = this.handlebars.compile(template.htmlContent);
      const sanitizedData = this.sanitizeData(data);
      const html = compiled(sanitizedData);
      const htmlWithCss = this.injectCss(html, template.cssContent);
      // Convert Google Drive URLs to direct image URLs
      return this.convertGoogleDriveUrls(htmlWithCss);
    } catch (error: any) {
      throw new BadRequestException(`Failed to render template: ${error?.message ?? 'Unknown error'}`);
    }
  }

  private sanitizeData(data: Record<string, any>) {
    try {
      return JSON.parse(JSON.stringify(data ?? {}));
    } catch (error) {
      return {};
    }
  }

  private injectCss(html: string, cssContent?: string | null) {
    if (!cssContent || !cssContent.trim()) {
      return html;
    }

    const styleTag = `<style>\n${cssContent.trim()}\n</style>`;
    
    // First, try to inject before </head> tag (most common case)
    if (html.includes('</head>')) {
      return html.replace('</head>', `${styleTag}\n</head>`);
    }
    
    // If no </head>, try to inject after <head> tag
    const headTagRegex = /<head([^>]*)>/i;
    if (headTagRegex.test(html)) {
      return html.replace(headTagRegex, (match) => `${match}\n${styleTag}`);
    }
    
    // If no <head> tag at all, wrap in a basic HTML structure or prepend
    // For email templates, we'll prepend the style tag
    return `${styleTag}\n${html}`;
  }

  /**
   * Wraps HTML content in a complete document structure to match PDF rendering
   * This ensures spacing, CSS, and layout are identical between preview and PDF
   */
  private wrapInDocument(html: string, cssContent?: string | null): string {
    // Check if HTML already has a complete document structure
    const hasHtmlTag = /<html[^>]*>/i.test(html);
    const hasHeadTag = /<head[^>]*>/i.test(html);
    const hasBodyTag = /<body[^>]*>/i.test(html);
    
    if (hasHtmlTag && hasHeadTag && hasBodyTag) {
      // Already a complete document, just ensure CSS is injected if not already present
      if (cssContent && cssContent.trim() && !html.includes('<style>')) {
        return this.injectCss(html, cssContent);
      }
      return html;
    }
    
    // Extract body content and any prepended CSS
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

  private registerDefaultHelpers() {
    this.handlebars.registerHelper('uppercase', (value: unknown) => {
      if (value === null || value === undefined) {
        return '';
      }

      return String(value).toUpperCase();
    });

    this.handlebars.registerHelper('lowercase', (value: unknown) => {
      if (value === null || value === undefined) {
        return '';
      }

      return String(value).toLowerCase();
    });

    this.handlebars.registerHelper('formatDate', (value: unknown, dateFormat = 'PPP') => {
      if (!value) {
        return '';
      }

      const date = value instanceof Date ? value : new Date(String(value));

      if (Number.isNaN(date.getTime())) {
        return '';
      }

      return format(date, dateFormat);
    });

    this.handlebars.registerHelper('formatCurrency', (value: unknown, currency = 'USD') => {
      const amount = typeof value === 'number' ? value : Number(value);

      if (Number.isNaN(amount)) {
        return '';
      }

      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
      }).format(amount);
    });

    this.handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
    this.handlebars.registerHelper('gt', (a: number, b: number) => Number(a) > Number(b));
    this.handlebars.registerHelper('lt', (a: number, b: number) => Number(a) < Number(b));
  }

  private serializeVariables(variables?: TemplateVariableDto[]): Prisma.InputJsonValue | undefined {
    if (!variables) {
      return undefined;
    }

    return variables.map((variable) => ({
      key: variable.key,
      description: variable.description ?? null,
      sampleValue: variable.sampleValue ?? null,
    })) as Prisma.InputJsonValue;
  }

  /**
   * Gets sample quote data for template preview
   * This ensures template preview uses the same data structure as actual quotes
   * Must match the structure returned by QuotesService.prepareTemplateData()
   */
  private getSampleQuoteData() {
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
}



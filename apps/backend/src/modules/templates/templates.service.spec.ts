import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { PreviewTemplateDto } from './dto/preview-template.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { TemplateType } from '@prisma/client';

describe('TemplatesService', () => {
  let service: TemplatesService;
  let prismaService: any;

  const mockTemplate = {
    id: 'template-1',
    name: 'Invoice Template',
    type: TemplateType.INVOICE,
    htmlContent: '<h1>Invoice {{invoiceNumber}}</h1><p>Total: {{total}}</p>',
    cssContent: 'h1 { color: blue; }',
    variables: [
      { key: 'invoiceNumber', description: 'Invoice number', sampleValue: 'INV-001' },
      { key: 'total', description: 'Total amount', sampleValue: 1000 },
    ],
    isDefault: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const mockPrismaService = {
      template: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplatesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TemplatesService>(TemplatesService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createDto: CreateTemplateDto = {
      name: 'Invoice Template',
      type: TemplateType.INVOICE,
      htmlContent: '<h1>Invoice {{invoiceNumber}}</h1>',
      cssContent: 'h1 { color: blue; }',
      variables: [
        { key: 'invoiceNumber', description: 'Invoice number' },
      ],
      isDefault: true,
    };

    it('should create a template successfully', async () => {
      prismaService.template.updateMany.mockResolvedValue({ count: 0 });
      prismaService.template.create.mockResolvedValue(mockTemplate);

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Invoice Template');
      expect(prismaService.template.create).toHaveBeenCalled();
    });

    it('should ensure only one default template per type', async () => {
      prismaService.template.updateMany.mockResolvedValue({ count: 1 });
      prismaService.template.create.mockResolvedValue(mockTemplate);

      await service.create(createDto);

      expect(prismaService.template.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: TemplateType.INVOICE,
          }),
          data: {
            isDefault: false,
          },
        }),
      );
    });

    it('should serialize variables correctly', async () => {
      prismaService.template.updateMany.mockResolvedValue({ count: 0 });
      prismaService.template.create.mockResolvedValue(mockTemplate);

      await service.create(createDto);

      expect(prismaService.template.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            variables: expect.arrayContaining([
              expect.objectContaining({
                key: 'invoiceNumber',
                description: 'Invoice number',
              }),
            ]),
          }),
        }),
      );
    });

    it('should set isActive to true by default', async () => {
      const dtoWithoutActive: CreateTemplateDto = {
        ...createDto,
        isActive: undefined,
      };

      prismaService.template.updateMany.mockResolvedValue({ count: 0 });
      prismaService.template.create.mockResolvedValue(mockTemplate);

      await service.create(dtoWithoutActive);

      expect(prismaService.template.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all templates', async () => {
      prismaService.template.findMany.mockResolvedValue([mockTemplate]);

      const query: ListTemplatesDto = {};
      const result = await service.findAll(query);

      expect(result).toBeDefined();
      expect(result.length).toBe(1);
      expect(prismaService.template.findMany).toHaveBeenCalled();
    });

    it('should filter by type', async () => {
      prismaService.template.findMany.mockResolvedValue([mockTemplate]);

      const query: ListTemplatesDto = {
        type: TemplateType.INVOICE,
      };

      await service.findAll(query);

      expect(prismaService.template.findMany).toHaveBeenCalled();
    });

    it('should filter by onlyActive', async () => {
      prismaService.template.findMany.mockResolvedValue([mockTemplate]);

      const query: ListTemplatesDto = {
        onlyActive: true,
      };

      await service.findAll(query);

      expect(prismaService.template.findMany).toHaveBeenCalled();
    });

    it('should search by name', async () => {
      prismaService.template.findMany.mockResolvedValue([mockTemplate]);

      const query: ListTemplatesDto = {
        search: 'Invoice',
      };

      await service.findAll(query);

      expect(prismaService.template.findMany).toHaveBeenCalled();
    });

    it('should order by isDefault and updatedAt', async () => {
      prismaService.template.findMany.mockResolvedValue([mockTemplate]);

      await service.findAll({});

      expect(prismaService.template.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { isDefault: 'desc' },
            { updatedAt: 'desc' },
          ],
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a template by id', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.findOne('template-1');

      expect(result).toBeDefined();
      expect(result.id).toBe('template-1');
      expect(prismaService.template.findUnique).toHaveBeenCalled();
    });

    it('should throw NotFoundException when template does not exist', async () => {
      prismaService.template.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto: UpdateTemplateDto = {
      name: 'Updated Template Name',
      htmlContent: '<h1>Updated Content</h1>',
    };

    it('should update a template successfully', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);
      prismaService.template.updateMany.mockResolvedValue({ count: 0 });
      prismaService.template.update.mockResolvedValue({
        ...mockTemplate,
        ...updateDto,
      });

      const result = await service.update('template-1', updateDto);

      expect(result).toBeDefined();
      expect(result.name).toBe('Updated Template Name');
      expect(prismaService.template.update).toHaveBeenCalled();
    });

    it('should ensure single default when setting isDefault to true', async () => {
      const updateWithDefault: UpdateTemplateDto = {
        isDefault: true,
      };

      prismaService.template.findUnique.mockResolvedValue(mockTemplate);
      prismaService.template.updateMany.mockResolvedValue({ count: 1 });
      prismaService.template.update.mockResolvedValue({
        ...mockTemplate,
        isDefault: true,
      });

      await service.update('template-1', updateWithDefault);

      expect(prismaService.template.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: TemplateType.INVOICE,
            id: { not: 'template-1' },
          }),
          data: {
            isDefault: false,
          },
        }),
      );
    });

    it('should update variables when provided', async () => {
      const updateWithVariables: UpdateTemplateDto = {
        variables: [
          { key: 'newVariable', description: 'New variable' },
        ],
      };

      prismaService.template.findUnique.mockResolvedValue(mockTemplate);
      prismaService.template.updateMany.mockResolvedValue({ count: 0 });
      prismaService.template.update.mockResolvedValue(mockTemplate);

      await service.update('template-1', updateWithVariables);

      expect(prismaService.template.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            variables: expect.any(Array),
          }),
        }),
      );
    });

    it('should throw NotFoundException when template does not exist', async () => {
      prismaService.template.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('duplicate', () => {
    it('should duplicate a template successfully', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);
      prismaService.template.create.mockResolvedValue({
        ...mockTemplate,
        id: 'template-2',
        name: 'Invoice Template (Copy)',
        isDefault: false,
      });

      const result = await service.duplicate('template-1');

      expect(result).toBeDefined();
      expect(result.name).toBe('Invoice Template (Copy)');
      expect(result.isDefault).toBe(false);
      expect(prismaService.template.create).toHaveBeenCalled();
    });

    it('should preserve template content and variables', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);
      prismaService.template.create.mockResolvedValue({
        ...mockTemplate,
        id: 'template-2',
        name: 'Invoice Template (Copy)',
      });

      await service.duplicate('template-1');

      expect(prismaService.template.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            htmlContent: mockTemplate.htmlContent,
            cssContent: mockTemplate.cssContent,
            variables: mockTemplate.variables,
            type: mockTemplate.type,
          }),
        }),
      );
    });

    it('should throw NotFoundException when template does not exist', async () => {
      prismaService.template.findUnique.mockResolvedValue(null);

      await expect(service.duplicate('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a template successfully', async () => {
      const nonDefaultTemplate = {
        ...mockTemplate,
        isDefault: false,
      };

      prismaService.template.findUnique.mockResolvedValue(nonDefaultTemplate);
      prismaService.template.delete.mockResolvedValue(nonDefaultTemplate);

      const result = await service.remove('template-1');

      expect(result.message).toBe('Template deleted successfully');
      expect(prismaService.template.delete).toHaveBeenCalled();
    });

    it('should throw BadRequestException when trying to delete default template', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);

      await expect(service.remove('template-1')).rejects.toThrow(BadRequestException);
      expect(prismaService.template.delete).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when template does not exist', async () => {
      prismaService.template.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('preview', () => {
    const previewDto: PreviewTemplateDto = {
      data: {
        invoiceNumber: 'INV-001',
        total: 1000,
      },
    };

    it('should preview template with sample data', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.preview('template-1', previewDto);

      expect(result).toBeDefined();
      expect(result.templateId).toBe('template-1');
      expect(result.renderedHtml).toBeDefined();
      expect(result.variables).toBeDefined();
    });

    it('should render template variables', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.preview('template-1', previewDto);

      expect(result.renderedHtml).toContain('INV-001');
      expect(result.renderedHtml).toContain('1000');
    });

    it('should inject CSS into rendered HTML', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.preview('template-1', previewDto);

      expect(result.renderedHtml).toContain('<style>');
      expect(result.renderedHtml).toContain('color: blue');
    });

    it('should use empty object when data not provided', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.preview('template-1', {});

      expect(result).toBeDefined();
      expect(result.renderedHtml).toBeDefined();
    });

    it('should throw NotFoundException when template does not exist', async () => {
      prismaService.template.findUnique.mockResolvedValue(null);

      await expect(service.preview('non-existent', previewDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('render', () => {
    it('should render template and return HTML and text', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const data = {
        invoiceNumber: 'INV-001',
        total: 1000,
      };

      const result = await service.render('template-1', data);

      expect(result).toBeDefined();
      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();
      expect(result.html).toContain('INV-001');
      expect(result.text).toContain('INV-001');
    });

    it('should convert HTML to plain text', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const result = await service.render('template-1', {});

      expect(result.text).toBeDefined();
      expect(result.text).not.toContain('<');
      expect(result.text).not.toContain('>');
    });

    it('should throw BadRequestException when template rendering fails', async () => {
      const invalidTemplate = {
        ...mockTemplate,
        htmlContent: '{{#invalid}}',
      };

      prismaService.template.findUnique.mockResolvedValue(invalidTemplate);

      await expect(service.render('template-1', {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('renderTemplateById', () => {
    it('should render template by ID and return HTML and text', async () => {
      prismaService.template.findUnique.mockResolvedValue(mockTemplate);

      const data = {
        invoiceNumber: 'INV-001',
      };

      const result = await service.renderTemplateById('template-1', data);

      expect(result).toBeDefined();
      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();
    });
  });

  describe('renderDefault', () => {
    it('should render default template for type', async () => {
      prismaService.template.findFirst.mockResolvedValue(mockTemplate);

      const data = {
        invoiceNumber: 'INV-001',
      };

      const result = await service.renderDefault(TemplateType.INVOICE, data);

      expect(result).toBeDefined();
      expect(result.html).toBeDefined();
      expect(result.text).toBeDefined();
      expect(prismaService.template.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: TemplateType.INVOICE,
            isDefault: true,
            isActive: true,
          }),
        }),
      );
    });

    it('should throw NotFoundException when no default template exists', async () => {
      prismaService.template.findFirst.mockResolvedValue(null);

      await expect(service.renderDefault(TemplateType.INVOICE, {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('Handlebars helpers', () => {
    it('should support uppercase helper', async () => {
      const templateWithHelper = {
        ...mockTemplate,
        htmlContent: '{{uppercase name}}',
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithHelper);

      const result = await service.render('template-1', { name: 'john' });

      expect(result.html).toContain('JOHN');
    });

    it('should support lowercase helper', async () => {
      const templateWithHelper = {
        ...mockTemplate,
        htmlContent: '{{lowercase name}}',
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithHelper);

      const result = await service.render('template-1', { name: 'JOHN' });

      expect(result.html).toContain('john');
    });

    it('should support formatDate helper', async () => {
      const templateWithHelper = {
        ...mockTemplate,
        htmlContent: '{{formatDate date "yyyy-MM-dd"}}',
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithHelper);

      const result = await service.render('template-1', { date: new Date('2024-01-01') });

      expect(result.html).toBeDefined();
      expect(result.html).not.toContain('{{formatDate');
      expect(result.html).toContain('2024');
    });

    it('should support formatCurrency helper', async () => {
      const templateWithHelper = {
        ...mockTemplate,
        htmlContent: '{{formatCurrency amount "USD"}}',
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithHelper);

      const result = await service.render('template-1', { amount: 1000 });

      expect(result.html).toBeDefined();
      expect(result.html).toMatch(/\$1,000\.00/);
    });

    it('should support eq helper', async () => {
      const templateWithHelper = {
        ...mockTemplate,
        htmlContent: '{{#if (eq status "active")}}Active{{/if}}',
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithHelper);

      const result = await service.render('template-1', { status: 'active' });

      expect(result.html).toContain('Active');
    });
  });

  describe('CSS injection', () => {
    it('should inject CSS into HTML with head tag', async () => {
      const templateWithHead = {
        ...mockTemplate,
        htmlContent: '<html><head></head><body><h1>Test</h1></body></html>',
        cssContent: 'h1 { color: red; }',
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithHead);

      const result = await service.render('template-1', {});

      expect(result.html).toContain('<style>');
      expect(result.html).toContain('color: red');
    });

    it('should inject CSS when no head tag exists', async () => {
      const templateWithoutHead = {
        ...mockTemplate,
        htmlContent: '<h1>Test</h1>',
        cssContent: 'h1 { color: red; }',
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithoutHead);

      const result = await service.render('template-1', {});

      expect(result.html).toContain('<style>');
      expect(result.html).toContain('color: red');
    });

    it('should not inject CSS when cssContent is empty', async () => {
      const templateWithoutCss = {
        ...mockTemplate,
        cssContent: null,
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithoutCss);

      const result = await service.render('template-1', {});

      expect(result.html).not.toContain('<style>');
    });
  });

  describe('Google Drive URL conversion', () => {
    it('should convert Google Drive file URLs to proxy URLs', async () => {
      const templateWithDriveImage = {
        ...mockTemplate,
        htmlContent: '<img src="https://drive.google.com/file/d/1A2b3C4D5E6F7G8H/view" />',
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithDriveImage);

      const result = await service.render('template-1', {});

      expect(result.html).toContain('/api/v1/templates/proxy/google-drive-image?fileId=1A2b3C4D5E6F7G8H');
    });

    it('should handle Google Drive URLs with query parameters', async () => {
      const templateWithDriveImage = {
        ...mockTemplate,
        htmlContent: '<img src="https://drive.google.com/open?id=1A2b3C4D5E6F7G8H" />',
      };

      prismaService.template.findUnique.mockResolvedValue(templateWithDriveImage);

      const result = await service.render('template-1', {});

      expect(result.html).toContain('/api/v1/templates/proxy/google-drive-image?fileId=1A2b3C4D5E6F7G8H');
    });
  });
});


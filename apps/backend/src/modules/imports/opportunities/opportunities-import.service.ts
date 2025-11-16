import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CustomerType,
  ImportStatus,
  LeadStatus,
  Prisma,
} from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { parseSpreadsheet } from '../../../common/utils/spreadsheet-parser';
import { validateFileUpload } from '../../../common/config/multer.config';
import { sanitizeFilename } from '../../../common/utils/file-sanitizer';
import {
  OpportunityFieldMappingEntry,
  OpportunityImportField,
  OpportunityMapImportDto,
} from './dto/opportunity-map-import.dto';
import { ExecuteOpportunityImportDto } from './dto/execute-opportunity-import.dto';
import { generateInitialMappings } from '../utils/field-mapping.util';

export interface OpportunityImportFieldMetadata {
  key: OpportunityImportField;
  label: string;
  description: string;
  required: boolean;
}

export interface OpportunityUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: OpportunityImportFieldMetadata[];
  suggestedMappings?: Array<{ sourceColumn: string; targetField: string }>;
}

export interface OpportunityImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

type OpportunityFieldMapping = Partial<
  Record<OpportunityImportField, string>
>;

interface ParsedSheet {
  headers: string[];
  rows: Record<string, any>[];
}

const SUPPORTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'];

const OPPORTUNITY_FIELD_DEFINITIONS: OpportunityImportFieldMetadata[] = [
  {
    key: OpportunityImportField.TITLE,
    label: 'Opportunity Title',
    description: 'Title or summary of the opportunity (required).',
    required: true,
  },
  {
    key: OpportunityImportField.DESCRIPTION,
    label: 'Description',
    description: 'Detailed notes about the opportunity.',
    required: false,
  },
  {
    key: OpportunityImportField.TYPE,
    label: 'Type',
    description:
      'Opportunity type (STAFF_AUGMENTATION, SOFTWARE_SUBSCRIPTION, BOTH).',
    required: false,
  },
  {
    key: OpportunityImportField.VALUE,
    label: 'Value',
    description: 'Projected value for the opportunity (numeric).',
    required: false,
  },
  {
    key: OpportunityImportField.STAGE,
    label: 'Stage',
    description: 'Pipeline stage (defaults to "Qualification" if omitted).',
    required: false,
  },
  {
    key: OpportunityImportField.CUSTOMER_NAME,
    label: 'Customer Name',
    description:
      'Existing customer to associate (matched by name, case-insensitive).',
    required: false,
  },
  {
    key: OpportunityImportField.CUSTOMER_EMAIL,
    label: 'Customer Email',
    description: 'Existing customer matched by primary email address.',
    required: false,
  },
  {
    key: OpportunityImportField.OWNER_EMAIL,
    label: 'Owner Email',
    description: 'Email of the user who should own the opportunity.',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_EMAIL,
    label: 'Contact Email',
    description: 'Primary email for the lead contact (required).',
    required: true,
  },
  {
    key: OpportunityImportField.CONTACT_FIRST_NAME,
    label: 'Contact First Name',
    description: 'First name of the lead contact.',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_LAST_NAME,
    label: 'Contact Last Name',
    description: 'Last name of the lead contact.',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_FULL_NAME,
    label: 'Contact Full Name',
    description: 'Full name (used when first/last names are missing).',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_PHONE,
    label: 'Contact Phone',
    description: 'Phone number for the lead contact.',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_TITLE,
    label: 'Lead Title',
    description: 'Lead title (defaults to opportunity title).',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_DESCRIPTION,
    label: 'Lead Description',
    description: 'Additional context for the lead record.',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_STATUS,
    label: 'Lead Status',
    description: 'Lead status (NEW, QUALIFIED, etc.).',
    required: false,
  },
  {
    key: OpportunityImportField.JOB_DESCRIPTION_URL,
    label: 'Job Description URL',
    description: 'Link to a JD for staff augmentation opportunities.',
    required: false,
  },
  {
    key: OpportunityImportField.NOTES,
    label: 'Internal Notes',
    description: 'Additional notes appended to the opportunity description.',
    required: false,
  },
  {
    key: OpportunityImportField.IS_CLOSED,
    label: 'Is Closed',
    description: 'Marks the opportunity as closed when true.',
    required: false,
  },
  {
    key: OpportunityImportField.IS_WON,
    label: 'Is Won',
    description: 'Marks the opportunity as won when true.',
    required: false,
  },
];

@Injectable()
export class OpportunitiesImportService {
  private readonly uploadDir = path.join(
    process.cwd(),
    'apps',
    'backend',
    'tmp',
    'imports',
  );

  constructor(private readonly prisma: PrismaService) {}

  private async ensureUploadDir() {
    await fs.mkdir(this.uploadDir, { recursive: true });
  }


  private normalizeRowValues(row: Record<string, any>): Record<string, string> {
    const normalized: Record<string, string> = {};
    Object.entries(row).forEach(([key, value]) => {
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        return;
      }
      if (value === null || value === undefined) {
        normalized[trimmedKey] = '';
      } else {
        normalized[trimmedKey] = String(value).trim();
      }
    });
    return normalized;
  }

  async uploadOpportunitiesImport(
    file: Express.Multer.File,
  ): Promise<OpportunityUploadResult> {
    // Validate file upload (size, type)
    try {
      validateFileUpload(file, 10); // 10MB limit
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid file upload.',
      );
    }

    // Parse spreadsheet
    let parsed;
    try {
      parsed = await parseSpreadsheet(file.buffer);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Failed to parse file. Please ensure it is a valid CSV or Excel file.',
      );
    }

    if (!parsed.headers.length) {
      throw new BadRequestException(
        'The uploaded file does not contain a header row.',
      );
    }

    const sanitizedRows = parsed.rows.map((row) =>
      this.normalizeRowValues(row),
    );

    const sampleRows = sanitizedRows.slice(0, 5);

    await this.ensureUploadDir();
    
    // Sanitize filename before storing
    const sanitizedOriginalName = sanitizeFilename(file.originalname);
    const fileExtension = path.extname(sanitizedOriginalName) || '.xlsx';
    const storageName = `${Date.now()}_${randomUUID()}${fileExtension}`;
    const storagePath = path.join(this.uploadDir, storageName);
    await fs.writeFile(storagePath, file.buffer);

    const importRecord = await this.prisma.dataImport.create({
      data: {
        type: 'opportunities',
        fileName: sanitizedOriginalName,
        fileUrl: storageName,
        status: ImportStatus.PENDING,
        totalRecords: sanitizedRows.length,
        successCount: 0,
        failureCount: 0,
      },
      select: { id: true },
    });

    const suggestedMappings = generateInitialMappings(
      parsed.headers,
      OPPORTUNITY_FIELD_DEFINITIONS,
    );

    return {
      id: importRecord.id,
      type: 'opportunities',
      fileName: file.originalname,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: OPPORTUNITY_FIELD_DEFINITIONS,
      suggestedMappings,
    };
  }

  async listOpportunitiesImports() {
    return this.prisma.dataImport.findMany({
      where: { type: 'opportunities' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        type: true,
        fileName: true,
        status: true,
        totalRecords: true,
        successCount: true,
        failureCount: true,
        createdAt: true,
        completedAt: true,
      },
    });
  }

  async getOpportunitiesImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'opportunities') {
      throw new NotFoundException('Import not found');
    }

    return {
      ...importRecord,
      availableFields: OPPORTUNITY_FIELD_DEFINITIONS,
    };
  }

  private async readImportFile(importRecord: { fileUrl: string }) {
    const storagePath = path.join(this.uploadDir, importRecord.fileUrl);
    try {
      return await fs.readFile(storagePath);
    } catch (error) {
      throw new NotFoundException(
        'Import file could not be located on the server.',
      );
    }
  }

  private validateMapping(
    headers: string[],
    mappings: OpportunityFieldMappingEntry[],
  ): OpportunityFieldMapping {
    const uniqueHeaders = new Set(headers.map((header) => header.trim()));
    const fieldMapping: OpportunityFieldMapping = {};

    mappings.forEach((entry) => {
      const source = entry.sourceColumn.trim();
      if (!uniqueHeaders.has(source)) {
        throw new BadRequestException(
          `Column "${entry.sourceColumn}" does not exist in the uploaded file.`,
        );
      }

      if (fieldMapping[entry.targetField]) {
        throw new BadRequestException(
          `Field "${entry.targetField}" has been mapped more than once.`,
        );
      }

      fieldMapping[entry.targetField] = source;
    });

    if (!fieldMapping[OpportunityImportField.TITLE]) {
      throw new BadRequestException(
        'Opportunity title must be mapped in order to import opportunities.',
      );
    }

    if (!fieldMapping[OpportunityImportField.CONTACT_EMAIL]) {
      throw new BadRequestException(
        'Contact email must be mapped in order to import opportunities.',
      );
    }

    return fieldMapping;
  }

  async saveOpportunitiesMapping(id: string, dto: OpportunityMapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'opportunities') {
      throw new NotFoundException('Import not found');
    }

    const buffer = await this.readImportFile(importRecord);
    const parsed = await parseSpreadsheet(buffer);

    const mapping = this.validateMapping(parsed.headers, dto.mappings);

    await this.prisma.dataImport.update({
      where: { id },
      data: {
        fieldMapping: {
          fields: mapping,
          ignoredColumns: dto.ignoredColumns ?? [],
        },
      },
    });

    return {
      id,
      fieldMapping: mapping,
      ignoredColumns: dto.ignoredColumns ?? [],
    };
  }

  private async resolveCustomerByName(
    name: string,
    cache: Map<string, string | null>,
  ): Promise<string | null> {
    const normalized = name.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (cache.has(normalized)) {
      return cache.get(normalized) ?? null;
    }

    const customer = await this.prisma.customer.findFirst({
      where: {
        name: {
          equals: name.trim(),
          mode: Prisma.QueryMode.insensitive,
        },
      },
      select: { id: true },
    });

    cache.set(normalized, customer?.id ?? null);
    return customer?.id ?? null;
  }

  private async resolveCustomerByEmail(
    email: string,
    cache: Map<string, string | null>,
  ): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (cache.has(normalized)) {
      return cache.get(normalized) ?? null;
    }

    const customer = await this.prisma.customer.findUnique({
      where: { email: normalized },
      select: { id: true },
    });

    cache.set(normalized, customer?.id ?? null);
    return customer?.id ?? null;
  }

  private async ensureDefaultCustomer(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      throw new BadRequestException(
        'Default customer ID provided does not match an existing customer.',
      );
    }
  }

  private async resolveOwnerByEmail(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private extractValue(
    row: Record<string, string>,
    mapping: OpportunityFieldMapping,
    key: OpportunityImportField,
  ) {
    const column = mapping[key];
    if (!column) {
      return undefined;
    }
    const value = row[column];
    if (value === undefined || value === null) {
      return undefined;
    }
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : undefined;
  }

  private splitFullName(fullName: string) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return { firstName: undefined, lastName: undefined };
    }
    if (parts.length === 1) {
      return { firstName: parts[0], lastName: parts[0] };
    }
    const firstName = parts.shift();
    const lastName = parts.join(' ');
    return {
      firstName,
      lastName,
    };
  }

  private buildContactData(
    row: Record<string, string>,
    mapping: OpportunityFieldMapping,
  ) {
    const email = this.extractValue(
      row,
      mapping,
      OpportunityImportField.CONTACT_EMAIL,
    );
    if (!email) {
      throw new BadRequestException(
        'Contact email is required for each opportunity row.',
      );
    }

    let firstName =
      this.extractValue(
        row,
        mapping,
        OpportunityImportField.CONTACT_FIRST_NAME,
      ) ?? '';
    let lastName =
      this.extractValue(
        row,
        mapping,
        OpportunityImportField.CONTACT_LAST_NAME,
      ) ?? '';

    if (!firstName || !lastName) {
      const fullName = this.extractValue(
        row,
        mapping,
        OpportunityImportField.CONTACT_FULL_NAME,
      );
      if (fullName) {
        const split = this.splitFullName(fullName);
        if (!firstName && split.firstName) {
          firstName = split.firstName;
        }
        if (!lastName && split.lastName) {
          lastName = split.lastName;
        }
      }
    }

    firstName = firstName.trim();
    lastName = lastName.trim();

    if (!firstName || !lastName) {
      throw new BadRequestException(
        'Each contact must include either first/last name or a full name column.',
      );
    }

    return {
      email: email.trim().toLowerCase(),
      firstName,
      lastName,
      phone:
        this.extractValue(
          row,
          mapping,
          OpportunityImportField.CONTACT_PHONE,
        ) ?? undefined,
    };
  }

  private parseLeadStatus(value?: string): LeadStatus {
    if (!value) {
      return LeadStatus.QUALIFIED;
    }
    const normalized = value.trim().toUpperCase();
    if (!Object.prototype.hasOwnProperty.call(LeadStatus, normalized)) {
      throw new BadRequestException(
        `Invalid lead status "${value}". Accepted values: ${Object.values(
          LeadStatus,
        ).join(', ')}`,
      );
    }
    return LeadStatus[normalized as keyof typeof LeadStatus];
  }

  private parseOpportunityType(value?: string): CustomerType {
    if (!value) {
      return CustomerType.STAFF_AUGMENTATION;
    }
    const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_');
    const match = Object.values(CustomerType).find(
      (type) => type === normalized,
    );
    if (!match) {
      throw new BadRequestException(
        `Invalid opportunity type "${value}". Accepted values: ${Object.values(
          CustomerType,
        ).join(', ')}`,
      );
    }
    return match;
  }

  private parseBooleanFlag(value?: string) {
    if (!value) {
      return false;
    }
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'y'].includes(normalized);
  }

  private parseNumber(value?: string) {
    if (!value) {
      return null;
    }
    const cleaned = value.replace(/,/g, '');
    const parsed = Number(cleaned);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`Invalid numeric value "${value}".`);
    }
    return parsed;
  }

  private sanitizeStage(value?: string, fallback?: string) {
    if (value && value.trim()) {
      return value.trim();
    }
    if (fallback && fallback.trim()) {
      return fallback.trim();
    }
    return 'Qualification';
  }

  private stripHtmlIfNeeded(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }

    const containsHtml = /<\/?[a-z][^>]*>/i.test(trimmed);
    if (!containsHtml && !/&[a-zA-Z]+;/.test(trimmed)) {
      return trimmed;
    }

    let text = trimmed
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&apos;/gi, "'");

    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<div[^>]*>/gi, '\n');

    text = text.replace(/<[^>]*>/g, '');

    text = text
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();

    return text.length ? text : undefined;
  }

  private async findExistingLead(
    title: string,
    contactEmail: string,
  ): Promise<string | undefined> {
    const existing = await this.prisma.lead.findFirst({
      where: {
        title: {
          equals: title,
          mode: Prisma.QueryMode.insensitive,
        },
        contact: {
          email: {
            equals: contactEmail,
            mode: Prisma.QueryMode.insensitive,
          },
        },
      },
      select: { id: true },
    });

    return existing?.id ?? undefined;
  }

  private async findExistingOpportunity(leadId: string, title: string) {
    const existing = await this.prisma.opportunity.findFirst({
      where: {
        leadId,
        title: {
          equals: title,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      select: { id: true },
    });
    return existing?.id ?? null;
  }

  private async findOrCreateContact(
    contactData: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
    },
    cache: Map<string, string>,
  ): Promise<string> {
    const cached = cache.get(contactData.email);
    if (cached) {
      return cached;
    }

    const existingContact = await this.prisma.contact.findUnique({
      where: { email: contactData.email },
      select: { id: true },
    });

    if (existingContact) {
      cache.set(contactData.email, existingContact.id);
      return existingContact.id;
    }

    const createdContact = await this.prisma.contact.create({
      data: {
        firstName: contactData.firstName,
        lastName: contactData.lastName,
        email: contactData.email,
        phone: contactData.phone ?? null,
      },
      select: { id: true },
    });

    cache.set(contactData.email, createdContact.id);
    return createdContact.id;
  }

  private async ensureDefaultOwner(defaultOwnerEmail: string) {
    const owner = await this.resolveOwnerByEmail(defaultOwnerEmail);
    if (!owner) {
      throw new BadRequestException(
        'Default owner email provided does not match an existing user.',
      );
    }
  }

  async executeOpportunitiesImport(
    id: string,
    dto: ExecuteOpportunityImportDto,
  ): Promise<OpportunityImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'opportunities') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: OpportunityFieldMapping;
          ignoredColumns?: string[];
        }
      | null;

    if (!mappingPayload?.fields) {
      throw new BadRequestException(
        'Field mappings must be configured before executing the import.',
      );
    }

    if (dto.defaultCustomerId) {
      await this.ensureDefaultCustomer(dto.defaultCustomerId);
    }

    if (dto.defaultOwnerEmail) {
      await this.ensureDefaultOwner(dto.defaultOwnerEmail);
    }

    const buffer = await this.readImportFile(importRecord);
    const parsed = await parseSpreadsheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const updateExisting = dto.updateExisting ?? true;
    const defaultOwnerEmail = dto.defaultOwnerEmail ?? null;
    const defaultCustomerId = dto.defaultCustomerId ?? null;
    const defaultStage = dto.defaultStage ?? undefined;

    const customerNameCache = new Map<string, string | null>();
    const customerEmailCache = new Map<string, string | null>();
    const ownerCache = new Map<string, string | null>();
    const contactCache = new Map<string, string>();
    const leadCache = new Map<string, string>();

    await this.prisma.dataImport.update({
      where: { id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const summary: OpportunityImportSummary = {
      importId: id,
      totalRows: rows.length,
      processedRows: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      errors: [],
    };

    const errorLimit = 50;

    const processRow = async (
      row: Record<string, string>,
      rowIndex: number,
    ) => {
      const rowNumber = rowIndex + 2;
      const nonEmpty = Object.values(row).some(
        (value) => value && value.trim().length > 0,
      );

      if (!nonEmpty) {
        summary.skippedCount += 1;
        return;
      }

      try {
        const title =
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.TITLE,
          ) ?? '';

        if (!title.trim()) {
          throw new BadRequestException(
            'Opportunity title is required for each row.',
          );
        }

        const contactData = this.buildContactData(
          row,
          mappingPayload.fields!,
        );

        const contactId = await this.findOrCreateContact(
          contactData,
          contactCache,
        );

        let customerId: string | null = null;

        const customerEmail = this.extractValue(
          row,
          mappingPayload.fields!,
          OpportunityImportField.CUSTOMER_EMAIL,
        );
        if (customerEmail) {
          customerId = await this.resolveCustomerByEmail(
            customerEmail,
            customerEmailCache,
          );
          if (!customerId) {
            throw new BadRequestException(
              `Customer email "${customerEmail}" does not match an existing customer.`,
            );
          }
        }

        if (!customerId) {
          const customerName = this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.CUSTOMER_NAME,
          );
          if (customerName) {
            customerId = await this.resolveCustomerByName(
              customerName,
              customerNameCache,
            );
            if (!customerId) {
              throw new BadRequestException(
                `Customer name "${customerName}" does not match an existing customer.`,
              );
            }
          }
        }

        if (!customerId && defaultCustomerId) {
          customerId = defaultCustomerId;
        }

        const ownerEmail =
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.OWNER_EMAIL,
          ) ?? defaultOwnerEmail;

        let ownerId: string | null = null;
        if (ownerEmail) {
          const normalized = ownerEmail.trim().toLowerCase();
          if (ownerCache.has(normalized)) {
            ownerId = ownerCache.get(normalized) ?? null;
          } else {
            ownerId = await this.resolveOwnerByEmail(normalized);
            ownerCache.set(normalized, ownerId);
          }

          if (!ownerId) {
            throw new BadRequestException(
              `Opportunity owner email "${ownerEmail}" does not match an existing user.`,
            );
          }
        }

        const leadTitle =
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.LEAD_TITLE,
          ) ?? title;

        const leadKey = `${leadTitle.toLowerCase()}::${contactData.email}`;
        let leadId = leadCache.get(leadKey);
        if (!leadId) {
          leadId = await this.findExistingLead(leadTitle, contactData.email);
          if (leadId) {
            leadCache.set(leadKey, leadId);
          }
        }

        const leadStatus = this.parseLeadStatus(
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.LEAD_STATUS,
          ),
        );

        const rawLeadDescription =
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.LEAD_DESCRIPTION,
          ) ?? undefined;
        const leadDescription =
          this.stripHtmlIfNeeded(rawLeadDescription) ?? null;

        if (!leadId) {
          const createdLead = await this.prisma.lead.create({
            data: {
              title: leadTitle,
              description: leadDescription,
              status: leadStatus,
              contact: { connect: { id: contactId } },
              assignedTo: ownerId ? { connect: { id: ownerId } } : undefined,
              source: 'Import',
            },
            select: { id: true },
          });
          leadId = createdLead.id;
          leadCache.set(leadKey, leadId);
        } else if (updateExisting) {
          await this.prisma.lead.update({
            where: { id: leadId },
            data: {
              title: leadTitle,
              description: leadDescription ?? undefined,
              status: leadStatus,
              assignedTo: ownerId
                ? { connect: { id: ownerId } }
                : { disconnect: true },
            },
          });
        }

        const opportunityType = this.parseOpportunityType(
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.TYPE,
          ),
        );

        const numericValue = this.parseNumber(
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.VALUE,
          ),
        );
        const decimalValue = new Prisma.Decimal(
          ((numericValue ?? 0) as number).toFixed(2),
        );

        const stage = this.sanitizeStage(
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.STAGE,
          ),
          defaultStage,
        );

        const rawDescription =
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.DESCRIPTION,
          ) ?? undefined;
        const description =
          this.stripHtmlIfNeeded(rawDescription) ?? null;

        const rawNotes =
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.NOTES,
          ) ?? undefined;
        const notes = this.stripHtmlIfNeeded(rawNotes) ?? null;

        const jobDescriptionUrl =
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.JOB_DESCRIPTION_URL,
          ) ?? null;

        const isClosed = this.parseBooleanFlag(
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.IS_CLOSED,
          ),
        );

        const isWon = this.parseBooleanFlag(
          this.extractValue(
            row,
            mappingPayload.fields!,
            OpportunityImportField.IS_WON,
          ),
        );

        const existingOpportunityId = await this.findExistingOpportunity(
          leadId,
          title,
        );

        const combinedDescription = notes
          ? [description ?? '', `Notes: ${notes}`]
              .filter((segment) => segment.trim().length)
              .join('\n\n')
          : description;

        if (existingOpportunityId) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            return;
          }

          await this.prisma.opportunity.update({
            where: { id: existingOpportunityId },
            data: {
              title,
              description: combinedDescription ?? undefined,
              type: opportunityType,
              value: decimalValue,
              stage,
              jobDescriptionUrl: jobDescriptionUrl ?? undefined,
              isClosed,
              isWon,
              customer: customerId
                ? { connect: { id: customerId } }
                : { disconnect: true },
              assignedTo: ownerId
                ? { connect: { id: ownerId } }
                : { disconnect: true },
            },
          });
          summary.updatedCount += 1;
        } else {
          await this.prisma.opportunity.create({
            data: {
              title,
              description: combinedDescription,
              type: opportunityType,
              value: decimalValue,
              stage,
              isClosed,
              isWon,
              jobDescriptionUrl,
              lead: { connect: { id: leadId } },
              customer: customerId
                ? { connect: { id: customerId } }
                : undefined,
              assignedTo: ownerId
                ? { connect: { id: ownerId } }
                : undefined,
            },
          });
          summary.createdCount += 1;
        }

        summary.processedRows += 1;
      } catch (error: any) {
        summary.failedCount += 1;
        if (summary.errors.length < errorLimit) {
          summary.errors.push({
            row: rowNumber,
            message:
              error?.message ??
              'An unexpected error occurred while importing this row.',
          });
        }
      }
    };

    try {
      for (let index = 0; index < rows.length; index += 1) {
        // eslint-disable-next-line no-await-in-loop
        await processRow(rows[index], index);
      }

      await this.prisma.dataImport.update({
        where: { id },
        data: {
          status: ImportStatus.COMPLETED,
          successCount: summary.createdCount + summary.updatedCount,
          failureCount: summary.failedCount,
          totalRecords: rows.length,
          errors: summary.errors,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.dataImport.update({
        where: { id },
        data: {
          status: ImportStatus.FAILED,
          errors: summary.errors,
          failureCount: summary.failedCount,
          totalRecords: rows.length,
          completedAt: new Date(),
        },
      });
      throw error;
    }

    return summary;
  }
}



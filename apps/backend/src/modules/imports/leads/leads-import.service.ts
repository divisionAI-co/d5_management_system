import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportStatus, LeadStatus, Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { parseSpreadsheet } from '../../../common/utils/spreadsheet-parser';
import { validateFileUpload } from '../../../common/config/multer.config';
import { sanitizeFilename } from '../../../common/utils/file-sanitizer';
import { LeadMapImportDto, LeadFieldMappingEntry, LeadImportField } from './dto/lead-map-import.dto';
import { ExecuteLeadImportDto } from './dto/execute-lead-import.dto';
import { generateInitialMappings } from '../utils/field-mapping.util';

export interface LeadImportFieldMetadata {
  key: LeadImportField;
  label: string;
  description: string;
  required: boolean;
}

export interface LeadUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: LeadImportFieldMetadata[];
  suggestedMappings?: Array<{ sourceColumn: string; targetField: string }>;
}

export interface LeadImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

type LeadFieldMapping = Partial<Record<LeadImportField, string>>;

const LEAD_FIELD_DEFINITIONS: LeadImportFieldMetadata[] = [
  {
    key: LeadImportField.TITLE,
    label: 'Lead Title',
    description: 'Title or summary of the lead (required)',
    required: true,
  },
  {
    key: LeadImportField.DESCRIPTION,
    label: 'Description',
    description: 'Detailed description or notes about the lead',
    required: false,
  },
  {
    key: LeadImportField.STATUS,
    label: 'Status',
    description: 'Lead status (NEW, CONTACTED, QUALIFIED, PROPOSAL, WON, LOST)',
    required: false,
  },
  {
    key: LeadImportField.VALUE,
    label: 'Value',
    description: 'Potential value of the lead',
    required: false,
  },
  {
    key: LeadImportField.PROBABILITY,
    label: 'Probability (%)',
    description: 'Probability of closing (0-100)',
    required: false,
  },
  {
    key: LeadImportField.SOURCE,
    label: 'Source',
    description: 'Lead source (e.g., Website, Referral)',
    required: false,
  },
  {
    key: LeadImportField.EXPECTED_CLOSE_DATE,
    label: 'Expected Close Date',
    description: 'Expected closing date of the lead',
    required: false,
  },
  {
    key: LeadImportField.CUSTOMER_NAME,
    label: 'Customer Name',
    description:
      'Existing customer to associate (matched by name, case-insensitive).',
    required: false,
  },
  {
    key: LeadImportField.OWNER_EMAIL,
    label: 'Owner Email',
    description:
      'Email of the user who should own the lead (matched by email).',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_EMAIL,
    label: 'Contact Email',
    description: 'Primary email for the lead contact (required)',
    required: true,
  },
  {
    key: LeadImportField.CONTACT_FIRST_NAME,
    label: 'Contact First Name',
    description: 'First name of the lead contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_LAST_NAME,
    label: 'Contact Last Name',
    description: 'Last name of the lead contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_FULL_NAME,
    label: 'Contact Full Name',
    description:
      'Full name of the lead contact (split into first/last if individual names missing)',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_PHONE,
    label: 'Contact Phone',
    description: 'Phone number for the lead contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_ROLE,
    label: 'Contact Role',
    description: 'Role or title of the lead contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_COMPANY,
    label: 'Contact Company',
    description: 'Company of the lead contact (used when creating a contact)',
    required: false,
  },
];

@Injectable()
export class LeadsImportService {
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


  private normalizeRowValues(
    row: Record<string, any>,
  ): Record<string, string> {
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

  async uploadLeadsImport(
    file: Express.Multer.File,
  ): Promise<LeadUploadResult> {
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
    const fileExtension = path.extname(sanitizedOriginalName) || '.csv';
    const storageName = `${Date.now()}_${randomUUID()}${fileExtension}`;
    const storagePath = path.join(this.uploadDir, storageName);
    await fs.writeFile(storagePath, file.buffer);

    const importRecord = await this.prisma.dataImport.create({
      data: {
        type: 'leads',
        fileName: sanitizedOriginalName,
        fileUrl: storageName,
        status: ImportStatus.PENDING,
        totalRecords: sanitizedRows.length,
        successCount: 0,
        failureCount: 0,
      },
      select: {
        id: true,
      },
    });

    const suggestedMappings = generateInitialMappings(
      parsed.headers,
      LEAD_FIELD_DEFINITIONS,
    );

    return {
      id: importRecord.id,
      type: 'leads',
      fileName: sanitizedOriginalName,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: LEAD_FIELD_DEFINITIONS,
      suggestedMappings,
    };
  }

  async listLeadsImports() {
    return this.prisma.dataImport.findMany({
      where: { type: 'leads' },
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

  async getLeadsImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });
    if (!importRecord || importRecord.type !== 'leads') {
      throw new NotFoundException('Import not found');
    }

    return {
      ...importRecord,
      availableFields: LEAD_FIELD_DEFINITIONS,
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
    mappings: LeadFieldMappingEntry[],
  ): LeadFieldMapping {
    const uniqueHeaders = new Set(headers.map((header) => header.trim()));
    const fieldMapping: LeadFieldMapping = {};

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

    if (!fieldMapping[LeadImportField.TITLE]) {
      throw new BadRequestException(
        'Lead title must be mapped in order to import leads.',
      );
    }

    if (!fieldMapping[LeadImportField.CONTACT_EMAIL]) {
      throw new BadRequestException(
        'Lead contact email must be mapped in order to import leads.',
      );
    }

    return fieldMapping;
  }

  async saveLeadsMapping(id: string, dto: LeadMapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'leads') {
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
      select: {
        id: true,
      },
    });

    cache.set(normalized, customer?.id ?? null);
    return customer?.id ?? null;
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
    mapping: LeadFieldMapping,
    key: LeadImportField,
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
    mapping: LeadFieldMapping,
  ) {
    const email = this.extractValue(row, mapping, LeadImportField.CONTACT_EMAIL);
    if (!email) {
      throw new BadRequestException(
        'Contact email is required for each lead row.',
      );
    }

    let firstName =
      this.extractValue(row, mapping, LeadImportField.CONTACT_FIRST_NAME) ?? '';
    let lastName =
      this.extractValue(row, mapping, LeadImportField.CONTACT_LAST_NAME) ?? '';

    if (!firstName || !lastName) {
      const fullName = this.extractValue(
        row,
        mapping,
        LeadImportField.CONTACT_FULL_NAME,
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
        'Each lead contact must include either first/last name or a full name column.',
      );
    }

    return {
      email: email.trim().toLowerCase(),
      firstName,
      lastName,
      phone:
        this.extractValue(row, mapping, LeadImportField.CONTACT_PHONE) ??
        undefined,
      role:
        this.extractValue(row, mapping, LeadImportField.CONTACT_ROLE) ??
        undefined,
      companyName:
        this.extractValue(row, mapping, LeadImportField.CONTACT_COMPANY) ??
        undefined,
    };
  }

  private async ensureDefaultOwner(defaultOwnerEmail: string) {
    const owner = await this.resolveOwnerByEmail(defaultOwnerEmail);
    if (!owner) {
      throw new BadRequestException(
        'Default owner email provided does not match an existing user.',
      );
    }
  }

  private parseStatus(value?: string, fallback?: LeadStatus): LeadStatus {
    if (!value) {
      return fallback ?? LeadStatus.NEW;
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

  private parseNumber(value?: string) {
    if (!value) {
      return null;
    }
    const parsed = Number(value.replace(/,/g, ''));
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(`Invalid numeric value "${value}".`);
    }
    return parsed;
  }

  private parseDate(value?: string) {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid date value "${value}".`);
    }
    return parsed;
  }

  private async findExistingLead(
    title: string,
    contactEmail: string,
  ): Promise<string | null> {
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

    return existing?.id ?? null;
  }

  async executeLeadsImport(
    id: string,
    dto: ExecuteLeadImportDto,
  ): Promise<LeadImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'leads') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: LeadFieldMapping;
          ignoredColumns?: string[];
        }
      | null;

    if (!mappingPayload?.fields) {
      throw new BadRequestException(
        'Field mappings must be configured before executing the import.',
      );
    }

    if (dto.defaultOwnerEmail) {
      await this.ensureDefaultOwner(dto.defaultOwnerEmail);
    }

    const buffer = await this.readImportFile(importRecord);
    const parsed = await parseSpreadsheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const updateExisting = dto.updateExisting ?? true;
    const defaultOwnerEmail = dto.defaultOwnerEmail ?? null;
    const defaultStatus = dto.defaultStatus ?? LeadStatus.NEW;

    const customerCache = new Map<string, string | null>();
    const ownerCache = new Map<string, string | null>();
    const contactCache = new Map<string, string>(); // email -> contactId

    await this.prisma.dataImport.update({
      where: { id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const summary: LeadImportSummary = {
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
      const rowNumber = rowIndex + 2; // account for header row
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
            LeadImportField.TITLE,
          ) ?? '';

        if (!title.trim()) {
          throw new BadRequestException(
            'Title is required for each lead row.',
          );
        }

        const contactData = this.buildContactData(
          row,
          mappingPayload.fields!,
        );

        let contactId = contactCache.get(contactData.email);
        if (!contactId) {
          const existingContact = await this.prisma.contact.findUnique({
            where: { email: contactData.email },
            select: { id: true },
          });

          if (existingContact) {
            contactId = existingContact.id;
          } else {
            const createdContact = await this.prisma.contact.create({
              data: {
                firstName: contactData.firstName,
                lastName: contactData.lastName,
                email: contactData.email,
                phone: contactData.phone ?? null,
                role: contactData.role ?? null,
                companyName: contactData.companyName ?? null,
              },
              select: { id: true },
            });
            contactId = createdContact.id;
          }

          contactCache.set(contactData.email, contactId);
        }

        let customerId: string | null = null;
        const customerName = this.extractValue(
          row,
          mappingPayload.fields!,
          LeadImportField.CUSTOMER_NAME,
        );
        if (customerName) {
          customerId = await this.resolveCustomerByName(
            customerName,
            customerCache,
          );
        }

        let ownerId: string | null = null;
        const ownerEmail =
          this.extractValue(
            row,
            mappingPayload.fields!,
            LeadImportField.OWNER_EMAIL,
          ) ?? defaultOwnerEmail;

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
              `Lead owner email "${ownerEmail}" does not match an existing user.`,
            );
          }
        }

        const status = this.parseStatus(
          this.extractValue(
            row,
            mappingPayload.fields!,
            LeadImportField.STATUS,
          ),
          defaultStatus,
        );

        const value = this.parseNumber(
          this.extractValue(
            row,
            mappingPayload.fields!,
            LeadImportField.VALUE,
          ),
        );
        const probability = this.parseNumber(
          this.extractValue(
            row,
            mappingPayload.fields!,
            LeadImportField.PROBABILITY,
          ),
        );
        const expectedCloseDate = this.parseDate(
          this.extractValue(
            row,
            mappingPayload.fields!,
            LeadImportField.EXPECTED_CLOSE_DATE,
          ),
        );

        const existingLeadId = await this.findExistingLead(
          title,
          contactData.email,
        );

        const leadData: Prisma.LeadCreateInput = {
          title,
          description:
            this.extractValue(
              row,
              mappingPayload.fields!,
              LeadImportField.DESCRIPTION,
            ) ?? null,
          status,
          value:
            value !== null ? new Prisma.Decimal(value.toFixed(2)) : undefined,
          probability:
            probability !== null ? Math.min(Math.max(probability, 0), 100) : undefined,
          source:
            this.extractValue(
              row,
              mappingPayload.fields!,
              LeadImportField.SOURCE,
            ) ?? null,
          expectedCloseDate: expectedCloseDate ?? undefined,
          contact: {
            connect: { id: contactId },
          },
          assignedTo: ownerId ? { connect: { id: ownerId } } : undefined,
          convertedCustomer: customerId
            ? { connect: { id: customerId } }
            : undefined,
        };

        if (existingLeadId) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            if (summary.errors.length < errorLimit) {
              summary.errors.push({
                row: rowNumber,
                message:
                  'Lead already exists and updateExisting option is disabled.',
              });
            }
            return;
          }

          await this.prisma.lead.update({
            where: { id: existingLeadId },
            data: {
              title: leadData.title,
              description: leadData.description ?? undefined,
              status: leadData.status,
              value:
                value !== null
                  ? new Prisma.Decimal(value.toFixed(2))
                  : undefined,
              probability:
                probability !== null
                  ? Math.min(Math.max(probability, 0), 100)
                  : undefined,
              source: leadData.source ?? undefined,
              expectedCloseDate: expectedCloseDate ?? undefined,
              assignedTo: ownerId
                ? { connect: { id: ownerId } }
                : { disconnect: true },
              convertedCustomer: customerId
                ? { connect: { id: customerId } }
                : { disconnect: true },
            },
          });

          summary.updatedCount += 1;
        } else {
          await this.prisma.lead.create({
            data: leadData,
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



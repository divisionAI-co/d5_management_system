import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportStatus, Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { parseSpreadsheet } from '../../../common/utils/spreadsheet-parser';
import { validateFileUpload } from '../../../common/config/multer.config';
import { sanitizeFilename } from '../../../common/utils/file-sanitizer';
import { ExecuteContactImportDto } from './dto/execute-contact-import.dto';
import {
  ContactImportField,
  ContactMapImportDto,
  ContactFieldMappingEntry,
} from './dto/contact-map-import.dto';
import { generateInitialMappings } from '../utils/field-mapping.util';

export interface ContactUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: ContactImportFieldMetadata[];
  suggestedMappings?: Array<{ sourceColumn: string; targetField: string }>;
}

export interface ContactImportFieldMetadata {
  key: ContactImportField;
  label: string;
  description: string;
  required: boolean;
}

export interface ContactImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

type ContactFieldMapping = Partial<Record<ContactImportField, string>>;

const CONTACT_FIELD_DEFINITIONS: ContactImportFieldMetadata[] = [
  {
    key: ContactImportField.EMAIL,
    label: 'Email',
    description: 'Primary email address (required, used for matching)',
    required: true,
  },
  {
    key: ContactImportField.FIRST_NAME,
    label: 'First Name',
    description: 'First name of the contact',
    required: false,
  },
  {
    key: ContactImportField.LAST_NAME,
    label: 'Last Name',
    description: 'Last name of the contact',
    required: false,
  },
  {
    key: ContactImportField.FULL_NAME,
    label: 'Full Name',
    description:
      'Full name (will be split into first and last when individual names are not provided)',
    required: false,
  },
  {
    key: ContactImportField.PHONE,
    label: 'Phone',
    description: 'Primary phone number',
    required: false,
  },
  {
    key: ContactImportField.ROLE,
    label: 'Role / Title',
    description: 'Role or title of the contact',
    required: false,
  },
  {
    key: ContactImportField.COMPANY_NAME,
    label: 'Company Name',
    description: 'Company associated with the contact',
    required: false,
  },
  {
    key: ContactImportField.LINKEDIN_URL,
    label: 'LinkedIn URL',
    description: 'LinkedIn profile URL',
    required: false,
  },
  {
    key: ContactImportField.NOTES,
    label: 'Notes',
    description: 'Internal notes about the contact',
    required: false,
  },
  {
    key: ContactImportField.CUSTOMER_NAME,
    label: 'Customer Name',
    description:
      'Existing customer to associate (matched by name, case-insensitive).',
    required: false,
  },
];

@Injectable()
export class ContactsImportService {
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

  async uploadContactsImport(
    file: Express.Multer.File,
  ): Promise<ContactUploadResult> {
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
        type: 'contacts',
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

    // Generate suggested mappings based on column name similarity
    const suggestedMappings = generateInitialMappings(
      parsed.headers,
      CONTACT_FIELD_DEFINITIONS,
      0.3, // Minimum confidence threshold
    );

    return {
      id: importRecord.id,
      type: 'contacts',
      fileName: file.originalname,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: CONTACT_FIELD_DEFINITIONS,
      suggestedMappings,
    };
  }

  async listContactsImports() {
    return this.prisma.dataImport.findMany({
      where: { type: 'contacts' },
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

  async getContactsImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });
    if (!importRecord || importRecord.type !== 'contacts') {
      throw new NotFoundException('Import not found');
    }

    return {
      ...importRecord,
      availableFields: CONTACT_FIELD_DEFINITIONS,
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
    mappings: ContactFieldMappingEntry[],
  ): ContactFieldMapping {
    const uniqueHeaders = new Set(headers.map((header) => header.trim()));
    const fieldMapping: ContactFieldMapping = {};

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

    if (!fieldMapping[ContactImportField.EMAIL]) {
      throw new BadRequestException(
        'Email must be mapped in order to import contacts.',
      );
    }

    return fieldMapping;
  }

  async saveContactsMapping(id: string, dto: ContactMapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'contacts') {
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

  private extractValue(
    row: Record<string, string>,
    mapping: ContactFieldMapping,
    key: ContactImportField,
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
    mapping: ContactFieldMapping,
  ) {
    const email = this.extractValue(row, mapping, ContactImportField.EMAIL);
    if (!email) {
      throw new BadRequestException('Email is required for each contact row.');
    }

    let firstName =
      this.extractValue(row, mapping, ContactImportField.FIRST_NAME) ?? '';
    let lastName =
      this.extractValue(row, mapping, ContactImportField.LAST_NAME) ?? '';

    if (!firstName || !lastName) {
      const fullName = this.extractValue(
        row,
        mapping,
        ContactImportField.FULL_NAME,
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
        this.extractValue(row, mapping, ContactImportField.PHONE) ?? undefined,
      role:
        this.extractValue(row, mapping, ContactImportField.ROLE) ?? undefined,
      companyName:
        this.extractValue(row, mapping, ContactImportField.COMPANY_NAME) ??
        undefined,
      linkedinUrl:
        this.extractValue(row, mapping, ContactImportField.LINKEDIN_URL) ??
        undefined,
      notes:
        this.extractValue(row, mapping, ContactImportField.NOTES) ?? undefined,
      customerName:
        this.extractValue(row, mapping, ContactImportField.CUSTOMER_NAME) ??
        undefined,
    };
  }

  private async ensureDefaultCustomer(defaultCustomerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: defaultCustomerId },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException(
        'Default customer ID provided does not exist.',
      );
    }
  }

  async executeContactsImport(
    id: string,
    dto: ExecuteContactImportDto,
  ): Promise<ContactImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'contacts') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: ContactFieldMapping;
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

    const buffer = await this.readImportFile(importRecord);
    const parsed = await parseSpreadsheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const updateExisting = dto.updateExisting ?? true;
    const defaultCustomerId = dto.defaultCustomerId ?? null;
    const customerCache = new Map<string, string | null>();

    await this.prisma.dataImport.update({
      where: { id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const summary: ContactImportSummary = {
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
        const data = this.buildContactData(row, mappingPayload.fields!);
        let customerId: string | null = null;

        if (data.customerName) {
          customerId = await this.resolveCustomerByName(
            data.customerName,
            customerCache,
          );
        }

        if (!customerId && defaultCustomerId) {
          customerId = defaultCustomerId;
        }

        const contactData: Prisma.ContactCreateInput = {
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone ?? null,
          role: data.role ?? null,
          companyName: data.companyName ?? null,
          linkedinUrl: data.linkedinUrl ?? null,
          notes: data.notes ?? null,
          customer: customerId ? { connect: { id: customerId } } : undefined,
        };

        const existing = await this.prisma.contact.findUnique({
          where: { email: data.email },
          select: { id: true },
        });

        if (existing) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            if (summary.errors.length < errorLimit) {
              summary.errors.push({
                row: rowNumber,
                message:
                  'Contact already exists and updateExisting option is disabled.',
              });
            }
            return;
          }

          await this.prisma.contact.update({
            where: { id: existing.id },
            data: {
              firstName: contactData.firstName,
              lastName: contactData.lastName,
              phone: contactData.phone ?? undefined,
              role: contactData.role ?? undefined,
              companyName: contactData.companyName ?? undefined,
              linkedinUrl: contactData.linkedinUrl ?? undefined,
              notes: contactData.notes ?? undefined,
              customer: customerId
                ? { connect: { id: customerId } }
                : { disconnect: true },
            },
          });

          summary.updatedCount += 1;
        } else {
          await this.prisma.contact.create({
            data: contactData,
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



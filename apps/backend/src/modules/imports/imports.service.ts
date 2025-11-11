import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CustomerType, DataImport, ImportStatus, LeadStatus, Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ExecuteImportDto } from './dto/execute-import.dto';
import {
  ContactImportField,
  LeadImportField,
  OpportunityImportField,
  MapImportDto,
  FieldMappingEntry,
} from './dto/map-import.dto';

type ContactFieldMapping = Partial<Record<ContactImportField, string>>;
type LeadFieldMapping = Partial<Record<LeadImportField, string>>;
type OpportunityFieldMapping = Partial<Record<OpportunityImportField, string>>;

export type ImportType = 'contacts' | 'leads' | 'opportunities';

export interface UploadImportResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: ImportFieldMetadata[];
}

export interface ImportFieldMetadata {
  key: string;
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

interface ParsedSheet {
  headers: string[];
  rows: Record<string, any>[];
}

const CONTACT_FIELD_DEFINITIONS: ImportFieldMetadata[] = [
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

const LEAD_FIELD_DEFINITIONS: ImportFieldMetadata[] = [
  {
    key: LeadImportField.TITLE,
    label: 'Lead Title',
    description: 'Title or subject of the lead (required)',
    required: true,
  },
  {
    key: LeadImportField.CONTACT_EMAIL,
    label: 'Contact Email',
    description: 'Email address of the associated contact (required)',
    required: true,
  },
  {
    key: LeadImportField.CONTACT_FIRST_NAME,
    label: 'Contact First Name',
    description: 'First name of the associated contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_LAST_NAME,
    label: 'Contact Last Name',
    description: 'Last name of the associated contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_FULL_NAME,
    label: 'Contact Full Name',
    description:
      'Full name of the contact (used if first/last name not supplied separately)',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_PHONE,
    label: 'Contact Phone',
    description: 'Phone number for the contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_ROLE,
    label: 'Contact Role / Title',
    description: 'Role or title of the contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_COMPANY_NAME,
    label: 'Contact Company Name',
    description: 'Company associated with the contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_LINKEDIN_URL,
    label: 'Contact LinkedIn URL',
    description: 'LinkedIn profile URL of the contact',
    required: false,
  },
  {
    key: LeadImportField.CONTACT_NOTES,
    label: 'Contact Notes',
    description: 'Internal notes about the contact',
    required: false,
  },
  {
    key: LeadImportField.CUSTOMER_NAME,
    label: 'Customer Name',
    description:
      'Existing customer to associate (matched by name, case-insensitive)',
    required: false,
  },
  {
    key: LeadImportField.STATUS,
    label: 'Lead Status',
    description: 'Status of the lead (e.g. NEW, QUALIFIED, WON, LOST)',
    required: false,
  },
  {
    key: LeadImportField.DESCRIPTION,
    label: 'Lead Description',
    description: 'Description or notes for the lead',
    required: false,
  },
  {
    key: LeadImportField.VALUE,
    label: 'Lead Value',
    description: 'Potential value of the lead (numeric)',
    required: false,
  },
  {
    key: LeadImportField.PROBABILITY,
    label: 'Lead Probability',
    description: 'Probability (%) of closing the lead',
    required: false,
  },
  {
    key: LeadImportField.SOURCE,
    label: 'Lead Source',
    description: 'Source of the lead (e.g. Website, Referral)',
    required: false,
  },
  {
    key: LeadImportField.EXPECTED_CLOSE_DATE,
    label: 'Expected Close Date',
    description: 'Expected close date for the lead',
    required: false,
  },
  {
    key: LeadImportField.ASSIGNED_TO_EMAIL,
    label: 'Assigned To (User Email)',
    description: 'Email of the user who should own the lead',
    required: false,
  },
];

const OPPORTUNITY_FIELD_DEFINITIONS: ImportFieldMetadata[] = [
  {
    key: OpportunityImportField.OPPORTUNITY_TITLE,
    label: 'Opportunity Title',
    description: 'Title or subject of the opportunity (required)',
    required: true,
  },
  {
    key: OpportunityImportField.CONTACT_EMAIL,
    label: 'Contact Email',
    description: 'Email address of the associated contact (required)',
    required: true,
  },
  {
    key: OpportunityImportField.CUSTOMER_NAME,
    label: 'Customer Name',
    description:
      'Existing customer to associate (matched by name, case-insensitive)',
    required: false,
  },
  {
    key: OpportunityImportField.OPPORTUNITY_VALUE,
    label: 'Opportunity Value',
    description: 'Value of the opportunity (numeric)',
    required: false,
  },
  {
    key: OpportunityImportField.OPPORTUNITY_TYPE,
    label: 'Opportunity Type',
    description: 'Type of the opportunity (Staff Augmentation, Software Subscription, Hybrid)',
    required: false,
  },
  {
    key: OpportunityImportField.OPPORTUNITY_STAGE,
    label: 'Opportunity Stage',
    description: 'Pipeline stage (e.g. Prospecting, Negotiation, Closed Won)',
    required: false,
  },
  {
    key: OpportunityImportField.OPPORTUNITY_DESCRIPTION,
    label: 'Opportunity Description',
    description: 'Description or notes about the opportunity',
    required: false,
  },
  {
    key: OpportunityImportField.OPPORTUNITY_ASSIGNED_TO_EMAIL,
    label: 'Opportunity Owner (User Email)',
    description: 'Email of the user who should own the opportunity',
    required: false,
  },
  {
    key: OpportunityImportField.OPPORTUNITY_IS_WON,
    label: 'Is Won',
    description: 'Mark opportunity as won (true/false)',
    required: false,
  },
  {
    key: OpportunityImportField.OPPORTUNITY_IS_CLOSED,
    label: 'Is Closed',
    description: 'Mark opportunity as closed (true/false)',
    required: false,
  },
  {
    key: OpportunityImportField.OPPORTUNITY_JOB_DESCRIPTION_URL,
    label: 'Job Description URL',
    description: 'Link to the job description or scope document',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_TITLE,
    label: 'Lead Title',
    description: 'Lead title to associate (defaults to opportunity title when omitted)',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_STATUS,
    label: 'Lead Status',
    description: 'Lead status (NEW, QUALIFIED, WON, LOST, etc.)',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_DESCRIPTION,
    label: 'Lead Description',
    description: 'Description or notes for the lead',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_VALUE,
    label: 'Lead Value',
    description: 'Potential value of the lead (numeric)',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_PROBABILITY,
    label: 'Lead Probability',
    description: 'Probability (%) of closing the lead',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_SOURCE,
    label: 'Lead Source',
    description: 'Source of the lead (Website, Referral, etc.)',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_EXPECTED_CLOSE_DATE,
    label: 'Lead Expected Close Date',
    description: 'Expected close date for the lead',
    required: false,
  },
  {
    key: OpportunityImportField.LEAD_ASSIGNED_TO_EMAIL,
    label: 'Lead Owner (User Email)',
    description: 'Email of the user who should own the lead',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_FIRST_NAME,
    label: 'Contact First Name',
    description: 'First name of the associated contact',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_LAST_NAME,
    label: 'Contact Last Name',
    description: 'Last name of the associated contact',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_FULL_NAME,
    label: 'Contact Full Name',
    description:
      'Full name of the contact (used if first/last names are not supplied)',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_PHONE,
    label: 'Contact Phone',
    description: 'Phone number for the contact',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_ROLE,
    label: 'Contact Role / Title',
    description: 'Role or title of the contact',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_COMPANY_NAME,
    label: 'Contact Company Name',
    description: 'Company associated with the contact',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_LINKEDIN_URL,
    label: 'Contact LinkedIn URL',
    description: 'LinkedIn profile URL of the contact',
    required: false,
  },
  {
    key: OpportunityImportField.CONTACT_NOTES,
    label: 'Contact Notes',
    description: 'Internal notes about the contact',
    required: false,
  },
];

@Injectable()
export class ImportsService {
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

  private assertSupportedType(type: string): asserts type is ImportType {
    if (type !== 'contacts' && type !== 'leads' && type !== 'opportunities') {
      throw new BadRequestException(
        `Unsupported import type "${type}". Supported types are contacts, leads, and opportunities.`,
      );
    }
  }

  private getFieldDefinitions(type: ImportType) {
    switch (type) {
      case 'leads':
        return LEAD_FIELD_DEFINITIONS;
      case 'opportunities':
        return OPPORTUNITY_FIELD_DEFINITIONS;
      case 'contacts':
      default:
        return CONTACT_FIELD_DEFINITIONS;
    }
  }

  private parseSheet(buffer: Buffer): ParsedSheet {
    const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new BadRequestException('Uploaded file does not contain any data.');
    }

    const sheet = workbook.Sheets[sheetName];
    const headerRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    }) as unknown as string[][];

    const headers =
      headerRows?.[0]?.map((header) =>
        header !== undefined && header !== null
          ? String(header).trim()
          : '',
      ) ?? [];

    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
      raw: false,
      defval: '',
      blankrows: false,
    });

    return { headers, rows };
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

  async uploadImport(
    type: ImportType,
    file: Express.Multer.File,
  ): Promise<UploadImportResult> {
    this.assertSupportedType(type);

    if (!file) {
      throw new BadRequestException('A CSV file must be provided.');
    }

    if (!file.originalname.toLowerCase().endsWith('.csv')) {
      throw new BadRequestException(
        'Only CSV files exported from Odoo are supported.',
      );
    }

    const parsed = this.parseSheet(file.buffer);
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
    const storageName = `${Date.now()}_${randomUUID()}.csv`;
    const storagePath = path.join(this.uploadDir, storageName);
    await fs.writeFile(storagePath, file.buffer);

    const importRecord = await this.prisma.dataImport.create({
      data: {
        type,
        fileName: file.originalname,
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

    return {
      id: importRecord.id,
      type,
      fileName: file.originalname,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: this.getFieldDefinitions(type),
    };
  }

  async listImports(type: ImportType = 'contacts') {
    this.assertSupportedType(type);
    return this.prisma.dataImport.findMany({
      where: { type },
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

  async getImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });
    if (!importRecord) {
      throw new NotFoundException('Import not found');
    }
    this.assertSupportedType(importRecord.type);

    return {
      ...importRecord,
      availableFields: this.getFieldDefinitions(importRecord.type),
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
    type: ImportType,
    headers: string[],
    mappings: FieldMappingEntry[],
  ) {
    const uniqueHeaders = new Set(headers.map((header) => header.trim()));
    const fieldDefinitions = this.getFieldDefinitions(type);
    const allowedFields = new Set(fieldDefinitions.map((field) => field.key));
    const fieldMapping: Record<string, string> = {};

    mappings.forEach((entry) => {
      const source = entry.sourceColumn.trim();
      if (!uniqueHeaders.has(source)) {
        throw new BadRequestException(
          `Column "${entry.sourceColumn}" does not exist in the uploaded file.`,
        );
      }

      const targetField = entry.targetField;
      if (!allowedFields.has(targetField)) {
        throw new BadRequestException(
          `Field "${entry.targetField}" is not a valid mapping option for ${type} imports.`,
        );
      }

      if (fieldMapping[targetField]) {
        throw new BadRequestException(
          `Field "${entry.targetField}" has been mapped more than once.`,
        );
      }

      fieldMapping[targetField] = source;
    });

    fieldDefinitions
      .filter((field) => field.required)
      .forEach((field) => {
        if (!fieldMapping[field.key]) {
          throw new BadRequestException(
            `Field "${field.label}" must be mapped in order to import ${type}.`,
          );
        }
      });

    return fieldMapping;
  }

  async saveMapping(id: string, dto: MapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord) {
      throw new NotFoundException('Import not found');
    }
    this.assertSupportedType(importRecord.type);

    const buffer = await this.readImportFile(importRecord);
    const parsed = this.parseSheet(buffer);

    const mapping = this.validateMapping(
      importRecord.type,
      parsed.headers,
      dto.mappings,
    );

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

  private extractValue<TField extends string>(
    row: Record<string, string>,
    mapping: Partial<Record<TField, string>>,
    key: TField,
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

  async executeImport(
    id: string,
    dto: ExecuteImportDto,
  ): Promise<ContactImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord) {
      throw new NotFoundException('Import not found');
    }

    this.assertSupportedType(importRecord.type);

    switch (importRecord.type) {
      case 'contacts':
        return this.executeContactsImport(importRecord, dto);
      case 'opportunities':
        return this.executeOpportunitiesImport(importRecord, dto);
      case 'leads':
      default:
        return this.executeLeadsImport(importRecord, dto);
    }
  }

  private async executeContactsImport(
    importRecord: DataImport,
    dto: ExecuteImportDto,
  ): Promise<ContactImportSummary> {
    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: Record<string, string>;
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
    const parsed = this.parseSheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const updateExisting = dto.updateExisting ?? true;
    const defaultCustomerId = dto.defaultCustomerId ?? null;
    const customerCache = new Map<string, string | null>();
    const fieldMapping = mappingPayload.fields as ContactFieldMapping;

    await this.prisma.dataImport.update({
      where: { id: importRecord.id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const summary: ContactImportSummary = {
      importId: importRecord.id,
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
        const data = this.buildContactData(row, fieldMapping);
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
        where: { id: importRecord.id },
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
        where: { id: importRecord.id },
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

  private parseBoolean(value?: string) {
    if (value === undefined) {
      return undefined;
    }
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
    return undefined;
  }

  private parseCustomerType(value?: string) {
    if (!value) {
      return undefined;
    }
    const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');
    if ((Object.values(CustomerType) as string[]).includes(normalized)) {
      return normalized as CustomerType;
    }
    if (normalized === 'HYBRID') {
      return CustomerType.BOTH;
    }
    return undefined;
  }

  private parseNumeric(value?: string) {
    if (!value) {
      return undefined;
    }
    const normalized = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    const parsed = Number(normalized);
    if (Number.isNaN(parsed)) {
      return undefined;
    }
    return parsed;
  }

  private async executeLeadsImport(
    importRecord: DataImport,
    dto: ExecuteImportDto,
  ): Promise<ContactImportSummary> {
    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: Record<string, string>;
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
    const parsed = this.parseSheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const updateExisting = dto.updateExisting ?? true;
    const defaultCustomerId = dto.defaultCustomerId ?? null;
    const customerCache = new Map<string, string | null>();
    const userCache = new Map<string, string | null>();
    const fieldMapping = mappingPayload.fields as LeadFieldMapping;

    await this.prisma.dataImport.update({
      where: { id: importRecord.id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const summary: ContactImportSummary = {
      importId: importRecord.id,
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
        const leadTitleRaw = this.extractValue(
          row,
          fieldMapping,
          LeadImportField.TITLE,
        );
        const leadTitle = leadTitleRaw?.trim();
        const contactEmailRaw = this.extractValue(
          row,
          fieldMapping,
          LeadImportField.CONTACT_EMAIL,
        );

        if (!leadTitle) {
          throw new BadRequestException('Lead title is required.');
        }
        if (!contactEmailRaw) {
          throw new BadRequestException('Contact email is required.');
        }

        const contactEmail = contactEmailRaw.trim().toLowerCase();
        if (!contactEmail) {
          throw new BadRequestException('Contact email is required.');
        }
        const customerName = this.extractValue(
          row,
          fieldMapping,
          LeadImportField.CUSTOMER_NAME,
        );

        let customerId: string | null = null;
        if (customerName) {
          customerId = await this.resolveCustomerByName(
            customerName,
            customerCache,
          );
        }
        if (!customerId && defaultCustomerId) {
          customerId = defaultCustomerId;
        }

        const firstName =
          this.extractValue(
            row,
            fieldMapping,
            LeadImportField.CONTACT_FIRST_NAME,
          ) ?? '';
        const lastName =
          this.extractValue(
            row,
            fieldMapping,
            LeadImportField.CONTACT_LAST_NAME,
          ) ?? '';

        let resolvedFirstName = firstName.trim();
        let resolvedLastName = lastName.trim();

        if (!resolvedFirstName || !resolvedLastName) {
          const fullName = this.extractValue(
            row,
            fieldMapping,
            LeadImportField.CONTACT_FULL_NAME,
          );
          if (fullName) {
            const split = this.splitFullName(fullName);
            if (!resolvedFirstName && split.firstName) {
              resolvedFirstName = split.firstName;
            }
            if (!resolvedLastName && split.lastName) {
              resolvedLastName = split.lastName;
            }
          }
        }

        if (!resolvedFirstName) {
          resolvedFirstName = 'Unknown';
        }
        if (!resolvedLastName) {
          resolvedLastName = 'Contact';
        }

        const contactData: Prisma.ContactCreateInput = {
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          email: contactEmail,
          phone:
            this.extractValue(
              row,
              fieldMapping,
              LeadImportField.CONTACT_PHONE,
            ) ?? null,
          role:
            this.extractValue(row, fieldMapping, LeadImportField.CONTACT_ROLE) ??
            null,
          companyName:
            this.extractValue(
              row,
              fieldMapping,
              LeadImportField.CONTACT_COMPANY_NAME,
            ) ?? null,
          linkedinUrl:
            this.extractValue(
              row,
              fieldMapping,
              LeadImportField.CONTACT_LINKEDIN_URL,
            ) ?? null,
          notes:
            this.extractValue(
              row,
              fieldMapping,
              LeadImportField.CONTACT_NOTES,
            ) ?? null,
          customer: customerId ? { connect: { id: customerId } } : undefined,
        };

        const existingContact = await this.prisma.contact.findUnique({
          where: { email: contactEmail },
        });

        let contactId: string;

        if (existingContact) {
          contactId = existingContact.id;

          if (updateExisting) {
            await this.prisma.contact.update({
              where: { id: existingContact.id },
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
                  : customerId === null
                  ? { disconnect: true }
                  : undefined,
              },
            });
          }
        } else {
          const newContact = await this.prisma.contact.create({
            data: contactData,
          });
          contactId = newContact.id;
        }

        const assignedToEmail = this.extractValue(
          row,
          fieldMapping,
          LeadImportField.ASSIGNED_TO_EMAIL,
        );
        let assignedToId: string | null = null;
        if (assignedToEmail) {
          const normalized = assignedToEmail.trim().toLowerCase();
          if (userCache.has(normalized)) {
            assignedToId = userCache.get(normalized) ?? null;
          } else {
            const user = await this.prisma.user.findUnique({
              where: { email: normalized },
              select: { id: true },
            });
            assignedToId = user?.id ?? null;
            userCache.set(normalized, assignedToId);
          }
        }

        const statusRaw = this.extractValue(
          row,
          fieldMapping,
          LeadImportField.STATUS,
        );
        let status: LeadStatus = LeadStatus.NEW;
        if (statusRaw) {
          const normalizedStatus = statusRaw.trim().toUpperCase();
          if ((Object.values(LeadStatus) as string[]).includes(normalizedStatus)) {
            status = normalizedStatus as LeadStatus;
          }
        }

        const valueRaw = this.extractValue(
          row,
          fieldMapping,
          LeadImportField.VALUE,
        );
        const probabilityRaw = this.extractValue(
          row,
          fieldMapping,
          LeadImportField.PROBABILITY,
        );
        const expectedCloseRaw = this.extractValue(
          row,
          fieldMapping,
          LeadImportField.EXPECTED_CLOSE_DATE,
        );

        const parsedValue = this.parseNumeric(valueRaw);
        let parsedProbability: number | undefined;
        if (probabilityRaw) {
          const probability = Number(
            probabilityRaw.replace(/[^0-9.-]/g, ''),
          );
          if (!Number.isNaN(probability)) {
            parsedProbability = Math.max(
              0,
              Math.min(100, Math.round(probability)),
            );
          }
        }

        let expectedCloseDate: Date | undefined;
        if (expectedCloseRaw) {
          const date = new Date(expectedCloseRaw);
          if (!Number.isNaN(date.getTime())) {
            expectedCloseDate = date;
          }
        }

        const existingLead = await this.prisma.lead.findFirst({
          where: {
            contactId,
            title: leadTitle,
          },
          select: { id: true },
        });

        if (existingLead) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            if (summary.errors.length < errorLimit) {
              summary.errors.push({
                row: rowNumber,
                message:
                  'Lead already exists for this contact and updateExisting option is disabled.',
              });
            }
            return;
          }

          const leadUpdateData: Prisma.LeadUncheckedUpdateInput = {
            status,
            description:
              this.extractValue(
                row,
                fieldMapping,
                LeadImportField.DESCRIPTION,
              ) ?? undefined,
            value:
              parsedValue !== undefined
                ? new Prisma.Decimal(parsedValue)
                : undefined,
            probability: parsedProbability,
            source:
              this.extractValue(row, fieldMapping, LeadImportField.SOURCE) ??
              undefined,
            expectedCloseDate,
            assignedToId: assignedToId ?? undefined,
          };

          await this.prisma.lead.update({
            where: { id: existingLead.id },
            data: leadUpdateData,
          });

          summary.updatedCount += 1;
        } else {
          await this.prisma.lead.create({
            data: {
              contactId,
              title: leadTitle,
              status,
              description:
                this.extractValue(
                  row,
                  fieldMapping,
                  LeadImportField.DESCRIPTION,
                ) ?? null,
              value:
                parsedValue !== undefined
                  ? new Prisma.Decimal(parsedValue)
                  : null,
              probability: parsedProbability ?? null,
              source:
                this.extractValue(row, fieldMapping, LeadImportField.SOURCE) ??
                null,
              expectedCloseDate: expectedCloseDate ?? null,
              assignedToId: assignedToId ?? null,
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
        where: { id: importRecord.id },
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
        where: { id: importRecord.id },
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

  private async executeOpportunitiesImport(
    importRecord: DataImport,
    dto: ExecuteImportDto,
  ): Promise<ContactImportSummary> {
    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: Record<string, string>;
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
    const parsed = this.parseSheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const updateExisting = dto.updateExisting ?? true;
    const hasFallbackCustomer = dto.defaultCustomerId !== undefined;
    const defaultCustomerId = dto.defaultCustomerId ?? null;
    const customerCache = new Map<string, string | null>();
    const userCache = new Map<string, string | null>();
    const fieldMapping = mappingPayload.fields as OpportunityFieldMapping;

    await this.prisma.dataImport.update({
      where: { id: importRecord.id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const summary: ContactImportSummary = {
      importId: importRecord.id,
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
        const titleRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.OPPORTUNITY_TITLE,
        );
        const opportunityTitle =
          titleRaw && titleRaw.trim().length ? titleRaw.trim() : undefined;

        if (!opportunityTitle) {
          throw new BadRequestException('Opportunity title is required.');
        }

        const contactEmailRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.CONTACT_EMAIL,
        );
        const contactEmailTrimmed =
          contactEmailRaw && contactEmailRaw.trim().length
            ? contactEmailRaw.trim()
            : undefined;

        if (!contactEmailTrimmed) {
          throw new BadRequestException('Contact email is required.');
        }

        const contactEmail = contactEmailTrimmed.toLowerCase();

        const customerNameRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.CUSTOMER_NAME,
        );
        const customerName =
          customerNameRaw && customerNameRaw.trim().length
            ? customerNameRaw.trim()
            : undefined;

        let customerId: string | null | undefined = undefined;
        if (customerName !== undefined) {
          customerId = await this.resolveCustomerByName(
            customerName,
            customerCache,
          );
        } else if (hasFallbackCustomer) {
          customerId = defaultCustomerId;
        }

        const contactFirstNameRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.CONTACT_FIRST_NAME,
        );
        const contactLastNameRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.CONTACT_LAST_NAME,
        );
        const contactFullNameRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.CONTACT_FULL_NAME,
        );

        let resolvedFirstName =
          contactFirstNameRaw && contactFirstNameRaw.trim().length
            ? contactFirstNameRaw.trim()
            : '';
        let resolvedLastName =
          contactLastNameRaw && contactLastNameRaw.trim().length
            ? contactLastNameRaw.trim()
            : '';

        if (!resolvedFirstName || !resolvedLastName) {
          const fullName = contactFullNameRaw && contactFullNameRaw.trim().length
            ? contactFullNameRaw.trim()
            : undefined;
          if (fullName) {
            const split = this.splitFullName(fullName);
            if (!resolvedFirstName && split.firstName) {
              resolvedFirstName = split.firstName;
            }
            if (!resolvedLastName && split.lastName) {
              resolvedLastName = split.lastName;
            }
          }
        }

        if (!resolvedFirstName) {
          resolvedFirstName = 'Unknown';
        }
        if (!resolvedLastName) {
          resolvedLastName = 'Contact';
        }

        const contactNameProvided =
          (contactFirstNameRaw && contactFirstNameRaw.trim().length > 0) ||
          (contactLastNameRaw && contactLastNameRaw.trim().length > 0) ||
          (contactFullNameRaw && contactFullNameRaw.trim().length > 0);

        const contactData: Prisma.ContactCreateInput = {
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          email: contactEmail,
          phone:
            this.extractValue(
              row,
              fieldMapping,
              OpportunityImportField.CONTACT_PHONE,
            ) ?? null,
          role:
            this.extractValue(
              row,
              fieldMapping,
              OpportunityImportField.CONTACT_ROLE,
            ) ?? null,
          companyName:
            this.extractValue(
              row,
              fieldMapping,
              OpportunityImportField.CONTACT_COMPANY_NAME,
            ) ?? null,
          linkedinUrl:
            this.extractValue(
              row,
              fieldMapping,
              OpportunityImportField.CONTACT_LINKEDIN_URL,
            ) ?? null,
          notes:
            this.extractValue(
              row,
              fieldMapping,
              OpportunityImportField.CONTACT_NOTES,
            ) ?? null,
        };

        if (typeof customerId === 'string') {
          contactData.customer = { connect: { id: customerId } };
        }

        const existingContact = await this.prisma.contact.findUnique({
          where: { email: contactEmail },
        });

        let contactId: string;

        if (existingContact) {
          contactId = existingContact.id;

          if (updateExisting) {
            const contactUpdateData: Prisma.ContactUpdateInput = {
              phone: contactData.phone ?? undefined,
              role: contactData.role ?? undefined,
              companyName: contactData.companyName ?? undefined,
              linkedinUrl: contactData.linkedinUrl ?? undefined,
              notes: contactData.notes ?? undefined,
            };

            if (contactNameProvided) {
              contactUpdateData.firstName = resolvedFirstName;
              contactUpdateData.lastName = resolvedLastName;
            }

            if (typeof customerId === 'string') {
              contactUpdateData.customer = {
                connect: { id: customerId },
              };
            }

            await this.prisma.contact.update({
              where: { id: existingContact.id },
              data: contactUpdateData,
            });
          }
        } else {
          const newContact = await this.prisma.contact.create({
            data: contactData,
          });
          contactId = newContact.id;
        }

        const leadTitleRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.LEAD_TITLE,
        );
        const leadTitle =
          leadTitleRaw && leadTitleRaw.trim().length
            ? leadTitleRaw.trim()
            : opportunityTitle;

        const leadDescription =
          this.extractValue(
            row,
            fieldMapping,
            OpportunityImportField.LEAD_DESCRIPTION,
          ) ?? null;
        const leadStatusRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.LEAD_STATUS,
        );
        const leadStatusProvided =
          leadStatusRaw !== undefined && leadStatusRaw.trim().length > 0;
        let leadStatus: LeadStatus = LeadStatus.NEW;
        if (leadStatusRaw) {
          const normalizedStatus = leadStatusRaw.trim().toUpperCase();
          if ((Object.values(LeadStatus) as string[]).includes(normalizedStatus)) {
            leadStatus = normalizedStatus as LeadStatus;
          }
        }

        const leadValueRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.LEAD_VALUE,
        );
        const leadValueProvided =
          leadValueRaw !== undefined && leadValueRaw.length > 0;
        const leadValueNumeric = leadValueProvided
          ? this.parseNumeric(leadValueRaw)
          : undefined;

        const leadProbabilityRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.LEAD_PROBABILITY,
        );
        let leadProbability: number | undefined;
        if (leadProbabilityRaw) {
          const probability = Number(
            leadProbabilityRaw.replace(/[^0-9.-]/g, ''),
          );
          if (!Number.isNaN(probability)) {
            leadProbability = Math.max(
              0,
              Math.min(100, Math.round(probability)),
            );
          }
        }

        const leadSource =
          this.extractValue(
            row,
            fieldMapping,
            OpportunityImportField.LEAD_SOURCE,
          ) ?? null;

        const leadExpectedCloseRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.LEAD_EXPECTED_CLOSE_DATE,
        );
        let leadExpectedCloseDate: Date | null = null;
        if (leadExpectedCloseRaw) {
          const date = new Date(leadExpectedCloseRaw);
          if (!Number.isNaN(date.getTime())) {
            leadExpectedCloseDate = date;
          }
        }

        const leadAssignedEmail = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.LEAD_ASSIGNED_TO_EMAIL,
        );
        let leadAssignedToId: string | null = null;
        if (leadAssignedEmail) {
          const normalized = leadAssignedEmail.trim().toLowerCase();
          if (userCache.has(normalized)) {
            leadAssignedToId = userCache.get(normalized) ?? null;
          } else {
            const user = await this.prisma.user.findUnique({
              where: { email: normalized },
              select: { id: true },
            });
            leadAssignedToId = user?.id ?? null;
            userCache.set(normalized, leadAssignedToId);
          }
        }

        const existingLead = await this.prisma.lead.findFirst({
          where: {
            contactId,
            title: leadTitle,
          },
        });

        let leadId: string;

        if (existingLead) {
          leadId = existingLead.id;

          if (updateExisting) {
            const leadUpdateData: Prisma.LeadUncheckedUpdateInput = {
              description: leadDescription ?? undefined,
              probability: leadProbability,
              source: leadSource ?? undefined,
              expectedCloseDate: leadExpectedCloseDate ?? undefined,
              assignedToId: leadAssignedToId ?? undefined,
            };

            if (leadStatusProvided) {
              leadUpdateData.status = leadStatus;
            }
            if (leadValueProvided && leadValueNumeric !== undefined) {
              leadUpdateData.value = new Prisma.Decimal(leadValueNumeric);
            }

            await this.prisma.lead.update({
              where: { id: existingLead.id },
              data: leadUpdateData,
            });
          }
        } else {
          const newLead = await this.prisma.lead.create({
            data: {
              contactId,
              title: leadTitle,
              status: leadStatus,
              description: leadDescription,
              value:
                leadValueNumeric !== undefined
                  ? new Prisma.Decimal(leadValueNumeric)
                  : null,
              probability: leadProbability ?? null,
              source: leadSource,
              expectedCloseDate: leadExpectedCloseDate ?? null,
              assignedToId: leadAssignedToId ?? null,
            },
          });
          leadId = newLead.id;
        }

        const opportunityStageRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.OPPORTUNITY_STAGE,
        );
        const stage =
          opportunityStageRaw && opportunityStageRaw.trim().length
            ? opportunityStageRaw.trim()
            : undefined;
        const stageProvided = stage !== undefined;

        const opportunityDescriptionRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.OPPORTUNITY_DESCRIPTION,
        );
        const opportunityDescription =
          opportunityDescriptionRaw ?? null;
        const descriptionProvided = opportunityDescriptionRaw !== undefined;

        const opportunityValueRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.OPPORTUNITY_VALUE,
        );
        const valueProvided =
          opportunityValueRaw !== undefined && opportunityValueRaw.length > 0;
        const opportunityValueNumeric = valueProvided
          ? this.parseNumeric(opportunityValueRaw)
          : undefined;

        const opportunityTypeRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.OPPORTUNITY_TYPE,
        );
        const opportunityTypeParsed = this.parseCustomerType(
          opportunityTypeRaw,
        );
        const typeProvided = opportunityTypeRaw !== undefined;

        const opportunityAssignedEmail = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.OPPORTUNITY_ASSIGNED_TO_EMAIL,
        );
        let opportunityAssignedToId: string | null = null;
        if (opportunityAssignedEmail) {
          const normalized = opportunityAssignedEmail.trim().toLowerCase();
          if (userCache.has(normalized)) {
            opportunityAssignedToId = userCache.get(normalized) ?? null;
          } else {
            const user = await this.prisma.user.findUnique({
              where: { email: normalized },
              select: { id: true },
            });
            opportunityAssignedToId = user?.id ?? null;
            userCache.set(normalized, opportunityAssignedToId);
          }
        }
        const assignedToProvided = opportunityAssignedEmail !== undefined;

        const opportunityIsWonRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.OPPORTUNITY_IS_WON,
        );
        let isWon = this.parseBoolean(opportunityIsWonRaw);
        const isWonProvided =
          opportunityIsWonRaw !== undefined && opportunityIsWonRaw !== null;

        const opportunityIsClosedRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.OPPORTUNITY_IS_CLOSED,
        );
        let isClosed = this.parseBoolean(opportunityIsClosedRaw);
        const isClosedProvided =
          opportunityIsClosedRaw !== undefined &&
          opportunityIsClosedRaw !== null;

        const jobDescriptionUrlRaw = this.extractValue(
          row,
          fieldMapping,
          OpportunityImportField.OPPORTUNITY_JOB_DESCRIPTION_URL,
        );
        const jobDescriptionUrl =
          jobDescriptionUrlRaw && jobDescriptionUrlRaw.trim().length
            ? jobDescriptionUrlRaw.trim()
            : null;
        const jobDescriptionProvided = jobDescriptionUrlRaw !== undefined;

        if (stage) {
          const normalizedStage = stage.toLowerCase();
          if (normalizedStage === 'closed won') {
            isClosed = true;
            isWon = true;
          } else if (normalizedStage === 'closed lost') {
            isClosed = true;
            if (isWon === undefined) {
              isWon = false;
            }
          }
        }

        const existingOpportunity = await this.prisma.opportunity.findFirst({
          where: {
            leadId,
            title: opportunityTitle,
          },
        });

        if (existingOpportunity) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            if (summary.errors.length < errorLimit) {
              summary.errors.push({
                row: rowNumber,
                message:
                  'Opportunity already exists and updateExisting option is disabled.',
              });
            }
            return;
          }

          const updateData: Prisma.OpportunityUpdateInput = {};

          if (descriptionProvided) {
            updateData.description = opportunityDescription;
          }
          if (valueProvided && opportunityValueNumeric !== undefined) {
            updateData.value = new Prisma.Decimal(opportunityValueNumeric);
          }
          if (typeProvided && opportunityTypeParsed) {
            updateData.type = opportunityTypeParsed;
          }
          if (stageProvided && stage) {
            updateData.stage = stage;
          }
          if (isWon !== undefined) {
            updateData.isWon = isWon;
          }
          if (isClosed !== undefined) {
            updateData.isClosed = isClosed;
          }
          if (assignedToProvided) {
            updateData.assignedTo = opportunityAssignedToId
              ? { connect: { id: opportunityAssignedToId } }
              : { disconnect: true };
          }
          if (jobDescriptionProvided) {
            updateData.jobDescriptionUrl = jobDescriptionUrl;
          }
          if (customerId !== undefined) {
            updateData.customer = customerId
              ? { connect: { id: customerId } }
              : undefined;
          }

          await this.prisma.opportunity.update({
            where: { id: existingOpportunity.id },
            data: updateData,
          });

          summary.updatedCount += 1;
        } else {
          const createData: Prisma.OpportunityCreateInput = {
            title: opportunityTitle,
            description: opportunityDescription,
            value: new Prisma.Decimal(opportunityValueNumeric ?? 0),
            type:
              opportunityTypeParsed ?? CustomerType.STAFF_AUGMENTATION,
            stage: stage ?? 'Prospecting',
            isWon: isWon ?? false,
            isClosed: isClosed ?? false,
            jobDescriptionUrl,
            lead: {
              connect: { id: leadId },
            },
          };

          if (typeof customerId === 'string') {
            createData.customer = { connect: { id: customerId } };
          }

          if (opportunityAssignedToId) {
            createData.assignedTo = {
              connect: { id: opportunityAssignedToId },
            };
          }

          await this.prisma.opportunity.create({
            data: createData,
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
        where: { id: importRecord.id },
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
        where: { id: importRecord.id },
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



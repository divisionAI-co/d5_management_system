import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportStatus, InvoiceStatus, Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { parseSpreadsheet } from '../../../common/utils/spreadsheet-parser';
import { validateFileUpload } from '../../../common/config/multer.config';
import { sanitizeFilename } from '../../../common/utils/file-sanitizer';
import {
  InvoiceMapImportDto,
  InvoiceFieldMappingEntry,
  InvoiceImportField,
} from './dto/invoice-map-import.dto';
import { ExecuteInvoiceImportDto } from './dto/execute-invoice-import.dto';

export interface InvoiceUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: InvoiceImportFieldMetadata[];
}

export interface InvoiceImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

export interface InvoiceImportFieldMetadata {
  key: InvoiceImportField;
  label: string;
  description: string;
  required: boolean;
}

type InvoiceFieldMapping = Partial<Record<InvoiceImportField, string>>;

type ParsedSheet = {
  headers: string[];
  rows: Record<string, any>[];
};

const INVOICE_FIELD_DEFINITIONS: InvoiceImportFieldMetadata[] = [
  {
    key: InvoiceImportField.INVOICE_NUMBER,
    label: 'Invoice Number',
    description: 'Unique invoice number (required).',
    required: true,
  },
  {
    key: InvoiceImportField.CUSTOMER_EMAIL,
    label: 'Customer Email',
    description: 'Customer email used to match the customer record.',
    required: false,
  },
  {
    key: InvoiceImportField.CUSTOMER_NAME,
    label: 'Customer Name',
    description: 'Customer name used when email is unavailable.',
    required: false,
  },
  {
    key: InvoiceImportField.ISSUE_DATE,
    label: 'Issue Date',
    description: 'Invoice issue date (required).',
    required: true,
  },
  {
    key: InvoiceImportField.DUE_DATE,
    label: 'Due Date',
    description: 'Invoice due date (required).',
    required: true,
  },
  {
    key: InvoiceImportField.PAID_DATE,
    label: 'Paid Date',
    description: 'Date the invoice was paid (optional).',
    required: false,
  },
  {
    key: InvoiceImportField.STATUS,
    label: 'Status',
    description: 'Invoice status (DRAFT, SENT, PAID, OVERDUE, CANCELLED).',
    required: false,
  },
  {
    key: InvoiceImportField.SUBTOTAL,
    label: 'Subtotal',
    description: 'Subtotal amount before tax.',
    required: false,
  },
  {
    key: InvoiceImportField.TAX_RATE,
    label: 'Tax Rate',
    description: 'Tax rate percentage.',
    required: false,
  },
  {
    key: InvoiceImportField.TAX_AMOUNT,
    label: 'Tax Amount',
    description: 'Tax amount applied to the invoice.',
    required: false,
  },
  {
    key: InvoiceImportField.TOTAL,
    label: 'Total',
    description: 'Total amount including tax (required).',
    required: true,
  },
  {
    key: InvoiceImportField.CURRENCY,
    label: 'Currency',
    description: 'Three-letter currency code (defaults to USD).',
    required: false,
  },
  {
    key: InvoiceImportField.NOTES,
    label: 'Notes',
    description: 'Additional notes.',
    required: false,
  },
  {
    key: InvoiceImportField.ITEMS,
    label: 'Items',
    description: 'Invoice line items as JSON array or newline separated text.',
    required: false,
  },
  {
    key: InvoiceImportField.IS_RECURRING,
    label: 'Is Recurring',
    description: 'Whether the invoice is recurring (true/false).',
    required: false,
  },
  {
    key: InvoiceImportField.RECURRING_DAY,
    label: 'Recurring Day',
    description: 'Day of month for recurring invoices (1-28).',
    required: false,
  },
  {
    key: InvoiceImportField.CREATED_BY_EMAIL,
    label: 'Created By Email',
    description: 'Email of the invoice creator.',
    required: false,
  },
  {
    key: InvoiceImportField.PDF_URL,
    label: 'PDF URL',
    description: 'Link to the invoice PDF file.',
    required: false,
  },
];

@Injectable()
export class InvoicesImportService {
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

  async uploadInvoicesImport(
    file: Express.Multer.File,
  ): Promise<InvoiceUploadResult> {
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
        type: 'invoices',
        fileName: sanitizedOriginalName,
        fileUrl: storageName,
        status: ImportStatus.PENDING,
        totalRecords: sanitizedRows.length,
        successCount: 0,
        failureCount: 0,
      },
      select: { id: true },
    });

    return {
      id: importRecord.id,
      type: 'invoices',
      fileName: sanitizedOriginalName,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: INVOICE_FIELD_DEFINITIONS,
    };
  }

  async listInvoicesImports() {
    return this.prisma.dataImport.findMany({
      where: { type: 'invoices' },
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

  async getInvoicesImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'invoices') {
      throw new NotFoundException('Import not found');
    }

    return {
      ...importRecord,
      availableFields: INVOICE_FIELD_DEFINITIONS,
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
    mappings: InvoiceFieldMappingEntry[],
  ): InvoiceFieldMapping {
    const headerSet = new Set(headers.map((header) => header.trim()));
    const fieldMapping: InvoiceFieldMapping = {};

    mappings.forEach((entry) => {
      const source = entry.sourceColumn.trim();
      if (!source) {
        throw new BadRequestException(
          'Mapped source column names cannot be empty.',
        );
      }
      if (!headerSet.has(source)) {
        throw new BadRequestException(
          `The column "${source}" does not exist in the uploaded file.`,
        );
      }
      if (fieldMapping[entry.targetField]) {
        throw new BadRequestException(
          `Field "${entry.targetField}" has been mapped more than once.`,
        );
      }
      fieldMapping[entry.targetField] = source;
    });

    if (!fieldMapping[InvoiceImportField.INVOICE_NUMBER]) {
      throw new BadRequestException('Invoice number must be mapped.');
    }

    if (!fieldMapping[InvoiceImportField.ISSUE_DATE]) {
      throw new BadRequestException('Issue date must be mapped.');
    }

    if (!fieldMapping[InvoiceImportField.DUE_DATE]) {
      throw new BadRequestException('Due date must be mapped.');
    }

    if (!fieldMapping[InvoiceImportField.TOTAL]) {
      throw new BadRequestException('Total amount must be mapped.');
    }

    return fieldMapping;
  }

  async saveInvoicesMapping(id: string, dto: InvoiceMapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'invoices') {
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

  private extractValue(
    row: Record<string, string>,
    mapping: InvoiceFieldMapping,
    key: InvoiceImportField,
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

  private parseDate(value: string | undefined): Date | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `Value "${value}" is not a valid date (expected YYYY-MM-DD).`,
      );
    }
    return parsed;
  }

  private parseDateTime(value: string | undefined): Date | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `Value "${value}" is not a valid datetime (expected ISO format).`,
      );
    }
    return parsed;
  }

  private parseBoolean(value: string | undefined): boolean | undefined {
    if (!value) {
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

  private parseInteger(value: string | undefined): number | undefined {
    if (!value) {
      return undefined;
    }
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(
        `Value "${value}" is not a valid integer.`,
      );
    }
    return parsed;
  }

  private parseDecimal(value: string | undefined): Prisma.Decimal | undefined {
    if (!value) {
      return undefined;
    }
    const normalized = value.replace(/[^0-9.,-]/g, '').replace(',', '.');
    if (!normalized) {
      return undefined;
    }
    const parsed = Number(normalized);
    if (Number.isNaN(parsed)) {
      throw new BadRequestException(
        `Value "${value}" is not a valid number.`,
      );
    }
    return new Prisma.Decimal(parsed);
  }

  private parseItems(value: string | undefined): Prisma.JsonArray {
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed as Prisma.JsonArray;
      }
    } catch (error) {
      // fallback to newline separated list
    }
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return lines as Prisma.JsonArray;
  }

  private parseStatus(value: string | undefined, fallback?: InvoiceStatus): InvoiceStatus | undefined {
    if (!value) {
      return fallback;
    }
    const normalized = value.trim().toUpperCase();
    if ((Object.values(InvoiceStatus) as string[]).includes(normalized)) {
      return normalized as InvoiceStatus;
    }
    return fallback;
  }

  private async resolveCustomer(
    email: string | undefined,
    name: string | undefined,
    defaults: { email?: string; name?: string },
  ): Promise<string> {
    const lookupEmail = email?.trim().toLowerCase() || defaults.email?.trim().toLowerCase();
    const lookupName = name?.trim() || defaults.name?.trim();

    let customer = null;
    if (lookupEmail) {
      customer = await this.prisma.customer.findUnique({
        where: { email: lookupEmail },
        select: { id: true },
      });
    }

    if (!customer && lookupName) {
      customer = await this.prisma.customer.findFirst({
        where: {
          name: {
            equals: lookupName,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        select: { id: true },
      });
    }

    if (!customer) {
      throw new BadRequestException(
        'Customer could not be resolved. Provide a valid customer email or name, or configure defaults.',
      );
    }

    return customer.id;
  }

  private async resolveCreatedBy(email: string | undefined, fallback?: string): Promise<string> {
    const lookupEmail = email?.trim().toLowerCase() || fallback?.trim().toLowerCase();
    if (!lookupEmail) {
      throw new BadRequestException(
        'Invoice creator email is required either in the import file or as a default option.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: lookupEmail },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException(
        `No user found with email "${lookupEmail}" to assign as invoice creator.`,
      );
    }

    return user.id;
  }

  private buildInvoicePayload(
    row: Record<string, string>,
    mapping: InvoiceFieldMapping,
    options: {
      defaultStatus?: InvoiceStatus;
      defaultCurrency?: string;
      defaultCustomerEmail?: string;
      defaultCustomerName?: string;
      defaultCreatedByEmail?: string;
    },
  ) {
    const invoiceNumber = this.extractValue(row, mapping, InvoiceImportField.INVOICE_NUMBER);
    if (!invoiceNumber) {
      throw new BadRequestException('Invoice number is required for each row.');
    }

    const issueDateStr = this.extractValue(row, mapping, InvoiceImportField.ISSUE_DATE);
    const issueDate = this.parseDate(issueDateStr);
    if (!issueDate) {
      throw new BadRequestException('Issue date is required for each row.');
    }

    const dueDateStr = this.extractValue(row, mapping, InvoiceImportField.DUE_DATE);
    const dueDate = this.parseDate(dueDateStr);
    if (!dueDate) {
      throw new BadRequestException('Due date is required for each row.');
    }

    const total = this.parseDecimal(this.extractValue(row, mapping, InvoiceImportField.TOTAL));
    if (!total) {
      throw new BadRequestException('Total amount is required for each row.');
    }

    const subtotal = this.parseDecimal(
      this.extractValue(row, mapping, InvoiceImportField.SUBTOTAL),
    );
    const taxRate = this.parseDecimal(
      this.extractValue(row, mapping, InvoiceImportField.TAX_RATE),
    );
    const taxAmount = this.parseDecimal(
      this.extractValue(row, mapping, InvoiceImportField.TAX_AMOUNT),
    );

    const paidDate = this.parseDateTime(
      this.extractValue(row, mapping, InvoiceImportField.PAID_DATE),
    );
    const status = this.parseStatus(
      this.extractValue(row, mapping, InvoiceImportField.STATUS),
      options.defaultStatus,
    ) ?? InvoiceStatus.DRAFT;

    const currency =
      this.extractValue(row, mapping, InvoiceImportField.CURRENCY) ||
      options.defaultCurrency ||
      'USD';

    const notes = this.extractValue(row, mapping, InvoiceImportField.NOTES);
    const items = this.parseItems(
      this.extractValue(row, mapping, InvoiceImportField.ITEMS),
    );

    const isRecurring = this.parseBoolean(
      this.extractValue(row, mapping, InvoiceImportField.IS_RECURRING),
    ) ?? false;

    const recurringDay = this.parseInteger(
      this.extractValue(row, mapping, InvoiceImportField.RECURRING_DAY),
    );

    if (recurringDay !== undefined && (recurringDay < 1 || recurringDay > 28)) {
      throw new BadRequestException('Recurring day must be between 1 and 28.');
    }

    const createdByEmail = this.extractValue(
      row,
      mapping,
      InvoiceImportField.CREATED_BY_EMAIL,
    );

    const pdfUrl = this.extractValue(row, mapping, InvoiceImportField.PDF_URL);

    return {
      invoiceNumber,
      issueDate,
      dueDate,
      subtotal,
      taxRate,
      taxAmount,
      total,
      currency,
      notes,
      items,
      paidDate,
      status,
      isRecurring,
      recurringDay,
      createdByEmail,
      pdfUrl,
      customerEmail: this.extractValue(row, mapping, InvoiceImportField.CUSTOMER_EMAIL),
      customerName: this.extractValue(row, mapping, InvoiceImportField.CUSTOMER_NAME),
    };
  }

  async executeInvoicesImport(
    id: string,
    dto: ExecuteInvoiceImportDto,
  ): Promise<InvoiceImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'invoices') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: InvoiceFieldMapping;
          ignoredColumns?: string[];
        }
      | null;

    if (!mappingPayload?.fields) {
      throw new BadRequestException(
        'Field mappings must be configured before executing the import.',
      );
    }

    const buffer = await this.readImportFile(importRecord);
    const parsed = await parseSpreadsheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const options = {
      defaultStatus: dto.defaultStatus,
      defaultCurrency: dto.defaultCurrency,
      defaultCustomerEmail: dto.defaultCustomerEmail,
      defaultCustomerName: dto.defaultCustomerName,
      defaultCreatedByEmail: dto.defaultCreatedByEmail,
    };

    const updateExisting = dto.updateExisting ?? true;

    await this.prisma.dataImport.update({
      where: { id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const summary: InvoiceImportSummary = {
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
      index: number,
    ) => {
      const rowNumber = index + 2;
      try {
        const payload = this.buildInvoicePayload(row, mappingPayload.fields!, options);

        const customerId = await this.resolveCustomer(
          payload.customerEmail,
          payload.customerName,
          {
            email: options.defaultCustomerEmail,
            name: options.defaultCustomerName,
          },
        );

        const createdById = await this.resolveCreatedBy(
          payload.createdByEmail,
          options.defaultCreatedByEmail,
        );

        const existingInvoice = await this.prisma.invoice.findUnique({
          where: { invoiceNumber: payload.invoiceNumber },
        });

        if (existingInvoice) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            return;
          }

          await this.prisma.invoice.update({
            where: { invoiceNumber: payload.invoiceNumber },
            data: {
              customerId,
              issueDate: payload.issueDate,
              dueDate: payload.dueDate,
              paidDate: payload.paidDate ?? existingInvoice.paidDate,
              status: payload.status,
              subtotal: payload.subtotal ?? existingInvoice.subtotal,
              taxRate: payload.taxRate ?? existingInvoice.taxRate,
              taxAmount: payload.taxAmount ?? existingInvoice.taxAmount,
              total: payload.total,
              currency: payload.currency,
              notes: payload.notes ?? existingInvoice.notes,
              items: (payload.items.length
                ? payload.items
                : existingInvoice.items) as unknown as Prisma.InputJsonValue,
              isRecurring: payload.isRecurring,
              recurringDay: payload.recurringDay ?? existingInvoice.recurringDay,
              pdfUrl: payload.pdfUrl ?? existingInvoice.pdfUrl,
            },
          });
          summary.updatedCount += 1;
        } else {
          await this.prisma.invoice.create({
            data: {
              invoiceNumber: payload.invoiceNumber,
              customerId,
              issueDate: payload.issueDate,
              dueDate: payload.dueDate,
              paidDate: payload.paidDate ?? null,
              status: payload.status,
              subtotal: payload.subtotal ?? new Prisma.Decimal(0),
              taxRate: payload.taxRate ?? new Prisma.Decimal(0),
              taxAmount: payload.taxAmount ?? new Prisma.Decimal(0),
              total: payload.total,
              currency: payload.currency,
              notes: payload.notes ?? null,
              items: payload.items as unknown as Prisma.InputJsonValue,
              isRecurring: payload.isRecurring,
              recurringDay: payload.recurringDay ?? null,
              pdfUrl: payload.pdfUrl ?? null,
              createdById,
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

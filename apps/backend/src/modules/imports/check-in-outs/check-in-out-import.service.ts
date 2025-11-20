import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportStatus, Prisma, CheckInOutStatus } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { parseSpreadsheet } from '../../../common/utils/spreadsheet-parser';
import { validateFileUpload } from '../../../common/config/multer.config';
import { sanitizeFilename } from '../../../common/utils/file-sanitizer';
import { CheckInOutMapImportDto, CheckInOutFieldMappingEntry, CheckInOutImportField } from './dto/check-in-out-map-import.dto';
import { ExecuteCheckInOutImportDto } from './dto/execute-check-in-out-import.dto';
import {
  buildCheckInOutPayload,
  CheckInOutFieldMapping,
} from './check-in-out-import.helpers';
import { generateInitialMappings } from '../utils/field-mapping.util';

export interface CheckInOutUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: CheckInOutImportFieldMetadata[];
  suggestedMappings?: Array<{ sourceColumn: string; targetField: string }>;
}

export interface CheckInOutImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

export interface CheckInOutImportFieldMetadata {
  key: CheckInOutImportField;
  label: string;
  description: string;
  required: boolean;
}

const CHECK_IN_OUT_FIELD_DEFINITIONS: CheckInOutImportFieldMetadata[] = [
  {
    key: CheckInOutImportField.FIRST_NAME,
    label: 'First Name',
    description: 'Employee first name (required for matching).',
    required: true,
  },
  {
    key: CheckInOutImportField.LAST_NAME,
    label: 'Last Name',
    description: 'Employee last name (required for matching).',
    required: true,
  },
  {
    key: CheckInOutImportField.CARD_NUMBER,
    label: 'Card Number',
    description: 'Employee card number (optional, used for matching if provided).',
    required: false,
  },
  {
    key: CheckInOutImportField.DATE_TIME,
    label: 'Date and Time',
    description: 'Date and time of check-in/out (required, ISO format or standard date/time format).',
    required: true,
  },
  {
    key: CheckInOutImportField.STATUS,
    label: 'Status',
    description: 'Check-in/out status: "IN" or "OUT" (required). Accepts formats like "Division 5-1 In" or "Division 5-1 Out".',
    required: true,
  },
];

@Injectable()
export class CheckInOutImportService {
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

  async uploadCheckInOutImport(file: Express.Multer.File): Promise<CheckInOutUploadResult> {
    try {
      validateFileUpload(file, 10); // 10MB limit
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid file upload.',
      );
    }

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
    
    const sanitizedOriginalName = sanitizeFilename(file.originalname);
    const fileExtension = path.extname(sanitizedOriginalName) || '.xlsx';
    const storageName = `${Date.now()}_${randomUUID()}${fileExtension}`;
    const storagePath = path.join(this.uploadDir, storageName);
    await fs.writeFile(storagePath, file.buffer);

    const importRecord = await this.prisma.dataImport.create({
      data: {
        type: 'check_in_outs',
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
      CHECK_IN_OUT_FIELD_DEFINITIONS,
      0.25,
    );

    return {
      id: importRecord.id,
      type: 'check_in_outs',
      fileName: sanitizedOriginalName,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: CHECK_IN_OUT_FIELD_DEFINITIONS,
      suggestedMappings,
    };
  }

  async listCheckInOutImports() {
    return this.prisma.dataImport.findMany({
      where: { type: 'check_in_outs' },
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

  async getCheckInOutImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'check_in_outs') {
      throw new NotFoundException('Import not found');
    }

    return {
      ...importRecord,
      availableFields: CHECK_IN_OUT_FIELD_DEFINITIONS,
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
    mappings: CheckInOutFieldMappingEntry[],
  ): CheckInOutFieldMapping {
    const headerSet = new Set(headers.map((header) => header.trim()));
    const fieldMapping: CheckInOutFieldMapping = {};

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

    if (!fieldMapping[CheckInOutImportField.FIRST_NAME]) {
      throw new BadRequestException('First name must be mapped for check-in/out import.');
    }

    if (!fieldMapping[CheckInOutImportField.LAST_NAME]) {
      throw new BadRequestException('Last name must be mapped for check-in/out import.');
    }

    if (!fieldMapping[CheckInOutImportField.DATE_TIME]) {
      throw new BadRequestException('Date and time must be mapped for check-in/out import.');
    }

    if (!fieldMapping[CheckInOutImportField.STATUS]) {
      throw new BadRequestException('Status must be mapped for check-in/out import.');
    }

    return fieldMapping;
  }

  async saveCheckInOutMapping(id: string, dto: CheckInOutMapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'check_in_outs') {
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

  private async resolveEmployeeId(
    firstName: string,
    lastName: string,
    cardNumber: string | undefined,
    manualMatches?: Record<string, string>,
  ): Promise<{ employeeId: string }> {
    const normalizedFirstName = firstName.trim();
    const normalizedLastName = lastName.trim();
    const normalizedCardNumber = cardNumber?.trim();

    // Create a unique key for manual matching
    const matchKey = `${normalizedFirstName}|${normalizedLastName}${normalizedCardNumber ? `|${normalizedCardNumber}` : ''}`;

    // Check manual matches first
    if (manualMatches) {
      const manualMatch = manualMatches[matchKey] || 
                         manualMatches[`${normalizedFirstName} ${normalizedLastName}`] ||
                         (normalizedCardNumber && manualMatches[normalizedCardNumber]);
      if (manualMatch) {
        const employee = await this.prisma.employee.findUnique({
          where: { id: manualMatch },
          select: { id: true },
        });
        if (employee) {
          return { employeeId: employee.id };
        }
      }
    }

    // Try matching by card number first (most reliable)
    if (normalizedCardNumber) {
      const employeeByCard = await this.prisma.employee.findFirst({
        where: {
          cardNumber: normalizedCardNumber,
        },
        select: { id: true },
      });
      if (employeeByCard) {
        return { employeeId: employeeByCard.id };
      }
    }

    // Try matching by first name and last name
    const employeeByName = await this.prisma.employee.findFirst({
      where: {
        user: {
          firstName: { equals: normalizedFirstName, mode: Prisma.QueryMode.insensitive },
          lastName: { equals: normalizedLastName, mode: Prisma.QueryMode.insensitive },
        },
      },
      select: { id: true },
    });

    if (employeeByName) {
      return { employeeId: employeeByName.id };
    }

    throw new BadRequestException(
      `No employee found matching "${normalizedFirstName} ${normalizedLastName}"${normalizedCardNumber ? ` or card number "${normalizedCardNumber}"` : ''}. Please ensure the employee exists and matches by name or card number.`,
    );
  }

  async validateCheckInOutImport(
    id: string,
  ): Promise<{
    unmatchedEmployees: string[];
  }> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'check_in_outs') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: CheckInOutFieldMapping;
          ignoredColumns?: string[];
        }
      | null;

    if (!mappingPayload?.fields) {
      throw new BadRequestException(
        'Field mappings must be configured before validating the import.',
      );
    }

    const buffer = await this.readImportFile(importRecord);
    const parsed = await parseSpreadsheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const unmatchedEmployees = new Set<string>();
    const seenKeys = new Set<string>();

    for (const row of rows) {
      try {
        const payload = buildCheckInOutPayload(row, mappingPayload.fields!);
        const key = `${payload.firstName}|${payload.lastName}${payload.cardNumber ? `|${payload.cardNumber}` : ''}`;
        
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);

        try {
          await this.resolveEmployeeId(payload.firstName, payload.lastName, payload.cardNumber);
        } catch (error) {
          unmatchedEmployees.add(key);
        }
      } catch (error) {
        // Skip rows with invalid data during validation
      }
    }

    return {
      unmatchedEmployees: Array.from(unmatchedEmployees).sort(),
    };
  }

  async executeCheckInOutImport(
    id: string,
    dto: ExecuteCheckInOutImportDto,
    userId: string,
  ): Promise<CheckInOutImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'check_in_outs') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: CheckInOutFieldMapping;
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

    const updateExisting = dto.updateExisting ?? true;
    const manualMatches = dto.manualMatches?.employees;

    await this.prisma.dataImport.update({
      where: { id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const totalRecords = rows.length;

    let summary: CheckInOutImportSummary | null = null;
    try {
      summary = await this.processImport({
        importId: id,
        rows,
        mapping: mappingPayload.fields!,
        updateExisting,
        manualMatches,
        userId,
      });

      await this.prisma.dataImport.update({
        where: { id },
        data: {
          status: ImportStatus.COMPLETED,
          successCount: summary.createdCount + summary.updatedCount,
          failureCount: summary.failedCount,
          totalRecords,
          errors: summary.errors,
          completedAt: new Date(),
        },
      });

      return summary;
    } catch (error) {
      await this.prisma.dataImport.update({
        where: { id },
        data: {
          status: ImportStatus.FAILED,
          errors: summary?.errors ?? [],
          failureCount: summary?.failedCount ?? 0,
          totalRecords,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async processImport(params: {
    importId: string;
    rows: Record<string, string>[];
    mapping: CheckInOutFieldMapping;
    updateExisting: boolean;
    manualMatches?: Record<string, string>;
    userId: string;
  }): Promise<CheckInOutImportSummary> {
    const { importId, rows, mapping, updateExisting, manualMatches, userId } = params;

    const summary: CheckInOutImportSummary = {
      importId,
      totalRows: rows.length,
      processedRows: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      failedCount: 0,
      errors: [],
    };

    const errorLimit = 50;

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      try {
        const payload = buildCheckInOutPayload(rows[index], mapping);
        const { employeeId } = await this.resolveEmployeeId(
          payload.firstName,
          payload.lastName,
          payload.cardNumber,
          manualMatches,
        );

        // Check if record already exists (same employee, same datetime within 1 minute tolerance)
        const dateTimeStart = new Date(payload.dateTime);
        dateTimeStart.setSeconds(0, 0);
        const dateTimeEnd = new Date(payload.dateTime);
        dateTimeEnd.setSeconds(59, 999);

        const existing = await this.prisma.checkInOut.findFirst({
          where: {
            employeeId,
            dateTime: {
              gte: dateTimeStart,
              lte: dateTimeEnd,
            },
          },
        });

        if (existing) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            continue;
          }

          await this.prisma.checkInOut.update({
            where: { id: existing.id },
            data: {
              dateTime: payload.dateTime,
              status: payload.status,
              importedAt: new Date(),
              importedBy: userId,
            },
          });
          summary.updatedCount += 1;
        } else {
          await this.prisma.checkInOut.create({
            data: {
              employeeId,
              dateTime: payload.dateTime,
              status: payload.status,
              importedAt: new Date(),
              importedBy: userId,
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
    }

    return summary;
  }
}


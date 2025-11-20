import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CheckInStatus, ImportStatus, Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { parseSpreadsheet } from '../../../common/utils/spreadsheet-parser';
import { validateFileUpload } from '../../../common/config/multer.config';
import { sanitizeFilename } from '../../../common/utils/file-sanitizer';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ExecuteCheckInImportDto } from './dto/execute-check-in-import.dto';
import {
  CheckInFieldMappingEntry,
  CheckInImportField,
  CheckInMapImportDto,
} from './dto/check-in-map-import.dto';
import { generateInitialMappings } from '../utils/field-mapping.util';

export interface CheckInUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: CheckInImportFieldMetadata[];
  suggestedMappings?: Array<{ sourceColumn: string; targetField: string }>;
}

export interface CheckInImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

export interface CheckInImportFieldMetadata {
  key: CheckInImportField;
  label: string;
  description: string;
  required: boolean;
}

type CheckInFieldMapping = Partial<Record<CheckInImportField, string>>;

const CHECK_IN_FIELD_DEFINITIONS: CheckInImportFieldMetadata[] = [
  {
    key: CheckInImportField.DATETIME,
    label: 'Date & Time',
    description: 'Combined date and time of check-in/check-out (ISO 8601, YYYY-MM-DD HH:MM:SS, or similar formats).',
    required: false,
  },
  {
    key: CheckInImportField.DATE,
    label: 'Date',
    description: 'Date of check-in/check-out (YYYY-MM-DD). Required if Date & Time is not provided.',
    required: false,
  },
  {
    key: CheckInImportField.TIME,
    label: 'Time',
    description: 'Time of check-in/check-out (ISO 8601 or HH:MM:SS). Required if Date & Time is not provided.',
    required: false,
  },
  {
    key: CheckInImportField.FIRST_NAME,
    label: 'First Name',
    description: 'Employee first name.',
    required: true,
  },
  {
    key: CheckInImportField.LAST_NAME,
    label: 'Last Name',
    description: 'Employee last name.',
    required: true,
  },
  {
    key: CheckInImportField.EMPLOYEE_CARD_NUMBER,
    label: 'Employee Card Number',
    description: 'Employee card number used for check-in/check-out.',
    required: true,
  },
  {
    key: CheckInImportField.STATUS,
    label: 'Status',
    description: 'Check-in status: IN or OUT.',
    required: true,
  },
];

@Injectable()
export class CheckInsImportService {
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

  async uploadCheckInsImport(
    file: Express.Multer.File,
  ): Promise<CheckInUploadResult> {
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
    const fileExtension = path.extname(sanitizedOriginalName) || '.csv';
    const storageName = `${Date.now()}_${randomUUID()}${fileExtension}`;
    const storagePath = path.join(this.uploadDir, storageName);
    await fs.writeFile(storagePath, file.buffer);

    const importRecord = await this.prisma.dataImport.create({
      data: {
        type: 'check-ins',
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
      CHECK_IN_FIELD_DEFINITIONS,
      0.3,
    );

    return {
      id: importRecord.id,
      type: 'check-ins',
      fileName: sanitizedOriginalName,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: CHECK_IN_FIELD_DEFINITIONS,
      suggestedMappings,
    };
  }

  async listCheckInsImports() {
    return this.prisma.dataImport.findMany({
      where: { type: 'check-ins' },
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

  async getCheckInsImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'check-ins') {
      throw new NotFoundException('Import not found');
    }

    return {
      ...importRecord,
      availableFields: CHECK_IN_FIELD_DEFINITIONS,
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
    mappings: CheckInFieldMappingEntry[],
  ): CheckInFieldMapping {
    const headerSet = new Set(headers.map((header) => header.trim()));
    const fieldMapping: CheckInFieldMapping = {};

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

    // Validate required fields
    // Either DATETIME must be mapped, OR both DATE and TIME must be mapped
    const hasDateTime = !!fieldMapping[CheckInImportField.DATETIME];
    const hasDate = !!fieldMapping[CheckInImportField.DATE];
    const hasTime = !!fieldMapping[CheckInImportField.TIME];

    if (!hasDateTime && (!hasDate || !hasTime)) {
      throw new BadRequestException(
        'Either "Date & Time" must be mapped, or both "Date" and "Time" must be mapped for check-in import.',
      );
    }

    const requiredFields = [
      CheckInImportField.FIRST_NAME,
      CheckInImportField.LAST_NAME,
      CheckInImportField.EMPLOYEE_CARD_NUMBER,
      CheckInImportField.STATUS,
    ];

    for (const field of requiredFields) {
      if (!fieldMapping[field]) {
        throw new BadRequestException(
          `Field "${field}" must be mapped for check-in import.`,
        );
      }
    }

    return fieldMapping;
  }

  async saveCheckInsMapping(id: string, dto: CheckInMapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'check-ins') {
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
    mapping: CheckInFieldMapping,
    key: CheckInImportField,
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

  private parseCombinedDateTime(dateTimeValue: string): { date: Date; time: Date } {
    // Try various datetime formats
    let parsedDateTime: Date;
    
    // Try ISO 8601 format first
    parsedDateTime = new Date(dateTimeValue);
    if (Number.isNaN(parsedDateTime.getTime())) {
      // Try common formats: YYYY-MM-DD HH:MM:SS, YYYY/MM/DD HH:MM:SS, etc.
      const formats = [
        /^(\d{4})[-\/](\d{2})[-\/](\d{2})\s+(\d{2}):(\d{2}):?(\d{2})?/,
        /^(\d{2})[-\/](\d{2})[-\/](\d{4})\s+(\d{2}):(\d{2}):?(\d{2})?/,
        /^(\d{4})(\d{2})(\d{2})\s*(\d{2})(\d{2})(\d{2})?/,
      ];
      
      let matched = false;
      for (const format of formats) {
        const match = dateTimeValue.match(format);
        if (match) {
          let year: number, month: number, day: number, hour: number, minute: number, second: number;
          
          if (format === formats[0]) {
            // YYYY-MM-DD HH:MM:SS
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            day = parseInt(match[3], 10);
            hour = parseInt(match[4], 10);
            minute = parseInt(match[5], 10);
            second = match[6] ? parseInt(match[6], 10) : 0;
          } else if (format === formats[1]) {
            // DD/MM/YYYY or MM/DD/YYYY HH:MM:SS
            // Assume DD/MM/YYYY format
            day = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            year = parseInt(match[3], 10);
            hour = parseInt(match[4], 10);
            minute = parseInt(match[5], 10);
            second = match[6] ? parseInt(match[6], 10) : 0;
          } else {
            // YYYYMMDD HHMMSS
            year = parseInt(match[1], 10);
            month = parseInt(match[2], 10) - 1;
            day = parseInt(match[3], 10);
            hour = parseInt(match[4], 10);
            minute = parseInt(match[5], 10);
            second = match[6] ? parseInt(match[6], 10) : 0;
          }
          
          parsedDateTime = new Date(year, month, day, hour, minute, second);
          if (!Number.isNaN(parsedDateTime.getTime())) {
            matched = true;
            break;
          }
        }
      }
      
      if (!matched) {
        throw new BadRequestException(
          `Value "${dateTimeValue}" is not a valid date-time format. Expected formats: YYYY-MM-DD HH:MM:SS, ISO 8601, or similar.`,
        );
      }
    }

    // Extract date (set time to midnight for date field)
    const date = new Date(parsedDateTime);
    date.setHours(0, 0, 0, 0);
    
    // Time is the full datetime
    const time = parsedDateTime;

    return { date, time };
  }

  private parseDateTime(dateValue: string, timeValue: string): Date {
    // Try to parse as full ISO datetime first
    if (timeValue.includes('T') || timeValue.includes(' ')) {
      const fullDateTime = new Date(timeValue);
      if (!Number.isNaN(fullDateTime.getTime())) {
        return fullDateTime;
      }
    }

    // Otherwise combine date and time
    const date = this.parseDate(dateValue);
    if (!date) {
      throw new BadRequestException(`Invalid date: ${dateValue}`);
    }

    // Parse time (HH:MM:SS or HH:MM)
    const timeParts = timeValue.split(':');
    if (timeParts.length < 2) {
      throw new BadRequestException(`Invalid time format: ${timeValue}`);
    }

    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    const seconds = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

    if (Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds)) {
      throw new BadRequestException(`Invalid time: ${timeValue}`);
    }

    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes, seconds, 0);
    return dateTime;
  }

  private parseCheckInStatus(value: string | undefined): CheckInStatus {
    if (!value) {
      throw new BadRequestException('Status is required.');
    }
    const normalized = value.trim().toUpperCase();
    
    // Check for exact match first
    if (normalized === 'IN' || normalized === 'OUT') {
      return normalized as CheckInStatus;
    }
    
    // Try to extract IN or OUT from strings like "Division 5-1 Out" or "Division 5-1 In"
    // Look for "OUT" first (to avoid matching "IN" inside "OUT")
    if (normalized.includes('OUT')) {
      return CheckInStatus.OUT;
    }
    if (normalized.includes('IN')) {
      return CheckInStatus.IN;
    }
    
    throw new BadRequestException(
      `Invalid status "${value}". Must be IN or OUT.`,
    );
  }

  async validateCheckInsImport(
    id: string,
  ): Promise<{
    unmatchedEmployees: string[];
  }> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'check-ins') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: CheckInFieldMapping;
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
    const cardNumberCache = new Set<string>();

    for (const row of rows) {
      const employeeCardNumber = this.extractValue(
        row,
        mappingPayload.fields!,
        CheckInImportField.EMPLOYEE_CARD_NUMBER,
      );

      if (!employeeCardNumber || cardNumberCache.has(employeeCardNumber)) {
        continue;
      }

      cardNumberCache.add(employeeCardNumber);

      try {
        await this.resolveEmployeeByCardNumber(employeeCardNumber);
      } catch (error) {
        // If resolution fails, it's unmatched
        const firstName = this.extractValue(
          row,
          mappingPayload.fields!,
          CheckInImportField.FIRST_NAME,
        );
        const lastName = this.extractValue(
          row,
          mappingPayload.fields!,
          CheckInImportField.LAST_NAME,
        );
        
        // Use card number as primary identifier, fallback to name
        const identifier = employeeCardNumber || `${firstName} ${lastName}`.trim();
        if (identifier) {
          unmatchedEmployees.add(identifier);
        }
      }
    }

    return {
      unmatchedEmployees: Array.from(unmatchedEmployees).sort(),
    };
  }

  private async resolveEmployeeByCardNumber(
    cardNumber: string,
    manualMatches?: Record<string, string>,
  ): Promise<{ employeeId: string }> {
    const normalized = cardNumber.trim();

    // Check manual matches first
    if (manualMatches) {
      const manualMatch = manualMatches[normalized] || manualMatches[cardNumber];
      if (manualMatch) {
        // Verify the manual match exists
        const employee = await this.prisma.employee.findUnique({
          where: { id: manualMatch },
          select: { id: true },
        });
        if (employee) {
          return { employeeId: employee.id };
        }
        throw new BadRequestException(
          `The manually matched employee ID "${manualMatch}" does not exist.`,
        );
      }
    }

    // Try to find by card number
    const employee = await this.prisma.employee.findFirst({
      where: {
        cardNumber: normalized,
      },
      select: { id: true },
    });

    if (!employee) {
      throw new BadRequestException(
        `No employee found with card number "${cardNumber}". Ensure the employee exists and has a card number set before importing check-ins.`,
      );
    }

    return { employeeId: employee.id };
  }

  async executeCheckInsImport(
    id: string,
    dto: ExecuteCheckInImportDto,
  ): Promise<CheckInImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'check-ins') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: CheckInFieldMapping;
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

    const updateExisting = dto.updateExisting ?? false;
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

    const summary: CheckInImportSummary = {
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
      const rowNumber = index + 2; // account for header row
      try {
        // Check if we have a combined datetime field or separate date/time fields
        const dateTimeValue = this.extractValue(
          row,
          mappingPayload.fields!,
          CheckInImportField.DATETIME,
        );
        
        let date: Date;
        let time: Date;
        
        if (dateTimeValue) {
          // Use combined datetime field
          const parsed = this.parseCombinedDateTime(dateTimeValue);
          date = parsed.date;
          time = parsed.time;
        } else {
          // Use separate date and time fields
          const dateValue = this.extractValue(
            row,
            mappingPayload.fields!,
            CheckInImportField.DATE,
          );
          const timeValue = this.extractValue(
            row,
            mappingPayload.fields!,
            CheckInImportField.TIME,
          );
          
          if (!dateValue || !timeValue) {
            throw new BadRequestException('Either "Date & Time" or both "Date" and "Time" must be provided.');
          }
          
          const parsedDate = this.parseDate(dateValue);
          if (!parsedDate) {
            throw new BadRequestException(`Invalid date: ${dateValue}`);
          }
          date = parsedDate;
          time = this.parseDateTime(dateValue, timeValue);
        }
        
        const firstName = this.extractValue(
          row,
          mappingPayload.fields!,
          CheckInImportField.FIRST_NAME,
        );
        const lastName = this.extractValue(
          row,
          mappingPayload.fields!,
          CheckInImportField.LAST_NAME,
        );
        const employeeCardNumber = this.extractValue(
          row,
          mappingPayload.fields!,
          CheckInImportField.EMPLOYEE_CARD_NUMBER,
        );
        const statusValue = this.extractValue(
          row,
          mappingPayload.fields!,
          CheckInImportField.STATUS,
        );

        if (!firstName || !lastName || !employeeCardNumber || !statusValue) {
          throw new BadRequestException('All required fields must be provided.');
        }

        const status = this.parseCheckInStatus(statusValue);

        // Resolve employee using the same logic as EOD imports
        let employeeId: string;
        try {
          const resolved = await this.resolveEmployeeByCardNumber(
            employeeCardNumber,
            manualMatches,
          );
          employeeId = resolved.employeeId;
        } catch (error) {
          // If resolution fails, it's unmatched - skip this row
          summary.skippedCount += 1;
          if (summary.errors.length < errorLimit) {
            summary.errors.push({
              row: rowNumber,
              message:
                error instanceof BadRequestException
                  ? error.message
                  : `Could not match employee for card number "${employeeCardNumber}". Use manual matches to link this record.`,
            });
          }
          return; // Don't create check-in without employee link
        }

        // Check if check-in already exists (same date, time, card number, status)
        const existing = await this.prisma.employeeCheckIn.findFirst({
          where: {
            date,
            employeeId,
            status,
            time: {
              gte: new Date(time.getTime() - 60000), // 1 minute tolerance
              lte: new Date(time.getTime() + 60000),
            },
          },
        });

        if (existing) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            return;
          }

          await this.prisma.employeeCheckIn.update({
            where: { id: existing.id },
            data: {
              firstName,
              lastName,
              employeeId: employeeId,
            },
          });
          summary.updatedCount += 1;
        } else {
          await this.prisma.employeeCheckIn.create({
            data: {
              date,
              time,
              firstName,
              lastName,
              employeeCardNumber,
              status,
              employeeId: employeeId,
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


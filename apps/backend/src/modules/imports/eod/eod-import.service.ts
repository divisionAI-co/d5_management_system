import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ImportStatus, Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { EodMapImportDto, EodFieldMappingEntry, EodImportField } from './dto/eod-map-import.dto';
import { ExecuteEodImportDto } from './dto/execute-eod-import.dto';

export interface EodUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: EodImportFieldMetadata[];
}

export interface EodImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

export interface EodImportFieldMetadata {
  key: EodImportField;
  label: string;
  description: string;
  required: boolean;
}

type EodFieldMapping = Partial<Record<EodImportField, string>>;

type ParsedSheet = {
  headers: string[];
  rows: Record<string, any>[];
};

const EOD_FIELD_DEFINITIONS: EodImportFieldMetadata[] = [
  {
    key: EodImportField.EMAIL,
    label: 'Employee Email',
    description: 'Work email address used to identify the employee (required).',
    required: true,
  },
  {
    key: EodImportField.DATE,
    label: 'Report Date',
    description: 'Date of the report (required, YYYY-MM-DD).',
    required: true,
  },
  {
    key: EodImportField.SUMMARY,
    label: 'Summary',
    description: 'Daily summary content (optional when individual task rows are provided).',
    required: false,
  },
  {
    key: EodImportField.TASKS,
    label: 'Tasks Worked On',
    description:
      'Tasks detail. Accepts JSON array or newline separated text. Optional.',
    required: false,
  },
  {
    key: EodImportField.HOURS_WORKED,
    label: 'Hours Worked',
    description: 'Number of hours worked during the day. Optional.',
    required: false,
  },
  {
    key: EodImportField.SUBMITTED_AT,
    label: 'Submitted At',
    description:
      'Submitted timestamp (ISO format). If omitted, can be set during execution.',
    required: false,
  },
  {
    key: EodImportField.IS_LATE,
    label: 'Is Late',
    description: 'Whether the report was submitted late (true/false). Optional.',
    required: false,
  },
];

@Injectable()
export class EodImportService {
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

  async uploadEodImport(file: Express.Multer.File): Promise<EodUploadResult> {
    if (!file) {
      throw new BadRequestException('A spreadsheet file must be provided.');
    }

    const lower = file.originalname.toLowerCase();
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls') && !lower.endsWith('.csv')) {
      throw new BadRequestException('Only Excel or CSV files exported from Odoo are supported.');
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
    const storageName = `${Date.now()}_${randomUUID()}.xlsx`;
    const storagePath = path.join(this.uploadDir, storageName);
    await fs.writeFile(storagePath, file.buffer);

    const importRecord = await this.prisma.dataImport.create({
      data: {
        type: 'eod_reports',
        fileName: file.originalname,
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
      type: 'eod_reports',
      fileName: file.originalname,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: EOD_FIELD_DEFINITIONS,
    };
  }

  async listEodImports() {
    return this.prisma.dataImport.findMany({
      where: { type: 'eod_reports' },
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

  async getEodImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'eod_reports') {
      throw new NotFoundException('Import not found');
    }

    return {
      ...importRecord,
      availableFields: EOD_FIELD_DEFINITIONS,
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
    mappings: EodFieldMappingEntry[],
  ): EodFieldMapping {
    const headerSet = new Set(headers.map((header) => header.trim()));
    const fieldMapping: EodFieldMapping = {};

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

    if (!fieldMapping[EodImportField.EMAIL]) {
      throw new BadRequestException('Email must be mapped for EOD import.');
    }

    if (!fieldMapping[EodImportField.DATE]) {
      throw new BadRequestException('Date must be mapped for EOD import.');
    }

    return fieldMapping;
  }

  async saveEodMapping(id: string, dto: EodMapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'eod_reports') {
      throw new NotFoundException('Import not found');
    }

    const buffer = await this.readImportFile(importRecord);
    const parsed = this.parseSheet(buffer);

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
    mapping: EodFieldMapping,
    key: EodImportField,
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
        `Value "${value}" is not a valid number for hours worked.`,
      );
    }
    return new Prisma.Decimal(parsed);
  }

  private parseTasks(value: string | undefined) {
    if (!value) {
      return [] as Prisma.JsonArray;
    }
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed as Prisma.JsonArray;
      }
    } catch (error) {
      // Fallback to newline-separated text
    }
    const lines = value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return lines.length ? (lines as Prisma.JsonArray) : ([] as Prisma.JsonArray);
  }

  private async resolveUserIdByEmail(email: string): Promise<{ userId: string }> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: {
        id: true,
        employee: { select: { id: true } },
      },
    });

    if (!user || !user.employee) {
      throw new BadRequestException(
        `No employee found with email "${email}". Ensure the employee exists before importing EOD reports.`,
      );
    }

    return { userId: user.id };
  }

  private buildEodPayload(
    row: Record<string, string>,
    mapping: EodFieldMapping,
    options: {
      markMissingAsSubmitted: boolean;
      defaultIsLate: boolean;
    },
  ) {
    const email = this.extractValue(row, mapping, EodImportField.EMAIL);
    if (!email) {
      throw new BadRequestException('Email is required for each EOD row.');
    }

    const dateValue = this.extractValue(row, mapping, EodImportField.DATE);
    const reportDate = this.parseDate(dateValue);
    if (!reportDate) {
      throw new BadRequestException('Date is required for each EOD row.');
    }

    const summary = this.extractValue(row, mapping, EodImportField.SUMMARY) ?? '';

    const submittedAt =
      this.parseDateTime(this.extractValue(row, mapping, EodImportField.SUBMITTED_AT)) ??
      (options.markMissingAsSubmitted ? new Date() : undefined);

    const isLate =
      this.parseBoolean(this.extractValue(row, mapping, EodImportField.IS_LATE)) ??
      options.defaultIsLate;

    const hoursWorked = this.parseDecimal(
      this.extractValue(row, mapping, EodImportField.HOURS_WORKED),
    );

    const tasks = this.parseTasks(
      this.extractValue(row, mapping, EodImportField.TASKS),
    );

    return {
      email,
      reportDate,
      summary,
      submittedAt: submittedAt ?? null,
      isLate,
      hoursWorked,
      tasks,
    };
  }

  async executeEodImport(
    id: string,
    dto: ExecuteEodImportDto,
  ): Promise<EodImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'eod_reports') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: EodFieldMapping;
          ignoredColumns?: string[];
        }
      | null;

    if (!mappingPayload?.fields) {
      throw new BadRequestException(
        'Field mappings must be configured before executing the import.',
      );
    }

    const buffer = await this.readImportFile(importRecord);
    const parsed = this.parseSheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const updateExisting = dto.updateExisting ?? true;
    const options = {
      markMissingAsSubmitted: dto.markMissingAsSubmitted ?? false,
      defaultIsLate: dto.defaultIsLate ?? false,
    };

    await this.prisma.dataImport.update({
      where: { id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const summary: EodImportSummary = {
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

    type GroupedEodRow = {
      email: string;
      reportDate: Date;
      summaries: string[];
      tasks: Prisma.JsonArray;
      totalHours: number;
      hasHours: boolean;
      submittedAt: Date | null;
      isLate: boolean;
      rowNumbers: number[];
    };

    const grouped = new Map<string, GroupedEodRow>();

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      try {
        const payload = this.buildEodPayload(rows[index], mappingPayload.fields!, options);
        const key = `${payload.email.toLowerCase()}|${payload.reportDate
          .toISOString()
          .slice(0, 10)}`;
        const hoursValue = payload.hoursWorked
          ? parseFloat(payload.hoursWorked.toString())
          : 0;

        const summaryPart = payload.summary?.trim();

        if (grouped.has(key)) {
          const group = grouped.get(key)!;
          if (summaryPart && !group.summaries.includes(summaryPart)) {
            group.summaries.push(summaryPart);
          }
          group.tasks = [...group.tasks, ...payload.tasks];
          if (payload.hoursWorked) {
            group.totalHours += hoursValue;
            group.hasHours = true;
          }
          if (payload.submittedAt) {
            if (!group.submittedAt || payload.submittedAt < group.submittedAt) {
              group.submittedAt = payload.submittedAt;
            }
          }
          group.isLate = group.isLate || payload.isLate;
          group.rowNumbers.push(rowNumber);
        } else {
          grouped.set(key, {
            email: payload.email,
            reportDate: payload.reportDate,
            summaries: summaryPart ? [summaryPart] : [],
            tasks: [...payload.tasks],
            totalHours: payload.hoursWorked ? hoursValue : 0,
            hasHours: Boolean(payload.hoursWorked),
            submittedAt: payload.submittedAt ?? null,
            isLate: payload.isLate,
            rowNumbers: [rowNumber],
          });
        }
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

    const groupedEntries = Array.from(grouped.values());

    const processGroup = async (group: GroupedEodRow) => {
      const rowNumber = group.rowNumbers[0];
      try {
        const { userId } = await this.resolveUserIdByEmail(group.email);

        const existingReport = await this.prisma.eodReport.findUnique({
          where: {
            userId_date: {
              userId,
              date: group.reportDate,
            },
          },
        });

        const hoursWorkedDecimal = group.hasHours
          ? new Prisma.Decimal(group.totalHours)
          : undefined;

        const tasksPayload = group.tasks.length
          ? group.tasks
          : ([] as Prisma.JsonArray);

        const submittedAtValue = group.submittedAt ?? (options.markMissingAsSubmitted ? new Date() : null);

        const aggregatedSummary = group.summaries.length
          ? group.summaries.join('\n')
          : 'Imported summary';

        if (existingReport) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            return;
          }

          await this.prisma.eodReport.update({
            where: {
              userId_date: {
                userId,
                date: group.reportDate,
              },
            },
            data: {
              summary: aggregatedSummary,
              tasksWorkedOn: tasksPayload,
              hoursWorked: hoursWorkedDecimal ?? existingReport.hoursWorked,
              submittedAt: submittedAtValue ?? existingReport.submittedAt,
              isLate: group.isLate,
            },
          });
          summary.updatedCount += 1;
        } else {
          await this.prisma.eodReport.create({
            data: {
              userId,
              date: group.reportDate,
              summary: aggregatedSummary,
              tasksWorkedOn: tasksPayload,
              hoursWorked: hoursWorkedDecimal ?? null,
              submittedAt: submittedAtValue,
              isLate: group.isLate,
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
              'An unexpected error occurred while importing this group of rows.',
          });
        }
      }
    };

    try {
      for (const group of groupedEntries) {
        // eslint-disable-next-line no-await-in-loop
        await processGroup(group);
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

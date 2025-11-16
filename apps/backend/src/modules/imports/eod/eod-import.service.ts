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
import { EodMapImportDto, EodFieldMappingEntry, EodImportField } from './dto/eod-map-import.dto';
import { ExecuteEodImportDto } from './dto/execute-eod-import.dto';
import {
  buildEodPayload,
  BuildEodPayloadOptions,
  EodFieldMapping,
} from './eod-import.helpers';
import { LegacyEodImportService } from './legacy-eod-import.service';
import { generateInitialMappings } from '../utils/field-mapping.util';

export interface EodUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: EodImportFieldMetadata[];
  suggestedMappings?: Array<{ sourceColumn: string; targetField: string }>;
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
  {
    key: EodImportField.TASK_DETAILS,
    label: 'Task Details',
    description: 'Task description or client details for individual task rows (legacy format).',
    required: false,
  },
  {
    key: EodImportField.TASK_TICKET,
    label: 'Task Ticket/Reference',
    description: 'Ticket or task identifier for individual task rows (legacy format).',
    required: false,
  },
  {
    key: EodImportField.TASK_TYPE_OF_WORK,
    label: 'Task Type of Work',
    description: 'Type of work: PLANNING, RESEARCH, IMPLEMENTATION, or TESTING (legacy format). Defaults to PLANNING if not mapped.',
    required: false,
  },
  {
    key: EodImportField.TASK_ESTIMATED_TIME,
    label: 'Task Estimated Time',
    description: 'Estimated time for the task in hours (legacy format).',
    required: false,
  },
  {
    key: EodImportField.TASK_TIME_SPENT,
    label: 'Task Time Spent',
    description: 'Time spent on the task in hours (legacy format).',
    required: false,
  },
  {
    key: EodImportField.TASK_LIFECYCLE,
    label: 'Task Lifecycle',
    description: 'Task lifecycle: NEW or RETURNED (legacy format).',
    required: false,
  },
  {
    key: EodImportField.TASK_STATUS,
    label: 'Task Status',
    description: 'Task status: IN_PROGRESS or DONE (legacy format).',
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly legacyEodImportService: LegacyEodImportService,
  ) {}

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

  async uploadEodImport(file: Express.Multer.File): Promise<EodUploadResult> {
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
        type: 'eod_reports',
        fileName: sanitizedOriginalName,
        fileUrl: storageName,
        status: ImportStatus.PENDING,
        totalRecords: sanitizedRows.length,
        successCount: 0,
        failureCount: 0,
      },
      select: { id: true },
    });

    // Generate suggested mappings with lenient matching for legacy formats
    // Use lower threshold (0.25) to catch more variations like "Status" -> "Task Status"
    const suggestedMappings = generateInitialMappings(
      parsed.headers,
      EOD_FIELD_DEFINITIONS,
      0.25, // Lower threshold for fuzzy/legacy matching
    );

    return {
      id: importRecord.id,
      type: 'eod_reports',
      fileName: sanitizedOriginalName,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: EOD_FIELD_DEFINITIONS,
      suggestedMappings,
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
    const parsed = await parseSpreadsheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const updateExisting = dto.updateExisting ?? true;
    const options: BuildEodPayloadOptions = {
      markMissingAsSubmitted: dto.markMissingAsSubmitted ?? false,
      defaultIsLate: dto.defaultIsLate ?? false,
    };
    const useLegacyFormat = dto.useLegacyFormat ?? false;

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

    let summary: EodImportSummary | null = null;
    try {
      summary = useLegacyFormat
        ? await this.legacyEodImportService.processLegacyImport({
            importId: id,
            rows,
            mapping: mappingPayload.fields!,
            options,
            updateExisting,
          })
        : await this.processStandardImport({
            importId: id,
            rows,
            mapping: mappingPayload.fields!,
            options,
            updateExisting,
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

  private async processStandardImport(params: {
    importId: string;
    rows: Record<string, string>[];
    mapping: EodFieldMapping;
    options: BuildEodPayloadOptions;
    updateExisting: boolean;
  }): Promise<EodImportSummary> {
    const { importId, rows, mapping, options, updateExisting } = params;

    const summary: EodImportSummary = {
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
        const payload = buildEodPayload(rows[index], mapping, options);
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

        const submittedAtValue =
          group.submittedAt ?? (options.markMissingAsSubmitted ? new Date() : null);

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

      for (const group of groupedEntries) {
        // eslint-disable-next-line no-await-in-loop
        await processGroup(group);
    }

    return summary;
  }
}

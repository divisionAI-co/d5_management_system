import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidateStage, ImportStatus, Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';

import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  CandidateFieldMappingEntry,
  CandidateImportField,
  CandidateMapImportDto,
} from './dto/candidate-map-import.dto';
import { ExecuteCandidateImportDto } from './dto/execute-candidate-import.dto';

export interface CandidateUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: CandidateImportFieldMetadata[];
}

export interface CandidateImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

export interface CandidateImportFieldMetadata {
  key: CandidateImportField;
  label: string;
  description: string;
  required: boolean;
}

type CandidateFieldMapping = Partial<Record<CandidateImportField, string>>;

type ParsedSheet = {
  headers: string[];
  rows: Record<string, any>[];
};

const CANDIDATE_FIELD_DEFINITIONS: CandidateImportFieldMetadata[] = [
  {
    key: CandidateImportField.EMAIL,
    label: 'Email',
    description: 'Candidate primary email address (required, used for matching).',
    required: true,
  },
  {
    key: CandidateImportField.FIRST_NAME,
    label: 'First Name',
    description: 'Candidate first name (required).',
    required: true,
  },
  {
    key: CandidateImportField.LAST_NAME,
    label: 'Last Name',
    description: 'Candidate last name (required).',
    required: true,
  },
  {
    key: CandidateImportField.PHONE,
    label: 'Phone',
    description: 'Candidate phone number.',
    required: false,
  },
  {
    key: CandidateImportField.CITY,
    label: 'City',
    description: 'Candidate city.',
    required: false,
  },
  {
    key: CandidateImportField.COUNTRY,
    label: 'Country',
    description: 'Candidate country.',
    required: false,
  },
  {
    key: CandidateImportField.CURRENT_TITLE,
    label: 'Current Title',
    description: 'Current job title.',
    required: false,
  },
  {
    key: CandidateImportField.YEARS_OF_EXPERIENCE,
    label: 'Years of Experience',
    description: 'Years of professional experience.',
    required: false,
  },
  {
    key: CandidateImportField.SKILLS,
    label: 'Skills',
    description: 'Skills list (comma separated or JSON array).',
    required: false,
  },
  {
    key: CandidateImportField.RESUME_URL,
    label: 'Resume URL',
    description: 'Link to candidate resume.',
    required: false,
  },
  {
    key: CandidateImportField.LINKEDIN_URL,
    label: 'LinkedIn URL',
    description: 'LinkedIn profile URL.',
    required: false,
  },
  {
    key: CandidateImportField.GITHUB_URL,
    label: 'GitHub URL',
    description: 'GitHub profile URL.',
    required: false,
  },
  {
    key: CandidateImportField.PORTFOLIO_URL,
    label: 'Portfolio URL',
    description: 'Portfolio or website URL.',
    required: false,
  },
  {
    key: CandidateImportField.STAGE,
    label: 'Stage',
    description: 'Candidate stage (VALIDATION, CULTURAL_INTERVIEW, etc.).',
    required: false,
  },
  {
    key: CandidateImportField.RATING,
    label: 'Rating',
    description: 'Rating (1-5).',
    required: false,
  },
  {
    key: CandidateImportField.NOTES,
    label: 'Notes',
    description: 'Internal notes.',
    required: false,
  },
  {
    key: CandidateImportField.AVAILABLE_FROM,
    label: 'Available From',
    description: 'Availability date (YYYY-MM-DD).',
    required: false,
  },
  {
    key: CandidateImportField.EXPECTED_SALARY,
    label: 'Expected Salary',
    description: 'Expected salary amount.',
    required: false,
  },
  {
    key: CandidateImportField.SALARY_CURRENCY,
    label: 'Salary Currency',
    description: 'Salary currency (defaults to USD).',
    required: false,
  },
  {
    key: CandidateImportField.ODOO_ID,
    label: 'Odoo ID',
    description: 'Reference to Odoo candidate ID.',
    required: false,
  },
];

@Injectable()
export class CandidatesImportService {
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

  async uploadCandidatesImport(
    file: Express.Multer.File,
  ): Promise<CandidateUploadResult> {
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
        type: 'candidates',
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
      type: 'candidates',
      fileName: file.originalname,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: CANDIDATE_FIELD_DEFINITIONS,
    };
  }

  async listCandidatesImports() {
    return this.prisma.dataImport.findMany({
      where: { type: 'candidates' },
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

  async getCandidatesImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'candidates') {
      throw new NotFoundException('Import not found');
    }

    return {
      ...importRecord,
      availableFields: CANDIDATE_FIELD_DEFINITIONS,
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
    mappings: CandidateFieldMappingEntry[],
  ): CandidateFieldMapping {
    const headerSet = new Set(headers.map((header) => header.trim()));
    const fieldMapping: CandidateFieldMapping = {};

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

    if (!fieldMapping[CandidateImportField.EMAIL]) {
      throw new BadRequestException('Email must be mapped for candidate import.');
    }

    if (!fieldMapping[CandidateImportField.FIRST_NAME]) {
      throw new BadRequestException('First name must be mapped for candidate import.');
    }

    if (!fieldMapping[CandidateImportField.LAST_NAME]) {
      throw new BadRequestException('Last name must be mapped for candidate import.');
    }

    return fieldMapping;
  }

  async saveCandidatesMapping(id: string, dto: CandidateMapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'candidates') {
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
    mapping: CandidateFieldMapping,
    key: CandidateImportField,
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

  private parseSkills(value: string | undefined): string[] {
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);
      }
    } catch (error) {
      // ignore, fallback to comma separation
    }

    return value
      .split(/[,;\n]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private parseStage(value: string | undefined, fallback?: CandidateStage): CandidateStage | undefined {
    if (!value) {
      return fallback;
    }
    const normalized = value.trim().toUpperCase();
    if ((Object.values(CandidateStage) as string[]).includes(normalized)) {
      return normalized as CandidateStage;
    }
    return fallback;
  }

  private buildCandidatePayload(
    row: Record<string, string>,
    mapping: CandidateFieldMapping,
    options: {
      defaultStage?: CandidateStage;
      defaultSalaryCurrency?: string;
    },
  ) {
    const email = this.extractValue(row, mapping, CandidateImportField.EMAIL);
    if (!email) {
      throw new BadRequestException('Email is required for each candidate row.');
    }

    const firstName = this.extractValue(row, mapping, CandidateImportField.FIRST_NAME);
    if (!firstName) {
      throw new BadRequestException('First name is required for each candidate row.');
    }

    const lastName = this.extractValue(row, mapping, CandidateImportField.LAST_NAME);
    if (!lastName) {
      throw new BadRequestException('Last name is required for each candidate row.');
    }

    const stage = this.parseStage(
      this.extractValue(row, mapping, CandidateImportField.STAGE),
      options.defaultStage,
    ) ?? CandidateStage.VALIDATION;

    const yearsOfExperience = this.parseInteger(
      this.extractValue(row, mapping, CandidateImportField.YEARS_OF_EXPERIENCE),
    );

    const rating = this.parseInteger(
      this.extractValue(row, mapping, CandidateImportField.RATING),
    );

    const availableFrom = this.parseDate(
      this.extractValue(row, mapping, CandidateImportField.AVAILABLE_FROM),
    );

    const expectedSalary = this.parseDecimal(
      this.extractValue(row, mapping, CandidateImportField.EXPECTED_SALARY),
    );

    const skills = this.parseSkills(
      this.extractValue(row, mapping, CandidateImportField.SKILLS),
    );

    return {
      email: email.trim().toLowerCase(),
      firstName,
      lastName,
      phone: this.extractValue(row, mapping, CandidateImportField.PHONE),
      city: this.extractValue(row, mapping, CandidateImportField.CITY),
      country: this.extractValue(row, mapping, CandidateImportField.COUNTRY),
      currentTitle: this.extractValue(row, mapping, CandidateImportField.CURRENT_TITLE),
      yearsOfExperience,
      skills,
      resumeUrl: this.extractValue(row, mapping, CandidateImportField.RESUME_URL),
      linkedinUrl: this.extractValue(row, mapping, CandidateImportField.LINKEDIN_URL),
      githubUrl: this.extractValue(row, mapping, CandidateImportField.GITHUB_URL),
      portfolioUrl: this.extractValue(row, mapping, CandidateImportField.PORTFOLIO_URL),
      stage,
      rating,
      notes: this.extractValue(row, mapping, CandidateImportField.NOTES),
      availableFrom,
      expectedSalary,
      salaryCurrency:
        this.extractValue(row, mapping, CandidateImportField.SALARY_CURRENCY) ??
        options.defaultSalaryCurrency ??
        'USD',
      odooId: this.extractValue(row, mapping, CandidateImportField.ODOO_ID),
    };
  }

  async executeCandidatesImport(
    id: string,
    dto: ExecuteCandidateImportDto,
  ): Promise<CandidateImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'candidates') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: CandidateFieldMapping;
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

    const options = {
      defaultStage: dto.defaultStage,
      defaultSalaryCurrency: dto.defaultSalaryCurrency,
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

    const summary: CandidateImportSummary = {
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
        const payload = this.buildCandidatePayload(row, mappingPayload.fields!, options);

        const existingCandidate = await this.prisma.candidate.findUnique({
          where: { email: payload.email },
        });

        if (existingCandidate) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            return;
          }

          await this.prisma.candidate.update({
            where: { id: existingCandidate.id },
            data: {
              firstName: payload.firstName,
              lastName: payload.lastName,
              phone: payload.phone ?? existingCandidate.phone ?? null,
              city: payload.city ?? existingCandidate.city ?? null,
              country: payload.country ?? existingCandidate.country ?? null,
              currentTitle: payload.currentTitle ?? existingCandidate.currentTitle ?? null,
              yearsOfExperience: payload.yearsOfExperience ?? existingCandidate.yearsOfExperience ?? null,
              skills: payload.skills.length ? payload.skills : existingCandidate.skills,
              resume: payload.resumeUrl ?? existingCandidate.resume ?? null,
              linkedinUrl: payload.linkedinUrl ?? existingCandidate.linkedinUrl ?? null,
              githubUrl: payload.githubUrl ?? existingCandidate.githubUrl ?? null,
              portfolioUrl: payload.portfolioUrl ?? existingCandidate.portfolioUrl ?? null,
              stage: payload.stage,
              rating: payload.rating ?? existingCandidate.rating ?? null,
              notes: payload.notes ?? existingCandidate.notes ?? null,
              availableFrom: payload.availableFrom ?? existingCandidate.availableFrom ?? null,
              expectedSalary: payload.expectedSalary ?? existingCandidate.expectedSalary ?? null,
              salaryCurrency: payload.salaryCurrency ?? existingCandidate.salaryCurrency ?? 'USD',
              odooId: payload.odooId ?? existingCandidate.odooId ?? null,
            },
          });
          summary.updatedCount += 1;
        } else {
          await this.prisma.candidate.create({
            data: {
              firstName: payload.firstName,
              lastName: payload.lastName,
              email: payload.email,
              phone: payload.phone ?? null,
              city: payload.city ?? null,
              country: payload.country ?? null,
              currentTitle: payload.currentTitle ?? null,
              yearsOfExperience: payload.yearsOfExperience ?? null,
              skills: payload.skills,
              resume: payload.resumeUrl ?? null,
              linkedinUrl: payload.linkedinUrl ?? null,
              githubUrl: payload.githubUrl ?? null,
              portfolioUrl: payload.portfolioUrl ?? null,
              stage: payload.stage,
              rating: payload.rating ?? null,
              notes: payload.notes ?? null,
              availableFrom: payload.availableFrom ?? null,
              expectedSalary: payload.expectedSalary ?? null,
              salaryCurrency: payload.salaryCurrency ?? 'USD',
              odooId: payload.odooId ?? null,
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

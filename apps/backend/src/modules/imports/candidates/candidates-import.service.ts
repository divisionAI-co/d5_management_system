import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CandidateStage, ImportStatus, Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { parseSpreadsheet } from '../../../common/utils/spreadsheet-parser';
import { validateFileUpload } from '../../../common/config/multer.config';
import { sanitizeFilename } from '../../../common/utils/file-sanitizer';
import {
  CandidateFieldMappingEntry,
  CandidateImportField,
  CandidateMapImportDto,
} from './dto/candidate-map-import.dto';
import { ExecuteCandidateImportDto } from './dto/execute-candidate-import.dto';
import { generateInitialMappings } from '../utils/field-mapping.util';
import { OdooProcessor } from './odoo-processor.service';

export interface CandidateUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: CandidateImportFieldMetadata[];
  suggestedMappings?: Array<{ sourceColumn: string; targetField: string }>;
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
    description: 'Candidate first name (required if full name is not provided).',
    required: false,
  },
  {
    key: CandidateImportField.LAST_NAME,
    label: 'Last Name',
    description: 'Candidate last name (required if full name is not provided).',
    required: false,
  },
  {
    key: CandidateImportField.FULL_NAME,
    label: 'Full Name',
    description:
      'Full name (will be split into first and last when individual names are not provided).',
    required: false,
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
    key: CandidateImportField.JOB_POSITION,
    label: 'Job Position',
    description:
      'Name of the open position or opportunity to link this candidate to. Matches against Open Position title or Opportunity title (case-insensitive). Map Odoo’s "Job Position" column here.',
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
    description:
      'Skills list. Odoo exports as comma-separated values. Also supports semicolon, pipe, or JSON array format.',
    required: false,
  },
  {
    key: CandidateImportField.RESUME_URL,
    label: 'Resume URL',
    description:
      'Link to candidate resume. When Odoo import is enabled, Google Drive links from notes will automatically populate this field.',
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
    key: CandidateImportField.RECRUITER,
    label: 'Recruiter',
    description:
      'Recruiter responsible for the candidate. Provide the recruiter’s email or full name. Odoo exports typically include a "Recruiter" column that can be mapped here.',
    required: false,
  },
  {
    key: CandidateImportField.NOTES,
    label: 'Notes',
    description:
      'Internal notes. When Odoo import is enabled, Google Drive links will be automatically extracted and used for resume or drive folder.',
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
    key: CandidateImportField.IS_ACTIVE,
    label: 'Active',
    description:
      'Indicates whether the candidate is active (true/false). Active candidates are visible in the board by default. Inactive candidates are typically rejected or marked as inactive but retain their position links. Map Odoo\'s "Active" column here.',
    required: false,
  },
  {
    key: CandidateImportField.ODOO_ID,
    label: 'Odoo ID',
    description: 'Reference to Odoo candidate ID.',
    required: false,
  },
  {
    key: CandidateImportField.ACTIVITIES,
    label: 'Activities',
    description:
      'Activities column (JSON array) or multiple columns. Odoo formats: "Activity 1 Type", "Activity 1 Subject", "Activity 1 Body", "Activity 1 Date" or "Activity Type 1", "Activity Subject 1", etc. For single activity: "Activity/Type", "Activity/Subject", "Activity/Body", "Activity/Date".',
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
        type: 'candidates',
        fileName: sanitizedOriginalName,
        fileUrl: storageName,
        status: ImportStatus.PENDING,
        totalRecords: sanitizedRows.length,
        successCount: 0,
        failureCount: 0,
      },
      select: { id: true },
    });

    // Generate suggested mappings based on column name similarity
    const suggestedMappings = generateInitialMappings(
      parsed.headers,
      CANDIDATE_FIELD_DEFINITIONS,
      0.3, // Minimum confidence threshold
    );

    return {
      id: importRecord.id,
      type: 'candidates',
      fileName: file.originalname,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: CANDIDATE_FIELD_DEFINITIONS,
      suggestedMappings,
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

    const hasFirstName = !!fieldMapping[CandidateImportField.FIRST_NAME];
    const hasLastName = !!fieldMapping[CandidateImportField.LAST_NAME];
    const hasFullName = !!fieldMapping[CandidateImportField.FULL_NAME];

    if (!hasFullName && (!hasFirstName || !hasLastName)) {
      throw new BadRequestException(
        'Either full name or both first name and last name must be mapped for candidate import.',
      );
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
    mapping: CandidateFieldMapping,
    key: CandidateImportField,
    isOdooImport = false,
  ) {
    const column = mapping[key];
    if (!column) {
      return undefined;
    }
    const value = row[column];
    if (value === undefined || value === null) {
      return undefined;
    }
    // Use OdooProcessor for Odoo-specific processing (temporary)
    return OdooProcessor.processValue(value, isOdooImport);
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

  private parseBoolean(value: string | undefined): boolean | undefined {
    if (!value) {
      return undefined;
    }
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'n') {
      return false;
    }
    throw new BadRequestException(
      `Value "${value}" is not a valid boolean. Expected: true/false, 1/0, yes/no, y/n.`,
    );
  }

  private parseDecimal(value: string | undefined, isOdooImport = false): Prisma.Decimal | undefined {
    if (!value) {
      return undefined;
    }
    
    // For Odoo imports, be more aggressive in parsing string values
    if (isOdooImport && typeof value === 'string') {
      // Remove common formatting: currency symbols, spaces, parentheses (for negative), etc.
      const cleaned = value
        .replace(/[^\d.,-]/g, '') // Remove all non-numeric characters except digits, dots, commas, and minus
        .replace(/,/g, '.') // Replace comma with dot (European format)
        .replace(/\.(?=.*\.)/g, ''); // Remove all dots except the last one (handles thousand separators)
      
      const parsed = Number(cleaned);
      if (!Number.isNaN(parsed) && isFinite(parsed)) {
        return new Prisma.Decimal(parsed);
      }
    }
    
    // Standard parsing for non-Odoo imports
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

  private parseSkills(value: string | undefined): string[] {
    if (!value) {
      return [];
    }

    // Try JSON array first (for programmatic exports)
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);
      }
    } catch (error) {
      // Not JSON, continue with delimiter-based parsing
    }

    // Odoo typically exports many-to-many fields as comma-separated values
    // Also handle common delimiters: comma, semicolon, pipe, newline, or combinations
    // Remove common Odoo formatting like brackets or quotes
    const cleaned = value
      .replace(/^\[|\]$/g, '') // Remove brackets if present
      .replace(/^"|"$/g, '') // Remove surrounding quotes
      .trim();

    // Split by common delimiters (comma, semicolon, pipe, newline, or tab)
    const items = cleaned
      .split(/[,;|\n\t]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    // Remove duplicates while preserving order
    return Array.from(new Set(items));
  }

  private extractEmailFromText(value: string | undefined): string | null {
    if (!value) {
      return null;
    }
    const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return match ? match[0].toLowerCase() : null;
  }

  private normalizeNameFromIdentifier(
    identifier: string,
  ): { firstName: string; lastName: string } | null {
    if (!identifier) {
      return null;
    }

    const cleaned = identifier
      .replace(/<[^>]+>/g, ' ')
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) {
      return null;
    }

    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length < 2) {
      return null;
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(' '),
    };
  }

  private async resolveRecruiterIdentifier(
    identifier: string,
    cache: Map<string, string | null>,
    manualMatches?: Record<string, string>,
  ): Promise<string | null> {
    const cacheKey = identifier.trim().toLowerCase();
    if (cache.has(cacheKey)) {
      return cache.get(cacheKey) ?? null;
    }

    // Check manual matches first
    if (manualMatches) {
      const manualMatch = manualMatches[identifier] || manualMatches[cacheKey];
      if (manualMatch) {
        // Verify the manual match exists
        const user = await this.prisma.user.findUnique({
          where: { id: manualMatch },
          select: { id: true },
        });
        if (user) {
          cache.set(cacheKey, user.id);
          return user.id;
        }
      }
    }

    let recruiter: { id: string } | null = null;
    const email = this.extractEmailFromText(identifier);

    if (email) {
      recruiter = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
    }

    if (!recruiter) {
      const nameParts = this.normalizeNameFromIdentifier(identifier);
      if (nameParts) {
        recruiter = await this.prisma.user.findFirst({
          where: {
            firstName: {
              equals: nameParts.firstName,
              mode: Prisma.QueryMode.insensitive,
            },
            lastName: {
              equals: nameParts.lastName,
              mode: Prisma.QueryMode.insensitive,
            },
          },
          select: { id: true },
        });
      }
    }

    cache.set(cacheKey, recruiter?.id ?? null);
    return recruiter?.id ?? null;
  }

  private parseActivities(
    row: Record<string, string>,
    mapping: CandidateFieldMapping,
  ): Array<{
    activityTypeKey?: string;
    activityTypeName?: string;
    subject: string;
    body?: string;
    activityDate?: string;
  }> {
    const activities: Array<{
      activityTypeKey?: string;
      activityTypeName?: string;
      subject: string;
      body?: string;
      activityDate?: string;
    }> = [];

    // First, try to parse as JSON array (if mapped to a single column)
    const activitiesColumn = mapping[CandidateImportField.ACTIVITIES];
    if (activitiesColumn) {
      const value = row[activitiesColumn];
      if (value) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            return parsed.map((item) => {
              if (typeof item !== 'object' || item === null) {
                throw new BadRequestException('Each activity must be an object.');
              }
              if (!item.subject || typeof item.subject !== 'string') {
                throw new BadRequestException('Each activity must have a subject.');
              }
              return {
                activityTypeKey: item.activityTypeKey || item.activityType || undefined,
                activityTypeName: item.activityTypeName || item.typeName || undefined,
                subject: String(item.subject).trim(),
                body: item.body ? String(item.body).trim() : undefined,
                activityDate: item.activityDate || item.date || undefined,
              };
            });
          }
        } catch (error: any) {
          if (error instanceof BadRequestException) {
            throw error;
          }
          // If JSON parsing fails, fall through to numbered columns approach
        }
      }
    }

    // Otherwise, look for numbered columns (Odoo-style)
    // Odoo exports activities in various formats:
    // - "Activity 1 Type", "Activity 1 Subject", etc.
    // - "Activity Type 1", "Activity Subject 1", etc.
    // - "Activity/Type", "Activity/Subject", "Activity/Body", "Activity/Date" (for single activity)
    let activityIndex = 1;
    while (true) {
      // Try multiple Odoo column naming patterns
      const typeKeys = [
        `Activity ${activityIndex} Type`,
        `Activity Type ${activityIndex}`,
        activityIndex === 1 ? 'Activity/Type' : undefined,
        activityIndex === 1 ? 'Activity Type' : undefined,
      ].filter(Boolean) as string[];

      const subjectKeys = [
        `Activity ${activityIndex} Subject`,
        `Activity Subject ${activityIndex}`,
        `Activity ${activityIndex} Summary`,
        `Activity Summary ${activityIndex}`,
        activityIndex === 1 ? 'Activity/Subject' : undefined,
        activityIndex === 1 ? 'Activity Subject' : undefined,
        activityIndex === 1 ? 'Activity Summary' : undefined,
      ].filter(Boolean) as string[];

      const bodyKeys = [
        `Activity ${activityIndex} Body`,
        `Activity Body ${activityIndex}`,
        `Activity ${activityIndex} Description`,
        `Activity Description ${activityIndex}`,
        `Activity ${activityIndex} Note`,
        `Activity Note ${activityIndex}`,
        activityIndex === 1 ? 'Activity/Body' : undefined,
        activityIndex === 1 ? 'Activity Body' : undefined,
        activityIndex === 1 ? 'Activity Description' : undefined,
      ].filter(Boolean) as string[];

      const dateKeys = [
        `Activity ${activityIndex} Date`,
        `Activity Date ${activityIndex}`,
        `Activity ${activityIndex} Due Date`,
        `Activity Due Date ${activityIndex}`,
        activityIndex === 1 ? 'Activity/Date' : undefined,
        activityIndex === 1 ? 'Activity Date' : undefined,
        activityIndex === 1 ? 'Activity Due Date' : undefined,
      ].filter(Boolean) as string[];

      // Find the first matching column for each field
      const type = typeKeys.map((key) => row[key]?.trim()).find((val) => val);
      const subject = subjectKeys.map((key) => row[key]?.trim()).find((val) => val);
      const body = bodyKeys.map((key) => row[key]?.trim()).find((val) => val);
      const date = dateKeys.map((key) => row[key]?.trim()).find((val) => val);

      // If we don't have at least a subject, stop looking
      if (!subject) {
        break;
      }

      activities.push({
        activityTypeKey: type || undefined,
        activityTypeName: type || undefined,
        subject,
        body: body || undefined,
        activityDate: date || undefined,
      });

      activityIndex += 1;

      // Limit to prevent infinite loops (max 20 activities per candidate)
      if (activityIndex > 20) {
        break;
      }
    }

    return activities;
  }

  private buildPositionNameVariants(name: string): string[] {
    const normalized = name.replace(/\s+/g, ' ').trim();
    if (!normalized) {
      return [];
    }

    const variants = new Set<string>([normalized]);

    // Remove bracketed suffixes like "(Odoo)" or "[Closed]"
    const withoutBrackets = normalized.replace(/[\(\[\{].*?[\)\]\}]/g, '').trim();
    if (withoutBrackets) {
      variants.add(withoutBrackets);
    }

    const separators = ['/', '-', '–', '—', '|', '•', ':'];
    separators.forEach((separator) => {
      if (normalized.includes(separator)) {
        normalized
          .split(separator)
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((part) => variants.add(part));
      }
    });

    return Array.from(variants);
  }

  private async resolveOpenPositionId(
    positionName: string,
    cache: Map<string, string | null>,
    manualMatches?: Record<string, string>,
  ): Promise<string | null> {
    const normalized = positionName.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (cache.has(normalized)) {
      return cache.get(normalized) ?? null;
    }

    // Check manual matches first
    if (manualMatches) {
      const manualMatch = manualMatches[positionName] || manualMatches[normalized];
      if (manualMatch) {
        // Verify the manual match exists
        const position = await this.prisma.openPosition.findUnique({
          where: { id: manualMatch },
          select: { id: true },
        });
        if (position) {
          cache.set(normalized, position.id);
          return position.id;
        }
      }
    }

    const variants = this.buildPositionNameVariants(positionName);

    const tryFindPosition = async (
      comparator: 'equals' | 'contains',
    ): Promise<{ id: string } | null> => {
      const buildFilter = (value: string) =>
        comparator === 'equals'
          ? {
              equals: value,
              mode: Prisma.QueryMode.insensitive,
            }
          : {
              contains: value,
              mode: Prisma.QueryMode.insensitive,
            };

      for (const variant of variants) {
        const position = await this.prisma.openPosition.findFirst({
          where: {
            OR: [
              {
                title: buildFilter(variant),
              },
              {
                opportunity: {
                  title: buildFilter(variant),
                },
              },
            ],
          },
          select: { id: true },
          orderBy: {
            updatedAt: 'desc',
          },
        });

        if (position) {
          return position;
        }
      }

      return null;
    };

    let position = await tryFindPosition('equals');

    if (!position) {
      position = await tryFindPosition('contains');
    }

    cache.set(normalized, position ? position.id : null);
    return position?.id ?? null;
  }

  private async ensureCandidateLinkedToPosition(
    candidateId: string,
    positionId: string,
  ) {
    await this.prisma.candidatePosition.upsert({
      where: {
        candidateId_positionId: {
          candidateId,
          positionId,
        },
      },
      update: {},
      create: {
        candidateId,
        positionId,
      },
    });
  }

  private async resolveActivityType(
    keyOrName: string | undefined,
    cache: Map<string, string | null>,
    manualMatches?: Record<string, string>,
  ): Promise<string | null> {
    if (!keyOrName) {
      return null;
    }

    const normalized = keyOrName.trim().toUpperCase();
    if (cache.has(normalized)) {
      return cache.get(normalized) ?? null;
    }

    // Check manual matches first
    if (manualMatches) {
      const manualMatch = manualMatches[keyOrName] || manualMatches[normalized];
      if (manualMatch) {
        // Verify the manual match exists
        const activityType = await this.prisma.activityType.findUnique({
          where: { id: manualMatch },
          select: { id: true },
        });
        if (activityType) {
          cache.set(normalized, activityType.id);
          return activityType.id;
        }
      }
    }

    const activityType = await this.prisma.activityType.findFirst({
      where: {
        OR: [
          { key: { equals: normalized, mode: Prisma.QueryMode.insensitive } },
          { name: { equals: keyOrName.trim(), mode: Prisma.QueryMode.insensitive } },
        ],
        isActive: true,
      },
      select: { id: true },
    });

    const typeId = activityType?.id ?? null;
    cache.set(normalized, typeId);
    return typeId;
  }

  private parseStage(value: string | undefined, fallback?: CandidateStage): CandidateStage | undefined {
    if (!value) {
      return fallback;
    }
    
    const normalized = value.trim().toUpperCase();
    const enumValues = Object.values(CandidateStage) as string[];
    
    // Try exact match first (handles "CULTURAL_INTERVIEW", "VALIDATION", etc.)
    if (enumValues.includes(normalized)) {
      return normalized as CandidateStage;
    }
    
    // Try replacing spaces with underscores (e.g., "CULTURAL INTERVIEW" -> "CULTURAL_INTERVIEW")
    // This handles Odoo exports that use spaces instead of underscores
    const withUnderscores = normalized.replace(/\s+/g, '_');
    if (enumValues.includes(withUnderscores)) {
      return withUnderscores as CandidateStage;
    }
    
    // Try matching against enum values with spaces (for reverse lookup)
    // This handles cases where the input might have different formatting
    for (const enumValue of enumValues) {
      const enumWithSpaces = enumValue.replace(/_/g, ' ');
      if (normalized === enumWithSpaces) {
        return enumValue as CandidateStage;
      }
    }
    
    return fallback;
  }

  private buildCandidatePayload(
    row: Record<string, string>,
    mapping: CandidateFieldMapping,
    options: {
      defaultStage?: CandidateStage;
      defaultSalaryCurrency?: string;
      isOdooImport?: boolean;
    },
  ): {
    candidateData: {
      email: string;
      firstName: string;
      lastName: string;
      phone?: string;
      city?: string;
      country?: string;
      currentTitle?: string;
      yearsOfExperience?: number;
      skills: string[];
      resume?: string;
      linkedinUrl?: string;
      githubUrl?: string;
      portfolioUrl?: string;
      stage: CandidateStage;
      rating?: number;
      notes?: string;
      availableFrom?: Date;
      expectedSalary?: Prisma.Decimal;
      salaryCurrency: string;
      isActive: boolean;
      odooId?: string;
      driveFolderId?: string;
    };
    recruiterIdentifier?: string;
    linkedPositionName?: string;
    activities: Array<{
      activityTypeKey?: string;
      activityTypeName?: string;
      subject: string;
      body?: string;
      activityDate?: string;
    }>;
  } {
    const isOdooImport = options.isOdooImport ?? false;

    const email = this.extractValue(row, mapping, CandidateImportField.EMAIL, isOdooImport);
    if (!email) {
      throw new BadRequestException('Email is required for each candidate row.');
    }

    let firstName =
      this.extractValue(row, mapping, CandidateImportField.FIRST_NAME, isOdooImport) ?? '';
    let lastName =
      this.extractValue(row, mapping, CandidateImportField.LAST_NAME, isOdooImport) ?? '';

    if (!firstName || !lastName) {
      const fullName = this.extractValue(
        row,
        mapping,
        CandidateImportField.FULL_NAME,
        isOdooImport,
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
        'Each candidate must include either first/last name or a full name column.',
      );
    }

    const stage = this.parseStage(
      this.extractValue(row, mapping, CandidateImportField.STAGE, isOdooImport),
      options.defaultStage,
    ) ?? CandidateStage.VALIDATION;

    const yearsOfExperience = this.parseInteger(
      this.extractValue(row, mapping, CandidateImportField.YEARS_OF_EXPERIENCE, isOdooImport),
    );

    const rating = this.parseInteger(
      this.extractValue(row, mapping, CandidateImportField.RATING, isOdooImport),
    );

    const availableFrom = this.parseDate(
      this.extractValue(row, mapping, CandidateImportField.AVAILABLE_FROM, isOdooImport),
    );

    const expectedSalary = this.parseDecimal(
      this.extractValue(row, mapping, CandidateImportField.EXPECTED_SALARY, isOdooImport),
      isOdooImport,
    );

    const isActive =
      this.parseBoolean(
        this.extractValue(row, mapping, CandidateImportField.IS_ACTIVE, isOdooImport),
      ) ?? true; // Default to true if not provided

    const skills = this.parseSkills(
      this.extractValue(row, mapping, CandidateImportField.SKILLS, isOdooImport),
    );

    // Extract notes and resume with Odoo processing
    // For Odoo imports, we need to extract links from the original HTML before stripping
    const notesColumn = mapping[CandidateImportField.NOTES];
    // Get raw value directly from row (not processed through extractValue)
    const notesRawHtml = notesColumn && row[notesColumn] ? String(row[notesColumn]) : undefined;
    let notes: string | undefined;
    let resume = this.extractValue(row, mapping, CandidateImportField.RESUME_URL, isOdooImport);
    let driveFolderId: string | undefined;

    // Odoo-specific processing (temporary - see OdooProcessor for implementation)
    if (isOdooImport && notesRawHtml && notesRawHtml.trim().length > 0) {
      // Process Odoo notes: extract Drive links, wp-content URLs, and strip HTML
      const processed = OdooProcessor.processOdooNotes(notesRawHtml, resume);
      notes = processed.notes;
      if (processed.resume) {
        resume = processed.resume;
      }
      if (processed.driveFolderId) {
        driveFolderId = processed.driveFolderId;
      }
    } else {
      // Not Odoo import or no raw HTML - use normal extraction
      notes = this.extractValue(row, mapping, CandidateImportField.NOTES, isOdooImport);
    }

    const activities = this.parseActivities(row, mapping);
    const linkedPositionNameRaw = this.extractValue(
      row,
      mapping,
      CandidateImportField.JOB_POSITION,
      isOdooImport,
    );
    const linkedPositionName = linkedPositionNameRaw?.trim();

    const recruiterIdentifierRaw = this.extractValue(
      row,
      mapping,
      CandidateImportField.RECRUITER,
      isOdooImport,
    );
    const recruiterIdentifier = recruiterIdentifierRaw
      ? recruiterIdentifierRaw.trim()
      : undefined;

    return {
      candidateData: {
        email: email.trim().toLowerCase(),
        firstName,
        lastName,
        phone: this.extractValue(row, mapping, CandidateImportField.PHONE, isOdooImport),
        city: this.extractValue(row, mapping, CandidateImportField.CITY, isOdooImport),
        country: this.extractValue(row, mapping, CandidateImportField.COUNTRY, isOdooImport),
        currentTitle: this.extractValue(row, mapping, CandidateImportField.CURRENT_TITLE, isOdooImport),
        yearsOfExperience,
        skills,
        resume,
        linkedinUrl: this.extractValue(row, mapping, CandidateImportField.LINKEDIN_URL, isOdooImport),
        githubUrl: this.extractValue(row, mapping, CandidateImportField.GITHUB_URL, isOdooImport),
        portfolioUrl: this.extractValue(row, mapping, CandidateImportField.PORTFOLIO_URL, isOdooImport),
        stage,
        rating,
        notes,
        availableFrom,
        expectedSalary,
        salaryCurrency:
          this.extractValue(row, mapping, CandidateImportField.SALARY_CURRENCY, isOdooImport) ??
          options.defaultSalaryCurrency ??
          'USD',
        isActive,
        odooId: this.extractValue(row, mapping, CandidateImportField.ODOO_ID, isOdooImport),
        driveFolderId,
      },
      recruiterIdentifier,
      linkedPositionName,
      activities,
    };
  }

  async validateCandidatesImport(
    id: string,
  ): Promise<{
    unmatchedRecruiters: string[];
    unmatchedPositions: string[];
    unmatchedActivityTypes: string[];
  }> {
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
        'Field mappings must be configured before validating the import.',
      );
    }

    const buffer = await this.readImportFile(importRecord);
    const parsed = await parseSpreadsheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const unmatchedRecruiters = new Set<string>();
    const unmatchedPositions = new Set<string>();
    const unmatchedActivityTypes = new Set<string>();

    const recruiterCache = new Map<string, string | null>();
    const positionCache = new Map<string, string | null>();
    const activityTypeCache = new Map<string, string | null>();

    for (const row of rows) {
      const mapping = mappingPayload.fields!;
      const { recruiterIdentifier, linkedPositionName, activities } =
        this.buildCandidatePayload(row, mapping, {
          defaultStage: undefined,
          defaultSalaryCurrency: undefined,
          isOdooImport: false,
        });

      // Check recruiter
      if (recruiterIdentifier) {
        const resolved = await this.resolveRecruiterIdentifier(
          recruiterIdentifier,
          recruiterCache,
        );
        if (!resolved) {
          unmatchedRecruiters.add(recruiterIdentifier);
        }
      }

      // Check position
      if (linkedPositionName) {
        const resolved = await this.resolveOpenPositionId(
          linkedPositionName,
          positionCache,
        );
        if (!resolved) {
          unmatchedPositions.add(linkedPositionName);
        }
      }

      // Check activity types
      for (const activity of activities) {
        const typeIdentifier =
          activity.activityTypeKey || activity.activityTypeName;
        if (typeIdentifier) {
          const resolved = await this.resolveActivityType(
            typeIdentifier,
            activityTypeCache,
          );
          if (!resolved) {
            unmatchedActivityTypes.add(typeIdentifier);
          }
        }
      }
    }

    return {
      unmatchedRecruiters: Array.from(unmatchedRecruiters).sort(),
      unmatchedPositions: Array.from(unmatchedPositions).sort(),
      unmatchedActivityTypes: Array.from(unmatchedActivityTypes).sort(),
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
    const parsed = await parseSpreadsheet(buffer);
    const rows = parsed.rows.map((row) => this.normalizeRowValues(row));

    const options = {
      defaultStage: dto.defaultStage,
      defaultSalaryCurrency: dto.defaultSalaryCurrency,
      isOdooImport: dto.isOdooImport ?? false,
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
    const activityTypeCache = new Map<string, string | null>();
    const recruiterCache = new Map<string, string | null>();
    const positionCache = new Map<string, string | null>();

    const processRow = async (
      row: Record<string, string>,
      index: number,
    ) => {
      const rowNumber = index + 2;
      try {
        const mapping = mappingPayload.fields!;

        const {
          candidateData,
          recruiterIdentifier,
          activities,
          linkedPositionName,
        } = this.buildCandidatePayload(
          row,
          mapping,
          options,
        );
        const hasRecruiterMapping = !!mapping[CandidateImportField.RECRUITER];
        const hasPositionMapping = !!mapping[CandidateImportField.JOB_POSITION];

        let recruiterIdForRow: string | null | undefined = undefined;
        if (hasRecruiterMapping) {
          if (recruiterIdentifier) {
            const resolved = await this.resolveRecruiterIdentifier(
              recruiterIdentifier,
              recruiterCache,
              dto.manualMatches?.recruiters,
            );
            if (!resolved) {
              throw new BadRequestException(
                `Recruiter "${recruiterIdentifier}" not found. Please ensure the recruiter exists in the system before importing.`,
              );
            }
            recruiterIdForRow = resolved;
          } else {
            recruiterIdForRow = null;
          }
        }

        const existingCandidate = await this.prisma.candidate.findUnique({
          where: { email: candidateData.email },
        });

        let candidateId: string;

        if (existingCandidate) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            return;
          }

          // Check which fields are actually mapped to preserve unmapped fields
          const hasFirstNameMapping = !!mapping[CandidateImportField.FIRST_NAME] || !!mapping[CandidateImportField.FULL_NAME];
          const hasLastNameMapping = !!mapping[CandidateImportField.LAST_NAME] || !!mapping[CandidateImportField.FULL_NAME];
          const hasStageMapping = !!mapping[CandidateImportField.STAGE];
          const hasSkillsMapping = !!mapping[CandidateImportField.SKILLS];
          const hasIsActiveMapping = !!mapping[CandidateImportField.IS_ACTIVE];
          const hasOdooIdMapping = !!mapping[CandidateImportField.ODOO_ID];

          // Handle odooId update carefully to avoid unique constraint violations
          let odooIdValue = existingCandidate.odooId ?? null;
          if (hasOdooIdMapping && candidateData.odooId) {
            // Only update odooId if it's different and doesn't conflict with another candidate
            if (candidateData.odooId !== existingCandidate.odooId) {
              // Check if this odooId already exists for another candidate
              const conflictingCandidate = await this.prisma.candidate.findUnique({
                where: { odooId: candidateData.odooId },
              });
              
              if (!conflictingCandidate || conflictingCandidate.id === existingCandidate.id) {
                // Safe to update - either doesn't exist or belongs to the same candidate
                odooIdValue = candidateData.odooId;
              } else {
                // Conflict detected - skip updating odooId and log a warning
                summary.errors.push({
                  row: rowNumber,
                  message: `Odoo ID "${candidateData.odooId}" already exists for another candidate. Skipping odooId update.`,
                });
              }
            } else {
              // Same value, no change needed
              odooIdValue = candidateData.odooId;
            }
          }

          const updated = await this.prisma.candidate.update({
            where: { id: existingCandidate.id },
            data: {
              // Only update firstName/lastName if they were mapped
              firstName: hasFirstNameMapping ? candidateData.firstName : existingCandidate.firstName,
              lastName: hasLastNameMapping ? candidateData.lastName : existingCandidate.lastName,
              phone: candidateData.phone ?? existingCandidate.phone ?? null,
              city: candidateData.city ?? existingCandidate.city ?? null,
              country: candidateData.country ?? existingCandidate.country ?? null,
              currentTitle: candidateData.currentTitle ?? existingCandidate.currentTitle ?? null,
              yearsOfExperience: candidateData.yearsOfExperience ?? existingCandidate.yearsOfExperience ?? null,
              // Only update skills if they were mapped and have values
              skills: hasSkillsMapping && candidateData.skills.length ? candidateData.skills : existingCandidate.skills,
              resume: candidateData.resume ?? existingCandidate.resume ?? null,
              linkedinUrl: candidateData.linkedinUrl ?? existingCandidate.linkedinUrl ?? null,
              githubUrl: candidateData.githubUrl ?? existingCandidate.githubUrl ?? null,
              portfolioUrl: candidateData.portfolioUrl ?? existingCandidate.portfolioUrl ?? null,
              driveFolderId: candidateData.driveFolderId ?? existingCandidate.driveFolderId ?? null,
              // Only update stage if it was mapped
              stage: hasStageMapping ? candidateData.stage : existingCandidate.stage,
              rating: candidateData.rating ?? existingCandidate.rating ?? null,
              notes: candidateData.notes ?? existingCandidate.notes ?? null,
              availableFrom: candidateData.availableFrom ?? existingCandidate.availableFrom ?? null,
              expectedSalary: candidateData.expectedSalary ?? existingCandidate.expectedSalary ?? null,
              salaryCurrency: candidateData.salaryCurrency ?? existingCandidate.salaryCurrency ?? 'USD',
              isActive: hasIsActiveMapping ? candidateData.isActive : existingCandidate.isActive,
              odooId: odooIdValue,
              recruiterId:
                recruiterIdForRow !== undefined
                  ? recruiterIdForRow
                  : existingCandidate.recruiterId,
            },
          });
          candidateId = updated.id;
          summary.updatedCount += 1;
        } else {
          // For new candidates, check if odooId conflicts before creating
          const odooIdForCreate = candidateData.odooId ?? null;
          if (odooIdForCreate) {
            const conflictingCandidate = await this.prisma.candidate.findUnique({
              where: { odooId: odooIdForCreate },
            });
            
            if (conflictingCandidate) {
              // OdooId already exists - skip creating and log error
              summary.errors.push({
                row: rowNumber,
                message: `Cannot create candidate: Odoo ID "${odooIdForCreate}" already exists for another candidate.`,
              });
              summary.failedCount += 1;
              return;
            }
          }

          const created = await this.prisma.candidate.create({
            data: {
              firstName: candidateData.firstName,
              lastName: candidateData.lastName,
              email: candidateData.email,
              phone: candidateData.phone ?? null,
              city: candidateData.city ?? null,
              country: candidateData.country ?? null,
              currentTitle: candidateData.currentTitle ?? null,
              yearsOfExperience: candidateData.yearsOfExperience ?? null,
              skills: candidateData.skills,
              resume: candidateData.resume ?? null,
              linkedinUrl: candidateData.linkedinUrl ?? null,
              githubUrl: candidateData.githubUrl ?? null,
              portfolioUrl: candidateData.portfolioUrl ?? null,
              driveFolderId: candidateData.driveFolderId ?? null,
              stage: candidateData.stage,
              rating: candidateData.rating ?? null,
              notes: candidateData.notes ?? null,
              availableFrom: candidateData.availableFrom ?? null,
              expectedSalary: candidateData.expectedSalary ?? null,
              salaryCurrency: candidateData.salaryCurrency ?? 'USD',
              isActive: candidateData.isActive,
              odooId: odooIdForCreate,
              recruiterId:
                recruiterIdForRow !== undefined ? recruiterIdForRow : undefined,
            },
          });
          candidateId = created.id;
          summary.createdCount += 1;
        }

        // Link candidate to position if requested
        // For inactive candidates, skip linking if position doesn't match (no error)
        // For active candidates, show error if position doesn't match
        if (hasPositionMapping && linkedPositionName) {
          const positionId = await this.resolveOpenPositionId(
            linkedPositionName,
            positionCache,
            dto.manualMatches?.positions,
          );
          if (!positionId) {
            // Only show error for active candidates
            // Inactive candidates can be imported without position linking
            if (candidateData.isActive !== false) {
              summary.errors.push({
                row: rowNumber,
                message: `Job position "${linkedPositionName}" not found. Candidate was imported without linking.`,
              });
            }
            // For inactive candidates, silently skip linking (no error)
          } else {
            await this.ensureCandidateLinkedToPosition(candidateId, positionId);
          }
        }

        // Create activities if any
        if (activities.length > 0) {
          if (!dto.createdById) {
            throw new BadRequestException(
              'createdById is required when importing activities.',
            );
          }

          for (const activityData of activities) {
            const activityTypeId = await this.resolveActivityType(
              activityData.activityTypeKey || activityData.activityTypeName,
              activityTypeCache,
              dto.manualMatches?.activityTypes,
            );

            if (!activityTypeId) {
              const typeIdentifier = activityData.activityTypeKey || activityData.activityTypeName || 'unknown';
              throw new BadRequestException(
                `Activity type "${typeIdentifier}" not found. Please ensure the activity type exists in the system.`,
              );
            }

            await this.prisma.activity.create({
              data: {
                activityTypeId,
                subject: activityData.subject,
                body: activityData.body ?? null,
                activityDate: activityData.activityDate
                  ? new Date(activityData.activityDate)
                  : null,
                candidateId,
                createdById: dto.createdById,
              },
            });
          }
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

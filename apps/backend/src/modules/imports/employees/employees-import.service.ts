import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContractType,
  EmploymentStatus,
  ImportStatus,
  Prisma,
  UserRole,
} from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomBytes, randomUUID } from 'crypto';
import { parseSpreadsheet } from '../../../common/utils/spreadsheet-parser';
import { validateFileUpload } from '../../../common/config/multer.config';
import { sanitizeFilename } from '../../../common/utils/file-sanitizer';
import * as bcrypt from 'bcrypt';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { ExecuteEmployeeImportDto } from './dto/execute-employee-import.dto';
import {
  EmployeeFieldMappingEntry,
  EmployeeImportField,
  EmployeeMapImportDto,
} from './dto/employee-map-import.dto';
import { generateInitialMappings } from '../utils/field-mapping.util';

export interface EmployeeUploadResult {
  id: string;
  type: string;
  fileName: string;
  columns: string[];
  sampleRows: Record<string, string>[];
  totalRows: number;
  availableFields: EmployeeImportFieldMetadata[];
  suggestedMappings?: Array<{ sourceColumn: string; targetField: string }>;
}

export interface EmployeeImportSummary {
  importId: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errors: Array<{ row: number; message: string }>;
}

export interface EmployeeImportFieldMetadata {
  key: EmployeeImportField;
  label: string;
  description: string;
  required: boolean;
}

type EmployeeFieldMapping = Partial<Record<EmployeeImportField, string>>;

const EMPLOYEE_FIELD_DEFINITIONS: EmployeeImportFieldMetadata[] = [
  {
    key: EmployeeImportField.EMAIL,
    label: 'Work Email',
    description:
      'Primary work email address (required, used for matching users).',
    required: true,
  },
  {
    key: EmployeeImportField.FIRST_NAME,
    label: 'First Name',
    description: 'Employee first name (required unless full name provided).',
    required: false,
  },
  {
    key: EmployeeImportField.LAST_NAME,
    label: 'Last Name',
    description: 'Employee last name (required unless full name provided).',
    required: false,
  },
  {
    key: EmployeeImportField.FULL_NAME,
    label: 'Full Name',
    description:
      'Full name of the employee (used when first/last name columns are missing).',
    required: false,
  },
  {
    key: EmployeeImportField.EMPLOYEE_NUMBER,
    label: 'Employee Number',
    description: 'Unique employee number (required).',
    required: true,
  },
  {
    key: EmployeeImportField.JOB_TITLE,
    label: 'Job Title',
    description: 'Primary job title (required).',
    required: true,
  },
  {
    key: EmployeeImportField.DEPARTMENT,
    label: 'Department',
    description: 'Department name (optional).',
    required: false,
  },
  {
    key: EmployeeImportField.STATUS,
    label: 'Employment Status',
    description:
      'Employment status (ACTIVE, ON_LEAVE, TERMINATED, RESIGNED).',
    required: false,
  },
  {
    key: EmployeeImportField.CONTRACT_TYPE,
    label: 'Contract Type',
    description: 'Contract type (FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP).',
    required: false,
  },
  {
    key: EmployeeImportField.HIRE_DATE,
    label: 'Hire Date',
    description: 'Hire/start date (YYYY-MM-DD).',
    required: true,
  },
  {
    key: EmployeeImportField.TERMINATION_DATE,
    label: 'Termination Date',
    description: 'Termination date when applicable (YYYY-MM-DD).',
    required: false,
  },
  {
    key: EmployeeImportField.SALARY,
    label: 'Salary',
    description: 'Annual salary amount.',
    required: false,
  },
  {
    key: EmployeeImportField.SALARY_CURRENCY,
    label: 'Salary Currency',
    description: 'Salary currency code (e.g., USD, EUR).',
    required: false,
  },
  {
    key: EmployeeImportField.PHONE,
    label: 'Phone Number',
    description: 'Primary phone number.',
    required: false,
  },
  {
    key: EmployeeImportField.ROLE,
    label: 'User Role',
    description:
      'User role to assign (ADMIN, HR, EMPLOYEE, etc). Defaults to EMPLOYEE.',
    required: false,
  },
  {
    key: EmployeeImportField.MANAGER_EMAIL,
    label: 'Manager Email',
    description:
      'Email address of the manager (matched to existing employees/users).',
    required: false,
  },
  {
    key: EmployeeImportField.EMERGENCY_CONTACT_NAME,
    label: 'Emergency Contact Name',
    description: 'Name of the emergency contact.',
    required: false,
  },
  {
    key: EmployeeImportField.EMERGENCY_CONTACT_PHONE,
    label: 'Emergency Contact Phone',
    description: 'Phone number for the emergency contact.',
    required: false,
  },
  {
    key: EmployeeImportField.EMERGENCY_CONTACT_RELATION,
    label: 'Emergency Contact Relation',
    description: 'Relationship of the emergency contact to the employee.',
    required: false,
  },
];

@Injectable()
export class EmployeesImportService {
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

  async uploadEmployeesImport(
    file: Express.Multer.File,
  ): Promise<EmployeeUploadResult> {
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
        type: 'employees',
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
      EMPLOYEE_FIELD_DEFINITIONS,
      0.3, // Minimum confidence threshold
    );

    return {
      id: importRecord.id,
      type: 'employees',
      fileName: sanitizedOriginalName,
      columns: parsed.headers,
      sampleRows,
      totalRows: sanitizedRows.length,
      availableFields: EMPLOYEE_FIELD_DEFINITIONS,
      suggestedMappings,
    };
  }

  async listEmployeesImports() {
    return this.prisma.dataImport.findMany({
      where: { type: 'employees' },
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

  async getEmployeesImport(id: string) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'employees') {
      throw new NotFoundException('Import not found');
    }

    return {
      ...importRecord,
      availableFields: EMPLOYEE_FIELD_DEFINITIONS,
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
    mappings: EmployeeFieldMappingEntry[],
  ): EmployeeFieldMapping {
    const headerSet = new Set(headers.map((header) => header.trim()));
    const fieldMapping: EmployeeFieldMapping = {};

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

    if (!fieldMapping[EmployeeImportField.EMAIL]) {
      throw new BadRequestException('Email must be mapped for employee import.');
    }

    if (!fieldMapping[EmployeeImportField.EMPLOYEE_NUMBER]) {
      throw new BadRequestException(
        'Employee number must be mapped for employee import.',
      );
    }

    if (!fieldMapping[EmployeeImportField.JOB_TITLE]) {
      throw new BadRequestException(
        'Job title must be mapped for employee import.',
      );
    }

    if (!fieldMapping[EmployeeImportField.HIRE_DATE]) {
      throw new BadRequestException(
        'Hire date must be mapped for employee import.',
      );
    }

    return fieldMapping;
  }

  async saveEmployeesMapping(id: string, dto: EmployeeMapImportDto) {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'employees') {
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
    mapping: EmployeeFieldMapping,
    key: EmployeeImportField,
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
    return { firstName, lastName };
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
        `Value "${value}" is not a valid number for salary.`,
      );
    }
    return new Prisma.Decimal(parsed);
  }

  private parseEmploymentStatus(
    value: string | undefined,
    fallback?: EmploymentStatus,
  ): EmploymentStatus | undefined {
    if (!value) {
      return fallback;
    }
    const normalized = value.trim().toUpperCase();
    if (
      (Object.values(EmploymentStatus) as string[]).includes(normalized)
    ) {
      return normalized as EmploymentStatus;
    }
    return fallback;
  }

  private parseContractType(
    value: string | undefined,
    fallback?: ContractType,
  ): ContractType | undefined {
    if (!value) {
      return fallback;
    }
    const normalized = value.trim().toUpperCase();
    if ((Object.values(ContractType) as string[]).includes(normalized)) {
      return normalized as ContractType;
    }
    return fallback;
  }

  private parseUserRole(
    value: string | undefined,
    fallback: UserRole,
  ): UserRole {
    if (!value) {
      return fallback;
    }
    const normalized = value.trim().toUpperCase();
    if ((Object.values(UserRole) as string[]).includes(normalized)) {
      return normalized as UserRole;
    }
    return fallback;
  }

  private async resolveManagerIdByEmail(
    email: string | undefined,
    cache: Map<string, string | null>,
  ): Promise<string | null | undefined> {
    if (!email) {
      return undefined;
    }
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (cache.has(normalized)) {
      const cached = cache.get(normalized);
      if (cached === null) {
        throw new BadRequestException(
          `Manager with email "${email}" does not exist or is not linked to an employee record.`,
        );
      }
      return cached;
    }
    const manager = await this.prisma.user.findUnique({
      where: { email: normalized },
      select: { id: true, employee: { select: { id: true } } },
    });
    if (!manager?.employee?.id) {
      cache.set(normalized, null);
      throw new BadRequestException(
        `Manager with email "${email}" does not exist or is not linked to an employee record.`,
      );
    }
    cache.set(normalized, manager.employee.id);
    return manager.employee.id;
  }

  private async ensureEmployeeNumberAvailable(
    employeeNumber: string,
    currentEmployeeId?: string,
  ) {
    const existing = await this.prisma.employee.findUnique({
      where: { employeeNumber },
      select: { id: true },
    });
    if (existing && existing.id !== currentEmployeeId) {
      throw new BadRequestException(
        `Employee number "${employeeNumber}" is already in use by another employee.`,
      );
    }
  }

  private async buildUserAndEmployeeData(
    row: Record<string, string>,
    mapping: EmployeeFieldMapping,
    options: {
      defaultRole: UserRole;
      defaultStatus?: EmploymentStatus;
      defaultContractType?: ContractType;
      defaultManagerEmail?: string;
      defaultSalaryCurrency?: string;
      managerCache: Map<string, string | null>;
    },
  ) {
    const email = this.extractValue(row, mapping, EmployeeImportField.EMAIL);
    if (!email) {
      throw new BadRequestException('Email is required for each employee row.');
    }

    let firstName =
      this.extractValue(row, mapping, EmployeeImportField.FIRST_NAME) ?? '';
    let lastName =
      this.extractValue(row, mapping, EmployeeImportField.LAST_NAME) ?? '';

    if (!firstName || !lastName) {
      const fullName = this.extractValue(
        row,
        mapping,
        EmployeeImportField.FULL_NAME,
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
        'Each employee must include either first/last name columns or a full name column.',
      );
    }

    const employeeNumber = this.extractValue(
      row,
      mapping,
      EmployeeImportField.EMPLOYEE_NUMBER,
    );
    if (!employeeNumber) {
      throw new BadRequestException(
        'Employee number is required for each employee.',
      );
    }

    const hireDateValue = this.extractValue(
      row,
      mapping,
      EmployeeImportField.HIRE_DATE,
    );
    const hireDate = this.parseDate(hireDateValue);
    if (!hireDate) {
      throw new BadRequestException('Hire date is required for each employee.');
    }

    const terminationDate = this.parseDate(
      this.extractValue(row, mapping, EmployeeImportField.TERMINATION_DATE),
    );
    const salary = this.parseDecimal(
      this.extractValue(row, mapping, EmployeeImportField.SALARY),
    );
    const salaryCurrency =
      this.extractValue(row, mapping, EmployeeImportField.SALARY_CURRENCY) ??
      options.defaultSalaryCurrency ??
      'USD';
    const department = this.extractValue(
      row,
      mapping,
      EmployeeImportField.DEPARTMENT,
    );
    const contractType = this.parseContractType(
      this.extractValue(row, mapping, EmployeeImportField.CONTRACT_TYPE),
      options.defaultContractType,
    );
    const status = this.parseEmploymentStatus(
      this.extractValue(row, mapping, EmployeeImportField.STATUS),
      options.defaultStatus,
    );
    const role = this.parseUserRole(
      this.extractValue(row, mapping, EmployeeImportField.ROLE),
      options.defaultRole,
    );

    const phone = this.extractValue(row, mapping, EmployeeImportField.PHONE);
    const emergencyContactName = this.extractValue(
      row,
      mapping,
      EmployeeImportField.EMERGENCY_CONTACT_NAME,
    );
    const emergencyContactPhone = this.extractValue(
      row,
      mapping,
      EmployeeImportField.EMERGENCY_CONTACT_PHONE,
    );
    const emergencyContactRelation = this.extractValue(
      row,
      mapping,
      EmployeeImportField.EMERGENCY_CONTACT_RELATION,
    );

    const managerEmail =
      this.extractValue(row, mapping, EmployeeImportField.MANAGER_EMAIL) ??
      options.defaultManagerEmail ??
      undefined;

    const managerId = await this.resolveManagerIdByEmail(
      managerEmail,
      options.managerCache,
    );

    return {
      email,
      userData: {
        firstName,
        lastName,
        role,
        phone: phone ?? undefined,
      },
      employeeData: {
        employeeNumber,
        jobTitle:
          this.extractValue(row, mapping, EmployeeImportField.JOB_TITLE)!,
        department: department ?? undefined,
        status: status ?? EmploymentStatus.ACTIVE,
        contractType: contractType ?? ContractType.FULL_TIME,
        hireDate,
        terminationDate: terminationDate ?? null,
        salary,
        salaryCurrency: salaryCurrency || 'USD',
        managerId,
        emergencyContactName: emergencyContactName ?? undefined,
        emergencyContactPhone: emergencyContactPhone ?? undefined,
        emergencyContactRelation: emergencyContactRelation ?? undefined,
      },
    };
  }

  private generateRandomPassword(): string {
    return randomBytes(9).toString('base64');
  }

  async executeEmployeesImport(
    id: string,
    dto: ExecuteEmployeeImportDto,
  ): Promise<EmployeeImportSummary> {
    const importRecord = await this.prisma.dataImport.findUnique({
      where: { id },
    });

    if (!importRecord || importRecord.type !== 'employees') {
      throw new NotFoundException('Import not found');
    }

    const mappingPayload = importRecord.fieldMapping as
      | {
          fields?: EmployeeFieldMapping;
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
    const defaultRole = dto.defaultRole ?? UserRole.EMPLOYEE;
    const managerCache = new Map<string, string | null>();

    await this.prisma.dataImport.update({
      where: { id },
      data: {
        status: ImportStatus.PROCESSING,
        startedAt: new Date(),
        successCount: 0,
        failureCount: 0,
      },
    });

    const summary: EmployeeImportSummary = {
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
        const payload = await this.buildUserAndEmployeeData(row, mappingPayload.fields!, {
          defaultRole,
          defaultStatus: dto.defaultStatus,
          defaultContractType: dto.defaultContractType,
          defaultManagerEmail: dto.defaultManagerEmail,
          defaultSalaryCurrency: dto.defaultSalaryCurrency ?? 'USD',
          managerCache,
        });

        const normalizedEmail = payload.email.toLowerCase();
        const existingUser = await this.prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        let userId: string;
        let createdUser = false;

        if (existingUser) {
          userId = existingUser.id;
          if (!updateExisting) {
            summary.skippedCount += 1;
            return;
          }

          await this.prisma.user.update({
            where: { id: userId },
            data: {
              firstName: payload.userData.firstName,
              lastName: payload.userData.lastName,
              role: payload.userData.role,
              phone: payload.userData.phone ?? existingUser.phone ?? null,
            },
          });
        } else {
          const passwordToHash = dto.defaultPassword ?? this.generateRandomPassword();
          const hashedPassword = await bcrypt.hash(passwordToHash, 10);
          const user = await this.prisma.user.create({
            data: {
              email: normalizedEmail,
              password: hashedPassword,
              firstName: payload.userData.firstName,
              lastName: payload.userData.lastName,
              role: payload.userData.role,
              phone: payload.userData.phone ?? null,
              isActive: true,
            },
          });
          userId = user.id;
          createdUser = true;
        }

        const existingEmployee = await this.prisma.employee.findUnique({
          where: { userId },
        });

        await this.ensureEmployeeNumberAvailable(
          payload.employeeData.employeeNumber,
          existingEmployee?.id,
        );

        if (existingEmployee) {
          if (!updateExisting) {
            summary.skippedCount += 1;
            return;
          }

          await this.prisma.employee.update({
            where: { id: existingEmployee.id },
            data: {
              employeeNumber: payload.employeeData.employeeNumber,
              department: payload.employeeData.department ?? existingEmployee.department ?? null,
              jobTitle: payload.employeeData.jobTitle,
              status: payload.employeeData.status,
              contractType: payload.employeeData.contractType,
              hireDate: payload.employeeData.hireDate,
              terminationDate: payload.employeeData.terminationDate,
              salary:
                payload.employeeData.salary ?? existingEmployee.salary,
              salaryCurrency:
                payload.employeeData.salaryCurrency ?? existingEmployee.salaryCurrency,
              managerId:
                payload.employeeData.managerId !== undefined
                  ? payload.employeeData.managerId
                  : existingEmployee.managerId,
              emergencyContactName: payload.employeeData.emergencyContactName ?? existingEmployee.emergencyContactName ?? null,
              emergencyContactPhone:
                payload.employeeData.emergencyContactPhone ?? existingEmployee.emergencyContactPhone ?? null,
              emergencyContactRelation:
                payload.employeeData.emergencyContactRelation ?? existingEmployee.emergencyContactRelation ?? null,
            },
          });
          summary.updatedCount += 1;
        } else {
          await this.prisma.employee.create({
            data: {
              userId,
              employeeNumber: payload.employeeData.employeeNumber,
              department: payload.employeeData.department ?? null,
              jobTitle: payload.employeeData.jobTitle,
              status: payload.employeeData.status,
              contractType: payload.employeeData.contractType,
              hireDate: payload.employeeData.hireDate,
              terminationDate: payload.employeeData.terminationDate,
              salary:
                payload.employeeData.salary ?? new Prisma.Decimal(0),
              salaryCurrency: payload.employeeData.salaryCurrency,
              managerId: payload.employeeData.managerId ?? null,
              emergencyContactName: payload.employeeData.emergencyContactName ?? null,
              emergencyContactPhone: payload.employeeData.emergencyContactPhone ?? null,
              emergencyContactRelation:
                payload.employeeData.emergencyContactRelation ?? null,
            },
          });
          summary.createdCount += 1;
        }

        summary.processedRows += 1;

        if (createdUser) {
          managerCache.delete(normalizedEmail);
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

import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { EodImportField } from './dto/eod-map-import.dto';

export type EodFieldMapping = Partial<Record<EodImportField, string>>;

export interface BuildEodPayloadOptions {
  markMissingAsSubmitted: boolean;
  defaultIsLate: boolean;
}

export interface RawEodPayload {
  email: string;
  reportDate: Date;
  summary: string;
  submittedAt: Date | null;
  isLate: boolean;
  hoursWorked?: Prisma.Decimal;
  tasks: Prisma.JsonArray;
  // Legacy task fields
  taskDetails?: string;
  taskTicket?: string;
  taskTypeOfWork?: string;
  taskEstimatedTime?: number;
  taskTimeSpent?: number;
  taskLifecycle?: string;
  taskStatus?: string;
}

export function extractValue(
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

export function parseDate(value: string | undefined): Date | undefined {
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

export function parseDateTime(
  value: string | undefined,
): Date | undefined {
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

export function parseBoolean(value: string | undefined): boolean | undefined {
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

export function parseDecimal(
  value: string | undefined,
): Prisma.Decimal | undefined {
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

export function parseTasks(value: string | undefined) {
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

export function buildEodPayload(
  row: Record<string, string>,
  mapping: EodFieldMapping,
  options: BuildEodPayloadOptions,
): RawEodPayload {
  const email = extractValue(row, mapping, EodImportField.EMAIL);
  if (!email) {
    throw new BadRequestException('Email is required for each EOD row.');
  }

  const dateValue = extractValue(row, mapping, EodImportField.DATE);
  const reportDate = parseDate(dateValue);
  if (!reportDate) {
    throw new BadRequestException('Date is required for each EOD row.');
  }

  const summary =
    extractValue(row, mapping, EodImportField.SUMMARY) ?? '';

  const submittedAt =
    parseDateTime(extractValue(row, mapping, EodImportField.SUBMITTED_AT)) ??
    (options.markMissingAsSubmitted ? new Date() : undefined);

  const isLate =
    parseBoolean(extractValue(row, mapping, EodImportField.IS_LATE)) ??
    options.defaultIsLate;

  const hoursWorked = parseDecimal(
    extractValue(row, mapping, EodImportField.HOURS_WORKED),
  );

  const tasks = parseTasks(
    extractValue(row, mapping, EodImportField.TASKS),
  );

  // Extract legacy task fields
  const taskDetails = extractValue(row, mapping, EodImportField.TASK_DETAILS);
  const taskTicket = extractValue(row, mapping, EodImportField.TASK_TICKET);
  const taskTypeOfWork = extractValue(row, mapping, EodImportField.TASK_TYPE_OF_WORK);
  const taskEstimatedTime = parseDecimal(
    extractValue(row, mapping, EodImportField.TASK_ESTIMATED_TIME),
  );
  const taskTimeSpent = parseDecimal(
    extractValue(row, mapping, EodImportField.TASK_TIME_SPENT),
  );
  const taskLifecycle = extractValue(row, mapping, EodImportField.TASK_LIFECYCLE);
  const taskStatus = extractValue(row, mapping, EodImportField.TASK_STATUS);

  return {
    email,
    reportDate,
    summary,
    submittedAt: submittedAt ?? null,
    isLate,
    hoursWorked,
    tasks,
    taskDetails,
    taskTicket,
    taskTypeOfWork,
    taskEstimatedTime: taskEstimatedTime ? parseFloat(taskEstimatedTime.toString()) : undefined,
    taskTimeSpent: taskTimeSpent ? parseFloat(taskTimeSpent.toString()) : undefined,
    taskLifecycle,
    taskStatus,
  };
}


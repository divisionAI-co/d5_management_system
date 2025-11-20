import { BadRequestException } from '@nestjs/common';
import { CheckInOutStatus } from '@prisma/client';
import { CheckInOutImportField } from './dto/check-in-out-map-import.dto';

export type CheckInOutFieldMapping = Partial<Record<CheckInOutImportField, string>>;

export interface RawCheckInOutPayload {
  firstName: string;
  lastName: string;
  cardNumber?: string;
  dateTime: Date;
  status: CheckInOutStatus;
}

export function extractValue(
  row: Record<string, string>,
  mapping: CheckInOutFieldMapping,
  key: CheckInOutImportField,
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

export function parseDateTime(value: string | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(
      `Value "${value}" is not a valid datetime.`,
    );
  }
  return parsed;
}

export function parseStatus(value: string | undefined): CheckInOutStatus | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  
  // Parse "Division 5-1 In" -> "IN", "Division 5-1 Out" -> "OUT"
  if (normalized.includes('IN') && !normalized.includes('OUT')) {
    return CheckInOutStatus.IN;
  }
  if (normalized.includes('OUT')) {
    return CheckInOutStatus.OUT;
  }
  
  // Direct matches
  if (normalized === 'IN') {
    return CheckInOutStatus.IN;
  }
  if (normalized === 'OUT') {
    return CheckInOutStatus.OUT;
  }
  
  return undefined;
}

export function buildCheckInOutPayload(
  row: Record<string, string>,
  mapping: CheckInOutFieldMapping,
): RawCheckInOutPayload {
  const firstName = extractValue(row, mapping, CheckInOutImportField.FIRST_NAME);
  if (!firstName) {
    throw new BadRequestException('First name is required for each check-in/out row.');
  }

  const lastName = extractValue(row, mapping, CheckInOutImportField.LAST_NAME);
  if (!lastName) {
    throw new BadRequestException('Last name is required for each check-in/out row.');
  }

  const cardNumber = extractValue(row, mapping, CheckInOutImportField.CARD_NUMBER);

  const dateTimeValue = extractValue(row, mapping, CheckInOutImportField.DATE_TIME);
  const dateTime = parseDateTime(dateTimeValue);
  if (!dateTime) {
    throw new BadRequestException('Date and time is required for each check-in/out row.');
  }

  const statusValue = extractValue(row, mapping, CheckInOutImportField.STATUS);
  const status = parseStatus(statusValue);
  if (!status) {
    throw new BadRequestException(
      `Status is required and must be "IN" or "OUT" (received: "${statusValue}").`,
    );
  }

  return {
    firstName,
    lastName,
    cardNumber,
    dateTime,
    status,
  };
}


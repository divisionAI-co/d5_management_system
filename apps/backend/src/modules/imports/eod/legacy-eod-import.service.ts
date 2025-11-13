import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  buildEodPayload,
  BuildEodPayloadOptions,
  EodFieldMapping,
} from './eod-import.helpers';
import { EodImportSummary } from './eod-import.service';

type LegacyTaskRow = {
  clientDetails?: string;
  ticket?: string;
  typeOfWorkDone?: 'PLANNING' | 'RESEARCH' | 'IMPLEMENTATION' | 'TESTING';
  taskEstimatedTime?: number;
  timeSpentOnTicket?: number;
  taskLifecycle?: string;
  taskStatus?: string;
};

type GroupedLegacyRow = {
  email: string;
  reportDate: Date;
  summaries: string[];
  tasks: Array<LegacyTaskRow>;
  totalHours: number;
  hasHours: boolean;
  submittedAt: Date | null;
  isLate: boolean;
  rowNumbers: number[];
};

type EmailIndexEntry = {
  userId: string;
  email: string;
};

@Injectable()
export class LegacyEodImportService {
  private readonly errorLimit = 50;

  constructor(private readonly prisma: PrismaService) {}

  async processLegacyImport(params: {
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

    const grouped = new Map<string, GroupedLegacyRow>();
    const emailIndex = await this.buildEmailIndex();
    const resolvedCache = new Map<string, EmailIndexEntry>();

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      try {
        const payload = buildEodPayload(rows[index], mapping, options);
        
        // Submit date should be the original report date (or provided submittedAt)
        const submittedDate = payload.submittedAt || payload.reportDate;
        
        // Try to extract a different date from task details first, then from summary
        let overrideDate = this.tryExtractLegacyDate(payload.taskDetails || '', payload.reportDate);
        if (!overrideDate) {
          overrideDate = this.tryExtractLegacyDate(payload.summary, payload.reportDate);
        }
        
        // Use override date if found, otherwise keep original report date
        const finalReportDate = overrideDate || payload.reportDate;

        const key = `${payload.email.toLowerCase()}|${finalReportDate
          .toISOString()
          .slice(0, 10)}`;
        const hoursValue = payload.hoursWorked
          ? parseFloat(payload.hoursWorked.toString())
          : 0;

        const summaryPart = payload.summary?.trim();

        // Build task object from legacy fields
        const taskRow: LegacyTaskRow = {
          clientDetails: payload.taskDetails,
          ticket: payload.taskTicket,
          typeOfWorkDone: this.normalizeTypeOfWork(payload.taskTypeOfWork),
          taskEstimatedTime: payload.taskEstimatedTime,
          timeSpentOnTicket: payload.taskTimeSpent,
          taskLifecycle: payload.taskLifecycle,
          taskStatus: payload.taskStatus,
        };

        // Only add task if at least one field is populated
        const hasTaskData = Object.values(taskRow).some((v) => v !== undefined && v !== null && v !== '');

        if (grouped.has(key)) {
          const group = grouped.get(key)!;
          if (summaryPart && !group.summaries.includes(summaryPart)) {
            group.summaries.push(summaryPart);
          }
          if (hasTaskData) {
            group.tasks.push(taskRow);
          }
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
            reportDate: finalReportDate,
            summaries: summaryPart ? [summaryPart] : [],
            tasks: hasTaskData ? [taskRow] : [],
            totalHours: payload.hoursWorked ? hoursValue : 0,
            hasHours: Boolean(payload.hoursWorked),
            submittedAt: submittedDate,
            isLate: payload.isLate,
            rowNumbers: [rowNumber],
          });
        }
      } catch (error: any) {
        summary.failedCount += 1;
        if (summary.errors.length < this.errorLimit) {
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

    const processGroup = async (group: GroupedLegacyRow) => {
      const rowNumber = group.rowNumbers[0];
      try {
        const resolved = await this.resolveEmployeeByApproxEmail(
          group.email,
          emailIndex,
          resolvedCache,
        );

        const existingReport = await this.prisma.eodReport.findUnique({
          where: {
            userId_date: {
              userId: resolved.userId,
              date: group.reportDate,
            },
          },
        });

        const hoursWorkedDecimal = group.hasHours
          ? new Prisma.Decimal(group.totalHours)
          : undefined;

        // Convert legacy task rows to JSON array format
        const tasksPayload = group.tasks.length
          ? (group.tasks as unknown as Prisma.JsonArray)
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
                userId: resolved.userId,
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
              userId: resolved.userId,
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
        if (summary.errors.length < this.errorLimit) {
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

  private async buildEmailIndex() {
    const users = await this.prisma.user.findMany({
      where: { employee: { isNot: null } },
      select: {
        id: true,
        email: true,
      },
    });

    const index = new Map<string, EmailIndexEntry | null>();
    const registerKey = (key: string, entry: EmailIndexEntry) => {
      if (!key) {
        return;
      }
      if (!index.has(key)) {
        index.set(key, entry);
        return;
      }
      const existing = index.get(key);
      if (existing && existing.userId !== entry.userId) {
        index.set(key, null);
      }
    };

    users.forEach((user) => {
      const entry = { userId: user.id, email: user.email };
      const keys = this.buildEmailKeys(user.email);
      keys.forEach((key) => registerKey(key, entry));
    });

    return index;
  }

  private buildEmailKeys(email: string): string[] {
    const lower = email.trim().toLowerCase();
    if (!lower) {
      return [];
    }

    const [local = '', domain = ''] = lower.split('@');
    const noAliasLocal = local.replace(/\+.*$/, '');
    const noDotsLocal = local.replace(/\./g, '');
    const compressedLocal = noAliasLocal.replace(/[^a-z0-9]/g, '');

    const keys = new Set<string>();
    keys.add(lower);

    if (domain) {
      keys.add(`${noAliasLocal}@${domain}`);
      if (compressedLocal) {
        keys.add(`${compressedLocal}@${domain}`);
      }
    }

    if (local) {
      keys.add(local);
    }
    if (noAliasLocal) {
      keys.add(noAliasLocal);
    }
    if (noDotsLocal) {
      keys.add(noDotsLocal);
    }
    if (compressedLocal) {
      keys.add(compressedLocal);
    }

    return Array.from(keys).filter(Boolean);
  }

  private async resolveEmployeeByApproxEmail(
    email: string,
    index: Map<string, EmailIndexEntry | null>,
    cache: Map<string, EmailIndexEntry>,
  ): Promise<EmailIndexEntry> {
    const normalized = email.trim().toLowerCase();
    const cached = cache.get(normalized);
    if (cached) {
      return cached;
    }

    const keysToCheck = this.buildEmailKeys(email);
    let ambiguousKey: string | null = null;

    for (const key of keysToCheck) {
      if (!index.has(key)) {
        continue;
      }
      const entry = index.get(key);
      if (entry === null) {
        ambiguousKey = key;
        continue;
      }
      if (entry === undefined) {
        continue;
      }
      cache.set(normalized, entry);
      return entry;
    }

    if (ambiguousKey) {
      throw new BadRequestException(
        `Multiple employees match the identifier "${ambiguousKey}". Please update the import file with the exact work email for those rows.`,
      );
    }

    throw new BadRequestException(
      `Could not match "${email}" to any employee. Update the row with the employee's work email or create the employee first.`,
    );
  }

  private tryExtractLegacyDate(note: string, fallback: Date): Date | null {
    if (!note?.trim()) {
      return null;
    }

    const normalized = note.trim();
    const lower = normalized.toLowerCase();
    if (lower.includes('yesterday')) {
      return this.shiftDate(fallback, -1);
    }
    if (lower.includes('today')) {
      return fallback;
    }

    const patterns = [
      /(?:report|rep|for|on|date)\s+(?<date>\d{4}[-/]\d{1,2}[-/]\d{1,2})/i,
      /(?:report|rep|for|on|date)\s+(?<date>\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)/i,
      /(?:report|rep|for|on|date)\s+(?<date>[A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(normalized);
      const token = match?.groups?.date ?? match?.[1];
      if (token) {
        const parsed = this.parseDateToken(token, fallback);
        if (parsed) {
          return parsed;
        }
      }
    }

    const isoMatch = normalized.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
    if (isoMatch?.[1]) {
      const parsed = this.parseDateToken(isoMatch[1], fallback);
      if (parsed) {
        return parsed;
      }
    }

    const shortMatch = normalized.match(/(\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?)/);
    if (shortMatch?.[1]) {
      const parsed = this.parseDateToken(shortMatch[1], fallback);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private parseDateToken(token: string, fallback: Date): Date | null {
    const trimmed = token.trim();
    if (!trimmed) {
      return null;
    }

    // ISO format YYYY-MM-DD (unambiguous)
    if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(trimmed)) {
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // Ambiguous short format: could be MM/DD or DD/MM
    const monthDayMatch = trimmed.match(
      /^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/,
    );
    if (monthDayMatch) {
      const first = Number(monthDayMatch[1]);
      const second = Number(monthDayMatch[2]);
      const rawYear = monthDayMatch[3];

      if (Number.isNaN(first) || Number.isNaN(second)) {
        return null;
      }

      const candidates: Date[] = [];
      const fallbackYear = fallback.getUTCFullYear();

      // If year is explicitly provided, use only that year
      if (rawYear) {
        const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
        
        // Try MM/DD interpretation
        if (first >= 1 && first <= 12 && second >= 1 && second <= 31) {
          const mmdd = new Date(Date.UTC(year, first - 1, second));
          if (!Number.isNaN(mmdd.getTime())) {
            candidates.push(mmdd);
          }
        }

        // Try DD/MM interpretation (only if different from MM/DD)
        if (second >= 1 && second <= 12 && first >= 1 && first <= 31 && first !== second) {
          const ddmm = new Date(Date.UTC(year, second - 1, first));
          if (!Number.isNaN(ddmm.getTime())) {
            candidates.push(ddmm);
          }
        }
      } else {
        // No year provided - try current year, previous year, and next year
        // to find the date closest to submit date
        const yearsToTry = [fallbackYear, fallbackYear - 1, fallbackYear + 1];

        for (const year of yearsToTry) {
          // Try MM/DD interpretation
          if (first >= 1 && first <= 12 && second >= 1 && second <= 31) {
            const mmdd = new Date(Date.UTC(year, first - 1, second));
            if (!Number.isNaN(mmdd.getTime())) {
              candidates.push(mmdd);
            }
          }

          // Try DD/MM interpretation (only if different from MM/DD)
          if (second >= 1 && second <= 12 && first >= 1 && first <= 31 && first !== second) {
            const ddmm = new Date(Date.UTC(year, second - 1, first));
            if (!Number.isNaN(ddmm.getTime())) {
              candidates.push(ddmm);
            }
          }
        }
      }

      // Pick the candidate closest to the fallback (submit) date
      if (candidates.length === 0) {
        return null;
      }

      if (candidates.length === 1) {
        return candidates[0];
      }

      // Return the date closest to fallback, preferring dates before/on the fallback
      const fallbackTime = fallback.getTime();
      let closest = candidates[0];
      let minDiff = Math.abs(candidates[0].getTime() - fallbackTime);
      
      // Sort candidates by absolute distance from fallback
      const sorted = candidates.map(date => ({
        date,
        diff: Math.abs(date.getTime() - fallbackTime),
        isPast: date.getTime() <= fallbackTime
      })).sort((a, b) => {
        // If both are past or both are future, pick closer
        if (a.isPast === b.isPast) {
          return a.diff - b.diff;
        }
        // Prefer past dates (EOD reports are for past days)
        return a.isPast ? -1 : 1;
      });

      return sorted[0].date;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }

    return null;
  }

  private shiftDate(date: Date, days: number) {
    const shifted = new Date(date.getTime());
    shifted.setUTCDate(shifted.getUTCDate() + days);
    return shifted;
  }

  private normalizeTypeOfWork(
    value: string | undefined,
  ): 'PLANNING' | 'RESEARCH' | 'IMPLEMENTATION' | 'TESTING' {
    if (!value) {
      return 'PLANNING';
    }

    const normalized = value.trim().toUpperCase();

    // Direct match
    if (
      normalized === 'PLANNING' ||
      normalized === 'RESEARCH' ||
      normalized === 'IMPLEMENTATION' ||
      normalized === 'TESTING'
    ) {
      return normalized as 'PLANNING' | 'RESEARCH' | 'IMPLEMENTATION' | 'TESTING';
    }

    // Fuzzy matching for common variations
    if (normalized.includes('PLAN')) return 'PLANNING';
    if (normalized.includes('RESEARCH') || normalized.includes('STUDY')) return 'RESEARCH';
    if (
      normalized.includes('IMPLEMENT') ||
      normalized.includes('DEVELOP') ||
      normalized.includes('CODE') ||
      normalized.includes('BUILD')
    ) {
      return 'IMPLEMENTATION';
    }
    if (normalized.includes('TEST') || normalized.includes('QA')) return 'TESTING';

    // Default fallback
    return 'PLANNING';
  }
}


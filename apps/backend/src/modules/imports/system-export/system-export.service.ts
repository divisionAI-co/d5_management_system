import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { BaseService } from '../../../common/services/base.service';
import { ErrorMessages } from '../../../common/constants/error-messages.const';
import { Prisma } from '@prisma/client';

interface SystemExportData {
  version: string;
  exportedAt: string;
  metadata: {
    totalRecords: number;
    models: string[];
  };
  data: {
    [modelName: string]: any[];
  };
}

@Injectable()
export class SystemExportService extends BaseService {

  // Define export order to maintain referential integrity
  // Models without foreign keys first, then models that depend on them
  private readonly exportOrder = [
    // Core - no dependencies
    'user',
    'notificationSettings',
    'companySettings',
    'nationalHoliday',
    'activityType',
    'template',
    'integration',
    
    // CRM - depends on User
    'customer',
    'contact',
    'lead',
    'opportunity',
    
    // Recruitment - depends on User
    'candidate',
    'openPosition',
    'candidatePosition',
    
    // HR - depends on User, Candidate
    'employee',
    'performanceReview',
    'leaveRequest',
    'remoteWorkLog',
    
    // Billing - depends on Customer, User
    'invoice',
    
    // Email Campaigns - depends on User
    'emailCampaign',
    'emailCampaignLog',
    'emailSequence',
    'emailSequenceStep',
    
    // Tasks - depends on User
    'task',
    
    // Activities - depends on many models
    'activity',
    
    // AI Actions - depends on User
    'aiAction',
    'aiActionField',
    'aiActionCollection',
    'aiActionCollectionField',
    'aiActionAttachment',
    'aiActionExecution',
    
    // Customer Engagement - depends on Customer
    'meeting',
    'customerReport',
    
    // Notifications - depends on User
    'notification',
    
    // Integrations - depends on User
    'userCalendarIntegration',
    
    // Sessions & Security - depends on User
    'userSession',
    'passwordResetToken',
    'failedLoginAttempt',
    'accountLockout',
    
    // Audit & Rate Limiting - depends on User
    'auditLog',
    'rateLimitAttempt',
    
    // Imports
    'dataImport',
  ];

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  /**
   * Export all system data to JSON format
   */
  async exportSystemData(): Promise<SystemExportData> {
    try {
      this.logger.log('Starting system data export...');
      
      const exportData: SystemExportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        metadata: {
          totalRecords: 0,
          models: [],
        },
        data: {},
      };

      let totalRecords = 0;

      // Export each model in order
      for (const modelName of this.exportOrder) {
        try {
          const modelData = await this.exportModel(modelName);
          if (modelData && modelData.length > 0) {
            exportData.data[modelName] = modelData;
            exportData.metadata.models.push(modelName);
            totalRecords += modelData.length;
            this.logger.log(`Exported ${modelData.length} records from ${modelName}`);
          }
        } catch (error) {
          this.logger.error(`Error exporting model ${modelName}:`, error);
          // Continue with other models even if one fails
        }
      }

      exportData.metadata.totalRecords = totalRecords;
      this.logger.log(`System export completed. Total records: ${totalRecords}`);

      return exportData;
    } catch (error) {
      this.logger.error('Failed to export system data:', error);
      throw new InternalServerErrorException(ErrorMessages.FETCH_FAILED('system data'));
    }
  }

  /**
   * Export a single model
   */
  private async exportModel(modelName: string): Promise<any[]> {
    const prismaModel = this.getPrismaModel(modelName);
    if (!prismaModel) {
      return [];
    }

    try {
      // Use findMany to get all records
      const records = await (prismaModel as any).findMany({
        orderBy: { createdAt: 'asc' },
      });

      // Convert BigInt and Date objects to JSON-serializable format
      return records.map((record: any) => this.sanitizeRecord(record));
    } catch (error) {
      this.logger.error(`Error fetching records from ${modelName}:`, error);
      return [];
    }
  }

  /**
   * Get Prisma model by name
   */
  private getPrismaModel(modelName: string): any {
    // Map model names to Prisma client properties
    const modelMap: { [key: string]: string } = {
      user: 'user',
      notificationSettings: 'notificationSettings',
      companySettings: 'companySettings',
      nationalHoliday: 'nationalHoliday',
      activityType: 'activityType',
      template: 'template',
      integration: 'integration',
      customer: 'customer',
      contact: 'contact',
      lead: 'lead',
      opportunity: 'opportunity',
      candidate: 'candidate',
      openPosition: 'openPosition',
      candidatePosition: 'candidatePosition',
      employee: 'employee',
      performanceReview: 'performanceReview',
      leaveRequest: 'leaveRequest',
      remoteWorkLog: 'remoteWorkLog',
      invoice: 'invoice',
      emailCampaign: 'emailCampaign',
      emailCampaignLog: 'emailCampaignLog',
      emailSequence: 'emailSequence',
      emailSequenceStep: 'emailSequenceStep',
      task: 'task',
      activity: 'activity',
      aiAction: 'aiAction',
      aiActionField: 'aiActionField',
      aiActionCollection: 'aiActionCollection',
      aiActionCollectionField: 'aiActionCollectionField',
      aiActionAttachment: 'aiActionAttachment',
      aiActionExecution: 'aiActionExecution',
      meeting: 'meeting',
      customerReport: 'customerReport',
      notification: 'notification',
      userCalendarIntegration: 'userCalendarIntegration',
      userSession: 'userSession',
      passwordResetToken: 'passwordResetToken',
      failedLoginAttempt: 'failedLoginAttempt',
      accountLockout: 'accountLockout',
      auditLog: 'auditLog',
      rateLimitAttempt: 'rateLimitAttempt',
      dataImport: 'dataImport',
    };

    const prismaKey = modelMap[modelName];
    if (!prismaKey) {
      return null;
    }

    return (this.prisma as any)[prismaKey];
  }

  /**
   * Sanitize record for JSON serialization
   */
  private sanitizeRecord(record: any): any {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(record)) {
      if (value === null || value === undefined) {
        sanitized[key] = value;
      } else if (value instanceof Date) {
        sanitized[key] = value.toISOString();
      } else if (typeof value === 'bigint') {
        sanitized[key] = value.toString();
      } else if (value instanceof Prisma.Decimal) {
        sanitized[key] = value.toNumber();
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) => {
          if (item instanceof Date) return item.toISOString();
          if (typeof item === 'bigint') return item.toString();
          if (item instanceof Prisma.Decimal) return item.toNumber();
          return item;
        });
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeRecord(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Import system data from JSON
   */
  async importSystemData(exportData: SystemExportData, options?: { clearExisting?: boolean }): Promise<{
    success: boolean;
    imported: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let imported = 0;

    try {
      this.logger.log('Starting system data import...');

      // Validate export data structure
      if (!exportData.version || !exportData.data) {
        throw new BadRequestException(ErrorMessages.INVALID_INPUT('export data format'));
      }

      // If clearExisting is true, delete all data first in a separate transaction
      if (options?.clearExisting) {
        this.logger.log('Clearing existing data...');
        await this.prisma.$transaction(async (tx) => {
          await this.clearAllData(tx);
        });
      }

      // Import in same order as export (dependencies first, then dependents)
      // Process each model separately so one failure doesn't abort everything
      const importOrder = [...this.exportOrder];

      for (const modelName of importOrder) {
        if (!exportData.data[modelName] || exportData.data[modelName].length === 0) {
          continue;
        }

        try {
          const count = await this.importModel(modelName, exportData.data[modelName]);
          imported += count;
          this.logger.log(`Imported ${count} records into ${modelName}`);
        } catch (error: any) {
          const errorMsg = `Error importing ${modelName}: ${error.message}`;
          this.logger.error(errorMsg, error);
          errors.push(errorMsg);
          // Continue with other models
        }
      }

      this.logger.log(`System import completed. Imported: ${imported}, Errors: ${errors.length}`);

      return {
        success: errors.length === 0,
        imported,
        errors,
      };
    } catch (error: any) {
      this.logger.error('Failed to import system data:', error);
      throw new InternalServerErrorException(ErrorMessages.CREATE_FAILED('system data') + `: ${error.message}`);
    }
  }

  /**
   * Import a single model
   * Processes each record in its own transaction to allow individual failures
   */
  private async importModel(modelName: string, records: any[]): Promise<number> {
    const prismaModel = this.getPrismaModel(modelName);
    if (!prismaModel) {
      return 0;
    }

    let imported = 0;

    // Process each record in its own transaction
    // This ensures that one record failure doesn't abort the entire model import
    for (const record of records) {
      try {
        await this.prisma.$transaction(
          async (tx) => {
            const txPrismaModel = this.getPrismaModelFromTx(tx, modelName);
            if (!txPrismaModel) {
              throw new Error(`Model ${modelName} not found in transaction client`);
            }

            // Validate record has required id field
            if (!record.id || typeof record.id !== 'string') {
              throw new Error(`Record missing required 'id' field or invalid id type`);
            }

            // Remove relations that might be included in the export
            const cleanRecord = this.cleanRecordForImport(record);

            // Remove any relation objects (keep only scalar fields and foreign key IDs)
            // Prisma exports shouldn't include relations, but we'll be defensive
            const finalRecord = this.removeRelationFields(cleanRecord);

            // Use upsert to handle existing records
            await txPrismaModel.upsert({
              where: { id: record.id },
              create: finalRecord,
              update: finalRecord,
            });
          },
          {
            timeout: 10000, // 10 seconds per record
          },
        );

        imported++;
      } catch (error: any) {
        // Log detailed error information
        const errorDetails = {
          model: modelName,
          recordId: record.id,
          errorCode: error?.code,
          errorMessage: error?.message,
          meta: error?.meta,
        };
        
        this.logger.warn(
          `Failed to import record ${record.id} in ${modelName}: ${error.message}`,
          JSON.stringify(errorDetails, null, 2),
        );
        
        // Check if it's a transaction abort error (shouldn't happen with individual transactions)
        if (error?.code === '25P02' || error?.message?.includes('current transaction is aborted')) {
          this.logger.error(`Transaction aborted for record ${record.id} in ${modelName}. This shouldn't happen with individual transactions.`);
        }
        
        // Check for Prisma-specific errors
        if (error?.code && error.code.startsWith('P')) {
          this.logger.error(`Prisma error ${error.code} for record ${record.id} in ${modelName}:`, error.meta);
        }
      }
    }

    return imported;
  }

  /**
   * Get Prisma model from transaction client
   */
  private getPrismaModelFromTx(tx: any, modelName: string): any {
    const modelMap: { [key: string]: string } = {
      user: 'user',
      notificationSettings: 'notificationSettings',
      companySettings: 'companySettings',
      nationalHoliday: 'nationalHoliday',
      activityType: 'activityType',
      template: 'template',
      integration: 'integration',
      customer: 'customer',
      contact: 'contact',
      lead: 'lead',
      opportunity: 'opportunity',
      candidate: 'candidate',
      openPosition: 'openPosition',
      candidatePosition: 'candidatePosition',
      employee: 'employee',
      performanceReview: 'performanceReview',
      leaveRequest: 'leaveRequest',
      remoteWorkLog: 'remoteWorkLog',
      invoice: 'invoice',
      emailCampaign: 'emailCampaign',
      emailCampaignLog: 'emailCampaignLog',
      emailSequence: 'emailSequence',
      emailSequenceStep: 'emailSequenceStep',
      task: 'task',
      activity: 'activity',
      aiAction: 'aiAction',
      aiActionField: 'aiActionField',
      aiActionCollection: 'aiActionCollection',
      aiActionCollectionField: 'aiActionCollectionField',
      aiActionAttachment: 'aiActionAttachment',
      aiActionExecution: 'aiActionExecution',
      meeting: 'meeting',
      customerReport: 'customerReport',
      notification: 'notification',
      userCalendarIntegration: 'userCalendarIntegration',
      userSession: 'userSession',
      passwordResetToken: 'passwordResetToken',
      failedLoginAttempt: 'failedLoginAttempt',
      accountLockout: 'accountLockout',
      auditLog: 'auditLog',
      rateLimitAttempt: 'rateLimitAttempt',
      dataImport: 'dataImport',
    };

    const prismaKey = modelMap[modelName];
    if (!prismaKey) {
      return null;
    }

    return tx[prismaKey];
  }

  /**
   * Clean record for import (convert types back from JSON)
   * Note: Prisma exports don't include relations by default, so we only need to handle type conversions
   */
  private cleanRecordForImport(record: any): any {
    // Handle null/undefined
    if (record === null || record === undefined) {
      return record;
    }

    // Handle arrays - recursively clean each element
    if (Array.isArray(record)) {
      return record.map((item) => this.cleanRecordForImport(item));
    }

    // Handle primitive types
    if (typeof record !== 'object') {
      return record;
    }

    // Handle objects - recursively clean each property
    const cleaned: any = {};

    for (const [key, value] of Object.entries(record)) {
      // Skip null/undefined
      if (value === null || value === undefined) {
        cleaned[key] = value;
        continue;
      }

      // Handle empty objects for date fields - convert to null
      // Empty objects often occur when date fields are null/undefined in exports
      if (
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0 &&
        this.isDateField(key)
      ) {
        cleaned[key] = null;
        continue;
      }

      // Convert date strings back to Date objects
      if (typeof value === 'string' && this.isDateString(value)) {
        cleaned[key] = new Date(value);
      } 
      // Convert decimal values (numbers or strings) back to Prisma.Decimal for known decimal fields
      // Note: Export converts Prisma.Decimal to numbers, so we need to handle both numbers and strings
      else if (
        this.isDecimalField(key) &&
        ((typeof value === 'number') || 
         (typeof value === 'string' && this.isDecimalString(value)))
      ) {
        cleaned[key] = new Prisma.Decimal(value);
      } 
      // Recursively handle nested objects and arrays
      else if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        cleaned[key] = this.cleanRecordForImport(value);
      }
      // Keep other primitive types as-is
      else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Check if string is a date string
   */
  private isDateString(str: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str);
  }

  /**
   * Check if string is a decimal string
   */
  private isDecimalString(str: string): boolean {
    return /^-?\d+\.?\d*$/.test(str);
  }

  /**
   * Check if a field name indicates it should be a DateTime type
   */
  private isDateField(key: string): boolean {
    return (
      key.endsWith('At') || // createdAt, updatedAt, startedAt, completedAt, etc.
      key.endsWith('Date') || // startDate, endDate, etc.
      key === 'date' ||
      key === 'reminderAt' ||
      key === 'activityDate' ||
      key === 'expectedCloseDate' ||
      key === 'actualCloseDate' ||
      key === 'lastGeneratedDate'
    );
  }

  /**
   * Check if a field name indicates it should be a Decimal type
   */
  private isDecimalField(key: string): boolean {
    return (
      key.includes('Amount') || 
      key.includes('Value') || 
      key.includes('Salary') || 
      key.includes('Price') || 
      key.includes('Rate') || 
      key.includes('Total') || 
      key.includes('Subtotal') || 
      key.includes('Tax') || 
      key.includes('Hours') || 
      key.includes('Rating') ||
      key === 'monthlyValue' ||
      key === 'expectedSalary' ||
      key === 'salary' ||
      key === 'subtotal' ||
      key === 'taxAmount' ||
      key === 'taxRate' ||
      key === 'total' ||
      key === 'value' ||
      key === 'hoursWorked' ||
      key === 'estimatedHours' ||
      key === 'actualHours' ||
      key === 'overallRating'
    );
  }

  /**
   * Remove relation fields from record (keep only scalar fields and foreign key IDs)
   * This is a safety measure in case the export includes relation objects
   */
  private removeRelationFields(record: any): any {
    if (record === null || record === undefined) {
      return record;
    }

    if (Array.isArray(record)) {
      return record.map((item) => this.removeRelationFields(item));
    }

    if (typeof record !== 'object') {
      return record;
    }

    const cleaned: any = {};

    for (const [key, value] of Object.entries(record)) {
      // Skip relation objects (objects with 'id' and other relation-like properties)
      // Keep scalar values, arrays of scalars, and foreign key IDs (strings)
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date) &&
        !(value instanceof Prisma.Decimal)
      ) {
        // This looks like a relation object - skip it
        // Foreign keys should be stored as simple string IDs, not objects
        continue;
      }

      // Recursively clean nested structures
      if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        cleaned[key] = this.removeRelationFields(value);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Clear all data from database (in reverse dependency order)
   */
  private async clearAllData(tx: any): Promise<void> {
    const clearOrder = [...this.exportOrder].reverse();

    for (const modelName of clearOrder) {
      try {
        const prismaModel = this.getPrismaModelFromTx(tx, modelName);
        if (prismaModel) {
          await prismaModel.deleteMany({});
          this.logger.log(`Cleared ${modelName}`);
        }
      } catch (error) {
        this.logger.warn(`Failed to clear ${modelName}:`, error);
        // Continue with other models
      }
    }
  }
}


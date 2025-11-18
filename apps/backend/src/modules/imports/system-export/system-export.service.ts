import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
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
export class SystemExportService {
  private readonly logger = new Logger(SystemExportService.name);

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

  constructor(private readonly prisma: PrismaService) {}

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
      throw new InternalServerErrorException('Failed to export system data');
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
        throw new BadRequestException('Invalid export data format');
      }

      // Use a transaction for the entire import
      await this.prisma.$transaction(
        async (tx) => {
          // If clearExisting is true, delete all data first
          if (options?.clearExisting) {
            this.logger.log('Clearing existing data...');
            await this.clearAllData(tx);
          }

          // Import in same order as export (dependencies first, then dependents)
          const importOrder = [...this.exportOrder];

          for (const modelName of importOrder) {
            if (!exportData.data[modelName] || exportData.data[modelName].length === 0) {
              continue;
            }

            try {
              const count = await this.importModel(tx, modelName, exportData.data[modelName]);
              imported += count;
              this.logger.log(`Imported ${count} records into ${modelName}`);
            } catch (error: any) {
              const errorMsg = `Error importing ${modelName}: ${error.message}`;
              this.logger.error(errorMsg, error);
              errors.push(errorMsg);
              // Continue with other models
            }
          }
        },
        {
          maxWait: 60000, // 60 seconds
          timeout: 300000, // 5 minutes
        },
      );

      this.logger.log(`System import completed. Imported: ${imported}, Errors: ${errors.length}`);

      return {
        success: errors.length === 0,
        imported,
        errors,
      };
    } catch (error: any) {
      this.logger.error('Failed to import system data:', error);
      throw new InternalServerErrorException(`Failed to import system data: ${error.message}`);
    }
  }

  /**
   * Import a single model
   */
  private async importModel(tx: any, modelName: string, records: any[]): Promise<number> {
    const prismaModel = this.getPrismaModelFromTx(tx, modelName);
    if (!prismaModel) {
      return 0;
    }

    let imported = 0;

    for (const record of records) {
      try {
        // Remove relations that might be included in the export
        const cleanRecord = this.cleanRecordForImport(record);

        // Use upsert to handle existing records
        await prismaModel.upsert({
          where: { id: record.id },
          create: cleanRecord,
          update: cleanRecord,
        });

        imported++;
      } catch (error: any) {
        this.logger.warn(`Failed to import record ${record.id} in ${modelName}: ${error.message}`);
        // Continue with next record
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
    const cleaned: any = {};

    for (const [key, value] of Object.entries(record)) {
      // Skip null/undefined
      if (value === null || value === undefined) {
        cleaned[key] = value;
        continue;
      }

      // Convert date strings back to Date objects
      if (typeof value === 'string' && this.isDateString(value)) {
        cleaned[key] = new Date(value);
      } 
      // Convert decimal strings back to Prisma.Decimal for known decimal fields
      else if (
        typeof value === 'string' && 
        this.isDecimalString(value) && 
        (key.includes('Amount') || 
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
         key === 'overallRating')
      ) {
        cleaned[key] = new Prisma.Decimal(value);
      } 
      // Keep arrays and other types as-is
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


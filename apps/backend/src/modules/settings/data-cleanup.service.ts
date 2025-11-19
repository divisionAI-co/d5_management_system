import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class DataCleanupService {
  private readonly logger = new Logger(DataCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clean up contacts, leads, and opportunities for reimport
   * Deletion order respects foreign key constraints:
   * 1. Opportunities (cascade from Leads, but we delete explicitly first)
   * 2. Leads (cascades to Opportunities, LeadContact, Activities)
   * 3. Contacts (cascades to LeadContact, Activities)
   */
  async cleanupCrmData() {
    this.logger.log('Starting CRM data cleanup...');

    const results = {
      opportunities: 0,
      leads: 0,
      contacts: 0,
      errors: [] as string[],
    };

    try {
      // Step 1: Delete all Opportunities
      // This will cascade delete OpenPositions and related Activities
      const opportunityCount = await this.prisma.opportunity.deleteMany({});
      results.opportunities = opportunityCount.count;
      this.logger.log(`Deleted ${results.opportunities} opportunities`);

      // Step 2: Delete all Leads
      // This will cascade delete:
      // - Opportunities (already deleted, but safe)
      // - LeadContact entries
      // - Activities related to leads
      const leadCount = await this.prisma.lead.deleteMany({});
      results.leads = leadCount.count;
      this.logger.log(`Deleted ${results.leads} leads`);

      // Step 3: Delete all Contacts
      // This will cascade delete:
      // - LeadContact entries (junction table, already cleaned by Leads)
      // - Activities related to contacts
      const contactCount = await this.prisma.contact.deleteMany({});
      results.contacts = contactCount.count;
      this.logger.log(`Deleted ${results.contacts} contacts`);

      this.logger.log('CRM data cleanup completed successfully');
      return {
        success: true,
        message: 'CRM data cleaned up successfully',
        results,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error during CRM data cleanup: ${errorMessage}`, error);
      results.errors.push(errorMessage);

      return {
        success: false,
        message: 'Error during CRM data cleanup',
        results,
        error: errorMessage,
      };
    }
  }

  /**
   * Get counts of contacts, leads, and opportunities before cleanup
   */
  async getCrmDataCounts() {
    const [contactsCount, leadsCount, opportunitiesCount] = await Promise.all([
      this.prisma.contact.count(),
      this.prisma.lead.count(),
      this.prisma.opportunity.count(),
    ]);

    return {
      contacts: contactsCount,
      leads: leadsCount,
      opportunities: opportunitiesCount,
      total: contactsCount + leadsCount + opportunitiesCount,
    };
  }
}


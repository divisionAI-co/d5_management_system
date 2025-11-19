#!/usr/bin/env ts-node

/**
 * Standalone script to clean up CRM data (contacts, leads, opportunities)
 * 
 * Usage:
 *   npx ts-node scripts/cleanup-crm-data.ts
 * 
 * Or with tsx:
 *   npx tsx scripts/cleanup-crm-data.ts
 * 
 * ⚠️ WARNING: This will permanently delete all contacts, leads, and opportunities!
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting CRM data cleanup...\n');

  try {
    // Get counts before deletion
    const [contactsCount, leadsCount, opportunitiesCount] = await Promise.all([
      prisma.contact.count(),
      prisma.lead.count(),
      prisma.opportunity.count(),
    ]);

    console.log('📊 Current data counts:');
    console.log(`   - Contacts: ${contactsCount}`);
    console.log(`   - Leads: ${leadsCount}`);
    console.log(`   - Opportunities: ${opportunitiesCount}`);
    console.log(`   - Total: ${contactsCount + leadsCount + opportunitiesCount}\n`);

    if (contactsCount === 0 && leadsCount === 0 && opportunitiesCount === 0) {
      console.log('✅ No data to clean up. Database is already empty.');
      return;
    }

    // Step 1: Delete all Opportunities
    console.log('🗑️  Deleting opportunities...');
    const opportunityResult = await prisma.opportunity.deleteMany({});
    console.log(`   ✓ Deleted ${opportunityResult.count} opportunities\n`);

    // Step 2: Delete all Leads
    // This will cascade delete LeadContact entries and Activities
    console.log('🗑️  Deleting leads...');
    const leadResult = await prisma.lead.deleteMany({});
    console.log(`   ✓ Deleted ${leadResult.count} leads\n`);

    // Step 3: Delete all Contacts
    // This will cascade delete remaining LeadContact entries and Activities
    console.log('🗑️  Deleting contacts...');
    const contactResult = await prisma.contact.deleteMany({});
    console.log(`   ✓ Deleted ${contactResult.count} contacts\n`);

    // Verify deletion
    const [remainingContacts, remainingLeads, remainingOpportunities] = await Promise.all([
      prisma.contact.count(),
      prisma.lead.count(),
      prisma.opportunity.count(),
    ]);

    console.log('✅ Cleanup completed successfully!\n');
    console.log('📊 Remaining data counts:');
    console.log(`   - Contacts: ${remainingContacts}`);
    console.log(`   - Leads: ${remainingLeads}`);
    console.log(`   - Opportunities: ${remainingOpportunities}`);

    if (remainingContacts === 0 && remainingLeads === 0 && remainingOpportunities === 0) {
      console.log('\n✨ All CRM data has been successfully removed. Ready for reimport!');
    } else {
      console.log('\n⚠️  Warning: Some data still remains. Please check for errors.');
    }
  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


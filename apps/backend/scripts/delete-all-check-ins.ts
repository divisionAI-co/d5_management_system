#!/usr/bin/env ts-node

/**
 * Standalone script to delete all check-in/check-out records
 * 
 * Usage:
 *   npx ts-node scripts/delete-all-check-ins.ts
 * 
 * Or with tsx:
 *   npx tsx scripts/delete-all-check-ins.ts
 * 
 * ⚠️ WARNING: This will permanently delete all check-in and check-out records!
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting check-ins cleanup...\n');

  try {
    // Get count before deletion
    const checkInsCount = await prisma.employeeCheckIn.count();

    console.log('📊 Current check-ins count:');
    console.log(`   - Total check-ins: ${checkInsCount}\n`);

    if (checkInsCount === 0) {
      console.log('✅ No check-ins to delete. Database is already empty.');
      return;
    }

    // Delete all check-ins
    console.log('🗑️  Deleting all check-ins...');
    const result = await prisma.employeeCheckIn.deleteMany({});
    console.log(`   ✓ Deleted ${result.count} check-ins\n`);

    // Verify deletion
    const remainingCount = await prisma.employeeCheckIn.count();

    console.log('✅ Cleanup completed successfully!\n');
    console.log('📊 Remaining check-ins count:');
    console.log(`   - Total check-ins: ${remainingCount}`);

    if (remainingCount === 0) {
      console.log('\n✨ All check-ins have been successfully removed. Ready for migration!');
    } else {
      console.log('\n⚠️  Warning: Some check-ins still remain. Please check for errors.');
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


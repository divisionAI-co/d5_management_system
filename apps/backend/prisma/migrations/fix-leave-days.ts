/**
 * Data Migration: Recalculate totalDays for existing leave requests
 * 
 * This script recalculates totalDays for all existing leave requests
 * to exclude weekends and holidays, matching the new calculation logic.
 * 
 * Run with: npx ts-node prisma/migrations/fix-leave-days.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Calculate working days between two dates, excluding weekends and holidays
 */
async function calculateWorkingDays(startDate: Date, endDate: Date): Promise<number> {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start > end) {
    return 0;
  }

  // Get all holidays in the date range
  const holidays = await prisma.nationalHoliday.findMany({
    where: {
      country: 'AL',
      date: {
        gte: start,
        lte: end,
      },
    },
  });

  const holidayDates = new Set(
    holidays.map((h) => {
      const d = new Date(h.date);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }),
  );

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    const currentTime = current.getTime();

    // Check if it's not a weekend (Saturday = 6, Sunday = 0)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    // Check if it's not a holiday
    const isHoliday = holidayDates.has(currentTime);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

async function main() {
  console.log('🔄 Starting leave request data migration...\n');

  // Get all leave requests
  const leaveRequests = await prisma.leaveRequest.findMany({
    select: {
      id: true,
      startDate: true,
      endDate: true,
      totalDays: true,
      status: true,
      type: true,
      employee: {
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
    orderBy: {
      startDate: 'asc',
    },
  });

  console.log(`Found ${leaveRequests.length} leave requests to check\n`);

  let updatedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const request of leaveRequests) {
    try {
      const calculatedDays = await calculateWorkingDays(request.startDate, request.endDate);

      if (calculatedDays !== request.totalDays) {
        const userName = request.employee.user
          ? `${request.employee.user.firstName} ${request.employee.user.lastName}`
          : 'Unknown';

        console.log(`📝 Updating request for ${userName}:`);
        console.log(`   Dates: ${request.startDate.toISOString().split('T')[0]} to ${request.endDate.toISOString().split('T')[0]}`);
        console.log(`   Old days: ${request.totalDays} → New days: ${calculatedDays}`);
        console.log(`   Type: ${request.type}, Status: ${request.status}`);

        await prisma.leaveRequest.update({
          where: { id: request.id },
          data: { totalDays: calculatedDays },
        });

        updatedCount++;
      } else {
        unchangedCount++;
      }
    } catch (error) {
      console.error(`❌ Error updating request ${request.id}:`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Updated:   ${updatedCount} requests`);
  console.log(`⏭️  Unchanged: ${unchangedCount} requests`);
  console.log(`❌ Errors:    ${errorCount} requests`);
  console.log('='.repeat(60));

  if (updatedCount > 0) {
    console.log('\n💡 Note: Leave balances will be automatically recalculated when users view their dashboard.');
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


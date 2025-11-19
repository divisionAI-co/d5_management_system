# Backend Scripts

This directory contains utility scripts for database maintenance and migrations.

## Available Scripts

### cleanup-crm-data.ts

Cleans up CRM data (contacts, leads, and opportunities) to prepare for reimport.

**⚠️ WARNING:** This will permanently delete all contacts, leads, and opportunities. This action cannot be undone!

**When to use:**
- Before reimporting CRM data from an external source
- When you need to reset CRM data for testing
- After data migration or cleanup operations

**Usage:**
```bash
cd apps/backend
npx ts-node scripts/cleanup-crm-data.ts
```

Or with tsx:
```bash
cd apps/backend
npx tsx scripts/cleanup-crm-data.ts
```

**What it does:**
1. Shows current counts of contacts, leads, and opportunities
2. Deletes all opportunities (cascades to OpenPositions and Activities)
3. Deletes all leads (cascades to LeadContact entries and Activities)
4. Deletes all contacts (cascades to remaining LeadContact entries and Activities)
5. Verifies deletion and shows final counts

**Safety:**
- Shows data counts before deletion
- Uses proper deletion order to respect foreign key constraints
- Provides clear output and verification
- Can be run via API endpoint (requires admin role) at `POST /admin/data-cleanup/crm`

**Example output:**
```
🚀 Starting CRM data cleanup...

📊 Current data counts:
   - Contacts: 150
   - Leads: 75
   - Opportunities: 30
   - Total: 255

🗑️  Deleting opportunities...
   ✓ Deleted 30 opportunities

🗑️  Deleting leads...
   ✓ Deleted 75 leads

🗑️  Deleting contacts...
   ✓ Deleted 150 contacts

✅ Cleanup completed successfully!

📊 Remaining data counts:
   - Contacts: 0
   - Leads: 0
   - Opportunities: 0

✨ All CRM data has been successfully removed. Ready for reimport!
```

**API Alternative:**
You can also use the API endpoint (requires admin authentication):
```bash
# Get counts first
curl -X GET http://localhost:3000/admin/data-cleanup/counts \
  -H "Authorization: Bearer YOUR_TOKEN"

# Perform cleanup
curl -X POST http://localhost:3000/admin/data-cleanup/crm \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### fix-leave-days.sh

Recalculates `totalDays` for all existing leave requests to exclude weekends and holidays.

**When to use:**
- After implementing working days calculation
- If you suspect leave days are incorrect
- After adding/updating holiday data

**Usage:**
```bash
cd apps/backend
bash scripts/fix-leave-days.sh
```

Or directly with the TypeScript file:
```bash
cd apps/backend
npx ts-node prisma/migrations/fix-leave-days.ts
```

**What it does:**
1. Fetches all leave requests from the database
2. Recalculates working days (excluding weekends and holidays)
3. Updates records where totalDays differs from the calculated value
4. Provides a summary of changes

**Safety:**
- Read-only check first (compares without updating)
- Shows what will change before updating
- Can be run multiple times safely (idempotent)
- Does not affect approved/rejected status

**Example output:**
```
Found 25 leave requests to check

📝 Updating request for John Doe:
   Dates: 2025-12-17 to 2025-12-31
   Old days: 15 → New days: 10
   Type: ANNUAL, Status: APPROVED

============================================================
📊 Migration Summary:
============================================================
✅ Updated:   12 requests
⏭️  Unchanged: 13 requests
❌ Errors:    0 requests
============================================================
```

## Production Deployment

Before running in production:

1. **Create a backup:**
   ```bash
   pg_dump -h localhost -U postgres -d d5_management > backup_before_migration.sql
   ```

2. **Test in staging first:**
   ```bash
   # In staging environment
   cd apps/backend
   bash scripts/fix-leave-days.sh
   ```

3. **Run in production:**
   ```bash
   # In production environment
   cd apps/backend
   bash scripts/fix-leave-days.sh
   ```

4. **Verify results:**
   - Check the summary output
   - Spot-check a few leave requests manually
   - Verify leave balances are correct

## Adding New Scripts

When adding new maintenance scripts:

1. Place TypeScript files in `prisma/migrations/`
2. Place bash wrappers in `scripts/`
3. Make bash scripts executable: `chmod +x scripts/your-script.sh`
4. Document in this README
5. Include safety checks and confirmations
6. Provide clear output and summaries


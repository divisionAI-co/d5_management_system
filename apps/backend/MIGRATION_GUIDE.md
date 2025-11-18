# Data Migration Guide: Leave Request Days

## Problem

Existing leave requests in the database have `totalDays` calculated as calendar days, not working days. This means weekends and holidays were counted in the leave balance, which is incorrect.

**Example:**
- **Old calculation**: Dec 17, 2025 - Dec 31, 2025 = 15 days (including weekends/holidays)
- **New calculation**: Dec 17, 2025 - Dec 31, 2025 = 10 days (working days only)

## Solution

Run the data migration script to recalculate `totalDays` for all existing leave requests.

## Before Running Migration

### 1. Backup Your Database (IMPORTANT!)

**PostgreSQL:**
```bash
# Local/Development
pg_dump -h localhost -U postgres -d d5_management > backup_$(date +%Y%m%d_%H%M%S).sql

# Production (via SSH)
ssh user@server "pg_dump -h localhost -U postgres -d d5_management" > backup_prod_$(date +%Y%m%d_%H%M%S).sql
```

**Or use your hosting provider's backup tools** (recommended for production)

### 2. Test in Development/Staging First

Always test the migration in a non-production environment first.

## Running the Migration

### Option 1: Using npm script (Recommended)

```bash
cd apps/backend
npm run fix:leave-days
```

### Option 2: Direct TypeScript execution

```bash
cd apps/backend
npx ts-node prisma/migrations/fix-leave-days.ts
```

### Option 3: Using bash script (Linux/Mac)

```bash
cd apps/backend
bash scripts/fix-leave-days.sh
```

## What the Migration Does

1. **Fetches** all leave requests from the database
2. **Calculates** working days for each request (excluding weekends and holidays)
3. **Compares** calculated days with current `totalDays`
4. **Updates** only records where values differ
5. **Reports** a summary of changes

## Expected Output

```
🔄 Starting leave request data migration...

Found 25 leave requests to check

📝 Updating request for John Doe:
   Dates: 2025-12-17 to 2025-12-31
   Old days: 15 → New days: 10
   Type: ANNUAL, Status: APPROVED

📝 Updating request for Jane Smith:
   Dates: 2025-12-23 to 2025-12-27
   Old days: 5 → New days: 4
   Type: ANNUAL, Status: PENDING

============================================================
📊 Migration Summary:
============================================================
✅ Updated:   12 requests
⏭️  Unchanged: 13 requests
❌ Errors:    0 requests
============================================================

💡 Note: Leave balances will be automatically recalculated when users view their dashboard.
```

## After Migration

### 1. Verify Changes

Check a few leave requests manually:

```sql
SELECT 
  lr.id,
  CONCAT(u.first_name, ' ', u.last_name) as employee_name,
  lr.start_date,
  lr.end_date,
  lr.total_days,
  lr.type,
  lr.status
FROM leave_requests lr
JOIN employees e ON lr.employee_id = e.id
JOIN users u ON e.user_id = u.id
ORDER BY lr.start_date DESC
LIMIT 10;
```

### 2. Notify Users (Optional)

If leave balances changed significantly, consider notifying affected users:

```
Subject: Leave Balance Update

Dear Team,

We've updated our leave management system to calculate working days 
more accurately by excluding weekends and national holidays.

Your leave balance may have changed slightly. Please review your 
leave requests and current balance in the system.

If you have any questions, please contact HR.
```

### 3. Monitor Leave Balances

- Check that no balances are negative
- Verify annual allowances are correct
- Review any edge cases

## Rollback (If Needed)

If something goes wrong, restore from your backup:

```bash
# Stop the application
pm2 stop all

# Restore database
psql -h localhost -U postgres -d d5_management < backup_TIMESTAMP.sql

# Restart application
pm2 start all
```

## Production Deployment Checklist

- [ ] Backup database created and verified
- [ ] Migration tested in staging environment
- [ ] Scheduled during low-traffic period
- [ ] Team notified about maintenance window
- [ ] Rollback plan prepared
- [ ] Run migration script
- [ ] Verify changes in database
- [ ] Test leave request functionality
- [ ] Monitor for issues
- [ ] Notify users if needed

## Troubleshooting

### Migration runs but shows 0 updates

This means all leave requests already have correct working days calculated. No action needed.

### "Cannot find module" error

Make sure you're in the correct directory:
```bash
cd apps/backend
npm install  # Ensure dependencies are installed
```

### Database connection error

Check your `.env` file has correct `DATABASE_URL`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/d5_management"
```

### Permission errors on bash script

```bash
chmod +x scripts/fix-leave-days.sh
```

## Re-running the Migration

The script is **idempotent** - you can run it multiple times safely. It will:
- Only update records where values differ
- Skip records that are already correct
- Not duplicate updates

## Support

If you encounter issues:
1. Check the error messages in the output
2. Review database logs
3. Restore from backup if needed
4. Contact development team

## Related Changes

This migration is part of the leave request improvement that:
- Calculates working days (excludes weekends/holidays)
- Updates both backend calculation and frontend display
- Provides accurate leave balances
- Prevents overbooking of leave


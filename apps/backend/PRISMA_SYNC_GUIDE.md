# Prisma Schema Sync Guide

## Method 1: Pull Schema from Online Database (Recommended)

This method pulls the current database structure from your online database and updates your local schema.

### Step 1: Set Online Database URL

Create a temporary `.env.online` file or set the environment variable:

```bash
cd apps/backend

# Option A: Create a temporary .env file
cp .env .env.backup
# Edit .env and set DATABASE_URL to your online database

# Option B: Use environment variable directly
export DATABASE_URL="postgresql://user:password@online-host:5432/database"
```

### Step 2: Pull Schema from Online Database

```bash
cd apps/backend

# Pull the schema from online database
npx prisma db pull

# This will update your schema.prisma file to match the online database
```

### Step 3: Review Changes

```bash
# Check what changed
git diff prisma/schema.prisma
```

### Step 4: Mark Existing Migrations as Applied

If your online database already has migrations applied, mark them as applied locally:

```bash
# Check migration status
npx prisma migrate status

# Mark specific migrations as applied (if they're already in the online DB)
npx prisma migrate resolve --applied 20251120085001_
npx prisma migrate resolve --applied 20251120100315_add_task_relationships
# ... repeat for each migration that's already applied online
```

### Step 5: Generate Prisma Client

```bash
npx prisma generate
```

---

## Method 2: Baseline Migrations (If Online DB Has No Migration History)

If your online database doesn't have a migration history table, create a baseline:

### Step 1: Create Baseline Migration

```bash
cd apps/backend

# Pull schema from online
npx prisma db pull

# Create a baseline migration that matches current state
npx prisma migrate dev --name baseline --create-only

# Mark it as applied (since it's already in the database)
npx prisma migrate resolve --applied baseline
```

### Step 2: Test New Migrations

Now you can create and test new migrations:

```bash
# Create new migration without applying
npx prisma migrate dev --create-only --name your_new_migration

# Review the SQL
cat prisma/migrations/[timestamp]_your_new_migration/migration.sql

# Apply when ready
npx prisma migrate dev
```

---

## Method 3: Sync Migration History

If you want to sync the migration history from online to local:

### Step 1: Check Online Migration Status

```bash
# Connect to online database and check _prisma_migrations table
psql $ONLINE_DATABASE_URL -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;"
```

### Step 2: Mark Migrations as Applied Locally

```bash
cd apps/backend

# For each migration that exists online, mark it as applied locally
npx prisma migrate resolve --applied migration_name_1
npx prisma migrate resolve --applied migration_name_2
# ... etc
```

### Step 3: Verify Sync

```bash
npx prisma migrate status
```

Should show: "Database schema is up to date!"

---

## Quick Reference Commands

```bash
# Pull schema from database
npx prisma db pull

# Check migration status
npx prisma migrate status

# Mark migration as applied
npx prisma migrate resolve --applied migration_name

# Mark migration as rolled back
npx prisma migrate resolve --rolled-back migration_name

# Create migration without applying
npx prisma migrate dev --create-only --name migration_name

# Generate Prisma client
npx prisma generate

# Validate schema
npx prisma validate
```

---

## Testing Migrations After Sync

Once your local environment matches online:

1. **Create new migration:**
   ```bash
   npx prisma migrate dev --create-only --name test_migration
   ```

2. **Review the SQL:**
   ```bash
   cat prisma/migrations/[timestamp]_test_migration/migration.sql
   ```

3. **Test on local database:**
   ```bash
   # Make sure DATABASE_URL points to local/test DB
   npx prisma migrate dev
   ```

4. **If test passes, apply to online:**
   ```bash
   # Switch DATABASE_URL to online
   npx prisma migrate deploy
   ```

---

## Troubleshooting

### Error: "Migration X is not in the migrations directory"

**Solution:** The migration exists in the online database but not locally. Either:
- Pull the migration file from your version control
- Or mark it as applied: `npx prisma migrate resolve --applied X`

### Error: "Database schema is out of sync"

**Solution:** 
```bash
# Pull current schema
npx prisma db pull

# Or reset and reapply
npx prisma migrate reset  # WARNING: Deletes local data
```

### Error: "Migration history diverged"

**Solution:**
```bash
# Check what's different
npx prisma migrate status

# Resolve conflicts manually or reset migration history
```

---

## Best Practices

1. **Always backup before syncing:**
   ```bash
   cp prisma/schema.prisma prisma/schema.prisma.backup
   ```

2. **Use separate databases for testing:**
   - Local dev database
   - Test/staging database  
   - Production database

3. **Review migrations before applying:**
   Always use `--create-only` first, review SQL, then apply

4. **Keep migration history in sync:**
   Use version control for migration files and sync regularly


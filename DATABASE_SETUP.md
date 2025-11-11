# Database Setup Guide

Complete guide for setting up the PostgreSQL database for D5 Management System.

---

## 🎯 Quick Setup (TL;DR)

```bash
# 1. Create database
psql -U postgres -c "CREATE DATABASE d5_management;"

# 2. Configure connection
cd apps/backend
cp .env.example .env
# Edit .env and set DATABASE_URL

# 3. Run migration and seed
npx prisma migrate deploy
npm run seed
```

---

## 📋 Detailed Steps

### Step 1: Install PostgreSQL

If you haven't installed PostgreSQL yet:

**macOS (Homebrew)**:
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Ubuntu/Debian**:
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows**:
- Download from: https://www.postgresql.org/download/windows/
- Run installer and follow wizard
- Remember the password you set for `postgres` user

### Step 2: Create Database

**Option A: Using psql (Command Line)**

```bash
# Connect to PostgreSQL
psql -U postgres

# If prompted for password, enter your postgres password

# Create database
CREATE DATABASE d5_management;

# Verify it was created
\l

# You should see d5_management in the list

# Exit psql
\q
```

**Option B: Using pgAdmin (GUI)**

1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Right-click "Databases" → "Create" → "Database"
4. Database name: `d5_management`
5. Click "Save"

**Option C: Using DBeaver or other GUI tools**

Similar process - create a new database named `d5_management`

### Step 3: Configure Environment Variables

```bash
cd apps/backend

# Copy example environment file
cp .env.example .env
```

Edit `.env` and configure the `DATABASE_URL`:

```env
# Format: postgresql://USERNAME:PASSWORD@HOST:PORT/DATABASE
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/d5_management"
```

**Replace**:
- `YOUR_PASSWORD` with your PostgreSQL password
- `postgres` with your username (if different)
- `localhost` with your host (if remote)
- `5432` with your port (if different)

**Examples**:

```env
# Local development (default)
DATABASE_URL="postgresql://postgres:admin123@localhost:5432/d5_management"

# Custom username
DATABASE_URL="postgresql://myuser:mypassword@localhost:5432/d5_management"

# Remote database
DATABASE_URL="postgresql://user:pass@db.example.com:5432/d5_management"

# With connection pooling
DATABASE_URL="postgresql://user:pass@localhost:5432/d5_management?pgbouncer=true"

# With SSL (production)
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

### Step 4: Generate Prisma Client

```bash
# Still in apps/backend directory
npx prisma generate
```

**Expected output**:
```
✔ Generated Prisma Client (X.X.X) to ./node_modules/@prisma/client
```

### Step 5: Run Database Migration

The migration will create all tables, indexes, and relationships.

```bash
npx prisma migrate deploy
```

**Expected output**:
```
1 migration found in prisma/migrations
Applying migration `20251111000000_initial_schema`
The following migration(s) have been applied:

migrations/
  └─ 20251111000000_initial_schema/
    └─ migration.sql

All migrations have been successfully applied.
```

**Alternative** (for development):
```bash
npx prisma migrate dev
```

This will prompt you for a migration name. Just press Enter to accept the default.

### Step 6: Seed the Database

This creates test users and sample data.

```bash
npm run seed
```

**Expected output**:
```
🌱 Seeding database...

👥 Creating users...
  ✅ Admin: admin@d5.com
  ✅ Salesperson: sales@d5.com
  ✅ Account Manager: manager@d5.com
  ✅ Recruiter: recruiter@d5.com
  ✅ HR: hr@d5.com
  ✅ Employee: employee@d5.com

⚙️  Creating company settings...
  ✅ Company settings created

🎉 Creating national holidays...
  ✅ 13 Albanian holidays created

🏢 Creating sample customers...
  ✅ Customer: Tech Solutions Inc
  ✅ Customer: Global Retail Corp
  ✅ Customer: StartupXYZ

... (more output)

🎉 Seeding completed successfully!
```

### Step 7: Verify Database

**Option 1: Prisma Studio (Visual GUI)**

```bash
npx prisma studio
```

This opens a browser at http://localhost:5555 where you can:
- Browse all tables
- View and edit data
- Run queries

**Option 2: psql**

```bash
psql -U postgres -d d5_management

# List tables
\dt

# Count users
SELECT COUNT(*) FROM users;
# Should return 6

# View users
SELECT email, role FROM users;

# Exit
\q
```

---

## 📊 Database Schema Overview

After migration, you'll have these tables:

### Core Tables
- `users` - User accounts (6 test users)
- `notification_settings` - User notification preferences
- `company_settings` - System-wide settings

### CRM Tables
- `customers` - Customer/company records (3 sample)
- `leads` - Sales leads (2 sample)
- `opportunities` - Sales opportunities
- `email_campaigns` - Email marketing campaigns
- `email_campaign_logs` - Campaign tracking
- `email_sequences` - Automated email sequences
- `email_sequence_steps` - Sequence steps

### Recruitment Tables
- `candidates` - Job candidates (2 sample)
- `open_positions` - Job openings
- `candidate_positions` - Candidate-position linking

### HR Tables
- `employees` - Employee records (1 sample)
- `performance_reviews` - Performance review records
- `leave_requests` - Leave/vacation requests
- `remote_work_logs` - Remote work tracking
- `national_holidays` - Holiday calendar (13 for Albania)

### Task & Activity Tables
- `tasks` - Task management (3 sample)
- `activities` - Universal activity log (3 sample)
- `eod_reports` - End-of-day reports

### Finance Tables
- `invoices` - Invoice records

### Customer Engagement Tables
- `meetings` - Meeting records
- `customer_reports` - Monthly customer reports

### System Tables
- `notifications` - User notifications
- `templates` - HTML templates (2 default)
- `data_imports` - Import job tracking
- `integrations` - External integrations
- `audit_logs` - Audit trail

---

## 🔄 Common Database Operations

### Reset Database (WARNING: Deletes all data)

```bash
cd apps/backend
npx prisma migrate reset
```

This will:
1. Drop the database
2. Create it again
3. Run all migrations
4. Run seed script

### Create New Migration

After changing `schema.prisma`:

```bash
npx prisma migrate dev --name describe_your_changes
```

Example:
```bash
npx prisma migrate dev --name add_user_avatar_field
```

### View Database in Browser

```bash
npx prisma studio
```

Opens at: http://localhost:5555

### Generate Prisma Client (after schema changes)

```bash
npx prisma generate
```

### Pull Schema from Existing Database

```bash
npx prisma db pull
```

### Push Schema Changes (without migration)

⚠️ For prototyping only, not recommended for production:

```bash
npx prisma db push
```

---

## 🐛 Troubleshooting

### Error: "Can't reach database server"

**Problem**: PostgreSQL is not running or connection details are wrong.

**Solutions**:

1. Check if PostgreSQL is running:
   ```bash
   # macOS
   brew services list
   
   # Ubuntu/Linux
   sudo systemctl status postgresql
   
   # Windows: Check Services app
   ```

2. Start PostgreSQL:
   ```bash
   # macOS
   brew services start postgresql@14
   
   # Ubuntu/Linux
   sudo systemctl start postgresql
   ```

3. Verify connection details in `.env`

4. Test connection:
   ```bash
   psql -U postgres -d d5_management
   ```

### Error: "Database does not exist"

**Solution**: Create the database:

```bash
psql -U postgres -c "CREATE DATABASE d5_management;"
```

### Error: "Authentication failed"

**Problem**: Wrong username or password in `DATABASE_URL`.

**Solutions**:

1. Check your PostgreSQL password
2. Update `.env` with correct credentials
3. For local development, you might need to edit `pg_hba.conf`:
   ```bash
   # Find pg_hba.conf location
   psql -U postgres -c "SHOW hba_file;"
   
   # Edit file (requires sudo/admin)
   # Change METHOD from 'peer' to 'md5' or 'trust' for local connections
   ```

### Error: "Migration failed"

**Solution**: Reset and try again:

```bash
npx prisma migrate reset
```

### Error: "Prisma Client not generated"

**Solution**:

```bash
npx prisma generate
```

### Seed Script Fails

**Problem**: Usually due to existing data or constraint violations.

**Solution**: Reset database and seed again:

```bash
npx prisma migrate reset
# This will prompt, type 'yes'
```

### Want Fresh Start

```bash
# Complete reset
dropdb -U postgres d5_management
createdb -U postgres d5_management
cd apps/backend
npx prisma migrate deploy
npm run seed
```

---

## 📈 Performance Optimization

### Add Indexes (if needed)

Already included in schema:
- Foreign keys
- Frequently queried fields
- Unique constraints

### Connection Pooling

For production, use PgBouncer or similar:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/db?pgbouncer=true&connection_limit=10"
```

### Query Optimization

Use Prisma's query logging:

```typescript
// In main.ts or app.module.ts
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});
```

---

## 🔒 Security Best Practices

### For Production

1. **Use strong passwords**:
   ```sql
   ALTER USER postgres WITH PASSWORD 'very-strong-password-here';
   ```

2. **Create dedicated user**:
   ```sql
   CREATE USER d5_app WITH PASSWORD 'app-password';
   GRANT ALL PRIVILEGES ON DATABASE d5_management TO d5_app;
   ```

3. **Use SSL**:
   ```env
   DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
   ```

4. **Restrict network access** in `pg_hba.conf`

5. **Regular backups**:
   ```bash
   pg_dump -U postgres d5_management > backup.sql
   ```

6. **Use environment-specific `.env` files**

---

## 📦 Backup & Restore

### Backup Database

```bash
# Full backup
pg_dump -U postgres d5_management > d5_backup_$(date +%Y%m%d).sql

# Schema only
pg_dump -U postgres -s d5_management > schema_backup.sql

# Data only
pg_dump -U postgres -a d5_management > data_backup.sql
```

### Restore Database

```bash
# Restore full backup
psql -U postgres d5_management < d5_backup_20251111.sql

# Or using pg_restore for custom format
pg_restore -U postgres -d d5_management backup.dump
```

---

## ✅ Verification Checklist

After setup, verify:

- [ ] Database `d5_management` exists
- [ ] All 30+ tables created
- [ ] 6 test users in `users` table
- [ ] 3 customers in `customers` table
- [ ] 2 candidates in `candidates` table
- [ ] 3 tasks in `tasks` table
- [ ] 13 holidays in `national_holidays` table
- [ ] 2 templates in `templates` table
- [ ] Can connect with Prisma Studio
- [ ] Backend starts without database errors

---

## 🎓 Next Steps

After successful database setup:

1. Start the backend: `npm run dev:backend`
2. Start the frontend: `npm run dev:frontend`
3. Login at http://localhost:5173
4. Use: `admin@d5.com` / `admin123`
5. Explore the API docs at http://localhost:3000/api/docs

---

**Database setup complete! 🎉**


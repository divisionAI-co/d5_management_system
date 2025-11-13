# Prisma Workflow Guide

## 🔄 Complete Workflow for Schema Changes

### Step-by-Step Process

#### 1. **Edit Schema** (`apps/backend/prisma/schema.prisma`)
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  // Add your new field here
  newField  String?  // Example: new optional field
}
```

#### 2. **Create Migration**
```bash
cd apps/backend
npx prisma migrate dev --name add_new_field_to_user
```

**What happens:**
- ✅ Prisma compares your schema to the database
- ✅ Generates SQL migration file in `prisma/migrations/YYYYMMDDHHMMSS_add_new_field_to_user/migration.sql`
- ✅ Applies the migration to your database
- ✅ Automatically runs `prisma generate` to update TypeScript types
- ✅ Updates `_prisma_migrations` table with migration history

**Output:**
```
✔ Generated Prisma Client (5.8.0) to ./node_modules/@prisma/client
The following migration(s) have been applied:

migrations/
  └─ 20250115120000_add_new_field_to_user/
    └─ migration.sql

Your database is now in sync with your schema.
```

#### 3. **Verify Changes**
```bash
# View your database
npx prisma studio

# Or check migration status
npx prisma migrate status
```

#### 4. **Restart Backend** (if running)
The Prisma Client types are now updated, so restart your NestJS server:
```bash
npm run dev:backend
```

---

## 📋 Common Scenarios

### Scenario 1: Adding a New Model
```prisma
model NewEntity {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now())
}
```

**Commands:**
```bash
npx prisma migrate dev --name add_new_entity
# Client auto-generated, restart backend
```

### Scenario 2: Adding a Field to Existing Model
```prisma
model User {
  // ... existing fields
  phoneNumber String?  // New field
}
```

**Commands:**
```bash
npx prisma migrate dev --name add_phone_to_user
```

### Scenario 3: Adding a Relation
```prisma
model User {
  // ... existing fields
  posts Post[]  // New relation
}

model Post {
  id     String @id @default(uuid())
  title  String
  userId String
  user   User   @relation(fields: [userId], references: [id])
}
```

**Commands:**
```bash
npx prisma migrate dev --name add_user_posts_relation
```

### Scenario 4: Removing a Field/Model
```prisma
model User {
  // Remove: oldField String?
}
```

**Commands:**
```bash
npx prisma migrate dev --name remove_old_field_from_user
# ⚠️ This will delete data in that column!
```

---

## 🚀 Production Deployment

### Step 1: Commit Migrations
```bash
git add prisma/migrations/
git commit -m "Add migration for new feature"
git push
```

### Step 2: Deploy to Production
```bash
# On production server
cd apps/backend
npx prisma migrate deploy
```

**What happens:**
- ✅ Applies all pending migrations
- ✅ Does NOT create new migrations
- ✅ Safe for production (no prompts)

---

## ⚠️ Important Notes

### `migrate dev` vs `migrate deploy`

| Command | When to Use | Creates Migration? | Applies Migration? |
|---------|-------------|-------------------|-------------------|
| `migrate dev` | **Development only** | ✅ Yes | ✅ Yes |
| `migrate deploy` | **Production** | ❌ No | ✅ Yes |
| `db push` | **Prototyping** | ❌ No | ✅ Yes (no history) |

### Always Generate Client After Schema Changes

Even if `migrate dev` auto-generates, you may need to manually run:
```bash
npx prisma generate
```

**When to manually generate:**
- After pulling schema from DB (`db pull`)
- After manual SQL changes
- When TypeScript errors persist

---

## 🐛 Troubleshooting

### Error: "Migration failed to apply"
```bash
# Check migration status
npx prisma migrate status

# Reset if needed (⚠️ deletes data)
npx prisma migrate reset
```

### Error: "Schema and database are out of sync"
```bash
# Option 1: Reset and reapply (⚠️ deletes data)
npx prisma migrate reset

# Option 2: Create a new migration to sync
npx prisma migrate dev --name sync_schema
```

### Error: "Type errors after migration"
```bash
# Regenerate Prisma Client
npx prisma generate

# Restart TypeScript server in your IDE
# VS Code: Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"
```

---

## 📝 Quick Reference

```bash
# Development workflow
npx prisma migrate dev --name migration_name
npx prisma generate  # (usually auto-run)
npm run dev:backend

# Production workflow
npx prisma migrate deploy

# View database
npx prisma studio

# Reset everything (⚠️ deletes data)
npx prisma migrate reset

# Check status
npx prisma migrate status
```

---

## ✅ Checklist

Before deploying to production:
- [ ] All migrations are committed to git
- [ ] Migration files are tested locally
- [ ] Database backup created
- [ ] `prisma migrate deploy` tested on staging
- [ ] Prisma Client generated and types updated
- [ ] Backend restarted and tested


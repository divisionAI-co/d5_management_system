#!/bin/bash
# Quick fix script to grant CREATEDB permission to database user for Prisma Migrate

# Configuration (adjust if different)
DB_USER="d5user"

echo "Granting CREATEDB permission to ${DB_USER}..."
echo "You'll be prompted for the postgres user password."

sudo -u postgres psql <<EOF
-- Grant CREATEDB permission (needed for Prisma shadow database)
ALTER USER ${DB_USER} WITH CREATEDB;

-- Verify the permission
\du ${DB_USER}
\q
EOF

echo ""
echo "✅ Permission granted! You can now run 'npx prisma migrate dev'"


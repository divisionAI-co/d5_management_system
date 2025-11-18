#!/bin/bash

# Script to fix leave request days calculation
# This recalculates totalDays for all existing leave requests

set -e

echo "=========================================="
echo "Leave Request Data Migration"
echo "=========================================="
echo ""
echo "This script will recalculate totalDays for all"
echo "existing leave requests to exclude weekends"
echo "and holidays."
echo ""

# Check if we're in the backend directory
if [ ! -f "prisma/schema.prisma" ]; then
    echo "❌ Error: Please run this script from apps/backend directory"
    echo "   cd apps/backend && bash scripts/fix-leave-days.sh"
    exit 1
fi

# Ask for confirmation
read -p "Do you want to proceed? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo "🔄 Running migration..."
echo ""

# Run the TypeScript migration script
npx ts-node prisma/migrations/fix-leave-days.ts

echo ""
echo "✅ Migration completed!"
echo ""
echo "Next steps:"
echo "1. Review the changes in your database"
echo "2. Notify users about updated leave balances if needed"
echo "3. Consider running a full backup before deploying to production"


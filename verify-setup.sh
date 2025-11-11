#!/bin/bash

# Verification script for D5 Management System setup
# Run this after installation to verify everything is configured correctly

echo "🔍 D5 Management System - Setup Verification"
echo "=============================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to check and report
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $2"
        ((FAILED++))
    fi
}

# 1. Check Node.js version
echo "📦 Checking Prerequisites..."
echo ""

NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ]; then
    check 1 "Node.js is installed"
elif [ "$NODE_VERSION" -ge 18 ]; then
    check 0 "Node.js version >= 18 (found: $(node -v))"
else
    check 1 "Node.js version >= 18 (found: $(node -v))"
fi

# 2. Check npm
command -v npm &> /dev/null
check $? "npm is installed ($(npm -v 2>/dev/null))"

# 3. Check PostgreSQL
command -v psql &> /dev/null
check $? "PostgreSQL is installed ($(psql --version 2>/dev/null | head -1))"

echo ""
echo "📂 Checking Project Structure..."
echo ""

# 4. Check project files
[ -f "package.json" ]
check $? "Root package.json exists"

[ -d "apps/backend" ]
check $? "Backend directory exists"

[ -d "apps/frontend" ]
check $? "Frontend directory exists"

[ -f "apps/backend/prisma/schema.prisma" ]
check $? "Prisma schema exists"

[ -f "apps/backend/src/main.ts" ]
check $? "Backend entry point exists"

[ -f "apps/frontend/src/main.tsx" ]
check $? "Frontend entry point exists"

echo ""
echo "🔧 Checking Configuration..."
echo ""

# 5. Check environment files
[ -f "apps/backend/.env" ]
check $? "Backend .env file exists"

[ -f "apps/frontend/.env" ]
if [ $? -eq 0 ]; then
    check 0 "Frontend .env file exists"
else
    echo -e "${YELLOW}⚠${NC} Frontend .env file missing (optional)"
fi

# 6. Check node_modules
[ -d "node_modules" ]
check $? "Root dependencies installed"

[ -d "apps/backend/node_modules" ]
check $? "Backend dependencies installed"

[ -d "apps/frontend/node_modules" ]
check $? "Frontend dependencies installed"

# 7. Check Prisma Client
[ -d "apps/backend/node_modules/@prisma/client" ]
check $? "Prisma Client generated"

echo ""
echo "🗄️  Checking Database..."
echo ""

# 8. Check database connection
if [ -f "apps/backend/.env" ]; then
    cd apps/backend
    DATABASE_CHECK=$(npx prisma db execute --stdin <<< "SELECT 1;" 2>&1)
    if echo "$DATABASE_CHECK" | grep -q "error"; then
        check 1 "Database connection"
        echo "  ${YELLOW}Note: Make sure PostgreSQL is running and DATABASE_URL is correct${NC}"
    else
        check 0 "Database connection"
    fi
    
    # 9. Check if migrations are applied
    TABLES_CHECK=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>&1)
    if echo "$TABLES_CHECK" | grep -q "error"; then
        check 1 "Database tables exist"
        echo "  ${YELLOW}Note: Run 'npx prisma migrate deploy' in apps/backend${NC}"
    else
        check 0 "Database tables exist"
    fi
    
    # 10. Check if seed data exists
    USERS_CHECK=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM users;" 2>&1)
    if echo "$USERS_CHECK" | grep -q "6"; then
        check 0 "Seed data exists (6 users found)"
    elif echo "$USERS_CHECK" | grep -q "error"; then
        check 1 "Seed data check"
    else
        echo -e "${YELLOW}⚠${NC} Seed data incomplete"
        echo "  ${YELLOW}Note: Run 'npm run seed' in apps/backend${NC}"
    fi
    
    cd ../..
else
    echo -e "${YELLOW}⚠${NC} Cannot check database (no .env file)"
fi

echo ""
echo "📚 Checking Documentation..."
echo ""

# 11. Check documentation files
[ -f "README.md" ]
check $? "README.md exists"

[ -f "QUICKSTART.md" ]
check $? "QUICKSTART.md exists"

[ -f "IMPLEMENTATION_GUIDE.md" ]
check $? "IMPLEMENTATION_GUIDE.md exists"

[ -f "DATABASE_SETUP.md" ]
check $? "DATABASE_SETUP.md exists"

echo ""
echo "=============================================="
echo ""
echo "📊 Results:"
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Your setup is complete.${NC}"
    echo ""
    echo "🚀 Next steps:"
    echo "  1. Start backend:  cd apps/backend && npm run dev"
    echo "  2. Start frontend: cd apps/frontend && npm run dev"
    echo "  3. Or run both:    npm run dev (from project root)"
    echo ""
    echo "  Login at: http://localhost:5173"
    echo "  Email: admin@d5.com"
    echo "  Password: admin123"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please review the errors above.${NC}"
    echo ""
    echo "📖 For help, see:"
    echo "  • QUICKSTART.md - Setup instructions"
    echo "  • DATABASE_SETUP.md - Database setup guide"
    echo "  • INSTALLATION.md - Detailed installation guide"
    echo ""
    exit 1
fi


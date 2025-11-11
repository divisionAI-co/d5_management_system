#!/bin/bash

# D5 Management System - Setup Script
# This script sets up the development environment

set -e

echo "🚀 Setting up D5 Management System..."
echo ""

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Setup Backend
echo "🔧 Setting up backend..."
cd apps/backend

if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
    echo "⚠️  Please edit apps/backend/.env with your database credentials and API keys"
fi

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is installed"
else
    echo "⚠️  PostgreSQL not found. Please install PostgreSQL 14 or higher"
fi

# Generate Prisma Client
echo "🔄 Generating Prisma Client..."
npx prisma generate
echo "✅ Prisma Client generated"

cd ../..

# Setup Frontend
echo "🔧 Setting up frontend..."
cd apps/frontend

if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cp .env.example .env
fi

cd ../..

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo ""
echo "1. Configure your database:"
echo "   Edit apps/backend/.env and set your DATABASE_URL"
echo ""
echo "2. Run database migrations:"
echo "   cd apps/backend"
echo "   npx prisma migrate dev"
echo ""
echo "3. (Optional) Seed initial data:"
echo "   npm run seed --workspace=apps/backend"
echo ""
echo "4. Start development servers:"
echo "   npm run dev"
echo ""
echo "   Or start individually:"
echo "   npm run dev:backend  # Backend on http://localhost:3000"
echo "   npm run dev:frontend # Frontend on http://localhost:5173"
echo ""
echo "📚 Documentation:"
echo "   - README.md for project overview"
echo "   - IMPLEMENTATION_GUIDE.md for detailed implementation guide"
echo "   - API Docs will be available at http://localhost:3000/api/docs"
echo ""


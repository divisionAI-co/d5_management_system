# D5 Management System - Quick Start Guide

Get up and running with the D5 Management System in minutes!

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org/))
- **npm** >= 9.0.0 (comes with Node.js)
- **PostgreSQL** >= 14 ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/))

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd d5_management_system
```

### 2. Run Setup Script

**On Linux/Mac:**
```bash
chmod +x setup.sh
./setup.sh
```

**On Windows:**
```powershell
# Run commands manually:
npm install
cd apps/backend
copy .env.example .env
npx prisma generate
cd ../..
```

### 3. Configure Database

Edit `apps/backend/.env` and set your PostgreSQL connection:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/d5_management"
```

### 4. Create Database and Run Migrations

```bash
cd apps/backend

# Create the database (if it doesn't exist)
# Using psql:
psql -U postgres -c "CREATE DATABASE d5_management;"

# Run migrations
npx prisma migrate dev

# Seed initial data (creates test users and basic setup)
npm run seed
```

### 5. Start Development Servers

**From the project root:**

```bash
# Start both backend and frontend
npm run dev
```

**Or start them separately:**

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

### 6. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **API Documentation**: http://localhost:3000/api/docs

## Test Users

The seed script creates the following test users:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@d5.com | admin123 |
| Salesperson | sales@d5.com | sales123 |
| Account Manager | manager@d5.com | manager123 |
| Recruiter | recruiter@d5.com | recruiter123 |
| HR | hr@d5.com | hr123 |
| Employee | employee@d5.com | employee123 |

## Project Structure

```
d5_management_system/
├── apps/
│   ├── backend/          # NestJS API
│   │   ├── src/
│   │   │   ├── modules/  # Feature modules
│   │   │   ├── common/   # Shared utilities
│   │   │   └── main.ts
│   │   └── prisma/       # Database schema
│   └── frontend/         # React app
│       └── src/
│           ├── pages/    # Route pages
│           ├── components/ # UI components
│           └── lib/      # API, hooks, stores
├── package.json          # Root package.json
└── README.md
```

## Common Commands

### Development

```bash
# Start both servers
npm run dev

# Start backend only
npm run dev:backend

# Start frontend only
npm run dev:frontend
```

### Database

```bash
cd apps/backend

# Create a new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Open Prisma Studio (database GUI)
npx prisma studio

# Generate Prisma Client (after schema changes)
npx prisma generate
```

### Building for Production

```bash
# Build all
npm run build

# Build backend
npm run build:backend

# Build frontend
npm run build:frontend
```

### Testing

```bash
# Run all tests
npm test

# Run backend tests
npm run test --workspace=apps/backend

# Run frontend tests
npm run test --workspace=apps/frontend
```

### Code Quality

```bash
# Lint all code
npm run lint

# Type check
npm run typecheck
```

## Configuration

### Backend Environment Variables

Key environment variables in `apps/backend/.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/d5_management"

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Email (choose one provider)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Or use SendGrid
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-key

# Google Drive (Service Account)
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=service-account@your-project.iam.gserviceaccount.com
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC123...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_SHARED_DRIVE_ID=your-shared-drive-id
# Optional overrides
# GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive
# GOOGLE_DRIVE_IMPERSONATE_USER=admin@your-company.com
```

### Frontend Environment Variables

Create `apps/frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_APP_NAME=D5 Management System
```

## Troubleshooting

### Database Connection Issues

**Error**: "Can't reach database server"

**Solution**:
1. Ensure PostgreSQL is running: `sudo service postgresql start` (Linux) or check Services (Windows)
2. Verify connection string in `.env`
3. Check firewall settings

### Port Already in Use

**Error**: "Port 3000 is already in use"

**Solution**:
1. Kill the process: `lsof -ti:3000 | xargs kill` (Mac/Linux)
2. Or change the port in `apps/backend/.env`: `PORT=3001`

### Prisma Client Issues

**Error**: "Cannot find module '@prisma/client'"

**Solution**:
```bash
cd apps/backend
npx prisma generate
```

### Frontend Module Not Found

**Error**: "Cannot find module '@/...'

**Solution**:
1. Ensure you're in the frontend directory
2. Install dependencies: `npm install`
3. Check `vite.config.ts` for path aliases

## Next Steps

1. **Explore the API**: Visit http://localhost:3000/api/docs for interactive API documentation
2. **Read the Implementation Guide**: See `IMPLEMENTATION_GUIDE.md` for detailed feature implementation
3. **Review the Code**: Explore the existing modules in `apps/backend/src/modules/`
4. **Build Features**: Follow the implementation guide to build remaining features

## Email Setup (Optional)

### Using Gmail SMTP

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Update `.env`:
   ```env
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=your-16-digit-app-password
   ```

### Using SendGrid

1. Sign up at https://sendgrid.com/
2. Create an API key
3. Update `.env`:
   ```env
   EMAIL_PROVIDER=sendgrid
   SENDGRID_API_KEY=your-api-key
   EMAIL_FROM=noreply@yourdomain.com
   ```

## Google Drive Integration (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project and enable **Google Drive API**
3. Create a **service account** with domain-wide delegation (if using Google Workspace)
4. Generate a JSON key for the service account
5. If using a shared drive, capture its ID from the Drive URL
6. Update `apps/backend/.env` with:
   ```env
   GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=service-account@your-project.iam.gserviceaccount.com
   GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC123...\n-----END PRIVATE KEY-----\n"
   GOOGLE_DRIVE_SHARED_DRIVE_ID=your-shared-drive-id
   # Optional
   # GOOGLE_DRIVE_IMPERSONATE_USER=admin@your-company.com
   # GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive
   ```
7. Restart the backend service so the new credentials are loaded

## Support

- **Documentation**: See `README.md` and `IMPLEMENTATION_GUIDE.md`
- **Issues**: Create an issue in the repository
- **API Docs**: http://localhost:3000/api/docs when running

## Production Deployment

See `IMPLEMENTATION_GUIDE.md` for detailed deployment instructions for:
- Backend: Heroku, Railway, AWS, DigitalOcean
- Frontend: Vercel, Netlify, AWS S3
- Database: AWS RDS, DigitalOcean Managed Databases

---

**Happy Coding! 🚀**


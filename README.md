# D5 Management System

An integrated business management platform built with TypeScript, featuring CRM, HR, Recruitment, and Project Management modules.

## 🏗️ Architecture

This is a monorepo project using npm workspaces:

- **Backend**: NestJS REST API with TypeScript
- **Frontend**: React 18 with TypeScript, Vite, and TailwindCSS
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT with role-based access control (RBAC) and optional 2FA

## 📦 Tech Stack

### Backend
- **Framework**: NestJS
- **Database ORM**: Prisma
- **Authentication**: Passport.js (JWT strategy)
- **Validation**: class-validator, class-transformer
- **Email**: NodeMailer with SendGrid/Mailgun/AWS SES
- **PDF Generation**: Puppeteer
- **File Storage**: Google Drive API integration
- **Calendar**: Google Calendar API / Microsoft Graph API

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS + shadcn/ui components
- **State Management**: Zustand + React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation
- **Routing**: React Router v6
- **Drag & Drop**: @dnd-kit
- **Charts**: Recharts
- **Date Handling**: date-fns
- **Rich Text Editor**: TipTap (for HTML template editing)

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL >= 14
- Google Workspace account (for Drive integration)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd d5_management_system
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Backend
cp apps/backend/.env.example apps/backend/.env

# Frontend
cp apps/frontend/.env.example apps/frontend/.env
```

4. Configure your database in `apps/backend/.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/d5_management"
```

5. Run database migrations:
```bash
cd apps/backend
npx prisma migrate dev
npx prisma generate
```

6. Seed initial data (optional):
```bash
npm run seed --workspace=apps/backend
```

### Development

Start both backend and frontend in development mode:
```bash
npm run dev
```

Or run them separately:
```bash
# Terminal 1 - Backend (http://localhost:3000)
npm run dev:backend

# Terminal 2 - Frontend (http://localhost:5173)
npm run dev:frontend
```

### Building for Production

```bash
npm run build
```

## 📚 Module Overview

### 1. CRM (Customer Relationship Management)
- Lead and opportunity management
- Configurable sales pipeline with Kanban view
- Customer categorization (Staff Augmentation, Software Subscription, Both)
- Sales analytics and reporting
- Automated email campaigns
- Activity tracking

### 2. Recruitment
- Candidate lifecycle management
- Open positions board
- Integration with CRM for staff augmentation opportunities
- Automated notifications for recruiters
- Interview tracking (Cultural, Technical, Customer)
- Candidate-position linking

### 3. HR (Human Resources)
- Employee profile management
- Contract and document storage
- Performance reviews (6-month cycle)
- Leave request management
- Albanian national holiday management
- Remote work policy configuration

### 4. Employee Self-Service
- End-of-Day (EOD) reporting
- Leave requests
- Remote work reporting
- Personal profile access
- Task board view

### 5. Task Management
- Central team board
- Task assignment and tracking
- Integration with EOD reports
- Account Manager visibility

### 6. Billing & Invoicing
- Invoice generation with HTML templates
- Recurring monthly invoices for subscriptions
- PDF export
- Automated payment reminders

### 7. Account Management
- Customer management board
- Customer status tracking (Onboarding, Active, At Risk, Paused)
- Customer sentiment tracking (Happy, Neutral, Unhappy)
- Monthly report compilation
- Meeting scheduling

### 8. Universal Features
- Activity logging (Notes, Calls, Emails, Meetings)
- Notification system (in-app and email)
- Google Drive integration
- Odoo data import tool
- HTML template editor

## 🔐 User Roles

1. **Administrator**: Full system access and configuration
2. **Salesperson**: CRM and campaign management
3. **Account Manager**: Customer relationship and reporting
4. **Recruiter**: Candidate and recruitment pipeline management
5. **HR**: Employee management and HR policies
6. **Employee**: Self-service features (EOD, leave, tasks)

## 🔧 Configuration

### Email Service
Configure your email provider in `apps/backend/.env`:
```env
EMAIL_PROVIDER=sendgrid # or mailgun, ses
EMAIL_API_KEY=your_api_key
EMAIL_FROM=noreply@yourdomain.com
```

### Google Drive Integration
1. Create a Google Cloud project
2. Enable Google Drive API
3. Create OAuth2 credentials
4. Add credentials to `apps/backend/.env`:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback
```

### Calendar Integration
Configure Google Calendar or Microsoft 365:
```env
CALENDAR_PROVIDER=google # or microsoft
CALENDAR_CLIENT_ID=your_client_id
CALENDAR_CLIENT_SECRET=your_client_secret
```

## 📖 API Documentation

Once the backend is running, access the API documentation at:
- Swagger UI: http://localhost:3000/api/docs

## 🧪 Testing

```bash
# Run all tests
npm test

# Backend tests
npm run test --workspace=apps/backend

# Frontend tests
npm run test --workspace=apps/frontend
```

## 📝 Database Schema

The database schema is managed with Prisma. Key entities include:

- Users & Roles
- Customers & Leads
- Opportunities
- Candidates
- Employees
- Tasks
- Activities
- Invoices
- Templates
- Notifications
- EOD Reports
- Leave Requests

View the schema at `apps/backend/prisma/schema.prisma`

## 🚢 Deployment

### Backend
The NestJS backend can be deployed to:
- Heroku
- AWS (EC2, ECS, Lambda)
- DigitalOcean
- Railway
- Render

### Frontend
The React frontend can be deployed to:
- Vercel
- Netlify
- AWS S3 + CloudFront
- DigitalOcean App Platform

### Database
Recommended PostgreSQL hosting:
- AWS RDS
- DigitalOcean Managed Databases
- Heroku Postgres
- Supabase

## 🔒 Security Features

- HTTPS/SSL encryption
- Password hashing with bcrypt
- JWT-based authentication
- Role-based access control (RBAC)
- Optional Two-Factor Authentication (2FA)
- XSS protection
- SQL injection prevention via Prisma
- CSRF token protection
- Rate limiting
- Input validation and sanitization

## 📄 License

Private - All rights reserved

## 👥 Support

For support, email support@yourdomain.com or create an issue in the repository.


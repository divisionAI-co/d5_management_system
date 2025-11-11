# D5 Management System - Implementation Guide

This document provides a comprehensive guide to implementing the remaining features of the D5 Management System.

## Current Status

### ✅ Completed
1. **Project Structure**: Monorepo setup with npm workspaces
2. **Database Schema**: Complete Prisma schema with all entities
3. **Authentication**: JWT auth with RBAC and 2FA support
4. **Core Services**:
   - Prisma database service
   - Email service (SendGrid/SMTP)
   - PDF generation service (Puppeteer)
   - Users module with CRUD operations

### 🔨 To Be Implemented

The following modules need full implementation. Each section provides implementation details:

---

## 1. CRM Module

### Customers Service (`apps/backend/src/modules/crm/customers/`)

**Files to create:**
- `customers.module.ts`
- `customers.service.ts`
- `customers.controller.ts`
- `dto/create-customer.dto.ts`
- `dto/update-customer.dto.ts`
- `dto/filter-customers.dto.ts`

**Key Features:**
- CRUD operations for customers
- Customer categorization (Staff Aug, Subscription, Both)
- Customer status tracking (Onboarding, Active, At Risk, Paused)
- Customer sentiment tracking (Happy, Neutral, Unhappy)
- Search and filtering
- Pagination

**Controller Endpoints:**
```typescript
GET    /api/customers           - List all customers (with filters)
POST   /api/customers           - Create customer
GET    /api/customers/:id       - Get customer details
PATCH  /api/customers/:id       - Update customer
DELETE /api/customers/:id       - Delete customer
GET    /api/customers/:id/activities - Get customer activities
GET    /api/customers/:id/opportunities - Get customer opportunities
PATCH  /api/customers/:id/status - Update customer status/sentiment
```

**Access Control:**
- Salesperson: Read, Create
- Account Manager: Read, Update
- Admin: Full access

---

### Leads Service (`apps/backend/src/modules/crm/leads/`)

**Files to create:**
- `leads.module.ts`
- `leads.service.ts`
- `leads.controller.ts`
- `dto/create-lead.dto.ts`
- `dto/update-lead.dto.ts`

**Key Features:**
- Lead lifecycle management (New, Contacted, Qualified, Proposal, Won, Lost)
- Kanban board data structure
- Lead assignment
- Lead conversion to opportunity
- Analytics (conversion rates, cycle time)

**Controller Endpoints:**
```typescript
GET    /api/leads               - List leads (Kanban view data)
POST   /api/leads               - Create lead
PATCH  /api/leads/:id          - Update lead
PATCH  /api/leads/:id/status   - Move lead to different stage
POST   /api/leads/:id/convert  - Convert to opportunity
GET    /api/leads/analytics    - Get lead analytics
```

---

### Opportunities Service (`apps/backend/src/modules/crm/opportunities/`)

**Key Features:**
- Opportunity management
- Staff Augmentation: Auto-create Open Position
- Link to job descriptions
- Opportunity stages
- Win/loss tracking

**Controller Endpoints:**
```typescript
GET    /api/opportunities
POST   /api/opportunities       - Create (triggers recruitment workflow if Staff Aug)
PATCH  /api/opportunities/:id
POST   /api/opportunities/:id/close - Close as Won/Lost
```

**Special Logic:**
When creating Staff Augmentation opportunity:
1. Create Opportunity record
2. Create OpenPosition record
3. Send notification to all Recruiters

---

### Campaigns Service (`apps/backend/src/modules/crm/campaigns/`)

**Key Features:**
- Email campaign creation
- Campaign scheduling
- Recipient segmentation
- Campaign analytics (open rate, click rate)
- Email sequences with triggers

**Controller Endpoints:**
```typescript
GET    /api/campaigns
POST   /api/campaigns
PATCH  /api/campaigns/:id
POST   /api/campaigns/:id/send
GET    /api/campaigns/:id/analytics

GET    /api/sequences
POST   /api/sequences
PATCH  /api/sequences/:id
```

---

## 2. Recruitment Module

### Candidates Service (`apps/backend/src/modules/recruitment/candidates/`)

**Key Features:**
- Candidate lifecycle board (Validation → Hired/Rejected)
- Candidate profile management
- Skills and experience tracking
- Resume storage
- Stage progression with notifications

**Controller Endpoints:**
```typescript
GET    /api/candidates          - Kanban board view
POST   /api/candidates
GET    /api/candidates/:id
PATCH  /api/candidates/:id
PATCH  /api/candidates/:id/stage - Move to next stage
POST   /api/candidates/:id/link-position - Link to open position
GET    /api/candidates/:id/positions - Get linked positions
```

**Stage Reminder Logic:**
- Configurable reminders if candidate stuck in stage for X days
- Send in-app + email notifications to recruiters

---

### Open Positions Service (`apps/backend/src/modules/recruitment/positions/`)

**Key Features:**
- Open positions board
- Display linked opportunity details
- Show candidates in pipeline for each position
- Position status (Open, Filled, Cancelled)

**Controller Endpoints:**
```typescript
GET    /api/positions
GET    /api/positions/:id
PATCH  /api/positions/:id
GET    /api/positions/:id/candidates - Get candidates for position
POST   /api/positions/:id/close - Mark as filled
```

---

## 3. HR & Employee Module

### Employees Service (`apps/backend/src/modules/employees/`)

**Key Features:**
- Employee profile management
- Employment status tracking
- Manager hierarchy
- Document storage
- Contract details

**Controller Endpoints:**
```typescript
GET    /api/employees
POST   /api/employees
GET    /api/employees/:id
PATCH  /api/employees/:id
GET    /api/employees/:id/documents
POST   /api/employees/:id/documents
```

**Access Control:**
- HR: Full access
- Employees: Read their own profile only
- Managers: Read their direct reports

---

### Performance Reviews Service (`apps/backend/src/modules/employees/performance-reviews/`)

**Key Features:**
- 6-month review cycle
- HTML template with Handlebars
- PDF generation
- Rating system
- Goals and improvements tracking

**Controller Endpoints:**
```typescript
GET    /api/performance-reviews
POST   /api/performance-reviews
GET    /api/performance-reviews/:id
PATCH  /api/performance-reviews/:id
GET    /api/performance-reviews/:id/pdf - Generate PDF
```

**Automated Job:**
- Schedule job to create performance reviews every 6 months for active employees

---

### Leave Requests Service (`apps/backend/src/modules/employees/leave-requests/`)

**Key Features:**
- Leave request submission
- HR approval workflow
- Leave balance tracking
- Calendar integration

**Controller Endpoints:**
```typescript
GET    /api/leave-requests       - Get all (HR) or my requests (Employee)
POST   /api/leave-requests
PATCH  /api/leave-requests/:id/approve
PATCH  /api/leave-requests/:id/reject
GET    /api/leave-requests/my-balance
```

---

### EOD Reports Service (`apps/backend/src/modules/employees/eod-reports/`)

**Key Features:**
- Daily report submission
- Submission deadline: 23:59 same day
- Grace period: Can submit D's report until 23:59 on D+1
- 2 missed reports per month allowed
- Auto-waive on holidays and approved leave
- Track non-worked days

**Controller Endpoints:**
```typescript
GET    /api/eod-reports          - Get my reports history
POST   /api/eod-reports          - Submit EOD report
GET    /api/eod-reports/missing  - Get my missing reports
GET    /api/eod-reports/stats    - Get monthly stats
```

**Scheduled Jobs:**
- Daily at 00:00: Check for missing EOD reports from previous day
- Monthly at 00:00 on 1st: Calculate previous month's missing reports > 2

**Business Logic:**
```typescript
// Pseudo-code for EOD submission validation
function canSubmitEODForDate(date: Date): boolean {
  const today = new Date();
  const reportDate = new Date(date);
  const dayAfterReport = addDays(reportDate, 1);
  
  // Can submit on the same day or the next day (until 23:59)
  return isSameDay(reportDate, today) || 
         (isSameDay(dayAfterReport, today) && isBefore(today, endOfDay(dayAfterReport)));
}

function calculateNonWorkedDays(userId: string, month: number, year: number) {
  // Get all workdays in month
  // Exclude: weekends, national holidays, approved leave
  // Count missing EOD reports
  // If missing > 2, mark excess as non-worked days
}
```

---

### Remote Work Logs Service

**Key Features:**
- Remote work day logging
- Frequency limits (configurable: e.g., once per week)
- Validation against company policy

**Controller Endpoints:**
```typescript
GET    /api/remote-work/logs
POST   /api/remote-work/logs     - Log remote work day
GET    /api/remote-work/policy   - Get policy settings
PATCH  /api/remote-work/policy   - Update policy (HR only)
```

---

## 4. Task Management

### Tasks Service (`apps/backend/src/modules/tasks/`)

**Key Features:**
- Task board (Kanban)
- Task assignment
- Priority and status management
- Due date tracking
- Customer/project linking
- Task hours (estimated vs actual)

**Controller Endpoints:**
```typescript
GET    /api/tasks                - Get tasks (Kanban view)
POST   /api/tasks
GET    /api/tasks/:id
PATCH  /api/tasks/:id
DELETE /api/tasks/:id
PATCH  /api/tasks/:id/status
```

**Access Control:**
- All users can see tasks assigned to them
- Account Managers can see tasks for their customers
- Admin can see all tasks

---

## 5. Universal Features

### Activities Service (`apps/backend/src/modules/activities/`)

**Key Features:**
- Universal activity logging
- Attachable to: Customer, Lead, Opportunity, Candidate, Employee, Task
- Activity types: Note, Call, Email, Meeting, Status Change
- Chronological feed

**Controller Endpoints:**
```typescript
POST   /api/activities           - Create activity
GET    /api/activities           - List activities (with filters)
GET    /api/customers/:id/activities
GET    /api/candidates/:id/activities
GET    /api/employees/:id/activities
// etc.
```

---

### Notifications Service (`apps/backend/src/modules/notifications/`)

**Key Features:**
- In-app notifications
- Email notifications (via EmailService)
- User preferences
- Mark as read
- Notification types for all major events

**Controller Endpoints:**
```typescript
GET    /api/notifications        - Get my notifications
PATCH  /api/notifications/:id/read - Mark as read
PATCH  /api/notifications/read-all - Mark all as read
DELETE /api/notifications/:id
```

**Event Triggers:**
- Task assigned
- Task due soon (1 day before)
- Leave request submitted/approved/rejected
- Performance review initiated
- New candidate/opportunity
- Invoice overdue

---

### Meetings Service (`apps/backend/src/modules/meetings/`)

**Key Features:**
- Meeting scheduling
- Customer association
- Calendar integration (Google/Microsoft)
- Attendee management
- Meeting notes

**Controller Endpoints:**
```typescript
GET    /api/meetings
POST   /api/meetings             - Create meeting (sync to calendar)
PATCH  /api/meetings/:id
DELETE /api/meetings/:id
GET    /api/meetings/upcoming
```

---

### Reports Service (`apps/backend/src/modules/reports/`)

**Key Features:**
- Monthly customer reports
- Collaborative editing (Account Manager + assigned employees)
- HTML template with Handlebars
- PDF generation

**Controller Endpoints:**
```typescript
GET    /api/reports
POST   /api/reports              - Create report
GET    /api/reports/:id
PATCH  /api/reports/:id          - Update content
POST   /api/reports/:id/send     - Send to customer
GET    /api/reports/:id/pdf      - Generate PDF
```

---

## 6. Billing & Invoicing

### Invoices Service (`apps/backend/src/modules/invoices/`)

**Key Features:**
- Invoice generation
- Recurring invoices (monthly for subscriptions)
- HTML template editor
- PDF generation
- Payment tracking
- Automated reminders (3, 15, 30 days overdue)

**Controller Endpoints:**
```typescript
GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/:id
PATCH  /api/invoices/:id
GET    /api/invoices/:id/pdf
POST   /api/invoices/:id/send
PATCH  /api/invoices/:id/mark-paid
```

**Scheduled Jobs:**
- Monthly on 1st: Generate recurring invoices for subscription customers
- Daily: Check overdue invoices and send reminders

---

## 7. Templates

### Templates Service (`apps/backend/src/modules/templates/`)

**Key Features:**
- HTML template management
- CSS styling
- Variable substitution with Handlebars
- Preview functionality
- Template types: Invoice, Customer Report, Performance Review, Email

**Controller Endpoints:**
```typescript
GET    /api/templates
POST   /api/templates
GET    /api/templates/:id
PATCH  /api/templates/:id
POST   /api/templates/:id/preview - Preview with sample data
```

---

## 8. Data Import

### Imports Service (`apps/backend/src/modules/imports/`)

**Key Features:**
- CSV/XLSX file upload
- Field mapping interface
- Import types: Customers, Candidates, Activities
- Progress tracking
- Error reporting

**Controller Endpoints:**
```typescript
POST   /api/imports/upload       - Upload file
GET    /api/imports/:id          - Get import status
POST   /api/imports/:id/map      - Submit field mapping
POST   /api/imports/:id/execute  - Execute import
GET    /api/imports              - List import history
```

**Implementation Flow:**
1. Upload file → Save to temp storage
2. Parse file → Extract headers
3. Show mapping UI → User maps columns to DB fields
4. Validate data
5. Execute import with progress tracking
6. Show results (success/failure counts, errors)

---

## 9. Integrations

### Google Drive Integration (`apps/backend/src/modules/integrations/`)

**Key Features:**
- OAuth2 authentication
- Token refresh
- File/folder listing
- Search functionality
- Read-only access

**Controller Endpoints:**
```typescript
GET    /api/integrations/google/auth - Initiate OAuth
GET    /api/integrations/google/callback - OAuth callback
GET    /api/integrations/google/drive/files - List files
GET    /api/integrations/google/drive/search - Search files
```

---

### Google Calendar Integration

**Key Features:**
- OAuth2 authentication
- Create calendar events
- Check availability
- Sync meetings

**Controller Endpoints:**
```typescript
GET    /api/integrations/google/calendar/auth
POST   /api/integrations/google/calendar/events
GET    /api/integrations/google/calendar/availability
```

---

## 10. Frontend Application

### Frontend Structure (`apps/frontend/`)

**Technology Stack:**
- React 18 with TypeScript
- Vite for build tool
- TailwindCSS + shadcn/ui
- React Router v6
- Zustand (state management)
- React Query (TanStack Query)
- React Hook Form + Zod
- @dnd-kit (drag and drop)
- Recharts (analytics)

**Module Structure:**
```
apps/frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Layout components (Sidebar, Header, etc.)
│   │   ├── common/          # Shared components
│   │   └── [module]/        # Module-specific components
│   ├── pages/
│   │   ├── auth/            # Login, Register, 2FA
│   │   ├── dashboard/       # Main dashboard
│   │   ├── crm/             # CRM pages
│   │   ├── recruitment/     # Recruitment pages
│   │   ├── employees/       # HR & Employee pages
│   │   ├── tasks/           # Task board
│   │   ├── settings/        # Settings pages
│   │   └── ...
│   ├── lib/
│   │   ├── api/             # API client functions
│   │   ├── hooks/           # Custom hooks
│   │   ├── stores/          # Zustand stores
│   │   ├── utils/           # Utility functions
│   │   └── types/           # TypeScript types
│   ├── App.tsx
│   └── main.tsx
```

**Key Pages to Implement:**

1. **Authentication**
   - Login page
   - 2FA page
   - Profile settings

2. **Dashboard**
   - Overview with key metrics
   - Recent activities
   - Quick actions

3. **CRM**
   - Customers list/grid
   - Customer detail page
   - Leads Kanban board
   - Opportunities Kanban board
   - Customer management board (for Account Managers)
   - Campaign management
   - Email sequence builder

4. **Recruitment**
   - Candidates Kanban board
   - Candidate profile
   - Open Positions board
   - Position detail with candidate pipeline

5. **HR & Employees**
   - Employee directory
   - Employee profile
   - Performance review form
   - Leave request form
   - EOD report submission
   - Remote work logging

6. **Tasks**
   - Task Kanban board
   - Task detail modal
   - Task creation form

7. **Invoicing**
   - Invoice list
   - Invoice creation/edit
   - Invoice template editor
   - Recurring invoice setup

8. **Reports**
   - Customer report builder
   - Report template editor
   - Report preview and send

9. **Settings**
   - User management (Admin)
   - Company settings
   - Notification preferences
   - Template management
   - Integration settings (Google Drive, Calendar)

10. **Data Import**
    - Import wizard with field mapping UI

---

## Development Workflow

### 1. Set Up Development Environment

```bash
# Install dependencies
npm install

# Set up backend environment
cd apps/backend
cp .env.example .env
# Edit .env with your database and service credentials

# Run Prisma migrations
npx prisma migrate dev
npx prisma generate

# Seed initial data (optional)
npm run seed
```

### 2. Development Servers

```bash
# From project root
npm run dev

# Or run separately:
# Terminal 1
npm run dev:backend

# Terminal 2
npm run dev:frontend
```

### 3. Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run e2e tests
npm run test:e2e
```

### 4. Code Quality

```bash
# Lint
npm run lint

# Type checking
npm run typecheck

# Format code
npm run format
```

---

## Deployment

### Backend Deployment

**Recommended Platforms:**
- Heroku
- Railway
- Render
- AWS (EC2/ECS)
- DigitalOcean App Platform

**Environment Variables:**
Ensure all environment variables from `.env.example` are set in production.

**Database:**
- Use managed PostgreSQL (AWS RDS, DigitalOcean, Heroku Postgres)
- Set up automated backups
- Enable SSL connection

### Frontend Deployment

**Recommended Platforms:**
- Vercel (recommended for Vite apps)
- Netlify
- AWS S3 + CloudFront
- DigitalOcean App Platform

**Build Command:**
```bash
npm run build:frontend
```

**Environment Variables:**
```
VITE_API_URL=https://your-backend-api.com
VITE_APP_NAME=D5 Management System
```

---

## Next Steps

1. **Implement Remaining Backend Modules** - Follow the structure above for each module
2. **Create Frontend Application** - Set up Vite + React + TailwindCSS
3. **Build UI Components** - Implement pages and components
4. **Integrate APIs** - Connect frontend to backend
5. **Testing** - Write unit and integration tests
6. **Documentation** - Complete API documentation
7. **Deployment** - Deploy to production

---

## Support & Maintenance

### Monitoring
- Set up error tracking (Sentry)
- Application performance monitoring
- Database query monitoring

### Backups
- Daily automated database backups
- File storage backups
- Backup retention policy (30 days)

### Updates
- Regular dependency updates
- Security patches
- Feature enhancements based on user feedback

---

## Estimated Development Time

Based on the scope of requirements:

- **Backend Implementation**: 6-8 weeks
  - Core modules: 3 weeks
  - Integration modules: 2 weeks
  - Testing & refinement: 1-2 weeks

- **Frontend Implementation**: 6-8 weeks
  - UI components: 2 weeks
  - Page implementation: 3 weeks
  - Integration & testing: 1-2 weeks

- **Deployment & Documentation**: 1 week

**Total Estimated Time**: 13-17 weeks for complete implementation

---

## Resources

- [NestJS Documentation](https://docs.nestjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [React Documentation](https://react.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [shadcn/ui Components](https://ui.shadcn.com/)



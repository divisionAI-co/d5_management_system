-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALESPERSON', 'ACCOUNT_MANAGER', 'RECRUITER', 'HR', 'EMPLOYEE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "CustomerType" AS ENUM ('STAFF_AUGMENTATION', 'SOFTWARE_SUBSCRIPTION', 'BOTH');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "CustomerStatus" AS ENUM ('ONBOARDING', 'ACTIVE', 'AT_RISK', 'PAUSED', 'CHURNED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "CustomerSentiment" AS ENUM ('HAPPY', 'NEUTRAL', 'UNHAPPY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "CandidateStage" AS ENUM ('VALIDATION', 'CULTURAL_INTERVIEW', 'TECHNICAL_INTERVIEW', 'CUSTOMER_INTERVIEW', 'CONTRACT_SIGNING', 'HIRED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED', 'RESIGNED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "ContractType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "LeaveType" AS ENUM ('ANNUAL', 'SICK', 'PERSONAL', 'UNPAID', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "ActivityType" AS ENUM ('NOTE', 'CALL', 'EMAIL', 'MEETING', 'TASK_UPDATE', 'STATUS_CHANGE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_DUE_SOON', 'LEAVE_REQUEST', 'LEAVE_APPROVED', 'LEAVE_REJECTED', 'PERFORMANCE_REVIEW', 'NEW_CANDIDATE', 'NEW_OPPORTUNITY', 'INVOICE_OVERDUE', 'MEETING_REMINDER', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "TemplateType" AS ENUM ('INVOICE', 'CUSTOMER_REPORT', 'PERFORMANCE_REVIEW', 'EMAIL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum (with existence check)
DO $$ BEGIN
    CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "twoFactorSecret" TEXT,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "avatar" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "taskAssigned" BOOLEAN NOT NULL DEFAULT true,
    "taskDueSoon" BOOLEAN NOT NULL DEFAULT true,
    "leaveApproved" BOOLEAN NOT NULL DEFAULT true,
    "performanceReview" BOOLEAN NOT NULL DEFAULT true,
    "newCandidate" BOOLEAN NOT NULL DEFAULT true,
    "newOpportunity" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "industry" TEXT,
    "type" "CustomerType" NOT NULL,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ONBOARDING',
    "sentiment" "CustomerSentiment" NOT NULL DEFAULT 'NEUTRAL',
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "postalCode" TEXT,
    "monthlyValue" DECIMAL(10,2),
    "currency" TEXT DEFAULT 'USD',
    "notes" TEXT,
    "tags" TEXT[],
    "odooId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "companyName" TEXT,
    "linkedinUrl" TEXT,
    "notes" TEXT,
    "customerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "value" DECIMAL(10,2),
    "probability" INTEGER,
    "assignedToId" TEXT,
    "source" TEXT,
    "expectedCloseDate" TIMESTAMP(3),
    "actualCloseDate" TIMESTAMP(3),
    "lostReason" TEXT,
    "convertedCustomerId" TEXT,
    "prospectCompanyName" TEXT,
    "prospectWebsite" TEXT,
    "prospectIndustry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "customerId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "CustomerType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "assignedToId" TEXT,
    "jobDescriptionUrl" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'Negotiation',
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "targetSegment" TEXT,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "openedCount" INTEGER NOT NULL DEFAULT 0,
    "clickedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaign_logs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientName" TEXT,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "opened" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" TIMESTAMP(3),
    "clicked" BOOLEAN NOT NULL DEFAULT false,
    "clickedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_campaign_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sequences" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggerOn" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sequence_steps" (
    "id" TEXT NOT NULL,
    "sequenceId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "delayDays" INTEGER NOT NULL DEFAULT 0,
    "delayHours" INTEGER NOT NULL DEFAULT 0,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sequence_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurringDay" INTEGER,
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "pdfUrl" TEXT,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "currentTitle" TEXT,
    "yearsOfExperience" INTEGER,
    "skills" TEXT[],
    "resume" TEXT,
    "linkedinUrl" TEXT,
    "githubUrl" TEXT,
    "portfolioUrl" TEXT,
    "stage" "CandidateStage" NOT NULL DEFAULT 'VALIDATION',
    "rating" INTEGER,
    "notes" TEXT,
    "city" TEXT,
    "country" TEXT,
    "availableFrom" TIMESTAMP(3),
    "expectedSalary" DECIMAL(10,2),
    "salaryCurrency" TEXT DEFAULT 'USD',
    "odooId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "open_positions" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "filledAt" TIMESTAMP(3),

    CONSTRAINT "open_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_positions" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Under Review',
    "notes" TEXT,

    CONSTRAINT "candidate_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "candidateId" TEXT,
    "employeeNumber" TEXT NOT NULL,
    "department" TEXT,
    "jobTitle" TEXT NOT NULL,
    "status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "contractType" "ContractType" NOT NULL,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "terminationDate" TIMESTAMP(3),
    "salary" DECIMAL(10,2) NOT NULL,
    "salaryCurrency" TEXT NOT NULL DEFAULT 'USD',
    "managerId" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "emergencyContactRelation" TEXT,
    "documents" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_reviews" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reviewPeriodStart" TIMESTAMP(3) NOT NULL,
    "reviewPeriodEnd" TIMESTAMP(3) NOT NULL,
    "ratings" JSONB NOT NULL,
    "strengths" TEXT,
    "improvements" TEXT,
    "goals" TEXT,
    "overallRating" DECIMAL(3,2),
    "reviewedAt" TIMESTAMP(3),
    "reviewerName" TEXT,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remote_work_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "remote_work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "national_holidays" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'AL',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "national_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" TEXT NOT NULL,
    "remoteWorkFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "remoteWorkLimit" INTEGER NOT NULL DEFAULT 1,
    "eodGraceDays" INTEGER NOT NULL DEFAULT 2,
    "eodReportDeadlineHour" INTEGER NOT NULL DEFAULT 23,
    "eodReportDeadlineMin" INTEGER NOT NULL DEFAULT 59,
    "reviewCycleDays" INTEGER NOT NULL DEFAULT 180,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "eod_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "tasksWorkedOn" JSONB NOT NULL,
    "hoursWorked" DECIMAL(4,2),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "eod_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "assignedToId" TEXT,
    "createdById" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "customerId" TEXT,
    "tags" TEXT[],
    "estimatedHours" DECIMAL(5,2),
    "actualHours" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "customerId" TEXT,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "candidateId" TEXT,
    "employeeId" TEXT,
    "contactId" TEXT,
    "taskId" TEXT,
    "createdById" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "customerId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "meetingUrl" TEXT,
    "googleEventId" TEXT,
    "microsoftEventId" TEXT,
    "attendees" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_reports" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "content" JSONB NOT NULL,
    "htmlContent" TEXT,
    "pdfUrl" TEXT,
    "contributors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TemplateType" NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "cssContent" TEXT,
    "variables" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_imports" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "fieldMapping" JSONB,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "expiresAt" TIMESTAMP(3),
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_userId_key" ON "notification_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "customers_odooId_key" ON "customers"("odooId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_email_key" ON "contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_customerId_idx" ON "contacts"("customerId");

-- CreateIndex
CREATE INDEX "leads_contactId_idx" ON "leads"("contactId");

-- CreateIndex
CREATE INDEX "leads_convertedCustomerId_idx" ON "leads"("convertedCustomerId");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_assignedToId_idx" ON "leads"("assignedToId");

-- CreateIndex
CREATE INDEX "opportunities_customerId_idx" ON "opportunities"("customerId");

-- CreateIndex
CREATE INDEX "opportunities_type_idx" ON "opportunities"("type");

-- CreateIndex
CREATE INDEX "opportunities_assignedToId_idx" ON "opportunities"("assignedToId");

-- CreateIndex
CREATE INDEX "email_campaign_logs_campaignId_idx" ON "email_campaign_logs"("campaignId");

-- CreateIndex
CREATE INDEX "email_campaign_logs_recipientEmail_idx" ON "email_campaign_logs"("recipientEmail");

-- CreateIndex
CREATE UNIQUE INDEX "email_sequence_steps_sequenceId_order_key" ON "email_sequence_steps"("sequenceId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoiceNumber_key" ON "invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "invoices_customerId_idx" ON "invoices"("customerId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE INDEX "invoices_dueDate_idx" ON "invoices"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_email_key" ON "candidates"("email");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_odooId_key" ON "candidates"("odooId");

-- CreateIndex
CREATE INDEX "candidates_stage_idx" ON "candidates"("stage");

-- CreateIndex
CREATE INDEX "candidates_email_idx" ON "candidates"("email");

-- CreateIndex
CREATE UNIQUE INDEX "open_positions_opportunityId_key" ON "open_positions"("opportunityId");

-- CreateIndex
CREATE INDEX "open_positions_status_idx" ON "open_positions"("status");

-- CreateIndex
CREATE INDEX "candidate_positions_candidateId_idx" ON "candidate_positions"("candidateId");

-- CreateIndex
CREATE INDEX "candidate_positions_positionId_idx" ON "candidate_positions"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_positions_candidateId_positionId_key" ON "candidate_positions"("candidateId", "positionId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_userId_key" ON "employees"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_candidateId_key" ON "employees"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employeeNumber_key" ON "employees"("employeeNumber");

-- CreateIndex
CREATE INDEX "performance_reviews_employeeId_idx" ON "performance_reviews"("employeeId");

-- CreateIndex
CREATE INDEX "leave_requests_employeeId_idx" ON "leave_requests"("employeeId");

-- CreateIndex
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

-- CreateIndex
CREATE INDEX "remote_work_logs_employeeId_idx" ON "remote_work_logs"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "remote_work_logs_employeeId_date_key" ON "remote_work_logs"("employeeId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "national_holidays_date_country_key" ON "national_holidays"("date", "country");

-- CreateIndex
CREATE INDEX "eod_reports_userId_idx" ON "eod_reports"("userId");

-- CreateIndex
CREATE INDEX "eod_reports_date_idx" ON "eod_reports"("date");

-- CreateIndex
CREATE UNIQUE INDEX "eod_reports_userId_date_key" ON "eod_reports"("userId", "date");

-- CreateIndex
CREATE INDEX "tasks_assignedToId_idx" ON "tasks"("assignedToId");

-- CreateIndex
CREATE INDEX "tasks_status_idx" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "tasks_customerId_idx" ON "tasks"("customerId");

-- CreateIndex
CREATE INDEX "activities_customerId_idx" ON "activities"("customerId");

-- CreateIndex
CREATE INDEX "activities_leadId_idx" ON "activities"("leadId");

-- CreateIndex
CREATE INDEX "activities_opportunityId_idx" ON "activities"("opportunityId");

-- CreateIndex
CREATE INDEX "activities_candidateId_idx" ON "activities"("candidateId");

-- CreateIndex
CREATE INDEX "activities_employeeId_idx" ON "activities"("employeeId");

-- CreateIndex
CREATE INDEX "activities_contactId_idx" ON "activities"("contactId");

-- CreateIndex
CREATE INDEX "activities_taskId_idx" ON "activities"("taskId");

-- CreateIndex
CREATE INDEX "activities_createdById_idx" ON "activities"("createdById");

-- CreateIndex
CREATE INDEX "meetings_customerId_idx" ON "meetings"("customerId");

-- CreateIndex
CREATE INDEX "meetings_startTime_idx" ON "meetings"("startTime");

-- CreateIndex
CREATE INDEX "customer_reports_customerId_idx" ON "customer_reports"("customerId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "notifications"("isRead");

-- CreateIndex
CREATE UNIQUE INDEX "integrations_name_key" ON "integrations"("name");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaign_logs" ADD CONSTRAINT "email_campaign_logs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sequence_steps" ADD CONSTRAINT "email_sequence_steps_sequenceId_fkey" FOREIGN KEY ("sequenceId") REFERENCES "email_sequences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "open_positions" ADD CONSTRAINT "open_positions_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_positions" ADD CONSTRAINT "candidate_positions_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_positions" ADD CONSTRAINT "candidate_positions_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "open_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_reviews" ADD CONSTRAINT "performance_reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_work_logs" ADD CONSTRAINT "remote_work_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_work_logs" ADD CONSTRAINT "remote_work_logs_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "eod_reports" ADD CONSTRAINT "eod_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_reports" ADD CONSTRAINT "customer_reports_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

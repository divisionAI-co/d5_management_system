# Feedback Reports System - Implementation Guide

## Overview

The Feedback Reports System is a comprehensive module that allows HR, Account Managers, and Employees to collaboratively create monthly feedback reports that are automatically compiled with data from the system and can be sent to customers.

## Features

### 1. Auto-Compilation of Data
The system automatically compiles the following data for each report:
- **Number of Tasks**: Counts tasks the employee worked on during the month (tasks assigned to or created by them that were updated or completed during the period)
- **Total Days Off Taken**: Calculates approved leave days taken during the specific month
- **Total Remaining Days Off**: Calculates remaining annual leave for the entire year
- **Bank Holidays**: Lists bank holidays for the next month

### 2. Role-Based Access Control

#### HR / Admin
- Create new feedback reports
- View all feedback reports
- Update HR section (feedback, action description, and can override auto-compiled data)
- Submit reports for sending
- Recompile auto-calculated data
- Send reports to customers
- Delete draft/submitted reports

#### Account Manager
- View feedback reports
- Update Account Manager section (feedback only)
- Send submitted reports to customers

#### Employee
- View their own feedback reports
- Update Employee section (ratings and summary feedback)

### 3. Three-Section Structure

#### HR Section
- Number of tasks (auto-compiled, can be manually overridden)
- Total days off taken (auto-compiled, can be manually overridden)
- Total remaining days off (auto-compiled, can be manually overridden)
- HR feedback text
- Description of action taken

#### Account Manager Section
- Account Manager feedback text

#### Employee Section (Self-Assessment)
- Communication Effectiveness (1-5 rating)
- Collaboration and Teamwork (1-5 rating)
- Task Estimation (1-5 rating)
- Timeliness and Meeting Deadlines (1-5 rating)
- Summary feedback of the month

### 4. Report Workflow

1. **Create** (HR only): HR creates a new report for an employee for a specific month/year
2. **Auto-Compile**: System automatically calculates tasks, days off, and bank holidays
3. **Fill Sections**: Each role fills their respective sections
4. **Preview**: Anyone can preview the report as HTML before sending
5. **Submit** (HR only): HR submits the report when all sections are complete
6. **Send**: HR or Account Manager sends the report to the customer via email
7. **Archive**: Sent reports are marked as SENT and cannot be modified

## API Endpoints

### Base URL: `/api/feedback-reports`

#### Create Report
```
POST /api/feedback-reports
Role: HR, ADMIN
Body: {
  "employeeId": "uuid",
  "month": 1-12,
  "year": 2025
}
```

#### Get All Reports
```
GET /api/feedback-reports?employeeId=uuid&month=1&year=2025&status=DRAFT
Role: All (employees see only their own)
Query Params:
  - employeeId (optional)
  - month (optional)
  - year (optional)
  - status (optional): DRAFT | SUBMITTED | SENT
```

#### Get Single Report
```
GET /api/feedback-reports/:id
Role: All (employees can only view their own)
```

#### Update HR Section
```
PATCH /api/feedback-reports/:id/hr-section
Role: HR, ADMIN
Body: {
  "tasksCount": 15,
  "totalDaysOffTaken": 2,
  "totalRemainingDaysOff": 18,
  "hrFeedback": "Excellent performance this month...",
  "hrActionDescription": "Provided additional training on..."
}
```

#### Update Account Manager Section
```
PATCH /api/feedback-reports/:id/am-section
Role: ACCOUNT_MANAGER, ADMIN
Body: {
  "amFeedback": "Great collaboration with the client..."
}
```

#### Update Employee Section
```
PATCH /api/feedback-reports/:id/employee-section
Role: EMPLOYEE (own reports only)
Body: {
  "communicationRating": 4,
  "collaborationRating": 5,
  "taskEstimationRating": 4,
  "timelinessRating": 5,
  "employeeSummary": "This month has been very productive..."
}
```

#### Submit Report
```
POST /api/feedback-reports/:id/submit
Role: HR, ADMIN
```

#### Recompile Auto-Calculated Data
```
POST /api/feedback-reports/:id/recompile
Role: HR, ADMIN
```

#### Preview Report
```
GET /api/feedback-reports/:id/preview
Role: All (based on view permissions)
Response: {
  "html": "<html>...</html>"
}
```

#### Generate PDF
```
GET /api/feedback-reports/:id/pdf
Role: All (based on view permissions)
Response: PDF file download
```

#### Send to Customer
```
POST /api/feedback-reports/:id/send
Role: HR, ADMIN, ACCOUNT_MANAGER
Body: {
  "recipientEmail": "customer@example.com",
  "message": "Optional additional message"
}
```

#### Delete Report
```
DELETE /api/feedback-reports/:id
Role: HR, ADMIN
Note: Cannot delete sent reports
```

## Database Schema

```prisma
enum FeedbackReportStatus {
  DRAFT
  SUBMITTED
  SENT
}

model FeedbackReport {
  id         String   @id @default(uuid())
  employeeId String
  employee   Employee @relation(...)
  
  month Int // 1-12
  year  Int
  
  // Auto-compiled data (can be overridden by HR)
  tasksCount            Int?
  totalDaysOffTaken     Int?
  totalRemainingDaysOff Int?
  bankHolidays          Json?
  
  // HR Section
  hrFeedback              String?
  hrActionDescription     String?
  hrUpdatedAt             DateTime?
  hrUpdatedBy             String?
  hrUpdatedByUser         User?
  
  // Account Manager Section
  amFeedback              String?
  amUpdatedAt             DateTime?
  amUpdatedBy             String?
  amUpdatedByUser         User?
  
  // Employee Section
  communicationRating  Int?
  collaborationRating  Int?
  taskEstimationRating Int?
  timelinessRating     Int?
  employeeSummary      String?
  employeeUpdatedAt    DateTime?
  
  // Status
  status      FeedbackReportStatus @default(DRAFT)
  submittedAt DateTime?
  sentAt      DateTime?
  sentTo      String?
  
  pdfUrl String?
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@unique([employeeId, month, year])
}
```

## Frontend Integration

### Types
All TypeScript types are available in `apps/frontend/src/types/feedback-reports.ts`

### API Client Example

```typescript
import { api } from '@/lib/api';
import { FeedbackReport, CreateFeedbackReportDto } from '@/types/feedback-reports';

// Create report
const createReport = async (data: CreateFeedbackReportDto) => {
  const response = await api.post<FeedbackReport>('/feedback-reports', data);
  return response.data;
};

// Get all reports
const getReports = async (filters?: FilterFeedbackReportsDto) => {
  const response = await api.get<FeedbackReport[]>('/feedback-reports', {
    params: filters
  });
  return response.data;
};

// Update HR section
const updateHrSection = async (id: string, data: UpdateHrSectionDto) => {
  const response = await api.patch<FeedbackReport>(
    `/feedback-reports/${id}/hr-section`,
    data
  );
  return response.data;
};

// Preview report
const previewReport = async (id: string) => {
  const response = await api.get<{ html: string }>(
    `/feedback-reports/${id}/preview`
  );
  return response.data;
};

// Send to customer
const sendReport = async (id: string, data: SendReportDto) => {
  const response = await api.post<FeedbackReport>(
    `/feedback-reports/${id}/send`,
    data
  );
  return response.data;
};
```

## Template Structure

The system includes a default HTML template with the following sections:

1. **Header**: Employee name and reporting period
2. **Employee Information**: Name, job title, department
3. **Work Summary**: Tasks count, days off taken, remaining days off
4. **Bank Holidays**: List of holidays for the next month
5. **HR Feedback**: HR's feedback and action description
6. **Account Manager Feedback**: AM's feedback
7. **Employee Self-Assessment**: Ratings and summary

The template is fully styled and ready for PDF export. It uses a professional layout with:
- Color-coded ratings (1-5)
- Organized sections
- Professional typography
- Print-friendly formatting

## Business Logic

### Task Counting Logic
Tasks are counted if they meet ALL of these criteria:
- Employee was assigned to OR created the task
- Task was updated OR completed during the reporting month

### Days Off Calculation
- Only APPROVED leave requests are counted
- Overlapping days within the month are properly calculated
- Weekend days and holidays are already excluded from the original leave request calculations

### Bank Holidays
- Fetches holidays for the NEXT month (not the reporting month)
- Includes a note about weekend holiday observance rules
- Displays holiday name and date

### Remaining Days Off
- Calculated as: Annual allowance - Used days in the current year
- Uses company settings for annual allowance (default 20 days)
- Cannot go below 0

## Workflow Example

### Monthly Report Creation (HR)

1. **Create Report**
   ```
   POST /api/feedback-reports
   {
     "employeeId": "employee-uuid",
     "month": 1,
     "year": 2025
   }
   ```

2. **System Auto-Compiles**
   - Tasks: 15
   - Days off taken: 2
   - Remaining days: 18
   - Bank holidays for Feb 2025: [...]

3. **HR Reviews and Adds Feedback**
   ```
   PATCH /api/feedback-reports/:id/hr-section
   {
     "hrFeedback": "Great performance this month...",
     "hrActionDescription": "Provided mentoring..."
   }
   ```

4. **Account Manager Adds Feedback**
   ```
   PATCH /api/feedback-reports/:id/am-section
   {
     "amFeedback": "Excellent client communication..."
   }
   ```

5. **Employee Completes Self-Assessment**
   ```
   PATCH /api/feedback-reports/:id/employee-section
   {
     "communicationRating": 4,
     "collaborationRating": 5,
     "taskEstimationRating": 4,
     "timelinessRating": 5,
     "employeeSummary": "Very productive month..."
   }
   ```

6. **HR Submits Report**
   ```
   POST /api/feedback-reports/:id/submit
   ```

7. **HR or AM Sends to Customer**
   ```
   POST /api/feedback-reports/:id/send
   {
     "recipientEmail": "client@company.com",
     "message": "Please find attached..."
   }
   ```

## Notes

- Reports are uniquely identified by employee + month + year (cannot create duplicates)
- Once a report is SENT, it cannot be modified or deleted
- Only SUBMITTED reports can be sent to customers
- HR can recompile auto-calculated data at any time before sending
- The PDF is generated on-the-fly and attached to the email
- Email includes a professional template with company branding

## Future Enhancements

Potential features to add:
- Custom templates support (using the existing Templates module)
- Scheduled monthly report generation
- Reminders for incomplete sections
- Report analytics and trends
- Bulk report generation
- Customer feedback/acknowledgment tracking
- Integration with project management for task details
- Attachment support for additional documents


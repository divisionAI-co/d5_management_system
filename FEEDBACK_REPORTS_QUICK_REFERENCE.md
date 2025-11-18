# Feedback Reports - Quick Reference

## 🚀 Quick Start

### Testing Immediately
```bash
# 1. Start backend
cd apps/backend
npm run dev

# 2. In another terminal, start frontend
cd apps/frontend
npm run dev

# 3. Login with test accounts:
# HR: hr@division5.com / hr123
# Account Manager: manager@division5.com / manager123
# Employee: employee@division5.com / employee123
```

### API Base URL
```
http://localhost:3000/api/feedback-reports
```

### Swagger Documentation
```
http://localhost:3000/api/docs
```

---

## 📋 Common API Operations

### Create Report (HR Only)
```typescript
POST /api/feedback-reports
{
  "employeeId": "uuid",
  "month": 1,      // 1-12
  "year": 2025
}
```

### Get All Reports
```typescript
GET /api/feedback-reports?month=1&year=2025&status=DRAFT
```

### Update HR Section
```typescript
PATCH /api/feedback-reports/:id/hr-section
{
  "tasksCount": 15,
  "hrFeedback": "Great work this month...",
  "hrActionDescription": "Provided training..."
}
```

### Update AM Section
```typescript
PATCH /api/feedback-reports/:id/am-section
{
  "amFeedback": "Excellent client collaboration..."
}
```

### Update Employee Section
```typescript
PATCH /api/feedback-reports/:id/employee-section
{
  "communicationRating": 4,
  "collaborationRating": 5,
  "taskEstimationRating": 4,
  "timelinessRating": 5,
  "employeeSummary": "Productive month..."
}
```

### Preview Report
```typescript
GET /api/feedback-reports/:id/preview
// Returns: { html: "<html>...</html>" }
```

### Download PDF
```typescript
GET /api/feedback-reports/:id/pdf
// Returns: PDF file
```

### Submit Report (HR Only)
```typescript
POST /api/feedback-reports/:id/submit
```

### Send to Customer
```typescript
POST /api/feedback-reports/:id/send
{
  "recipientEmail": "client@company.com",
  "message": "Please find attached..."
}
```

---

## 🎨 Frontend Integration

### Import API Client
```typescript
import { feedbackReportsApi } from '@/lib/api/feedback-reports';
```

### Create Report
```typescript
const report = await feedbackReportsApi.create({
  employeeId: 'employee-uuid',
  month: 1,
  year: 2025
});
```

### Get Reports
```typescript
const reports = await feedbackReportsApi.getAll({
  month: 1,
  year: 2025,
  status: FeedbackReportStatus.DRAFT
});
```

### Update Sections
```typescript
// HR
await feedbackReportsApi.updateHrSection(id, {
  hrFeedback: 'Great work...'
});

// AM
await feedbackReportsApi.updateAmSection(id, {
  amFeedback: 'Excellent...'
});

// Employee
await feedbackReportsApi.updateEmployeeSection(id, {
  communicationRating: 4,
  employeeSummary: 'Productive...'
});
```

### Preview & Download
```typescript
// Preview
const { html } = await feedbackReportsApi.preview(id);

// Download PDF
import { downloadFeedbackReportPdf } from '@/lib/api/feedback-reports';
await downloadFeedbackReportPdf(id, 'report-jan-2025.pdf');
```

### Send Report
```typescript
await feedbackReportsApi.sendToCustomer(id, {
  recipientEmail: 'client@company.com',
  message: 'Please find attached...'
});
```

---

## 🔐 Role Permissions

| Action | HR | Account Manager | Employee |
|--------|----|-----------------| ---------|
| Create | ✅ | ❌ | ❌ |
| View All | ✅ | ✅ | Own only |
| Update HR Section | ✅ | ❌ | ❌ |
| Update AM Section | ❌ | ✅ | ❌ |
| Update Employee Section | ❌ | ❌ | ✅ |
| Submit | ✅ | ❌ | ❌ |
| Recompile | ✅ | ❌ | ❌ |
| Preview | ✅ | ✅ | Own only |
| Download PDF | ✅ | ✅ | Own only |
| Send | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ |

---

## 📊 Auto-Compiled Data

### What Gets Auto-Calculated
1. **Tasks Count**: Tasks assigned/created by employee, updated/completed in month
2. **Days Off Taken**: Approved leave days in the reporting month
3. **Remaining Days Off**: Annual allowance - used days in current year
4. **Bank Holidays**: Holidays in the NEXT month

### Manual Override
HR can manually override any auto-calculated value:
```typescript
PATCH /api/feedback-reports/:id/hr-section
{
  "tasksCount": 20,  // Override auto-calculated value
  "totalDaysOffTaken": 3
}
```

### Recompile
HR can recompile auto-calculated data:
```typescript
POST /api/feedback-reports/:id/recompile
```

---

## 🔄 Status Workflow

```
DRAFT → (edit) → SUBMITTED → (send) → SENT
```

- **DRAFT**: Being filled out, can be edited by all roles
- **SUBMITTED**: Ready to send, can still be edited
- **SENT**: Sent to customer, READ-ONLY, cannot be edited or deleted

---

## 📝 Rating Scale

| Rating | Label |
|--------|-------|
| 5 | Outstanding |
| 4 | Exceeds expectations |
| 3 | Meets expectations |
| 2 | Needs improvement |
| 1 | Unacceptable |

---

## 🎯 Typical Monthly Workflow

1. **Beginning of Month (HR)**
   - Create report for previous month
   - System auto-compiles data
   - Review and add HR feedback

2. **Account Manager**
   - Add account manager feedback
   - Review client interactions

3. **Employee**
   - Complete self-assessment
   - Add summary feedback

4. **HR Reviews**
   - Preview report
   - Make final adjustments
   - Submit report

5. **HR or AM Sends**
   - Download PDF (optional)
   - Send to customer via email
   - Report archived as SENT

---

## 🔧 Helper Functions

### Format Period
```typescript
import { formatReportPeriod } from '@/lib/api/feedback-reports';
formatReportPeriod(1, 2025); // "January 2025"
```

### Rating Labels
```typescript
import { getRatingLabel } from '@/lib/api/feedback-reports';
getRatingLabel(5); // "Outstanding"
getRatingLabel(3); // "Meets expectations"
```

### Status Badge Colors
```typescript
import { getStatusBadgeColor } from '@/lib/api/feedback-reports';
getStatusBadgeColor('DRAFT');     // "bg-gray-100 text-gray-800"
getStatusBadgeColor('SUBMITTED'); // "bg-blue-100 text-blue-800"
getStatusBadgeColor('SENT');      // "bg-green-100 text-green-800"
```

---

## 🐛 Common Issues

### Issue: "Report already exists"
**Solution**: Each employee can only have one report per month/year. Use filters to find existing report.

### Issue: "Cannot modify sent report"
**Solution**: Sent reports are read-only. Create a new report if corrections are needed.

### Issue: "Forbidden"
**Solution**: Check user role permissions. Some actions are restricted to specific roles.

### Issue: "PDF generation failed"
**Solution**: Ensure Chromium is installed (Puppeteer dependency).

---

## 📞 Getting Help

1. **Detailed Guide**: `FEEDBACK_REPORTS_GUIDE.md`
2. **Implementation Details**: `FEEDBACK_REPORTS_IMPLEMENTATION_SUMMARY.md`
3. **API Docs**: `http://localhost:3000/api/docs`
4. **Source Code**:
   - Service: `apps/backend/src/modules/hr/feedback-reports/feedback-reports.service.ts`
   - Controller: `apps/backend/src/modules/hr/feedback-reports/feedback-reports.controller.ts`
   - Types: `apps/frontend/src/types/feedback-reports.ts`

---

## 📦 Files Created

### Backend
- ✅ `feedback-reports.service.ts`
- ✅ `feedback-reports.controller.ts`
- ✅ `feedback-reports.module.ts`
- ✅ 6 DTOs in `dto/` folder
- ✅ Prisma schema updated
- ✅ Migration applied

### Frontend
- ✅ `types/feedback-reports.ts`
- ✅ `lib/api/feedback-reports.ts`

### Documentation
- ✅ `FEEDBACK_REPORTS_GUIDE.md`
- ✅ `FEEDBACK_REPORTS_IMPLEMENTATION_SUMMARY.md`
- ✅ `FEEDBACK_REPORTS_QUICK_REFERENCE.md` (this file)

---

**Last Updated**: November 18, 2025  
**Status**: ✅ Ready for Use


/**
 * Data Migration: Seed Default Templates for All Template Types
 * 
 * This script creates default templates for every template type in the system.
 * It uses upsert to avoid duplicates and can be safely run on existing databases.
 * 
 * Run with: npx ts-node prisma/migrations/seed-default-templates.ts
 */

import { PrismaClient, TemplateType } from '@prisma/client';

const prisma = new PrismaClient();

interface TemplateDefinition {
  id: string;
  name: string;
  type: TemplateType;
  htmlContent: string;
  cssContent?: string | null;
  variables: any;
}

const defaultTemplates: TemplateDefinition[] = [
  // INVOICE Template
  {
    id: 'default-invoice',
    name: 'Default Invoice Template',
    type: 'INVOICE',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .header h1 { color: #333; margin: 0; }
    .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .invoice-details div { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; font-weight: bold; }
    .totals { text-align: right; }
    .totals table { width: 300px; margin-left: auto; }
    .total-row { font-weight: bold; font-size: 1.2em; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
  </style>
</head>
<body>
  <div class="header">
    <h1>INVOICE</h1>
    <p>Invoice #{{invoiceNumber}}</p>
  </div>
  
  <div class="invoice-details">
    <div>
      <h3>Bill To:</h3>
      <p><strong>{{customer.name}}</strong><br>
      {{customer.email}}<br>
      {{#if customer.address}}{{customer.address}}<br>{{/if}}
      {{#if customer.city}}{{customer.city}}, {{/if}}{{#if customer.postalCode}}{{customer.postalCode}}{{/if}}</p>
    </div>
    <div>
      <p><strong>Date:</strong> {{formatDate issueDate}}</p>
      <p><strong>Due Date:</strong> {{formatDate dueDate}}</p>
      <p><strong>Status:</strong> {{status}}</p>
    </div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Quantity</th>
        <th>Price</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{description}}</td>
        <td>{{quantity}}</td>
        <td>{{formatCurrency price ../currency}}</td>
        <td>{{formatCurrency total ../currency}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>
  
  <div class="totals">
    <table>
      <tr>
        <td>Subtotal:</td>
        <td>{{formatCurrency subtotal currency}}</td>
      </tr>
      <tr>
        <td>Tax ({{taxRate}}%):</td>
        <td>{{formatCurrency taxAmount currency}}</td>
      </tr>
      <tr class="total-row">
        <td>Total:</td>
        <td>{{formatCurrency total currency}}</td>
      </tr>
    </table>
  </div>
  
  {{#if notes}}
  <div style="margin-top: 30px;">
    <h3>Notes:</h3>
    <p>{{notes}}</p>
  </div>
  {{/if}}
  
  <div class="footer">
    <p>Thank you for your business!</p>
  </div>
</body>
</html>`,
    variables: [
      { key: 'invoiceNumber', description: 'Invoice number' },
      { key: 'customer.name', description: 'Customer name' },
      { key: 'customer.email', description: 'Customer email' },
      { key: 'customer.address', description: 'Customer address' },
      { key: 'customer.city', description: 'Customer city' },
      { key: 'customer.postalCode', description: 'Customer postal code' },
      { key: 'issueDate', description: 'Issue date' },
      { key: 'dueDate', description: 'Due date' },
      { key: 'status', description: 'Invoice status' },
      { key: 'items', description: 'Array of invoice items' },
      { key: 'subtotal', description: 'Subtotal amount' },
      { key: 'taxRate', description: 'Tax rate percentage' },
      { key: 'taxAmount', description: 'Tax amount' },
      { key: 'total', description: 'Total amount' },
      { key: 'currency', description: 'Currency code' },
      { key: 'notes', description: 'Optional notes' },
    ],
  },

  // CUSTOMER_REPORT Template
  {
    id: 'default-customer-report',
    name: 'Monthly Customer Report',
    type: 'CUSTOMER_REPORT',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .section { margin: 30px 0; padding: 20px; border-left: 4px solid #667eea; }
    h2 { color: #333; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Monthly Report - {{title}}</h1>
    <p>{{formatDate periodStart}} - {{formatDate periodEnd}}</p>
  </div>
  <div class="section">
    <h2>Summary</h2>
    <p>{{content.summary}}</p>
  </div>
  <div class="section">
    <h2>Accomplishments</h2>
    <ul>
    {{#each content.accomplishments}}
      <li>{{this}}</li>
    {{/each}}
    </ul>
  </div>
</body>
</html>`,
    variables: [
      { key: 'title', description: 'Report title' },
      { key: 'periodStart', description: 'Start date' },
      { key: 'periodEnd', description: 'End date' },
      { key: 'content.summary', description: 'Report summary' },
      { key: 'content.accomplishments', description: 'Array of accomplishments' },
    ],
  },

  // PERFORMANCE_REVIEW Template
  {
    id: 'default-performance-review',
    name: 'Default Performance Review Template',
    type: 'PERFORMANCE_REVIEW',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 0 auto; padding: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #2563EB; padding-bottom: 20px; }
    .header h1 { color: #2563EB; margin: 0; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section h2 { color: #2563EB; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
    td { padding: 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    td.label { font-weight: bold; width: 40%; color: #555; }
    .rating { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .rating-5 { background-color: #10b981; color: white; }
    .rating-4 { background-color: #3b82f6; color: white; }
    .rating-3 { background-color: #f59e0b; color: white; }
    .rating-2 { background-color: #f97316; color: white; }
    .rating-1 { background-color: #ef4444; color: white; }
    .feedback-text { background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-top: 10px; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Performance Review</h1>
    <p>{{employeeName}} - {{reviewPeriod}}</p>
  </div>

  <div class="section">
    <h2>Employee Information</h2>
    <table>
      <tr>
        <td class="label">Employee Name:</td>
        <td>{{employeeName}}</td>
      </tr>
      <tr>
        <td class="label">Job Title:</td>
        <td>{{jobTitle}}</td>
      </tr>
      <tr>
        <td class="label">Department:</td>
        <td>{{department}}</td>
      </tr>
      <tr>
        <td class="label">Review Period:</td>
        <td>{{reviewPeriod}}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Performance Ratings</h2>
    <table>
      <tr>
        <td class="label">Overall Performance:</td>
        <td>{{{overallRatingDisplay}}}</td>
      </tr>
      <tr>
        <td class="label">Communication:</td>
        <td>{{{communicationRatingDisplay}}}</td>
      </tr>
      <tr>
        <td class="label">Teamwork:</td>
        <td>{{{teamworkRatingDisplay}}}</td>
      </tr>
      <tr>
        <td class="label">Problem Solving:</td>
        <td>{{{problemSolvingRatingDisplay}}}</td>
      </tr>
    </table>
  </div>

  {{#if managerFeedback}}
  <div class="section">
    <h2>Manager Feedback</h2>
    <div class="feedback-text">{{managerFeedback}}</div>
  </div>
  {{/if}}

  {{#if goals}}
  <div class="section">
    <h2>Goals for Next Period</h2>
    <ul>
      {{#each goals}}
      <li>{{this}}</li>
      {{/each}}
    </ul>
  </div>
  {{/if}}
</body>
</html>`,
    variables: [
      { key: 'employeeName', description: 'Employee full name' },
      { key: 'jobTitle', description: 'Employee job title' },
      { key: 'department', description: 'Employee department' },
      { key: 'reviewPeriod', description: 'Review period (e.g., Q1 2025)' },
      { key: 'overallRatingDisplay', description: 'Overall rating with badge' },
      { key: 'communicationRatingDisplay', description: 'Communication rating with badge' },
      { key: 'teamworkRatingDisplay', description: 'Teamwork rating with badge' },
      { key: 'problemSolvingRatingDisplay', description: 'Problem solving rating with badge' },
      { key: 'managerFeedback', description: 'Manager feedback text' },
      { key: 'goals', description: 'Array of goals for next period' },
    ],
  },

  // FEEDBACK_REPORT Template
  {
    id: 'default-feedback-report',
    name: 'Default Feedback Report Template',
    type: 'FEEDBACK_REPORT',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #2563EB; padding-bottom: 20px; }
    .header h1 { color: #2563EB; margin: 0; }
    .header p { color: #666; margin: 10px 0 0 0; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section h2 { color: #2563EB; border-bottom: 1px solid #ddd; padding-bottom: 10px; margin-bottom: 15px; }
    .section h3 { color: #555; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; }
    td { padding: 10px; border-bottom: 1px solid #eee; vertical-align: top; }
    td.label { font-weight: bold; width: 40%; color: #555; }
    .rating { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; }
    .rating-5 { background-color: #10b981; color: white; }
    .rating-4 { background-color: #3b82f6; color: white; }
    .rating-3 { background-color: #f59e0b; color: white; }
    .rating-2 { background-color: #f97316; color: white; }
    .rating-1 { background-color: #ef4444; color: white; }
    .feedback-text { background-color: #f9fafb; padding: 15px; border-radius: 6px; margin-top: 10px; white-space: pre-wrap; }
    .holiday-list { list-style: none; padding: 0; }
    .holiday-list li { padding: 8px; margin: 4px 0; background-color: #f3f4f6; border-radius: 4px; }
    .note { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 20px; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Monthly Feedback Report</h1>
    <p>{{employeeName}} - {{monthYear}}</p>
  </div>

  <div class="section">
    <h2>Employee Information</h2>
    <table>
      <tr>
        <td class="label">Employee Name:</td>
        <td>{{employeeName}}</td>
      </tr>
      <tr>
        <td class="label">Job Title:</td>
        <td>{{jobTitle}}</td>
      </tr>
      <tr>
        <td class="label">Department:</td>
        <td>{{department}}</td>
      </tr>
      <tr>
        <td class="label">Reporting Period:</td>
        <td>{{monthYear}}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Work Summary</h2>
    <table>
      <tr>
        <td class="label">Number of Tasks:</td>
        <td>{{tasksCount}}</td>
      </tr>
      <tr>
        <td class="label">Total Days Off Taken in {{monthName}}:</td>
        <td>{{totalDaysOffTaken}}</td>
      </tr>
      <tr>
        <td class="label">Total Remaining Days Off:</td>
        <td>{{totalRemainingDaysOff}}</td>
      </tr>
    </table>
  </div>

  {{#if bankHolidays}}
  <div class="section">
    <h2>Bank Holidays {{nextMonthName}} {{nextMonthYear}}</h2>
    <ul class="holiday-list">
      {{#each bankHolidays}}
      <li><strong>{{this.name}}</strong> - {{this.date}}</li>
      {{/each}}
    </ul>
    <div class="note">
      * If the public holiday/holidays falls/fall on the day or days of the weekend (Saturday and/or Sunday), 
      the holiday shall be observed on the following working day or days (Monday and Tuesday).
    </div>
  </div>
  {{/if}}

  {{#if amFeedback}}
  <div class="section">
    <h2>Account Manager Feedback</h2>
    <div class="feedback-text">{{amFeedback}}</div>
    {{#if amActionDescription}}
    <h3>Action Taken:</h3>
    <div class="feedback-text">{{amActionDescription}}</div>
    {{/if}}
  </div>
  {{/if}}

  <div class="section">
    <h2>Employee Self-Assessment</h2>
    
    <h3>Performance Ratings</h3>
    <table>
      <tr>
        <td class="label">Communication Effectiveness:</td>
        <td>{{{communicationRatingDisplay}}}</td>
      </tr>
      <tr>
        <td class="label">Collaboration and Teamwork:</td>
        <td>{{{collaborationRatingDisplay}}}</td>
      </tr>
      <tr>
        <td class="label">Task Estimation:</td>
        <td>{{{taskEstimationRatingDisplay}}}</td>
      </tr>
      <tr>
        <td class="label">Timeliness and Meeting Deadlines:</td>
        <td>{{{timelinessRatingDisplay}}}</td>
      </tr>
    </table>

    <p style="font-size: 0.9em; color: #666; margin-top: 5px;">
      <strong>Rating Scale:</strong> 5 – Outstanding | 4 – Exceeds expectations | 3 – Meets expectations | 2 – Needs improvement | 1 – Unacceptable
    </p>

    {{#if employeeSummary}}
    <h3>Summary Feedback of the Month:</h3>
    <div class="feedback-text">{{employeeSummary}}</div>
    {{/if}}
  </div>
</body>
</html>`,
    variables: [
      { key: 'employeeName', description: 'Employee full name' },
      { key: 'jobTitle', description: 'Employee job title' },
      { key: 'department', description: 'Employee department' },
      { key: 'monthYear', description: 'Reporting period (e.g., January 2025)' },
      { key: 'monthName', description: 'Month name' },
      { key: 'nextMonthName', description: 'Next month name' },
      { key: 'nextMonthYear', description: 'Next month year' },
      { key: 'tasksCount', description: 'Number of tasks worked on' },
      { key: 'totalDaysOffTaken', description: 'Days off taken in the month' },
      { key: 'totalRemainingDaysOff', description: 'Remaining annual leave days' },
      { key: 'bankHolidays', description: 'Array of bank holidays for next month' },
      { key: 'amFeedback', description: 'Account Manager feedback text' },
      { key: 'amActionDescription', description: 'Account Manager action description' },
      { key: 'communicationRatingDisplay', description: 'Communication rating with badge' },
      { key: 'collaborationRatingDisplay', description: 'Collaboration rating with badge' },
      { key: 'taskEstimationRatingDisplay', description: 'Task estimation rating with badge' },
      { key: 'timelinessRatingDisplay', description: 'Timeliness rating with badge' },
      { key: 'employeeSummary', description: 'Employee summary feedback' },
    ],
  },

  // EMAIL Template
  {
    id: 'default-email',
    name: 'Default Email Template',
    type: 'EMAIL',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .header { background-color: #2563EB; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Hi {{firstName}},</h1>
  </div>
  <div class="content">
    <p>Thanks for choosing division5. This is your email template body.</p>
    <p style="margin-top: 24px;">— The division5 Team</p>
  </div>
  <div class="footer">
    <p>© 2025 division5. All rights reserved.</p>
    <p>This email was sent to {{email}}</p>
  </div>
</body>
</html>`,
    variables: [
      { key: 'firstName', description: 'Recipient first name' },
      { key: 'lastName', description: 'Recipient last name' },
      { key: 'email', description: 'Recipient email' },
    ],
  },

  // EOD_REPORT_SUBMITTED Template
  {
    id: 'default-eod-report-submitted',
    name: 'Default EOD Report Submitted',
    type: 'EOD_REPORT_SUBMITTED',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .header { background-color: #2563EB; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
    .report-box { background-color: #fff; padding: 15px; border-left: 4px solid #2563EB; margin: 15px 0; border-radius: 4px; }
    .report-detail { margin: 8px 0; }
    .report-detail strong { color: #374151; }
    .late-warning { background-color: #fee2e2; color: #991b1b; padding: 10px; border-radius: 4px; margin: 15px 0; font-weight: bold; }
    .task-item { padding: 8px; margin: 4px 0; background-color: #f3f4f6; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>EOD Report Submitted</h1>
  </div>
  <div class="content">
    <p>Hi {{user.firstName}},</p>
    <p>Your End of Day report for <strong>{{report.date}}</strong> has been successfully submitted.</p>
    {{#if report.isLate}}
    <div class="late-warning">⚠️ Note: This report was submitted after the deadline.</div>
    {{/if}}
    <div class="report-box">
      <div class="report-detail">
        <strong>Date:</strong> {{report.date}}
      </div>
      <div class="report-detail">
        <strong>Total Hours Worked:</strong> {{report.hoursWorked}} hour(s)
      </div>
      {{#if report.submittedAt}}
      <div class="report-detail">
        <strong>Submitted At:</strong> {{report.submittedAt}}
      </div>
      {{/if}}
      {{#if report.summary}}
      <div class="report-detail" style="margin-top: 12px;">
        <strong>Summary:</strong><br>
        {{report.summary}}
      </div>
      {{/if}}
    </div>
    {{#if report.tasks}}
    <div style="margin-top: 20px;">
      <strong>Tasks Worked On ({{report.tasks.length}}):</strong>
      {{#each report.tasks}}
      <div class="task-item">
        <strong>{{this.ticket}}</strong> - {{this.typeOfWorkDone}}<br>
        <span style="color: #6b7280; font-size: 0.9em;">Time spent: {{this.timeSpent}} hour(s)</span>
      </div>
      {{/each}}
    </div>
    {{/if}}
  </div>
  <div class="footer">
    <p>Thank you for your submission!</p>
  </div>
</body>
</html>`,
    variables: [
      { key: 'user.firstName', description: 'User first name' },
      { key: 'user.lastName', description: 'User last name' },
      { key: 'user.email', description: 'User email' },
      { key: 'report.date', description: 'Report date' },
      { key: 'report.hoursWorked', description: 'Total hours worked' },
      { key: 'report.summary', description: 'Report summary' },
      { key: 'report.isLate', description: 'Whether report was late' },
      { key: 'report.submittedAt', description: 'Submission timestamp' },
      { key: 'report.tasks', description: 'Array of tasks worked on' },
    ],
  },

  // LEAVE_REQUEST_CREATED Template
  {
    id: 'default-leave-request-created',
    name: 'Default Leave Request Created',
    type: 'LEAVE_REQUEST_CREATED',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .request-box { background-color: #fff; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0; border-radius: 4px; }
    .request-detail { margin: 8px 0; }
    .request-detail strong { color: #374151; }
  </style>
</head>
<body>
  <div class="header">
    <h1>New Leave Request</h1>
  </div>
  <div class="content">
    <p>A new leave request has been submitted and requires your review:</p>
    <div class="request-box">
      <div class="request-detail">
        <strong>Employee:</strong> {{employee.firstName}} {{employee.lastName}}
      </div>
      <div class="request-detail">
        <strong>Start Date:</strong> {{request.startDate}}
      </div>
      <div class="request-detail">
        <strong>End Date:</strong> {{request.endDate}}
      </div>
      {{#if request.totalDays}}
      <div class="request-detail">
        <strong>Total Days:</strong> {{request.totalDays}} day(s)
      </div>
      {{/if}}
      <div class="request-detail">
        <strong>Type:</strong> {{request.type}}
      </div>
      {{#if request.reason}}
      <div class="request-detail">
        <strong>Reason:</strong><br>
        {{request.reason}}
      </div>
      {{/if}}
    </div>
    <p style="margin-top: 20px;">Please review and approve or reject this request in the system.</p>
  </div>
</body>
</html>`,
    variables: [
      { key: 'employee.firstName', description: 'Employee first name' },
      { key: 'employee.lastName', description: 'Employee last name' },
      { key: 'request.startDate', description: 'Leave start date' },
      { key: 'request.endDate', description: 'Leave end date' },
      { key: 'request.totalDays', description: 'Total number of days' },
      { key: 'request.type', description: 'Leave type (e.g., VACATION, SICK, PERSONAL)' },
      { key: 'request.reason', description: 'Leave reason' },
    ],
  },

  // LEAVE_REQUEST_APPROVED Template
  {
    id: 'default-leave-request-approved',
    name: 'Default Leave Request Approved',
    type: 'LEAVE_REQUEST_APPROVED',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .approved-box { background-color: #d1fae5; padding: 15px; border-left: 4px solid #10b981; margin: 15px 0; border-radius: 4px; }
    .request-detail { margin: 8px 0; }
    .request-detail strong { color: #374151; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Leave Request Approved ✓</h1>
  </div>
  <div class="content">
    <p>Hi {{employee.firstName}},</p>
    <p>Great news! Your leave request has been <strong>approved</strong>.</p>
    <div class="approved-box">
      <div class="request-detail">
        <strong>Period:</strong> {{request.startDate}} to {{request.endDate}}
      </div>
      {{#if request.totalDays}}
      <div class="request-detail">
        <strong>Total Days:</strong> {{request.totalDays}} day(s)
      </div>
      {{/if}}
      <div class="request-detail">
        <strong>Type:</strong> {{request.type}}
      </div>
      {{#if approvedBy}}
      <div class="request-detail">
        <strong>Approved by:</strong> {{approvedBy.firstName}} {{approvedBy.lastName}}
      </div>
      {{/if}}
    </div>
    <p style="margin-top: 20px;">Enjoy your time off! 🎉</p>
  </div>
</body>
</html>`,
    variables: [
      { key: 'employee.firstName', description: 'Employee first name' },
      { key: 'request.startDate', description: 'Leave start date' },
      { key: 'request.endDate', description: 'Leave end date' },
      { key: 'request.totalDays', description: 'Total number of days' },
      { key: 'request.type', description: 'Leave type (e.g., VACATION, SICK, PERSONAL)' },
      { key: 'approvedBy.firstName', description: 'Approver first name' },
      { key: 'approvedBy.lastName', description: 'Approver last name' },
    ],
  },

  // LEAVE_REQUEST_REJECTED Template
  {
    id: 'default-leave-request-rejected',
    name: 'Default Leave Request Rejected',
    type: 'LEAVE_REQUEST_REJECTED',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .rejected-box { background-color: #fee2e2; padding: 15px; border-left: 4px solid #ef4444; margin: 15px 0; border-radius: 4px; }
    .request-detail { margin: 8px 0; }
    .request-detail strong { color: #374151; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Leave Request Rejected</h1>
  </div>
  <div class="content">
    <p>Hi {{employee.firstName}},</p>
    <p>Unfortunately, your leave request has been <strong>rejected</strong>.</p>
    <div class="rejected-box">
      <div class="request-detail">
        <strong>Period:</strong> {{request.startDate}} to {{request.endDate}}
      </div>
      {{#if request.totalDays}}
      <div class="request-detail">
        <strong>Total Days:</strong> {{request.totalDays}} day(s)
      </div>
      {{/if}}
      <div class="request-detail">
        <strong>Type:</strong> {{request.type}}
      </div>
      {{#if rejectedBy}}
      <div class="request-detail">
        <strong>Rejected by:</strong> {{rejectedBy.firstName}} {{rejectedBy.lastName}}
      </div>
      {{/if}}
      {{#if rejectionReason}}
      <div class="request-detail" style="margin-top: 12px;">
        <strong>Reason:</strong><br>
        {{rejectionReason}}
      </div>
      {{/if}}
    </div>
    <p style="margin-top: 20px;">Please contact HR if you have any questions or would like to discuss this decision.</p>
  </div>
</body>
</html>`,
    variables: [
      { key: 'employee.firstName', description: 'Employee first name' },
      { key: 'request.startDate', description: 'Leave start date' },
      { key: 'request.endDate', description: 'Leave end date' },
      { key: 'request.totalDays', description: 'Total number of days' },
      { key: 'request.type', description: 'Leave type (e.g., VACATION, SICK, PERSONAL)' },
      { key: 'rejectedBy.firstName', description: 'Rejector first name' },
      { key: 'rejectedBy.lastName', description: 'Rejector last name' },
      { key: 'rejectionReason', description: 'Rejection reason' },
    ],
  },

  // TASK_ASSIGNED Template
  {
    id: 'default-task-assigned',
    name: 'Default Task Assigned',
    type: 'TASK_ASSIGNED',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .task-box { background-color: #fff; padding: 15px; border-left: 4px solid #3b82f6; margin: 15px 0; border-radius: 4px; }
    .task-title { font-size: 1.2em; font-weight: bold; color: #1f2937; margin-bottom: 10px; }
    .task-detail { margin: 8px 0; }
    .task-detail strong { color: #374151; }
    .priority { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 0.9em; font-weight: bold; }
    .priority-HIGH { background-color: #fee2e2; color: #991b1b; }
    .priority-MEDIUM { background-color: #fef3c7; color: #92400e; }
    .priority-LOW { background-color: #dbeafe; color: #1e40af; }
  </style>
</head>
<body>
  <div class="header">
    <h1>New Task Assigned</h1>
  </div>
  <div class="content">
    <p>Hi {{assignedTo.firstName}},</p>
    <p>A new task has been assigned to you by <strong>{{assignedBy.firstName}} {{assignedBy.lastName}}</strong>:</p>
    <div class="task-box">
      <div class="task-title">{{task.title}}</div>
      {{#if task.description}}
      <div class="task-detail">
        <strong>Description:</strong><br>
        {{task.description}}
      </div>
      {{/if}}
      <div class="task-detail">
        <strong>Priority:</strong> 
        <span class="priority priority-{{task.priority}}">{{task.priority}}</span>
      </div>
      {{#if task.dueDate}}
      <div class="task-detail">
        <strong>Due Date:</strong> {{task.dueDate}}
      </div>
      {{/if}}
    </div>
    <p style="margin-top: 20px;">Please review and start working on this task when ready.</p>
  </div>
</body>
</html>`,
    variables: [
      { key: 'assignedTo.firstName', description: 'Assignee first name' },
      { key: 'task.title', description: 'Task title' },
      { key: 'task.description', description: 'Task description' },
      { key: 'task.dueDate', description: 'Task due date' },
      { key: 'task.priority', description: 'Task priority (HIGH, MEDIUM, LOW)' },
      { key: 'assignedBy.firstName', description: 'Assigner first name' },
      { key: 'assignedBy.lastName', description: 'Assigner last name' },
    ],
  },

  // MENTION_NOTIFICATION Template
  {
    id: 'default-mention-notification',
    name: 'Default Mention Notification',
    type: 'MENTION_NOTIFICATION',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .header { background-color: #8b5cf6; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .button { display: inline-block; padding: 10px 20px; background-color: #8b5cf6; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
    .activity-box { background-color: #fff; padding: 15px; border-left: 4px solid #8b5cf6; margin: 15px 0; border-radius: 4px; }
    .activity-subject { font-weight: bold; color: #374151; margin-bottom: 8px; }
    .activity-meta { font-size: 0.9em; color: #6b7280; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>You Were Mentioned</h1>
  </div>
  <div class="content">
    <p>Hi {{firstName}},</p>
    <p><strong>{{mentionedBy.firstName}} {{mentionedBy.lastName}}</strong> mentioned you in {{mentionContext}}:</p>
    <div class="activity-box">
      <div class="activity-subject">{{activity.subject}}</div>
      <div>{{activity.content}}</div>
      {{#if activity.type}}
      <div class="activity-meta">
        <strong>Type:</strong> {{activity.type}}
        {{#if activity.date}} | <strong>Date:</strong> {{activity.date}}{{/if}}
      </div>
      {{/if}}
    </div>
    {{#if entityLink}}
    <a href="{{entityLink}}" class="button">View Activity</a>
    {{/if}}
    <p style="margin-top: 20px; color: #6b7280; font-size: 0.9em;">You're receiving this because {{mentionedBy.firstName}} mentioned you in this activity.</p>
  </div>
</body>
</html>`,
    variables: [
      { key: 'firstName', description: 'Recipient first name' },
      { key: 'mentionedBy.firstName', description: 'Mentioner first name' },
      { key: 'mentionedBy.lastName', description: 'Mentioner last name' },
      { key: 'mentionContext', description: 'Context where mention occurred (e.g., "a customer activity (Company Name)")' },
      { key: 'entityType', description: 'Entity type where mention occurred' },
      { key: 'activity.subject', description: 'Activity subject' },
      { key: 'activity.content', description: 'Activity content/body' },
      { key: 'activity.type', description: 'Activity type name' },
      { key: 'activity.date', description: 'Activity date' },
      { key: 'entityLink', description: 'Link to the entity' },
    ],
  },

  // REMOTE_WORK_WINDOW_OPENED Template
  {
    id: 'default-remote-work-window-opened',
    name: 'Default Remote Work Window Opened',
    type: 'REMOTE_WORK_WINDOW_OPENED',
    htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; line-height: 1.6; }
    .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .window-box { background-color: #fff; padding: 15px; border-left: 4px solid #f59e0b; margin: 15px 0; border-radius: 4px; }
    .window-detail { margin: 8px 0; }
    .window-detail strong { color: #374151; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Remote Work Window Opened</h1>
  </div>
  <div class="content">
    <p>Hi {{firstName}},</p>
    <p>A remote work window has been opened and you can now submit remote work requests for this period.</p>
    <div class="window-box">
      <div class="window-detail">
        <strong>Start Date:</strong> {{window.startDate}}
      </div>
      <div class="window-detail">
        <strong>End Date:</strong> {{window.endDate}}
      </div>
      <div class="window-detail">
        <strong>Remote Work Limit:</strong> {{window.limit}} day(s)
      </div>
      <div class="window-detail" style="margin-top: 12px;">
        <strong>Opened by:</strong> {{openedBy.firstName}} {{openedBy.lastName}}
      </div>
    </div>
    <p style="margin-top: 20px;">You can now submit your remote work requests for this period through the system.</p>
  </div>
</body>
</html>`,
    variables: [
      { key: 'firstName', description: 'Recipient first name' },
      { key: 'window.startDate', description: 'Window start date' },
      { key: 'window.endDate', description: 'Window end date' },
      { key: 'window.limit', description: 'Remote work limit in days' },
      { key: 'openedBy.firstName', description: 'Opener first name' },
      { key: 'openedBy.lastName', description: 'Opener last name' },
    ],
  },
];

async function main() {
  console.log('🔄 Starting default templates seeding...\n');

  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const template of defaultTemplates) {
    try {
      // Check if template with this ID already exists
      const existingById = await prisma.template.findUnique({
        where: { id: template.id },
      });

      if (existingById) {
        // Template with this ID exists - skip it (don't update)
        console.log(`⏭️  Skipped (exists): ${template.name} (${template.type})`);
        skippedCount++;
        continue;
      }

      // Check if there's already a default template for this type
      const existingDefault = await prisma.template.findFirst({
        where: {
          type: template.type,
          isDefault: true,
        },
      });

      if (existingDefault) {
        // A default template already exists for this type - skip creating new one
        console.log(`⏭️  Skipped (default exists): ${template.name} (${template.type}) - Default: ${existingDefault.name}`);
        skippedCount++;
        continue;
      }

      // No existing template and no default for this type - create it
      await prisma.template.create({
        data: {
          id: template.id,
          name: template.name,
          type: template.type,
          htmlContent: template.htmlContent,
          cssContent: template.cssContent,
          variables: template.variables,
          isDefault: true,
          isActive: true,
        },
      });

      console.log(`✅ Created: ${template.name} (${template.type})`);
      createdCount++;
    } catch (error) {
      console.error(`❌ Error processing ${template.name} (${template.type}):`, error);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Seeding Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Created:   ${createdCount} templates`);
  console.log(`⏭️  Skipped:   ${skippedCount} templates`);
  console.log(`❌ Errors:    ${errorCount} templates`);
  console.log('='.repeat(60));

  // Ensure only one default per type (safety check)
  console.log('\n🔍 Verifying single default per template type...');
  
  const templateTypes = Object.values(TemplateType);
  let fixedCount = 0;
  
  for (const type of templateTypes) {
    const defaults = await prisma.template.findMany({
      where: {
        type,
        isDefault: true,
      },
      orderBy: {
        createdAt: 'asc', // Keep the oldest one as default
      },
    });

    if (defaults.length > 1) {
      // Keep the first one, unset the rest
      for (let i = 1; i < defaults.length; i++) {
        await prisma.template.update({
          where: { id: defaults[i].id },
          data: { isDefault: false },
        });
        console.log(`  ⚠️  Unset default flag for: ${defaults[i].name} (${type})`);
        fixedCount++;
      }
    }
  }

  if (fixedCount === 0) {
    console.log('  ✅ All template types have a single default');
  }

  console.log('\n✅ Default templates seeding completed!');
  console.log('\n💡 Note: You can customize these templates in the Settings > Templates section.');
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


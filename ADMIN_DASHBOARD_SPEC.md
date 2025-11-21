# Admin Dashboard Specification

**Purpose**: Comprehensive company-wide dashboard for administrators to monitor and manage all aspects of the business.

---

## Overview

The admin dashboard should provide a **360-degree view** of the company with actionable insights, alerts, and quick access to critical functions. It should be organized into clear sections with key metrics, trends, and recent activities.

---

## 1. Executive Summary (Top Section)

### Key Performance Indicators (KPIs)

**Financial Metrics:**
- **Total Monthly Recurring Revenue (MRR)**: Sum of all active subscription invoices
- **Total Staff Augmentation Value**: Sum of active staff aug opportunities
- **Outstanding Invoices**: Count and total value of unpaid invoices
- **Overdue Invoices**: Count and total value of overdue invoices
- **This Month Revenue**: Total revenue received this month
- **Revenue Trend**: Month-over-month growth percentage

**Operational Metrics:**
- **Total Active Customers**: Count of customers with status = ACTIVE
- **Customers at Risk**: Count of customers with status = AT_RISK
- **Active Employees**: Count of employees with status = ACTIVE
- **Open Positions**: Count of open positions (not filled/archived)
- **Active Candidates**: Count of active candidates in pipeline
- **Pending Leave Requests**: Count of leave requests with status = PENDING

**Team Performance:**
- **EOD Compliance Rate**: Percentage of employees submitting reports on time
- **Missing EOD Reports**: Total count across all employees
- **Tasks Overdue**: Count of tasks with status != DONE and dueDate < today
- **Tasks Completed This Week**: Count of completed tasks

---

## 2. Financial Overview Section

### Revenue Breakdown
- **By Customer Type**: 
  - Staff Augmentation revenue
  - Software Subscription revenue
  - Both (hybrid customers)
- **By Salesperson**: Revenue attributed to each salesperson
- **Monthly Revenue Chart**: Line chart showing revenue over last 12 months
- **Top 10 Customers by Revenue**: List with revenue amounts

### Invoice Status
- **Draft Invoices**: Count and total value
- **Sent Invoices**: Count and total value
- **Paid Invoices**: Count and total value (this month)
- **Overdue Invoices**: Count, total value, and list of top overdue
- **Invoice Aging Report**: Breakdown by 0-30, 31-60, 61-90, 90+ days

### Quick Actions
- Create new invoice
- View all invoices
- Send payment reminders
- Export financial report

---

## 3. CRM & Sales Overview

### Sales Pipeline
- **Leads by Status**: 
  - NEW, CONTACTED, QUALIFIED, PROPOSAL, WON, LOST
- **Opportunities by Stage**: 
  - Total value in each stage
  - Conversion rate by stage
- **Win Rate**: Percentage of won opportunities vs total
- **Average Deal Size**: Average value of won opportunities
- **Sales Velocity**: Average time from lead to close

### Customer Health
- **Customer Status Distribution**:
  - ONBOARDING: Count
  - ACTIVE: Count
  - AT_RISK: Count (highlighted in red)
  - PAUSED: Count
  - CHURNED: Count (this month)
- **Customer Sentiment**:
  - HAPPY: Count and percentage
  - NEUTRAL: Count and percentage
  - UNHAPPY: Count and percentage (highlighted)
- **At-Risk Customers List**: Top 10 customers with status = AT_RISK
- **Recent Customer Activities**: Last 10 activities across all customers

### Sales Performance
- **Top Salespeople**: List by revenue generated
- **Sales Targets**: Progress toward monthly/quarterly targets
- **Recent Quotes Sent**: Last 10 quotes with status

### Quick Actions
- Create new lead
- Create new customer
- View all opportunities
- Generate sales report

---

## 4. HR & Employee Management

### Employee Overview
- **Total Employees**: Count by status (ACTIVE, ON_LEAVE, TERMINATED, RESIGNED)
- **New Hires This Month**: Count of employees hired this month
- **Departures This Month**: Count of terminated/resigned employees
- **Department Distribution**: Count of employees by department
- **Contract Types**: Count by FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP

### EOD Report Compliance
- **Overall Compliance Rate**: Percentage of reports submitted on time
- **Missing Reports**: Total count across all employees
- **Late Reports**: Total count of late submissions
- **Employees with Issues**: List of employees with >2 late reports this month
- **EOD Submission Trend**: Chart showing submission rate over time

### Leave Management
- **Pending Leave Requests**: Count and list of requests awaiting approval
- **Approved Leave This Month**: Count and total days
- **Upcoming Leave**: Employees on leave in next 7 days
- **Leave Balance**: Average remaining leave days per employee

### Performance Reviews
- **Overdue Reviews**: Count of reviews past due date
- **Upcoming Reviews**: Reviews due in next 30 days
- **Review Completion Rate**: Percentage of reviews completed on time

### Quick Actions
- View all employees
- Approve leave requests
- Create performance review
- View EOD reports
- Export HR report

---

## 5. Recruitment Overview

### Pipeline Metrics
- **Total Active Candidates**: Count of candidates with isActive = true
- **Candidates by Stage**:
  - VALIDATION, CULTURAL_INTERVIEW, TECHNICAL_INTERVIEW, 
  - CUSTOMER_INTERVIEW, ON_HOLD, CUSTOMER_REVIEW,
  - CONTRACT_PROPOSAL, CONTRACT_SIGNING, HIRED, REJECTED
- **Hire Rate**: Percentage of candidates that reach HIRED stage
- **Average Time to Hire**: Average days from VALIDATION to HIRED

### Open Positions
- **Total Open Positions**: Count of positions with status = "Open"
- **Positions by Status**: Open, Filled, Cancelled
- **Positions by Recruitment Type**: HEADHUNTING vs STANDARD
- **Top Positions by Candidate Count**: Positions with most candidates

### Recruiter Performance
- **Top Recruiters**: List by placements this month
- **Recruiter Activity**: Candidates contacted, interviews scheduled
- **Recruitment Funnel**: Visual funnel showing candidates at each stage

### Quick Actions
- Create new position
- View all candidates
- View all positions
- Generate recruitment report

---

## 6. Task & Project Management

### Task Overview
- **Total Active Tasks**: Count of tasks not in DONE/CANCELLED
- **Tasks by Status**: TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED
- **Overdue Tasks**: Count and list of overdue tasks
- **Tasks by Priority**: URGENT, HIGH, MEDIUM, LOW
- **Tasks Completed This Week**: Count and trend

### Task Distribution
- **Tasks by Assignee**: Top 10 employees by task count
- **Tasks by Customer**: Tasks grouped by customer
- **Average Task Completion Time**: Days from creation to completion

### Quick Actions
- View all tasks
- Create new task
- View task board
- Export task report

---

## 7. System Health & Alerts

### Critical Alerts (Red Flags)
- **Account Lockouts**: Users with locked accounts
- **Failed Login Attempts**: Recent failed login attempts (potential security issue)
- **System Errors**: Recent application errors (if logging is set up)
- **Database Issues**: Connection problems or slow queries

### Data Quality Issues
- **Incomplete Customer Records**: Customers missing critical information
- **Missing Employee Data**: Employees missing required fields
- **Orphaned Records**: Records with broken relationships

### System Metrics
- **Active Users**: Count of users logged in today
- **Total Users**: Count of all users by role
- **Storage Usage**: If file storage is tracked
- **API Usage**: Request count and response times (if monitoring is set up)

### Quick Actions
- View system logs
- Manage users
- System settings
- Data cleanup tools

---

## 8. Recent Activity Feed

### Company-Wide Activity Stream
Show the last 20-30 activities across all modules:
- **CRM Activities**: New leads, opportunities, customer updates
- **HR Activities**: New employees, leave approvals, performance reviews
- **Recruitment Activities**: New candidates, position updates, hires
- **Task Activities**: Task assignments, completions
- **Invoice Activities**: New invoices, payments received
- **User Activities**: Logins, profile updates

**Format**: 
- Icon based on activity type
- User who performed action
- Entity affected (customer, employee, etc.)
- Timestamp
- Link to detail page

---

## 9. Quick Actions Panel

### Common Admin Tasks
- **User Management**: Create/edit users, reset passwords, manage roles
- **Company Settings**: Update company-wide settings
- **Data Import**: Import data from external sources
- **System Export**: Export all company data
- **Template Management**: Manage email and document templates
- **Integration Settings**: Configure Google Drive, Calendar, etc.
- **Holiday Management**: Add/edit national holidays
- **Notification Settings**: Configure system notifications

---

## 10. Charts & Visualizations

### Recommended Charts
1. **Revenue Trend**: Line chart (last 12 months)
2. **Customer Status Distribution**: Pie chart
3. **Sales Pipeline**: Funnel chart
4. **EOD Compliance**: Bar chart (by employee or department)
5. **Recruitment Funnel**: Funnel chart
6. **Task Status Distribution**: Pie chart
7. **Employee Growth**: Line chart (headcount over time)
8. **Invoice Status**: Stacked bar chart

---

## 11. Filters & Time Periods

### Time Period Selector
- Today
- This Week
- This Month
- This Quarter
- This Year
- Custom Range

### Additional Filters
- **Department**: Filter by employee department
- **Salesperson**: Filter CRM metrics by salesperson
- **Recruiter**: Filter recruitment metrics by recruiter
- **Customer Type**: Filter by STAFF_AUGMENTATION, SOFTWARE_SUBSCRIPTION, BOTH

---

## 12. Responsive Design Considerations

### Desktop View (>1024px)
- 3-4 column grid layout
- All sections visible
- Side-by-side charts

### Tablet View (768px - 1024px)
- 2 column grid layout
- Stacked sections
- Scrollable charts

### Mobile View (<768px)
- Single column layout
- Collapsible sections
- Simplified metrics
- Priority on alerts and quick actions

---

## 13. Data Refresh & Real-Time Updates

### Refresh Strategy
- **Auto-refresh**: Every 5 minutes for metrics
- **Manual refresh**: Button to force refresh
- **Real-time alerts**: Push notifications for critical issues
- **Caching**: Cache expensive queries for 1-2 minutes

---

## 14. Export & Reporting

### Export Options
- **PDF Report**: Full dashboard as PDF
- **Excel Export**: All metrics as spreadsheet
- **Custom Report Builder**: Let admin create custom reports
- **Scheduled Reports**: Email reports daily/weekly/monthly

---

## Implementation Priority

### Phase 1 (MVP - 2-3 weeks)
1. Executive Summary KPIs
2. Financial Overview (basic)
3. CRM Overview (basic)
4. HR Overview (basic)
5. Recent Activity Feed
6. Quick Actions Panel

### Phase 2 (Enhanced - 2-3 weeks)
1. Charts and visualizations
2. Advanced filters
3. Export functionality
4. System health alerts
5. Recruitment overview

### Phase 3 (Advanced - 2-3 weeks)
1. Customizable dashboard
2. Scheduled reports
3. Real-time updates
4. Advanced analytics
5. Predictive insights

---

## Technical Implementation Notes

### Backend Service
Create `DashboardService.getAdminDashboard()` method that:
- Aggregates data from all modules
- Uses efficient database queries (avoid N+1)
- Caches expensive calculations
- Returns structured data for frontend

### Frontend Components
- Reusable metric cards
- Chart components (using Recharts)
- Activity feed component
- Quick action buttons
- Filter components

### Performance Considerations
- Use database aggregations instead of loading all records
- Implement pagination for lists
- Cache dashboard data
- Lazy load charts
- Optimize queries with proper indexes

---

## Example API Response Structure

```typescript
interface AdminDashboardResponse {
  kpis: {
    mrr: number;
    staffAugValue: number;
    outstandingInvoices: { count: number; value: number };
    overdueInvoices: { count: number; value: number };
    activeCustomers: number;
    customersAtRisk: number;
    activeEmployees: number;
    openPositions: number;
    activeCandidates: number;
    eodComplianceRate: number;
    missingEodReports: number;
    overdueTasks: number;
  };
  financial: {
    revenueByType: { staffAug: number; subscription: number; both: number };
    revenueBySalesperson: Array<{ name: string; revenue: number }>;
    monthlyRevenue: Array<{ month: string; revenue: number }>;
    invoiceStatus: {
      draft: { count: number; value: number };
      sent: { count: number; value: number };
      paid: { count: number; value: number };
      overdue: { count: number; value: number };
    };
    topCustomers: Array<{ id: string; name: string; revenue: number }>;
  };
  crm: {
    leadsByStatus: Record<string, number>;
    opportunitiesByStage: Array<{ stage: string; count: number; value: number }>;
    winRate: number;
    customerStatus: Record<string, number>;
    customerSentiment: { happy: number; neutral: number; unhappy: number };
    atRiskCustomers: Array<{ id: string; name: string; status: string }>;
  };
  hr: {
    employeesByStatus: Record<string, number>;
    employeesByDepartment: Record<string, number>;
    eodCompliance: {
      overallRate: number;
      missingReports: number;
      lateReports: number;
      employeesWithIssues: Array<{ id: string; name: string; lateCount: number }>;
    };
    leaveManagement: {
      pending: number;
      approvedThisMonth: number;
      upcoming: Array<{ id: string; employeeName: string; startDate: string }>;
    };
    performanceReviews: {
      overdue: number;
      upcoming: number;
      completionRate: number;
    };
  };
  recruitment: {
    activeCandidates: number;
    candidatesByStage: Record<string, number>;
    hireRate: number;
    averageTimeToHire: number;
    openPositions: {
      total: number;
      byStatus: Record<string, number>;
      byType: Record<string, number>;
    };
    topRecruiters: Array<{ id: string; name: string; placements: number }>;
  };
  tasks: {
    activeTasks: number;
    tasksByStatus: Record<string, number>;
    overdueTasks: number;
    tasksByPriority: Record<string, number>;
    completedThisWeek: number;
  };
  alerts: {
    accountLockouts: number;
    failedLogins: number;
    systemErrors: number;
    dataQualityIssues: number;
  };
  recentActivities: Array<{
    id: string;
    type: string;
    user: { id: string; name: string };
    entity: { type: string; id: string; name: string };
    timestamp: string;
    action: string;
  }>;
  systemHealth: {
    activeUsers: number;
    totalUsers: number;
    usersByRole: Record<string, number>;
  };
}
```

---

## Conclusion

The admin dashboard should be the **command center** for company management, providing:
- **Visibility**: See everything happening in the company
- **Insights**: Understand trends and patterns
- **Alerts**: Know when action is needed
- **Control**: Quick access to management functions

The dashboard should be **actionable** - not just showing data, but enabling quick decisions and interventions.


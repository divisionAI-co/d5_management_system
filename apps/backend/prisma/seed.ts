import { PrismaClient, UserRole, CustomerType, LeadStatus, CandidateStage, EmploymentStatus, ContractType, TaskStatus, TaskPriority } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ============================================
  // 1. CREATE USERS
  // ============================================
  console.log('👥 Creating users...');
  
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@division5.com' },
    update: {},
    create: {
      email: 'admin@division5.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      phone: '+355691234567',
      isActive: true,
    },
  });
  console.log('  ✅ Admin:', admin.email);

  const salesPassword = await bcrypt.hash('sales123', 10);
  const salesperson = await prisma.user.upsert({
    where: { email: 'sales@division5.com' },
    update: {},
    create: {
      email: 'sales@division5.com',
      password: salesPassword,
      firstName: 'John',
      lastName: 'Sales',
      role: UserRole.SALESPERSON,
      phone: '+355691234568',
      isActive: true,
    },
  });
  console.log('  ✅ Salesperson:', salesperson.email);

  const recruiterPassword = await bcrypt.hash('recruiter123', 10);
  const recruiter = await prisma.user.upsert({
    where: { email: 'recruiter@division5.com' },
    update: {},
    create: {
      email: 'recruiter@division5.com',
      password: recruiterPassword,
      firstName: 'Jane',
      lastName: 'Recruiter',
      role: UserRole.RECRUITER,
      phone: '+355691234569',
      isActive: true,
    },
  });
  console.log('  ✅ Recruiter:', recruiter.email);

  const hrPassword = await bcrypt.hash('hr123', 10);
  const hr = await prisma.user.upsert({
    where: { email: 'hr@division5.com' },
    update: {},
    create: {
      email: 'hr@division5.com',
      password: hrPassword,
      firstName: 'Sarah',
      lastName: 'HR',
      role: UserRole.HR,
      phone: '+355691234570',
      isActive: true,
    },
  });
  console.log('  ✅ HR:', hr.email);

  const amPassword = await bcrypt.hash('manager123', 10);
  const accountManager = await prisma.user.upsert({
    where: { email: 'manager@division5.com' },
    update: {},
    create: {
      email: 'manager@division5.com',
      password: amPassword,
      firstName: 'Mike',
      lastName: 'Manager',
      role: UserRole.ACCOUNT_MANAGER,
      phone: '+355691234571',
      isActive: true,
    },
  });
  console.log('  ✅ Account Manager:', accountManager.email);

  const employeePassword = await bcrypt.hash('employee123', 10);
  const employee = await prisma.user.upsert({
    where: { email: 'employee@division5.com' },
    update: {},
    create: {
      email: 'employee@division5.com',
      password: employeePassword,
      firstName: 'Bob',
      lastName: 'Developer',
      role: UserRole.EMPLOYEE,
      phone: '+355691234572',
      isActive: true,
    },
  });
  console.log('  ✅ Employee:', employee.email);

  // ============================================
  // 2. CREATE COMPANY SETTINGS
  // ============================================
  console.log('\n⚙️  Creating company settings...');
  
  await prisma.companySettings.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      remoteWorkFrequency: 'WEEKLY',
      remoteWorkLimit: 1,
      eodGraceDays: 2,
      eodReportDeadlineHour: 23,
      eodReportDeadlineMin: 59,
      reviewCycleDays: 180,
    },
  });
  console.log('  ✅ Company settings created');

  // ============================================
  // 3. CREATE NATIONAL HOLIDAYS (2025 - Albania)
  // ============================================
  console.log('\n🎉 Creating national holidays...');
  
  const holidays = [
    { name: "New Year's Day", date: new Date('2025-01-01') },
    { name: 'Orthodox Christmas', date: new Date('2025-01-07') },
    { name: 'Summer Day', date: new Date('2025-03-14') },
    { name: 'Nevruz', date: new Date('2025-03-22') },
    { name: 'Catholic Easter', date: new Date('2025-04-20') },
    { name: 'Orthodox Easter', date: new Date('2025-04-20') },
    { name: 'May Day', date: new Date('2025-05-01') },
    { name: 'Eid al-Fitr', date: new Date('2025-03-31') },
    { name: 'Eid al-Adha', date: new Date('2025-06-07') },
    { name: 'Mother Teresa Day', date: new Date('2025-10-19') },
    { name: 'Independence Day', date: new Date('2025-11-28') },
    { name: 'Liberation Day', date: new Date('2025-11-29') },
    { name: 'Christmas Day', date: new Date('2025-12-25') },
  ];

  for (const holiday of holidays) {
    await prisma.nationalHoliday.upsert({
      where: {
        date_country: {
          date: holiday.date,
          country: 'AL',
        },
      },
      update: {},
      create: {
        name: holiday.name,
        date: holiday.date,
        country: 'AL',
        isRecurring: false,
      },
    });
  }
  console.log('  ✅', holidays.length, 'Albanian holidays created');

  // ============================================
  // 4. CREATE SAMPLE CUSTOMERS
  // ============================================
  console.log('\n🏢 Creating sample customers...');
  
  const customer1 = await prisma.customer.create({
    data: {
      name: 'Tech Solutions Inc',
      email: 'contact@techsolutions.com',
      phone: '+1-555-0101',
      website: 'https://techsolutions.com',
      industry: 'Technology',
      type: CustomerType.SOFTWARE_SUBSCRIPTION,
      status: 'ACTIVE',
      sentiment: 'HAPPY',
      address: '123 Tech Street',
      city: 'San Francisco',
      country: 'USA',
      postalCode: '94105',
      monthlyValue: 5000,
      currency: 'USD',
      notes: 'Great client, pays on time',
      tags: ['tech', 'saas', 'enterprise'],
    },
  });
  console.log('  ✅ Customer:', customer1.name);

  const customer2 = await prisma.customer.create({
    data: {
      name: 'Global Retail Corp',
      email: 'hr@globalretail.com',
      phone: '+1-555-0102',
      website: 'https://globalretail.com',
      industry: 'Retail',
      type: CustomerType.STAFF_AUGMENTATION,
      status: 'ACTIVE',
      sentiment: 'NEUTRAL',
      address: '456 Retail Ave',
      city: 'New York',
      country: 'USA',
      postalCode: '10001',
      monthlyValue: 8000,
      currency: 'USD',
      tags: ['retail', 'staff-aug'],
    },
  });
  console.log('  ✅ Customer:', customer2.name);

  const customer3 = await prisma.customer.create({
    data: {
      name: 'StartupXYZ',
      email: 'founders@startupxyz.com',
      phone: '+1-555-0103',
      website: 'https://startupxyz.com',
      industry: 'FinTech',
      type: CustomerType.BOTH,
      status: 'ONBOARDING',
      sentiment: 'HAPPY',
      address: '789 Innovation Blvd',
      city: 'Austin',
      country: 'USA',
      postalCode: '78701',
      monthlyValue: 3500,
      currency: 'USD',
      tags: ['startup', 'fintech'],
    },
  });
  console.log('  ✅ Customer:', customer3.name);

  // ============================================
  // 5. CREATE SAMPLE CONTACTS & LEADS
  // ============================================
  console.log('\n👥 Creating sample contacts & leads...');

  const contact1 = await prisma.contact.create({
    data: {
      firstName: 'Emily',
      lastName: 'Stone',
      email: 'emily.stone@techsolutions.com',
      phone: '+1-555-1101',
      role: 'CTO',
      companyName: customer1.name,
      customerId: customer1.id,
      notes: 'Primary technical decision maker for Tech Solutions Inc.',
    },
  });
  console.log('  ✅ Contact:', contact1.email);

  const contact2 = await prisma.contact.create({
    data: {
      firstName: 'Liam',
      lastName: 'Garcia',
      email: 'liam.garcia@globalretail.com',
      phone: '+1-555-1102',
      role: 'Head of Engineering',
      companyName: customer2.name,
      customerId: customer2.id,
      notes: 'Coordinates staff augmentation teams.',
    },
  });
  console.log('  ✅ Contact:', contact2.email);

  const prospectContact = await prisma.contact.create({
    data: {
      firstName: 'Sophia',
      lastName: 'Nguyen',
      email: 'sophia.nguyen@futurecorp.com',
      phone: '+1-555-1103',
      role: 'COO',
      companyName: 'FutureCorp Labs',
      notes: 'Interested in exploring a dedicated squad subscription.',
    },
  });
  console.log('  ✅ Prospect Contact:', prospectContact.email);

  const lead1 = await prisma.lead.create({
    data: {
      contactId: contact1.id,
      title: 'Web App Development',
      description: 'Looking for React/Node.js developers',
      status: LeadStatus.QUALIFIED,
      value: 50000,
      probability: 70,
      assignedToId: salesperson.id,
      source: 'Website',
      expectedCloseDate: new Date('2025-12-31'),
      convertedCustomerId: customer1.id,
      prospectCompanyName: customer1.name,
      prospectWebsite: customer1.website ?? undefined,
      prospectIndustry: customer1.industry ?? undefined,
    },
  });
  console.log('  ✅ Converted Lead:', lead1.title);

  const lead2 = await prisma.lead.create({
    data: {
      contactId: contact2.id,
      title: 'Mobile App Project',
      description: 'Need 3 React Native developers',
      status: LeadStatus.PROPOSAL,
      value: 75000,
      probability: 80,
      assignedToId: salesperson.id,
      source: 'Referral',
      expectedCloseDate: new Date('2025-11-30'),
      convertedCustomerId: customer2.id,
      prospectCompanyName: customer2.name,
      prospectWebsite: customer2.website ?? undefined,
      prospectIndustry: customer2.industry ?? undefined,
    },
  });
  console.log('  ✅ Converted Lead:', lead2.title);

  const prospectLead = await prisma.lead.create({
    data: {
      contactId: prospectContact.id,
      title: 'Discovery Workshop',
      description: 'Initial discovery to scope recurring subscription engagement.',
      status: LeadStatus.NEW,
      value: 30000,
      probability: 20,
      assignedToId: salesperson.id,
      source: 'Conference',
      expectedCloseDate: new Date('2026-01-15'),
      prospectCompanyName: prospectContact.companyName,
      prospectIndustry: 'Biotech',
    },
  });
  console.log('  ✅ Prospect Lead:', prospectLead.title);

  // ============================================
  // 6. CREATE SAMPLE CANDIDATES
  // ============================================
  console.log('\n👨‍💻 Creating sample candidates...');
  
  const candidate1 = await prisma.candidate.create({
    data: {
      firstName: 'Alice',
      lastName: 'Johnson',
      email: 'alice.johnson@email.com',
      phone: '+1-555-0201',
      currentTitle: 'Senior Full-Stack Developer',
      yearsOfExperience: 5,
      skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'],
      stage: CandidateStage.TECHNICAL_INTERVIEW,
      rating: 4,
      city: 'Seattle',
      country: 'USA',
      availableFrom: new Date('2025-01-01'),
      expectedSalary: 120000,
      salaryCurrency: 'USD',
      notes: 'Strong technical skills, great culture fit',
    },
  });
  console.log('  ✅ Candidate:', candidate1.firstName, candidate1.lastName);

  const candidate2 = await prisma.candidate.create({
    data: {
      firstName: 'Carlos',
      lastName: 'Rodriguez',
      email: 'carlos.rodriguez@email.com',
      phone: '+1-555-0202',
      currentTitle: 'Frontend Developer',
      yearsOfExperience: 3,
      skills: ['React', 'Vue.js', 'JavaScript', 'CSS', 'Figma'],
      stage: CandidateStage.CULTURAL_INTERVIEW,
      rating: 5,
      city: 'Miami',
      country: 'USA',
      availableFrom: new Date('2024-12-15'),
      expectedSalary: 90000,
      salaryCurrency: 'USD',
    },
  });
  console.log('  ✅ Candidate:', candidate2.firstName, candidate2.lastName);

  // ============================================
  // 7. CREATE SAMPLE EMPLOYEES
  // ============================================
  console.log('\n👔 Creating sample employees...');
  
  const employeeRecord = await prisma.employee.create({
    data: {
      userId: employee.id,
      employeeNumber: 'EMP001',
      department: 'Engineering',
      jobTitle: 'Full-Stack Developer',
      status: EmploymentStatus.ACTIVE,
      contractType: ContractType.FULL_TIME,
      hireDate: new Date('2024-01-15'),
      salary: 60000,
      salaryCurrency: 'USD',
      emergencyContactName: 'Jane Developer',
      emergencyContactPhone: '+355691111111',
      emergencyContactRelation: 'Spouse',
    },
  });
  console.log('  ✅ Employee:', employee.firstName, employee.lastName);

  // ============================================
  // 8. CREATE SAMPLE TASKS
  // ============================================
  console.log('\n✅ Creating sample tasks...');
  
  const task1 = await prisma.task.create({
    data: {
      title: 'Setup development environment',
      description: 'Install Node.js, PostgreSQL, and configure project',
      status: TaskStatus.DONE,
      priority: TaskPriority.HIGH,
      assignedToId: employee.id,
      createdById: admin.id,
      completedAt: new Date(),
      customerId: customer1.id,
      tags: ['setup', 'devops'],
    },
  });
  console.log('  ✅ Task:', task1.title);

  const task2 = await prisma.task.create({
    data: {
      title: 'Implement authentication module',
      description: 'Build JWT-based authentication with 2FA support',
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      assignedToId: employee.id,
      createdById: admin.id,
      dueDate: new Date('2025-11-20'),
      customerId: customer1.id,
      tags: ['backend', 'security'],
      estimatedHours: 40,
    },
  });
  console.log('  ✅ Task:', task2.title);

  const task3 = await prisma.task.create({
    data: {
      title: 'Design customer dashboard',
      description: 'Create wireframes and mockups for customer portal',
      status: TaskStatus.TODO,
      priority: TaskPriority.MEDIUM,
      assignedToId: employee.id,
      createdById: accountManager.id,
      dueDate: new Date('2025-11-25'),
      customerId: customer1.id,
      tags: ['frontend', 'design'],
      estimatedHours: 20,
    },
  });
  console.log('  ✅ Task:', task3.title);

  // ============================================
  // 9. CREATE SAMPLE ACTIVITIES
  // ============================================
  console.log('\n📝 Creating sample activity types & activities...');

  const noteActivityType = await prisma.activityType.upsert({
    where: { key: 'NOTE' },
    update: {},
    create: {
      name: 'Note',
      key: 'NOTE',
      description: 'Internal note or meeting summary',
      isSystem: true,
    },
  });

  const callActivityType = await prisma.activityType.upsert({
    where: { key: 'CALL' },
    update: {},
    create: {
      name: 'Call',
      key: 'CALL',
      description: 'Logged phone or video call',
      isSystem: true,
    },
  });

  await prisma.activity.create({
    data: {
      activityType: { connect: { id: noteActivityType.id } },
      subject: 'Initial client meeting',
      body: 'Discussed project requirements and timeline',
      activityDate: new Date('2025-11-01T09:30:00Z'),
      customer: { connect: { id: customer1.id } },
      createdBy: { connect: { id: salesperson.id } },
    },
  });

  await prisma.activity.create({
    data: {
      activityType: { connect: { id: callActivityType.id } },
      subject: 'Follow-up call',
      body: 'Clarified technical requirements for the project',
      activityDate: new Date('2025-11-03T14:00:00Z'),
      customer: { connect: { id: customer1.id } },
      createdBy: { connect: { id: accountManager.id } },
    },
  });

  await prisma.activity.create({
    data: {
      activityType: { connect: { id: noteActivityType.id } },
      subject: 'Technical screening notes',
      body: 'Candidate demonstrated strong React and TypeScript skills',
      activityDate: new Date('2025-11-05T10:15:00Z'),
      candidate: { connect: { id: candidate1.id } },
      createdBy: { connect: { id: recruiter.id } },
    },
  });

  console.log('  ✅ Activity types seeded and 3 activities created');

  // ============================================
  // 10. CREATE DEFAULT FEEDBACK REPORT TEMPLATE
  // ============================================
  console.log('\n📄 Creating default feedback report template...');
  
  await prisma.template.upsert({
    where: { id: 'default-feedback-report' },
    update: {},
    create: {
      id: 'default-feedback-report',
      name: 'Default Feedback Report Template',
      type: 'FEEDBACK_REPORT',
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      margin: 40px;
      color: #333;
    }
    .header { 
      text-align: center; 
      margin-bottom: 40px;
      border-bottom: 2px solid #2563EB;
      padding-bottom: 20px;
    }
    .header h1 {
      color: #2563EB;
      margin: 0;
    }
    .header p {
      color: #666;
      margin: 10px 0 0 0;
    }
    .section { 
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section h2 {
      color: #2563EB;
      border-bottom: 1px solid #ddd;
      padding-bottom: 10px;
      margin-bottom: 15px;
    }
    .section h3 {
      color: #555;
      margin-bottom: 10px;
    }
    table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 10px;
      margin-bottom: 20px;
    }
    td { 
      padding: 10px; 
      border-bottom: 1px solid #eee;
      vertical-align: top;
    }
    td.label { 
      font-weight: bold;
      width: 40%;
      color: #555;
    }
    .rating {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: bold;
    }
    .rating-5 { background-color: #10b981; color: white; }
    .rating-4 { background-color: #3b82f6; color: white; }
    .rating-3 { background-color: #f59e0b; color: white; }
    .rating-2 { background-color: #f97316; color: white; }
    .rating-1 { background-color: #ef4444; color: white; }
    .feedback-text {
      background-color: #f9fafb;
      padding: 15px;
      border-radius: 6px;
      margin-top: 10px;
      white-space: pre-wrap;
    }
    .holiday-list {
      list-style: none;
      padding: 0;
    }
    .holiday-list li {
      padding: 8px;
      margin: 4px 0;
      background-color: #f3f4f6;
      border-radius: 4px;
    }
    .note {
      background-color: #fef3c7;
      border-left: 4px solid #f59e0b;
      padding: 12px;
      margin-top: 20px;
      font-size: 0.9em;
    }
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
  {{#if bankHolidays.length}}
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
  {{/if}}

  {{#if hrFeedback}}
  <div class="section">
    <h2>HR Feedback</h2>
    <div class="feedback-text">{{hrFeedback}}</div>
    {{#if hrActionDescription}}
    <h3>Action Taken:</h3>
    <div class="feedback-text">{{hrActionDescription}}</div>
    {{/if}}
  </div>
  {{/if}}

  {{#if amFeedback}}
  <div class="section">
    <h2>Account Manager Feedback</h2>
    <div class="feedback-text">{{amFeedback}}</div>
  </div>
  {{/if}}

  <div class="section">
    <h2>Employee Self-Assessment</h2>
    
    <h3>Performance Ratings</h3>
    <table>
      <tr>
        <td class="label">Communication Effectiveness:</td>
        <td>{{communicationRatingDisplay}}</td>
      </tr>
      <tr>
        <td class="label">Collaboration and Teamwork:</td>
        <td>{{collaborationRatingDisplay}}</td>
      </tr>
      <tr>
        <td class="label">Task Estimation:</td>
        <td>{{taskEstimationRatingDisplay}}</td>
      </tr>
      <tr>
        <td class="label">Timeliness and Meeting Deadlines:</td>
        <td>{{timelinessRatingDisplay}}</td>
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
        { name: 'employeeName', description: 'Employee full name' },
        { name: 'jobTitle', description: 'Employee job title' },
        { name: 'department', description: 'Employee department' },
        { name: 'monthYear', description: 'Reporting period (e.g., January 2025)' },
        { name: 'monthName', description: 'Month name' },
        { name: 'nextMonthName', description: 'Next month name' },
        { name: 'nextMonthYear', description: 'Next month year' },
        { name: 'tasksCount', description: 'Number of tasks worked on' },
        { name: 'totalDaysOffTaken', description: 'Days off taken in the month' },
        { name: 'totalRemainingDaysOff', description: 'Remaining annual leave days' },
        { name: 'bankHolidays', description: 'Array of bank holidays for next month' },
        { name: 'hrFeedback', description: 'HR feedback text' },
        { name: 'hrActionDescription', description: 'HR action description' },
        { name: 'amFeedback', description: 'Account Manager feedback' },
        { name: 'communicationRatingDisplay', description: 'Communication rating with badge' },
        { name: 'collaborationRatingDisplay', description: 'Collaboration rating with badge' },
        { name: 'taskEstimationRatingDisplay', description: 'Task estimation rating with badge' },
        { name: 'timelinessRatingDisplay', description: 'Timeliness rating with badge' },
        { name: 'employeeSummary', description: 'Employee summary feedback' },
      ],
    },
  });
  console.log('  ✅ Default feedback report template created');

  // ============================================
  // 11. CREATE SAMPLE FEEDBACK REPORT
  // ============================================
  console.log('\n📊 Creating sample feedback report...');
  
  // Create a feedback report for last month
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  
  const feedbackReport = await prisma.feedbackReport.create({
    data: {
      employeeId: employeeRecord.id,
      month: lastMonth,
      year: lastMonthYear,
      tasksCount: 12,
      totalDaysOffTaken: 1,
      totalRemainingDaysOff: 19,
      bankHolidays: [
        { name: "New Year's Day", date: '2025-01-01' },
      ],
      hrFeedback: 'Excellent performance this month. The employee has shown great initiative and delivered high-quality work.',
      hrActionDescription: 'Provided additional training on advanced TypeScript patterns and code review best practices.',
      hrUpdatedAt: new Date(),
      hrUpdatedBy: hr.id,
      amFeedback: 'Outstanding collaboration with the client. The employee has been very responsive and proactive in addressing client needs.',
      amUpdatedAt: new Date(),
      amUpdatedBy: accountManager.id,
      communicationRating: 4,
      collaborationRating: 5,
      taskEstimationRating: 4,
      timelinessRating: 5,
      employeeSummary: 'I feel like this month has been very productive and work has been going well. The timeline has been mostly set up correctly and the communication has been going great.',
      employeeUpdatedAt: new Date(),
      status: 'DRAFT',
    },
  });
  console.log('  ✅ Feedback report created for', employee.firstName, employee.lastName);

  // ============================================
  // 12. CREATE DEFAULT TEMPLATES (INVOICE & CUSTOMER REPORT)
  // ============================================
  console.log('\n📄 Creating default templates...');
  
  await prisma.template.upsert({
    where: { id: 'default-invoice' },
    update: {},
    create: {
      id: 'default-invoice',
      name: 'Default Invoice Template',
      type: 'INVOICE',
      isDefault: true,
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
      variables: {
        invoiceNumber: 'Invoice number',
        customer: { name: 'Customer name', email: 'Email', address: 'Address', city: 'City', postalCode: 'Postal code' },
        issueDate: 'Issue date',
        dueDate: 'Due date',
        status: 'Invoice status',
        items: 'Array of invoice items',
        subtotal: 'Subtotal amount',
        taxRate: 'Tax rate percentage',
        taxAmount: 'Tax amount',
        total: 'Total amount',
        currency: 'Currency code',
        notes: 'Optional notes',
      },
    },
  });
  console.log('  ✅ Invoice template created');

  await prisma.template.create({
    data: {
      name: 'Monthly Customer Report',
      type: 'CUSTOMER_REPORT',
      isDefault: true,
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
      variables: {
        title: 'Report title',
        periodStart: 'Start date',
        periodEnd: 'End date',
        content: 'Report content object',
      },
    },
  });
  console.log('  ✅ Customer report template created');

  // ============================================
  // SUMMARY
  // ============================================
  console.log('\n\n🎉 Seeding completed successfully!\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📋 SUMMARY:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('👤 Test Users Created:');
  console.log('  • Admin:           admin@division5.com           / admin123');
  console.log('  • Salesperson:     sales@division5.com           / sales123');
  console.log('  • Account Manager: manager@division5.com         / manager123');
  console.log('  • Recruiter:       recruiter@division5.com       / recruiter123');
  console.log('  • HR:              hr@division5.com              / hr123');
  console.log('  • Employee:        employee@division5.com        / employee123');
  console.log('');
  console.log('🏢 Sample Data Created:');
  console.log('  • 3 Customers');
  console.log('  • 2 Leads');
  console.log('  • 2 Candidates');
  console.log('  • 1 Employee');
  console.log('  • 3 Tasks');
  console.log('  • 3 Activities');
  console.log('  • 1 Feedback Report (Draft)');
  console.log('  • 13 Albanian National Holidays (2025)');
  console.log('  • 3 Default Templates (Invoice, Customer Report & Feedback Report)');
  console.log('');
  console.log('⚙️  Company Settings Configured');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('✨ You can now start the application:');
  console.log('');
  console.log('   1. Start backend:  npm run dev:backend');
  console.log('   2. Start frontend: npm run dev:frontend');
  console.log('   3. Or both:        npm run dev');
  console.log('');
  console.log('   Login at: http://localhost:5173');
  console.log('   API docs: http://localhost:3000/api/docs');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

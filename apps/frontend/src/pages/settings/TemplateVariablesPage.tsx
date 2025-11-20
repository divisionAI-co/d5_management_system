import { Copy, Check, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';

interface VariableGroup {
  title: string;
  description: string;
  context: string;
  variables: Array<{
    name: string;
    description: string;
    example: string;
    type: string;
  }>;
}

const TEMPLATE_VARIABLES: VariableGroup[] = [
  {
    title: 'Candidate Email Templates',
    description: 'Variables available when sending emails to recruitment candidates',
    context: 'Used in candidate email communications (marking inactive, stage updates, etc.)',
    variables: [
      {
        name: '{{candidate.firstName}}',
        description: "Candidate's first name",
        example: 'John',
        type: 'string',
      },
      {
        name: '{{candidate.lastName}}',
        description: "Candidate's last name",
        example: 'Doe',
        type: 'string',
      },
      {
        name: '{{candidate.fullName}}',
        description: "Candidate's full name (firstName + lastName)",
        example: 'John Doe',
        type: 'string',
      },
      {
        name: '{{candidate.email}}',
        description: "Candidate's email address",
        example: 'john.doe@example.com',
        type: 'string',
      },
      {
        name: '{{reason}}',
        description: 'Reason for the email (e.g., why candidate was marked inactive)',
        example: 'No longer available for position',
        type: 'string',
      },
    ],
  },
  {
    title: 'Invoice Templates',
    description: 'Variables available in invoice PDF and email templates',
    context: 'Used when generating invoices or sending invoice emails',
    variables: [
      {
        name: '{{invoiceNumber}}',
        description: 'Unique invoice number',
        example: 'INV-2024-001',
        type: 'string',
      },
      {
        name: '{{issueDate}}',
        description: 'Date the invoice was issued',
        example: '2024-01-15',
        type: 'date',
      },
      {
        name: '{{dueDate}}',
        description: 'Date the invoice is due',
        example: '2024-02-15',
        type: 'date',
      },
      {
        name: '{{status}}',
        description: 'Invoice status (DRAFT, SENT, PAID, OVERDUE, CANCELLED)',
        example: 'SENT',
        type: 'string',
      },
      {
        name: '{{subtotal}}',
        description: 'Invoice subtotal amount (before tax)',
        example: '1000.00',
        type: 'number',
      },
      {
        name: '{{taxRate}}',
        description: 'Tax rate percentage',
        example: '10',
        type: 'number',
      },
      {
        name: '{{taxAmount}}',
        description: 'Tax amount',
        example: '100.00',
        type: 'number',
      },
      {
        name: '{{total}}',
        description: 'Total invoice amount (subtotal + tax)',
        example: '1100.00',
        type: 'number',
      },
      {
        name: '{{currency}}',
        description: 'Currency code',
        example: 'USD',
        type: 'string',
      },
      {
        name: '{{notes}}',
        description: 'Invoice notes/terms',
        example: 'Payment due within 30 days',
        type: 'string',
      },
      {
        name: '{{customer.name}}',
        description: "Customer's company name",
        example: 'Acme Corporation',
        type: 'string',
      },
      {
        name: '{{customer.email}}',
        description: "Customer's email address",
        example: 'contact@acme.com',
        type: 'string',
      },
      {
        name: '{{customer.address}}',
        description: "Customer's street address",
        example: '123 Main St',
        type: 'string',
      },
      {
        name: '{{customer.city}}',
        description: "Customer's city",
        example: 'New York',
        type: 'string',
      },
      {
        name: '{{customer.country}}',
        description: "Customer's country",
        example: 'United States',
        type: 'string',
      },
      {
        name: '{{customer.postalCode}}',
        description: "Customer's postal/zip code",
        example: '10001',
        type: 'string',
      },
      {
        name: '{{customer.taxId}}',
        description: "Customer's tax identification number",
        example: 'TAX-123456',
        type: 'string',
      },
      {
        name: '{{items}}',
        description: 'Array of invoice line items',
        example: '[{description, quantity, unitPrice, total}]',
        type: 'array',
      },
      {
        name: '{{items.[].description}}',
        description: 'Item description',
        example: 'Web Development Services',
        type: 'string',
      },
      {
        name: '{{items.[].quantity}}',
        description: 'Item quantity',
        example: '10',
        type: 'number',
      },
      {
        name: '{{items.[].unitPrice}}',
        description: 'Item unit price',
        example: '100.00',
        type: 'number',
      },
      {
        name: '{{items.[].total}}',
        description: 'Item line total (quantity × unitPrice)',
        example: '1000.00',
        type: 'number',
      },
      {
        name: '{{paidDate}}',
        description: 'Date the invoice was paid (if applicable)',
        example: '2024-02-10',
        type: 'date',
      },
      {
        name: '{{isRecurring}}',
        description: 'Whether invoice is recurring',
        example: 'false',
        type: 'boolean',
      },
      {
        name: '{{recurringDay}}',
        description: 'Day of month for recurring invoices (1-28)',
        example: '15',
        type: 'number',
      },
      {
        name: '{{createdBy.firstName}}',
        description: "Invoice creator's first name",
        example: 'Jane',
        type: 'string',
      },
      {
        name: '{{createdBy.lastName}}',
        description: "Invoice creator's last name",
        example: 'Smith',
        type: 'string',
      },
      {
        name: '{{createdBy.email}}',
        description: "Invoice creator's email",
        example: 'jane.smith@company.com',
        type: 'string',
      },
    ],
  },
  {
    title: 'Performance Review Templates',
    description: 'Variables available in performance review PDF templates',
    context: 'Used when generating performance review PDFs',
    variables: [
      {
        name: '{{employeeName}}',
        description: "Employee's full name",
        example: 'Jane Smith',
        type: 'string',
      },
      {
        name: '{{jobTitle}}',
        description: "Employee's job title",
        example: 'Senior Developer',
        type: 'string',
      },
      {
        name: '{{department}}',
        description: "Employee's department",
        example: 'Engineering',
        type: 'string',
      },
      {
        name: '{{reviewDate}}',
        description: 'Date of the performance review',
        example: '2024-01-15',
        type: 'date',
      },
      {
        name: '{{periodStart}}',
        description: 'Start date of the review period',
        example: '2023-01-01',
        type: 'date',
      },
      {
        name: '{{periodEnd}}',
        description: 'End date of the review period',
        example: '2023-12-31',
        type: 'date',
      },
      {
        name: '{{reviewerName}}',
        description: 'Name of the person conducting the review',
        example: 'John Manager',
        type: 'string',
      },
      {
        name: '{{overallRating}}',
        description: 'Overall performance rating',
        example: '4.5',
        type: 'number',
      },
      {
        name: '{{strengths}}',
        description: 'Employee strengths section',
        example: 'Strong technical skills...',
        type: 'string',
      },
      {
        name: '{{improvements}}',
        description: 'Areas for improvement section',
        example: 'Could improve communication...',
        type: 'string',
      },
      {
        name: '{{goals}}',
        description: 'Future goals section',
        example: 'Complete advanced training...',
        type: 'string',
      },
    ],
  },
  {
    title: 'Opportunity Email Templates',
    description: 'Variables available when sending emails related to opportunities',
    context: 'Used in opportunity-related email communications (updates, notifications, etc.)',
    variables: [
      {
        name: '{{opportunity.title}}',
        description: 'Opportunity title/name',
        example: 'Website Redesign Project',
        type: 'string',
      },
      {
        name: '{{opportunity.description}}',
        description: 'Opportunity description',
        example: 'Complete redesign of company website',
        type: 'string',
      },
      {
        name: '{{opportunity.stage}}',
        description: 'Current opportunity stage',
        example: 'Negotiation',
        type: 'string',
      },
      {
        name: '{{opportunity.value}}',
        description: 'Opportunity value/amount',
        example: '50000.00',
        type: 'number',
      },
      {
        name: '{{opportunity.type}}',
        description: 'Opportunity type (PROJECT, STAFF_AUGMENTATION)',
        example: 'PROJECT',
        type: 'string',
      },
      {
        name: '{{opportunity.isClosed}}',
        description: 'Whether opportunity is closed',
        example: 'false',
        type: 'boolean',
      },
      {
        name: '{{opportunity.isWon}}',
        description: 'Whether opportunity was won',
        example: 'false',
        type: 'boolean',
      },
      {
        name: '{{customer.name}}',
        description: "Customer's company name",
        example: 'Acme Corporation',
        type: 'string',
      },
      {
        name: '{{customer.email}}',
        description: "Customer's email address",
        example: 'contact@acme.com',
        type: 'string',
      },
      {
        name: '{{lead.contact.firstName}}',
        description: "Lead contact's first name",
        example: 'John',
        type: 'string',
      },
      {
        name: '{{lead.contact.lastName}}',
        description: "Lead contact's last name",
        example: 'Doe',
        type: 'string',
      },
      {
        name: '{{lead.contact.email}}',
        description: "Lead contact's email",
        example: 'john.doe@example.com',
        type: 'string',
      },
      {
        name: '{{assignedTo.firstName}}',
        description: "Assigned user's first name",
        example: 'Jane',
        type: 'string',
      },
      {
        name: '{{assignedTo.lastName}}',
        description: "Assigned user's last name",
        example: 'Smith',
        type: 'string',
      },
      {
        name: '{{assignedTo.email}}',
        description: "Assigned user's email",
        example: 'jane.smith@company.com',
        type: 'string',
      },
    ],
  },
  {
    title: 'Lead Email Templates',
    description: 'Variables available when sending emails related to leads',
    context: 'Used in lead-related email communications (follow-ups, conversions, etc.)',
    variables: [
      {
        name: '{{lead.title}}',
        description: 'Lead title/name',
        example: 'New Website Project Inquiry',
        type: 'string',
      },
      {
        name: '{{lead.description}}',
        description: 'Lead description',
        example: 'Interested in website redesign services',
        type: 'string',
      },
      {
        name: '{{lead.status}}',
        description: 'Lead status (NEW, CONTACTED, QUALIFIED, CONVERTED, LOST)',
        example: 'QUALIFIED',
        type: 'string',
      },
      {
        name: '{{lead.value}}',
        description: 'Lead estimated value',
        example: '25000.00',
        type: 'number',
      },
      {
        name: '{{lead.probability}}',
        description: 'Lead conversion probability (0-100)',
        example: '75',
        type: 'number',
      },
      {
        name: '{{lead.source}}',
        description: 'Lead source (e.g., Website, Referral, Cold Call)',
        example: 'Website',
        type: 'string',
      },
      {
        name: '{{lead.expectedCloseDate}}',
        description: 'Expected close date',
        example: '2024-03-15',
        type: 'date',
      },
      {
        name: '{{lead.actualCloseDate}}',
        description: 'Actual close date',
        example: '2024-03-10',
        type: 'date',
      },
      {
        name: '{{lead.lostReason}}',
        description: 'Reason if lead was lost',
        example: 'Budget constraints',
        type: 'string',
      },
      {
        name: '{{lead.prospectCompanyName}}',
        description: 'Prospect company name',
        example: 'Acme Corp',
        type: 'string',
      },
      {
        name: '{{lead.prospectWebsite}}',
        description: 'Prospect website URL',
        example: 'https://acme.com',
        type: 'string',
      },
      {
        name: '{{lead.prospectIndustry}}',
        description: 'Prospect industry',
        example: 'Technology',
        type: 'string',
      },
      {
        name: '{{contact.firstName}}',
        description: "Contact's first name",
        example: 'John',
        type: 'string',
      },
      {
        name: '{{contact.lastName}}',
        description: "Contact's last name",
        example: 'Doe',
        type: 'string',
      },
      {
        name: '{{contact.email}}',
        description: "Contact's email address",
        example: 'john.doe@example.com',
        type: 'string',
      },
      {
        name: '{{contact.phone}}',
        description: "Contact's phone number",
        example: '+1-555-123-4567',
        type: 'string',
      },
      {
        name: '{{contact.company}}',
        description: "Contact's company name",
        example: 'Acme Corporation',
        type: 'string',
      },
      {
        name: '{{contact.position}}',
        description: "Contact's job title/position",
        example: 'CTO',
        type: 'string',
      },
      {
        name: '{{assignedTo.firstName}}',
        description: "Assigned user's first name",
        example: 'Jane',
        type: 'string',
      },
      {
        name: '{{assignedTo.lastName}}',
        description: "Assigned user's last name",
        example: 'Smith',
        type: 'string',
      },
      {
        name: '{{assignedTo.email}}',
        description: "Assigned user's email",
        example: 'jane.smith@company.com',
        type: 'string',
      },
      {
        name: '{{convertedCustomer.name}}',
        description: "Converted customer's company name (if lead was converted)",
        example: 'Acme Corporation',
        type: 'string',
      },
    ],
  },
  {
    title: 'Employee Email Templates',
    description: 'Variables available when sending emails to employees',
    context: 'Used in employee-related email communications (onboarding, updates, etc.)',
    variables: [
      {
        name: '{{employee.firstName}}',
        description: "Employee's first name",
        example: 'Jane',
        type: 'string',
      },
      {
        name: '{{employee.lastName}}',
        description: "Employee's last name",
        example: 'Smith',
        type: 'string',
      },
      {
        name: '{{employee.fullName}}',
        description: "Employee's full name (firstName + lastName)",
        example: 'Jane Smith',
        type: 'string',
      },
      {
        name: '{{employee.email}}',
        description: "Employee's email address",
        example: 'jane.smith@company.com',
        type: 'string',
      },
      {
        name: '{{employee.employeeNumber}}',
        description: "Employee's unique employee number",
        example: 'EMP-001',
        type: 'string',
      },
      {
        name: '{{employee.jobTitle}}',
        description: "Employee's job title",
        example: 'Senior Developer',
        type: 'string',
      },
      {
        name: '{{employee.department}}',
        description: "Employee's department",
        example: 'Engineering',
        type: 'string',
      },
      {
        name: '{{employee.status}}',
        description: 'Employment status (ACTIVE, ON_LEAVE, TERMINATED, RESIGNED)',
        example: 'ACTIVE',
        type: 'string',
      },
      {
        name: '{{employee.contractType}}',
        description: 'Contract type (FULL_TIME, PART_TIME, CONTRACT, INTERNSHIP)',
        example: 'FULL_TIME',
        type: 'string',
      },
      {
        name: '{{employee.hireDate}}',
        description: 'Date employee was hired',
        example: '2023-01-15',
        type: 'date',
      },
      {
        name: '{{employee.terminationDate}}',
        description: 'Date employee was terminated (if applicable)',
        example: '2024-12-31',
        type: 'date',
      },
      {
        name: '{{employee.salary}}',
        description: "Employee's salary amount",
        example: '75000.00',
        type: 'number',
      },
      {
        name: '{{employee.salaryCurrency}}',
        description: 'Salary currency code',
        example: 'USD',
        type: 'string',
      },
      {
        name: '{{manager.firstName}}',
        description: "Manager's first name",
        example: 'John',
        type: 'string',
      },
      {
        name: '{{manager.lastName}}',
        description: "Manager's last name",
        example: 'Manager',
        type: 'string',
      },
      {
        name: '{{manager.email}}',
        description: "Manager's email address",
        example: 'john.manager@company.com',
        type: 'string',
      },
      {
        name: '{{manager.jobTitle}}',
        description: "Manager's job title",
        example: 'Engineering Manager',
        type: 'string',
      },
    ],
  },
  {
    title: 'Customer Email Templates',
    description: 'Variables available when sending emails related to customers',
    context: 'Used in customer-related email communications (updates, reports, etc.)',
    variables: [
      {
        name: '{{customer.name}}',
        description: "Customer's company name",
        example: 'Acme Corporation',
        type: 'string',
      },
      {
        name: '{{customer.email}}',
        description: "Customer's email address",
        example: 'contact@acme.com',
        type: 'string',
      },
      {
        name: '{{customer.phone}}',
        description: "Customer's phone number",
        example: '+1-555-123-4567',
        type: 'string',
      },
      {
        name: '{{customer.website}}',
        description: "Customer's website URL",
        example: 'https://acme.com',
        type: 'string',
      },
      {
        name: '{{customer.address}}',
        description: "Customer's street address",
        example: '123 Main St',
        type: 'string',
      },
      {
        name: '{{customer.city}}',
        description: "Customer's city",
        example: 'New York',
        type: 'string',
      },
      {
        name: '{{customer.state}}',
        description: "Customer's state/province",
        example: 'NY',
        type: 'string',
      },
      {
        name: '{{customer.country}}',
        description: "Customer's country",
        example: 'United States',
        type: 'string',
      },
      {
        name: '{{customer.postalCode}}',
        description: "Customer's postal/zip code",
        example: '10001',
        type: 'string',
      },
      {
        name: '{{customer.taxId}}',
        description: "Customer's tax identification number",
        example: 'TAX-123456',
        type: 'string',
      },
      {
        name: '{{customer.registrationId}}',
        description: "Customer's registration/business ID",
        example: 'REG-789012',
        type: 'string',
      },
      {
        name: '{{customer.type}}',
        description: 'Customer type (ENTERPRISE, SMB, STARTUP)',
        example: 'ENTERPRISE',
        type: 'string',
      },
      {
        name: '{{customer.monthlyValue}}',
        description: "Customer's monthly value/revenue",
        example: '5000.00',
        type: 'number',
      },
      {
        name: '{{customer.currency}}',
        description: 'Currency code',
        example: 'USD',
        type: 'string',
      },
      {
        name: '{{customer.notes}}',
        description: 'Customer notes',
        example: 'Important client, priority support',
        type: 'string',
      },
      {
        name: '{{contact.firstName}}',
        description: "Primary contact's first name",
        example: 'John',
        type: 'string',
      },
      {
        name: '{{contact.lastName}}',
        description: "Primary contact's last name",
        example: 'Doe',
        type: 'string',
      },
      {
        name: '{{contact.email}}',
        description: "Primary contact's email",
        example: 'john.doe@acme.com',
        type: 'string',
      },
      {
        name: '{{contact.phone}}',
        description: "Primary contact's phone",
        example: '+1-555-123-4567',
        type: 'string',
      },
      {
        name: '{{contact.role}}',
        description: "Primary contact's role/title",
        example: 'CTO',
        type: 'string',
      },
    ],
  },
  {
    title: 'Feedback Report Templates',
    description: 'Variables available in feedback report PDF templates (Customer Report type)',
    context: 'Used when generating monthly feedback reports for employees to send to customers',
    variables: [
      {
        name: '{{employeeName}}',
        description: "Employee's full name",
        example: 'Jane Smith',
        type: 'string',
      },
      {
        name: '{{jobTitle}}',
        description: "Employee's job title",
        example: 'Senior Developer',
        type: 'string',
      },
      {
        name: '{{department}}',
        description: "Employee's department",
        example: 'Engineering',
        type: 'string',
      },
      {
        name: '{{monthYear}}',
        description: 'Reporting period (month and year)',
        example: 'January 2025',
        type: 'string',
      },
      {
        name: '{{monthName}}',
        description: 'Name of the reporting month',
        example: 'January',
        type: 'string',
      },
      {
        name: '{{nextMonthName}}',
        description: 'Name of the next month (for bank holidays section)',
        example: 'February',
        type: 'string',
      },
      {
        name: '{{nextMonthYear}}',
        description: 'Year of the next month',
        example: '2025',
        type: 'string',
      },
      {
        name: '{{tasksCount}}',
        description: 'Number of tasks worked on during the month',
        example: '12',
        type: 'number',
      },
      {
        name: '{{totalDaysOffTaken}}',
        description: 'Total days off taken in the reporting month',
        example: '1',
        type: 'number',
      },
      {
        name: '{{totalRemainingDaysOff}}',
        description: 'Total remaining annual leave days',
        example: '19',
        type: 'number',
      },
      {
        name: '{{bankHolidays}}',
        description: 'Array of bank holidays for the next month',
        example: '[{name: "New Year\'s Day", date: "2025-01-01"}]',
        type: 'array',
      },
      {
        name: '{{bankHolidays.[].name}}',
        description: 'Bank holiday name',
        example: "New Year's Day",
        type: 'string',
      },
      {
        name: '{{bankHolidays.[].date}}',
        description: 'Bank holiday date',
        example: '2025-01-01',
        type: 'date',
      },
      {
        name: '{{amFeedback}}',
        description: 'Account Manager feedback text',
        example: 'Excellent performance this month...',
        type: 'string',
      },
      {
        name: '{{amActionDescription}}',
        description: 'Description of actions taken by Account Manager',
        example: 'Provided additional training on...',
        type: 'string',
      },
      {
        name: '{{communicationRating}}',
        description: 'Communication effectiveness rating (1-5)',
        example: '4',
        type: 'number',
      },
      {
        name: '{{{communicationRatingDisplay}}}',
        description: 'Communication rating with formatted badge HTML (use triple braces to render HTML)',
        example: '<span class="rating rating-4">4 - Exceeds expectations</span>',
        type: 'string',
      },
      {
        name: '{{collaborationRating}}',
        description: 'Collaboration and teamwork rating (1-5)',
        example: '5',
        type: 'number',
      },
      {
        name: '{{{collaborationRatingDisplay}}}',
        description: 'Collaboration rating with formatted badge HTML (use triple braces to render HTML)',
        example: '<span class="rating rating-5">5 - Outstanding</span>',
        type: 'string',
      },
      {
        name: '{{taskEstimationRating}}',
        description: 'Task estimation rating (1-5)',
        example: '4',
        type: 'number',
      },
      {
        name: '{{{taskEstimationRatingDisplay}}}',
        description: 'Task estimation rating with formatted badge HTML (use triple braces to render HTML)',
        example: '<span class="rating rating-4">4 - Exceeds expectations</span>',
        type: 'string',
      },
      {
        name: '{{timelinessRating}}',
        description: 'Timeliness and meeting deadlines rating (1-5)',
        example: '5',
        type: 'number',
      },
      {
        name: '{{{timelinessRatingDisplay}}}',
        description: 'Timeliness rating with formatted badge HTML (use triple braces to render HTML)',
        example: '<span class="rating rating-5">5 - Outstanding</span>',
        type: 'string',
      },
      {
        name: '{{employeeSummary}}',
        description: "Employee's summary feedback for the month",
        example: 'I feel like this month has been very productive...',
        type: 'string',
      },
    ],
  },
  {
    title: 'Quote Templates',
    description: 'Variables available in quote PDF and email templates',
    context: 'Used when generating quote PDFs or sending quote emails',
    variables: [
      {
        name: '{{quote.quoteNumber}}',
        description: 'Unique quote number',
        example: 'QT-2024-0001',
        type: 'string',
      },
      {
        name: '{{quote.title}}',
        description: 'Quote title',
        example: 'Website Development Proposal',
        type: 'string',
      },
      {
        name: '{{quote.description}}',
        description: 'Quote description',
        example: 'Comprehensive proposal for website development',
        type: 'string',
      },
      {
        name: '{{quote.overview}}',
        description: 'Overview of the proposal (formatted HTML)',
        example: 'This proposal outlines our approach...',
        type: 'string',
      },
      {
        name: '{{{quote.overview}}}',
        description: 'Overview with HTML rendering (use triple braces to render HTML)',
        example: '<p>This proposal outlines our approach...</p>',
        type: 'string',
      },
      {
        name: '{{quote.functionalProposal}}',
        description: 'Functional proposal section (formatted HTML)',
        example: 'The system will include user management...',
        type: 'string',
      },
      {
        name: '{{{quote.functionalProposal}}}',
        description: 'Functional proposal with HTML rendering (use triple braces)',
        example: '<p>The system will include user management...</p>',
        type: 'string',
      },
      {
        name: '{{quote.technicalProposal}}',
        description: 'Technical proposal section (formatted HTML)',
        example: 'Built using React and Node.js...',
        type: 'string',
      },
      {
        name: '{{{quote.technicalProposal}}}',
        description: 'Technical proposal with HTML rendering (use triple braces)',
        example: '<p>Built using React and Node.js...</p>',
        type: 'string',
      },
      {
        name: '{{quote.teamComposition}}',
        description: 'Team composition section (formatted HTML)',
        example: 'Our team consists of 2 developers...',
        type: 'string',
      },
      {
        name: '{{{quote.teamComposition}}}',
        description: 'Team composition with HTML rendering (use triple braces)',
        example: '<p>Our team consists of 2 developers...</p>',
        type: 'string',
      },
      {
        name: '{{quote.milestones}}',
        description: 'Milestones section (formatted HTML text)',
        example: 'Milestone 1: Project kickoff...',
        type: 'string',
      },
      {
        name: '{{{quote.milestones}}}',
        description: 'Milestones with HTML rendering (use triple braces)',
        example: '<ul><li>Milestone 1: Project kickoff...</li></ul>',
        type: 'string',
      },
      {
        name: '{{quote.paymentTerms}}',
        description: 'Payment terms section (formatted HTML)',
        example: 'Payment schedule: 30% upfront...',
        type: 'string',
      },
      {
        name: '{{{quote.paymentTerms}}}',
        description: 'Payment terms with HTML rendering (use triple braces)',
        example: '<p>Payment schedule: 30% upfront...</p>',
        type: 'string',
      },
      {
        name: '{{quote.warrantyPeriod}}',
        description: 'Warranty period',
        example: '12 months',
        type: 'string',
      },
      {
        name: '{{quote.totalValue}}',
        description: 'Total quote value',
        example: '50000.00',
        type: 'number',
      },
      {
        name: '{{formatCurrency quote.totalValue quote.currency}}',
        description: 'Formatted total value with currency',
        example: 'USD 50,000.00',
        type: 'string',
      },
      {
        name: '{{quote.currency}}',
        description: 'Currency code',
        example: 'USD',
        type: 'string',
      },
      {
        name: '{{quote.status}}',
        description: 'Quote status (DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED)',
        example: 'SENT',
        type: 'string',
      },
      {
        name: '{{formatDate quote.createdAt}}',
        description: 'Quote creation date (formatted)',
        example: 'January 15, 2024',
        type: 'date',
      },
      {
        name: '{{formatDate quote.updatedAt}}',
        description: 'Quote last update date (formatted)',
        example: 'January 20, 2024',
        type: 'date',
      },
      {
        name: '{{quote.lead.title}}',
        description: 'Lead title',
        example: 'Website Development Inquiry',
        type: 'string',
      },
      {
        name: '{{quote.lead.description}}',
        description: 'Lead description',
        example: 'Interested in website development services',
        type: 'string',
      },
      {
        name: '{{quote.lead.prospectCompanyName}}',
        description: 'Prospect company name',
        example: 'Acme Corporation',
        type: 'string',
      },
      {
        name: '{{quote.lead.prospectWebsite}}',
        description: 'Prospect website URL',
        example: 'https://acme.com',
        type: 'string',
      },
      {
        name: '{{quote.lead.prospectIndustry}}',
        description: 'Prospect industry',
        example: 'Technology',
        type: 'string',
      },
      {
        name: '{{quote.contact.firstName}}',
        description: "Contact's first name",
        example: 'John',
        type: 'string',
      },
      {
        name: '{{quote.contact.lastName}}',
        description: "Contact's last name",
        example: 'Doe',
        type: 'string',
      },
      {
        name: '{{quote.contact.email}}',
        description: "Contact's email address",
        example: 'john.doe@acme.com',
        type: 'string',
      },
      {
        name: '{{quote.contact.phone}}',
        description: "Contact's phone number",
        example: '+1-555-123-4567',
        type: 'string',
      },
      {
        name: '{{quote.contact.companyName}}',
        description: "Contact's company name",
        example: 'Acme Corporation',
        type: 'string',
      },
    ],
  },
];

export default function TemplateVariablesPage() {
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedVariable(text);
    setTimeout(() => setCopiedVariable(null), 2000);
  };

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return TEMPLATE_VARIABLES;
    }

    const query = searchQuery.toLowerCase();
    return TEMPLATE_VARIABLES.map((group) => {
      const filteredVariables = group.variables.filter(
        (variable) =>
          variable.name.toLowerCase().includes(query) ||
          variable.description.toLowerCase().includes(query) ||
          variable.example.toLowerCase().includes(query) ||
          group.title.toLowerCase().includes(query) ||
          group.description.toLowerCase().includes(query),
      );

      if (filteredVariables.length === 0) {
        return null;
      }

      return {
        ...group,
        variables: filteredVariables,
      };
    }).filter((group): group is VariableGroup => group !== null);
  }, [searchQuery]);

  // Auto-expand groups when searching
  useEffect(() => {
    if (searchQuery.trim()) {
      setExpandedGroups(new Set(filteredGroups.map((_, index) => index)));
    }
  }, [searchQuery, filteredGroups]);

  const toggleGroup = (index: number) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Template Variables</h1>
        <p className="mt-2 text-muted-foreground">
          Reference guide for all available template variables across different contexts. Click any
          variable to copy it to your clipboard.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search variables, descriptions, or examples..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-12 text-center">
          <p className="text-muted-foreground">No variables found matching "{searchQuery}"</p>
          <p className="mt-2 text-sm text-muted-foreground/80">
            Try searching for variable names, descriptions, or examples
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group, groupIndex) => {
            const isExpanded = expandedGroups.has(groupIndex);
            return (
              <div
                key={groupIndex}
                className="rounded-lg border border-border bg-card shadow-sm"
              >
                <button
                  onClick={() => toggleGroup(groupIndex)}
                  className="w-full px-6 py-4 text-left transition hover:bg-muted/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{group.title}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                      {group.variables.length} variable{group.variables.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border px-6 py-4">
                    <p className="mb-4 text-xs text-muted-foreground/80">{group.context}</p>
                    <div className="space-y-4">
                      {group.variables.map((variable, varIndex) => (
                        <div
                          key={varIndex}
                          className="group rounded-lg border border-border bg-muted/30 p-4 transition hover:border-blue-300 hover:bg-muted/50"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => copyToClipboard(variable.name)}
                                  className="flex items-center gap-2 font-mono text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                                >
                                  {variable.name}
                                  {copiedVariable === variable.name ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
                                  )}
                                </button>
                                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                  {variable.type}
                                </span>
                              </div>
                              <p className="mt-1.5 text-sm text-muted-foreground">
                                {variable.description}
                              </p>
                              <div className="mt-2 rounded-md bg-background px-3 py-2">
                                <span className="text-xs font-medium text-muted-foreground">Example: </span>
                                <span className="text-xs text-foreground">{variable.example}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
        <h3 className="text-lg font-semibold text-blue-900">Handlebars Helpers</h3>
        <p className="mt-2 text-sm text-blue-800">
          In addition to variables, you can use Handlebars helpers to format your data:
        </p>
        <div className="mt-4 space-y-2 text-sm">
          <div>
            <code className="rounded bg-blue-100 px-2 py-1 text-blue-900">
              {'{{formatDate date "PPP"}}'}
            </code>
            <span className="ml-2 text-blue-800">- Format dates (default format: "PPP")</span>
          </div>
          <div>
            <code className="rounded bg-blue-100 px-2 py-1 text-blue-900">
              {'{{formatCurrency amount "USD"}}'}
            </code>
            <span className="ml-2 text-blue-800">- Format numbers as currency</span>
          </div>
          <div>
            <code className="rounded bg-blue-100 px-2 py-1 text-blue-900">
              {'{{uppercase text}}'}
            </code>
            <span className="ml-2 text-blue-800">- Convert text to uppercase</span>
          </div>
          <div>
            <code className="rounded bg-blue-100 px-2 py-1 text-blue-900">
              {'{{lowercase text}}'}
            </code>
            <span className="ml-2 text-blue-800">- Convert text to lowercase</span>
          </div>
          <div>
            <code className="rounded bg-blue-100 px-2 py-1 text-blue-900">
              {'{{#if condition}}...{{/if}}'}
            </code>
            <span className="ml-2 text-blue-800">- Conditional rendering</span>
          </div>
          <div>
            <code className="rounded bg-blue-100 px-2 py-1 text-blue-900">
              {'{{#each items}}...{{/each}}'}
            </code>
            <span className="ml-2 text-blue-800">- Loop through arrays</span>
          </div>
        </div>
      </div>
    </div>
  );
}


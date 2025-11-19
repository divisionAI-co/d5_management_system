import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiEntityType, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';

export interface FieldMetadata {
  key: string;
  label: string;
  description?: string;
}

type FieldSelector<T> = {
  key: string;
  label: string;
  description?: string;
  select: (entity: T) => unknown;
};

type CandidateSnapshot = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  currentTitle?: string | null;
  yearsOfExperience?: number | null;
  skills?: string[] | null;
  resume?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  portfolioUrl?: string | null;
  stage: string;
  rating?: number | null;
  notes?: string | null;
};

type OpportunitySnapshot = {
  title: string;
  description?: string | null;
  stage: string;
  type: string;
  value?: Prisma.Decimal | null;
  customer?: {
    name: string | null;
    industry: string | null;
  } | null;
  lead?: {
    title: string | null;
    description: string | null;
    contact: {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    } | null;
  } | null;
};

type EmployeeSnapshot = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  status: string;
  contractType: string;
  hireDate: Date | null;
  terminationDate: Date | null;
  salary: string | null;
  salaryCurrency: string | null;
  managerName: string | null;
  managerEmail: string | null;
  managerTitle: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
};

type CustomerSnapshot = {
  name: string;
  email: string;
  phone?: string | null;
  website?: string | null;
  industry?: string | null;
  type: string;
  status: string;
  sentiment: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  postalCode?: string | null;
  monthlyValue?: Prisma.Decimal | null;
  currency?: string | null;
  notes?: string | null;
  tags: string[];
};

type ContactSnapshot = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role?: string | null;
  companyName?: string | null;
  linkedinUrl?: string | null;
  notes?: string | null;
  customer?: {
    id: string;
    name: string;
  } | null;
};

type LeadSnapshot = {
  title: string;
  description?: string | null;
  status: string;
  value?: Prisma.Decimal | null;
  probability?: number | null;
  source?: string | null;
  expectedCloseDate?: Date | null;
  actualCloseDate?: Date | null;
  lostReason?: string | null;
  prospectCompanyName?: string | null;
  prospectWebsite?: string | null;
  prospectIndustry?: string | null;
  assignedTo?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  contacts?: Array<{
    contact: {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    };
  }>;
  // Legacy contact for backward compatibility (first contact)
  contact?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
};

type TaskSnapshot = {
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  dueDate?: Date | null;
  startDate?: Date | null;
  completedAt?: Date | null;
  tags: string[];
  estimatedHours?: Prisma.Decimal | null;
  actualHours?: Prisma.Decimal | null;
  assignedTo?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  } | null;
  customerId?: string | null;
};

type QuoteSnapshot = {
  quoteNumber: string;
  title: string;
  description?: string | null;
  overview?: string | null;
  functionalProposal?: string | null;
  technicalProposal?: string | null;
  teamComposition?: string | null;
  paymentTerms?: string | null;
  warrantyPeriod?: string | null;
  totalValue?: Prisma.Decimal | null;
  currency?: string | null;
  status: string;
  sentAt?: Date | null;
  sentTo?: string | null;
  lead?: {
    title: string | null;
    description: string | null;
    contacts?: Array<{
      contact: {
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        phone: string | null;
      };
    }>;
  } | null;
};

type EntitySnapshot =
  | CandidateSnapshot
  | OpportunitySnapshot
  | EmployeeSnapshot
  | CustomerSnapshot
  | ContactSnapshot
  | LeadSnapshot
  | TaskSnapshot
  | QuoteSnapshot;

@Injectable()
export class EntityFieldResolver {
  private readonly candidateFields: FieldSelector<CandidateSnapshot>[] = [
    {
      key: 'fullName',
      label: 'Full name',
      description: 'Candidate full name',
      select: (candidate) => `${candidate.firstName} ${candidate.lastName}`.trim(),
    },
    {
      key: 'email',
      label: 'Email',
      select: (candidate) => candidate.email,
    },
    {
      key: 'phone',
      label: 'Phone',
      select: (candidate) => candidate.phone,
    },
    {
      key: 'currentTitle',
      label: 'Current title',
      select: (candidate) => candidate.currentTitle,
    },
    {
      key: 'yearsOfExperience',
      label: 'Years of experience',
      select: (candidate) => candidate.yearsOfExperience,
    },
    {
      key: 'skills',
      label: 'Skills',
      description: 'Comma separated skills the candidate listed',
      select: (candidate) => candidate.skills?.join(', '),
    },
    {
      key: 'resumeUrl',
      label: 'Resume URL',
      select: (candidate) => candidate.resume,
    },
    {
      key: 'linkedinUrl',
      label: 'LinkedIn URL',
      select: (candidate) => candidate.linkedinUrl,
    },
    {
      key: 'githubUrl',
      label: 'GitHub URL',
      select: (candidate) => candidate.githubUrl,
    },
    {
      key: 'portfolioUrl',
      label: 'Portfolio URL',
      select: (candidate) => candidate.portfolioUrl,
    },
    {
      key: 'stage',
      label: 'Pipeline stage',
      select: (candidate) => candidate.stage,
    },
    {
      key: 'rating',
      label: 'Internal rating',
      select: (candidate) => candidate.rating,
    },
    {
      key: 'notes',
      label: 'Recruitment notes',
      description: 'Internal notes captured by recruiters',
      select: (candidate) => candidate.notes,
    },
  ];

  private readonly employeeFields: FieldSelector<EmployeeSnapshot>[] = [
    {
      key: 'fullName',
      label: 'Full name',
      description: 'Employee full name',
      select: (employee) => {
        const fullName = `${employee.firstName ?? ''} ${employee.lastName ?? ''}`.trim();
        return fullName || employee.email;
      },
    },
    {
      key: 'email',
      label: 'Work email',
      select: (employee) => employee.email,
    },
    {
      key: 'phone',
      label: 'Phone',
      select: (employee) => employee.phone,
    },
    {
      key: 'department',
      label: 'Department',
      select: (employee) => employee.department,
    },
    {
      key: 'jobTitle',
      label: 'Job title',
      select: (employee) => employee.jobTitle,
    },
    {
      key: 'status',
      label: 'Employment status',
      select: (employee) => employee.status,
    },
    {
      key: 'contractType',
      label: 'Contract type',
      select: (employee) => employee.contractType,
    },
    {
      key: 'hireDate',
      label: 'Hire date',
      description: 'ISO date string representing the hire date',
      select: (employee) => (employee.hireDate ? employee.hireDate.toISOString().split('T')[0] : null),
    },
    {
      key: 'tenureMonths',
      label: 'Tenure (months)',
      description: 'Approximate number of months employed',
      select: (employee) => {
        if (!employee.hireDate) {
          return null;
        }
        const endDate = employee.terminationDate ?? new Date();
        const diffMs = endDate.getTime() - employee.hireDate.getTime();
        const months = diffMs / (1000 * 60 * 60 * 24 * 30.4375);
        return Math.max(0, Math.round(months));
      },
    },
    {
      key: 'managerName',
      label: 'Manager name',
      select: (employee) => employee.managerName,
    },
    {
      key: 'managerEmail',
      label: 'Manager email',
      select: (employee) => employee.managerEmail,
    },
    {
      key: 'managerTitle',
      label: 'Manager job title',
      select: (employee) => employee.managerTitle,
    },
    {
      key: 'salaryDisplay',
      label: 'Salary (display)',
      description: 'Formatted salary including currency',
      select: (employee) => {
        if (!employee.salary) {
          return null;
        }
        const currency = employee.salaryCurrency ?? 'USD';
        return `${currency} ${employee.salary}`;
      },
    },
    {
      key: 'salaryAmount',
      label: 'Salary amount',
      description: 'Raw salary value without currency formatting',
      select: (employee) => employee.salary,
    },
    {
      key: 'salaryCurrency',
      label: 'Salary currency',
      select: (employee) => employee.salaryCurrency,
    },
    {
      key: 'emergencyContactName',
      label: 'Emergency contact name',
      select: (employee) => employee.emergencyContactName,
    },
    {
      key: 'emergencyContactPhone',
      label: 'Emergency contact phone',
      select: (employee) => employee.emergencyContactPhone,
    },
    {
      key: 'emergencyContactRelation',
      label: 'Emergency contact relation',
      select: (employee) => employee.emergencyContactRelation,
    },
  ];

  private readonly customerFields: FieldSelector<CustomerSnapshot>[] = [
    {
      key: 'name',
      label: 'Customer name',
      select: (customer) => customer.name,
    },
    {
      key: 'email',
      label: 'Customer email',
      select: (customer) => customer.email,
    },
    {
      key: 'phone',
      label: 'Phone',
      select: (customer) => customer.phone,
    },
    {
      key: 'website',
      label: 'Website',
      select: (customer) => customer.website,
    },
    {
      key: 'industry',
      label: 'Industry',
      select: (customer) => customer.industry,
    },
    {
      key: 'type',
      label: 'Customer type',
      select: (customer) => customer.type,
    },
    {
      key: 'status',
      label: 'Status',
      select: (customer) => customer.status,
    },
    {
      key: 'sentiment',
      label: 'Sentiment',
      select: (customer) => customer.sentiment,
    },
    {
      key: 'address',
      label: 'Address',
      select: (customer) => customer.address,
    },
    {
      key: 'city',
      label: 'City',
      select: (customer) => customer.city,
    },
    {
      key: 'country',
      label: 'Country',
      select: (customer) => customer.country,
    },
    {
      key: 'postalCode',
      label: 'Postal code',
      select: (customer) => customer.postalCode,
    },
    {
      key: 'monthlyValue',
      label: 'Monthly value',
      description: 'Recurring revenue value as string',
      select: (customer) => (customer.monthlyValue ? customer.monthlyValue.toString() : null),
    },
    {
      key: 'currency',
      label: 'Currency',
      select: (customer) => customer.currency,
    },
    {
      key: 'notes',
      label: 'Notes',
      select: (customer) => customer.notes,
    },
    {
      key: 'tags',
      label: 'Tags',
      description: 'Comma separated customer tags',
      select: (customer) => (customer.tags.length ? customer.tags.join(', ') : null),
    },
  ];

  private readonly contactFields: FieldSelector<ContactSnapshot>[] = [
    {
      key: 'fullName',
      label: 'Full name',
      select: (contact) => `${contact.firstName} ${contact.lastName}`.trim(),
    },
    {
      key: 'email',
      label: 'Email',
      select: (contact) => contact.email,
    },
    {
      key: 'phone',
      label: 'Phone',
      select: (contact) => contact.phone,
    },
    {
      key: 'role',
      label: 'Role',
      select: (contact) => contact.role,
    },
    {
      key: 'companyName',
      label: 'Company name',
      select: (contact) => contact.companyName,
    },
    {
      key: 'linkedinUrl',
      label: 'LinkedIn URL',
      select: (contact) => contact.linkedinUrl,
    },
    {
      key: 'notes',
      label: 'Notes',
      select: (contact) => contact.notes,
    },
    {
      key: 'customerName',
      label: 'Associated customer',
      select: (contact) => contact.customer?.name ?? null,
    },
  ];

  private readonly leadFields: FieldSelector<LeadSnapshot>[] = [
    {
      key: 'title',
      label: 'Lead title',
      select: (lead) => lead.title,
    },
    {
      key: 'description',
      label: 'Description',
      select: (lead) => lead.description,
    },
    {
      key: 'status',
      label: 'Status',
      select: (lead) => lead.status,
    },
    {
      key: 'value',
      label: 'Value',
      select: (lead) => (lead.value ? lead.value.toString() : null),
    },
    {
      key: 'probability',
      label: 'Close probability',
      select: (lead) => (lead.probability ?? null),
    },
    {
      key: 'source',
      label: 'Source',
      select: (lead) => lead.source,
    },
    {
      key: 'expectedCloseDate',
      label: 'Expected close date',
      select: (lead) => (lead.expectedCloseDate ? lead.expectedCloseDate.toISOString().split('T')[0] : null),
    },
    {
      key: 'actualCloseDate',
      label: 'Actual close date',
      select: (lead) => (lead.actualCloseDate ? lead.actualCloseDate.toISOString().split('T')[0] : null),
    },
    {
      key: 'lostReason',
      label: 'Lost reason',
      select: (lead) => lead.lostReason,
    },
    {
      key: 'prospectCompanyName',
      label: 'Prospect company',
      select: (lead) => lead.prospectCompanyName,
    },
    {
      key: 'prospectWebsite',
      label: 'Prospect website',
      select: (lead) => lead.prospectWebsite,
    },
    {
      key: 'prospectIndustry',
      label: 'Prospect industry',
      select: (lead) => lead.prospectIndustry,
    },
    {
      key: 'assignedTo',
      label: 'Assigned to',
      select: (lead) => {
        if (!lead.assignedTo) {
          return null;
        }
        const fullName = `${lead.assignedTo.firstName ?? ''} ${lead.assignedTo.lastName ?? ''}`.trim();
        return fullName || lead.assignedTo.email;
      },
    },
    {
      key: 'contactName',
      label: 'Primary contact name',
      select: (lead) => {
        const contact = lead.contacts && lead.contacts.length > 0 ? lead.contacts[0].contact : lead.contact;
        if (!contact) return null;
        const fullName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
        return fullName || contact.email || null;
      },
    },
    {
      key: 'contactEmail',
      label: 'Primary contact email',
      select: (lead) => {
        const contact = lead.contacts && lead.contacts.length > 0 ? lead.contacts[0].contact : lead.contact;
        return contact?.email ?? null;
      },
    },
    {
      key: 'contactPhone',
      label: 'Primary contact phone',
      select: (lead) => {
        const contact = lead.contacts && lead.contacts.length > 0 ? lead.contacts[0].contact : lead.contact;
        return contact?.phone ?? null;
      },
    },
  ];

  private readonly taskFields: FieldSelector<TaskSnapshot>[] = [
    {
      key: 'title',
      label: 'Task title',
      select: (task) => task.title,
    },
    {
      key: 'description',
      label: 'Description',
      select: (task) => task.description,
    },
    {
      key: 'status',
      label: 'Status',
      select: (task) => task.status,
    },
    {
      key: 'priority',
      label: 'Priority',
      select: (task) => task.priority,
    },
    {
      key: 'dueDate',
      label: 'Due date',
      select: (task) => (task.dueDate ? task.dueDate.toISOString() : null),
    },
    {
      key: 'startDate',
      label: 'Start date',
      select: (task) => (task.startDate ? task.startDate.toISOString() : null),
    },
    {
      key: 'completedAt',
      label: 'Completed at',
      select: (task) => (task.completedAt ? task.completedAt.toISOString() : null),
    },
    {
      key: 'tags',
      label: 'Tags',
      select: (task) => (task.tags.length ? task.tags.join(', ') : null),
    },
    {
      key: 'estimatedHours',
      label: 'Estimated hours',
      select: (task) => (task.estimatedHours ? task.estimatedHours.toString() : null),
    },
    {
      key: 'actualHours',
      label: 'Actual hours',
      select: (task) => (task.actualHours ? task.actualHours.toString() : null),
    },
    {
      key: 'assignedTo',
      label: 'Assigned to',
      select: (task) => {
        if (!task.assignedTo) {
          return null;
        }
        const fullName = `${task.assignedTo.firstName ?? ''} ${task.assignedTo.lastName ?? ''}`.trim();
        return fullName || task.assignedTo.email;
      },
    },
    {
      key: 'customerId',
      label: 'Customer ID',
      select: (task) => task.customerId ?? null,
    },
  ];

  private readonly quoteFields: FieldSelector<QuoteSnapshot>[] = [
    {
      key: 'quoteNumber',
      label: 'Quote number',
      select: (quote) => quote.quoteNumber,
    },
    {
      key: 'title',
      label: 'Quote title',
      select: (quote) => quote.title,
    },
    {
      key: 'description',
      label: 'Description',
      select: (quote) => quote.description,
    },
    {
      key: 'overview',
      label: 'Overview',
      select: (quote) => quote.overview,
    },
    {
      key: 'functionalProposal',
      label: 'Functional proposal',
      select: (quote) => quote.functionalProposal,
    },
    {
      key: 'technicalProposal',
      label: 'Technical proposal',
      select: (quote) => quote.technicalProposal,
    },
    {
      key: 'teamComposition',
      label: 'Team composition',
      select: (quote) => quote.teamComposition,
    },
    {
      key: 'paymentTerms',
      label: 'Payment terms',
      select: (quote) => quote.paymentTerms,
    },
    {
      key: 'warrantyPeriod',
      label: 'Warranty period',
      select: (quote) => quote.warrantyPeriod,
    },
    {
      key: 'totalValue',
      label: 'Total value',
      select: (quote) => (quote.totalValue ? quote.totalValue.toString() : null),
    },
    {
      key: 'currency',
      label: 'Currency',
      select: (quote) => quote.currency,
    },
    {
      key: 'status',
      label: 'Status',
      select: (quote) => quote.status,
    },
    {
      key: 'sentAt',
      label: 'Sent at',
      select: (quote) => (quote.sentAt ? quote.sentAt.toISOString() : null),
    },
    {
      key: 'sentTo',
      label: 'Sent to',
      select: (quote) => quote.sentTo,
    },
    {
      key: 'leadTitle',
      label: 'Lead title',
      select: (quote) => quote.lead?.title,
    },
    {
      key: 'leadDescription',
      label: 'Lead description',
      select: (quote) => quote.lead?.description,
    },
    {
      key: 'contactName',
      label: 'Contact name',
      select: (quote) => {
        const contact = quote.lead?.contacts && quote.lead.contacts.length > 0 ? quote.lead.contacts[0].contact : null;
        if (!contact) return null;
        const fullName = `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim();
        return fullName || contact.email || null;
      },
    },
    {
      key: 'contactEmail',
      label: 'Contact email',
      select: (quote) => {
        const contact = quote.lead?.contacts && quote.lead.contacts.length > 0 ? quote.lead.contacts[0].contact : null;
        return contact?.email ?? null;
      },
    },
    {
      key: 'contactPhone',
      label: 'Contact phone',
      select: (quote) => {
        const contact = quote.lead?.contacts && quote.lead.contacts.length > 0 ? quote.lead.contacts[0].contact : null;
        return contact?.phone ?? null;
      },
    },
  ];

  private readonly opportunityFields: FieldSelector<OpportunitySnapshot>[] = [
    {
      key: 'title',
      label: 'Opportunity title',
      select: (opportunity) => opportunity.title,
    },
    {
      key: 'description',
      label: 'Opportunity description',
      select: (opportunity) => opportunity.description,
    },
    {
      key: 'stage',
      label: 'Stage',
      select: (opportunity) => opportunity.stage,
    },
    {
      key: 'type',
      label: 'Type',
      select: (opportunity) => opportunity.type,
    },
    {
      key: 'value',
      label: 'Value',
      description: 'Numeric value formatted as string',
      select: (opportunity) => (opportunity.value ? opportunity.value.toString() : null),
    },
    {
      key: 'customerName',
      label: 'Customer name',
      select: (opportunity) => opportunity.customer?.name,
    },
    {
      key: 'customerIndustry',
      label: 'Customer industry',
      select: (opportunity) => opportunity.customer?.industry,
    },
    {
      key: 'leadTitle',
      label: 'Lead title',
      select: (opportunity) => opportunity.lead?.title,
    },
    {
      key: 'leadSummary',
      label: 'Lead summary',
      select: (opportunity) => opportunity.lead?.description,
    },
    {
      key: 'leadContactName',
      label: 'Lead contact name',
      select: (opportunity) => {
        const contact = opportunity.lead?.contact;
        if (!contact) return null;
        return `${contact.firstName} ${contact.lastName}`.trim();
      },
    },
    {
      key: 'leadContactEmail',
      label: 'Lead contact email',
      select: (opportunity) => opportunity.lead?.contact?.email,
    },
    {
      key: 'leadContactPhone',
      label: 'Lead contact phone',
      select: (opportunity) => opportunity.lead?.contact?.phone,
    },
  ];

  constructor(private readonly prisma: PrismaService) {}

  listFields(entityType: AiEntityType): FieldMetadata[] {
    const definitions = this.getFieldDefinitions(entityType);
    return definitions.map(({ key, label, description }) => ({ key, label, description }));
  }

  ensureFieldKeysSupported(entityType: AiEntityType, keys: string[]) {
    if (!keys || keys.length === 0) {
      throw new BadRequestException('At least one field must be selected');
    }

    const supportedKeys = new Set(
      this.getFieldDefinitions(entityType).map((definition) => definition.key),
    );
    const unsupported = keys.filter((key) => !supportedKeys.has(key));
    if (unsupported.length > 0) {
      throw new BadRequestException(
        `Unsupported field(s) for ${entityType.toLowerCase()} entity: ${unsupported.join(', ')}`,
      );
    }
  }

  async ensureEntityExists(entityType: AiEntityType, entityId: string) {
    switch (entityType) {
      case AiEntityType.CANDIDATE: {
        const entity = await this.findCandidate(entityId);
        if (!entity) {
          throw new NotFoundException(`CANDIDATE with ID ${entityId} was not found`);
        }
        return;
      }
      case AiEntityType.OPPORTUNITY: {
        const entity = await this.findOpportunity(entityId);
        if (!entity) {
          throw new NotFoundException(`OPPORTUNITY with ID ${entityId} was not found`);
        }
        return;
      }
      case AiEntityType.EMPLOYEE: {
        const entity = await this.findEmployee(entityId);
        if (!entity) {
          throw new NotFoundException(`EMPLOYEE with ID ${entityId} was not found`);
        }
        return;
      }
      case AiEntityType.CUSTOMER: {
        const entity = await this.findCustomer(entityId);
        if (!entity) {
          throw new NotFoundException(`CUSTOMER with ID ${entityId} was not found`);
        }
        return;
      }
      case AiEntityType.CONTACT: {
        const entity = await this.findContact(entityId);
        if (!entity) {
          throw new NotFoundException(`CONTACT with ID ${entityId} was not found`);
        }
        return;
      }
      case AiEntityType.LEAD: {
        const entity = await this.findLead(entityId);
        if (!entity) {
          throw new NotFoundException(`LEAD with ID ${entityId} was not found`);
        }
        return;
      }
      case AiEntityType.TASK: {
        const entity = await this.findTask(entityId);
        if (!entity) {
          throw new NotFoundException(`TASK with ID ${entityId} was not found`);
        }
        return;
      }
      case AiEntityType.QUOTE: {
        const entity = await this.findQuote(entityId);
        if (!entity) {
          throw new NotFoundException(`QUOTE with ID ${entityId} was not found`);
        }
        return;
      }
      default:
        throw new BadRequestException(`Entity type ${entityType} is not supported yet`);
    }
  }

  async resolveFields(entityType: AiEntityType, entityId: string, fieldKeys: string[]) {
    switch (entityType) {
      case AiEntityType.CANDIDATE: {
        const entity = await this.findCandidate(entityId);
        if (!entity) {
          throw new NotFoundException(`CANDIDATE with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.candidateFields);
      }
      case AiEntityType.OPPORTUNITY: {
        const entity = await this.findOpportunity(entityId);
        if (!entity) {
          throw new NotFoundException(`OPPORTUNITY with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.opportunityFields);
      }
      case AiEntityType.EMPLOYEE: {
        const entity = await this.findEmployee(entityId);
        if (!entity) {
          throw new NotFoundException(`EMPLOYEE with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.employeeFields);
      }
      case AiEntityType.CUSTOMER: {
        const entity = await this.findCustomer(entityId);
        if (!entity) {
          throw new NotFoundException(`CUSTOMER with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.customerFields);
      }
      case AiEntityType.CONTACT: {
        const entity = await this.findContact(entityId);
        if (!entity) {
          throw new NotFoundException(`CONTACT with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.contactFields);
      }
      case AiEntityType.LEAD: {
        const entity = await this.findLead(entityId);
        if (!entity) {
          throw new NotFoundException(`LEAD with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.leadFields);
      }
      case AiEntityType.TASK: {
        const entity = await this.findTask(entityId);
        if (!entity) {
          throw new NotFoundException(`TASK with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.taskFields);
      }
      case AiEntityType.QUOTE: {
        const entity = await this.findQuote(entityId);
        if (!entity) {
          throw new NotFoundException(`QUOTE with ID ${entityId} was not found`);
        }
        return this.mapFieldValues(fieldKeys, entity, this.quoteFields);
      }
      default:
        throw new BadRequestException(`Entity type ${entityType} is not supported yet`);
    }
  }

  private getFieldDefinitions(entityType: AiEntityType): FieldSelector<EntitySnapshot>[] {
    switch (entityType) {
      case AiEntityType.CANDIDATE:
        return this.candidateFields as FieldSelector<EntitySnapshot>[];
      case AiEntityType.OPPORTUNITY:
        return this.opportunityFields as FieldSelector<EntitySnapshot>[];
      case AiEntityType.EMPLOYEE:
        return this.employeeFields as FieldSelector<EntitySnapshot>[];
      case AiEntityType.CUSTOMER:
        return this.customerFields as FieldSelector<EntitySnapshot>[];
      case AiEntityType.CONTACT:
        return this.contactFields as FieldSelector<EntitySnapshot>[];
      case AiEntityType.LEAD:
        return this.leadFields as FieldSelector<EntitySnapshot>[];
      case AiEntityType.TASK:
        return this.taskFields as FieldSelector<EntitySnapshot>[];
      case AiEntityType.QUOTE:
        return this.quoteFields as FieldSelector<EntitySnapshot>[];
      default:
        return [];
    }
  }

  private async findCandidate(entityId: string): Promise<CandidateSnapshot | null> {
    const record = await this.prisma.candidate.findUnique({
      where: { id: entityId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        currentTitle: true,
        yearsOfExperience: true,
        skills: true,
        resume: true,
        linkedinUrl: true,
        githubUrl: true,
        portfolioUrl: true,
        stage: true,
        rating: true,
        notes: true,
      },
    });
    if (!record) {
      return null;
    }
    return record;
  }

  private async findOpportunity(entityId: string): Promise<OpportunitySnapshot | null> {
    const record = await this.prisma.opportunity.findUnique({
      where: { id: entityId },
      select: {
        title: true,
        description: true,
        stage: true,
        type: true,
        value: true,
        customer: { select: { name: true, industry: true } },
        lead: {
          select: {
            title: true,
            description: true,
            contacts: {
              include: {
                contact: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!record) {
      return null;
    }
    
    // Normalize contacts array and provide legacy contact for backward compatibility
    const normalized = {
      ...record,
      lead: record.lead
        ? {
            ...record.lead,
            contact:
              record.lead.contacts && record.lead.contacts.length > 0
                ? record.lead.contacts[0].contact
                : null,
          }
        : null,
    };

    return normalized;
  }

  private async findEmployee(entityId: string): Promise<EmployeeSnapshot | null> {
    const record = await this.prisma.employee.findUnique({
      where: { id: entityId },
      select: {
        department: true,
        jobTitle: true,
        status: true,
        contractType: true,
        hireDate: true,
        terminationDate: true,
        salary: true,
        salaryCurrency: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        manager: {
          select: {
            jobTitle: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    const managerFirstName = record.manager?.user?.firstName ?? '';
    const managerLastName = record.manager?.user?.lastName ?? '';
    const managerFullName = `${managerFirstName} ${managerLastName}`.trim() || null;

    return {
      firstName: record.user?.firstName ?? null,
      lastName: record.user?.lastName ?? null,
      email: record.user?.email ?? null,
      phone: record.user?.phone ?? null,
      department: record.department ?? null,
      jobTitle: record.jobTitle ?? null,
      status: record.status,
      contractType: record.contractType,
      hireDate: record.hireDate ?? null,
      terminationDate: record.terminationDate ?? null,
      salary: record.salary ? record.salary.toString() : null,
      salaryCurrency: record.salaryCurrency ?? null,
      managerName: managerFullName,
      managerEmail: record.manager?.user?.email ?? null,
      managerTitle: record.manager?.jobTitle ?? null,
      emergencyContactName: record.emergencyContactName ?? null,
      emergencyContactPhone: record.emergencyContactPhone ?? null,
      emergencyContactRelation: record.emergencyContactRelation ?? null,
    };
  }

  private async findCustomer(entityId: string): Promise<CustomerSnapshot | null> {
    const record = await this.prisma.customer.findUnique({
      where: { id: entityId },
      select: {
        name: true,
        email: true,
        phone: true,
        website: true,
        industry: true,
        type: true,
        status: true,
        sentiment: true,
        address: true,
        city: true,
        country: true,
        postalCode: true,
        monthlyValue: true,
        currency: true,
        notes: true,
        tags: true,
      },
    });

    if (!record) {
      return null;
    }

    return record;
  }

  private async findContact(entityId: string): Promise<ContactSnapshot | null> {
    const record = await this.prisma.contact.findUnique({
      where: { id: entityId },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        companyName: true,
        linkedinUrl: true,
        notes: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    return record;
  }

  private async findLead(entityId: string): Promise<LeadSnapshot | null> {
    const record = await this.prisma.lead.findUnique({
      where: { id: entityId },
      select: {
        title: true,
        description: true,
        status: true,
        value: true,
        probability: true,
        source: true,
        expectedCloseDate: true,
        actualCloseDate: true,
        lostReason: true,
        prospectCompanyName: true,
        prospectWebsite: true,
        prospectIndustry: true,
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        contacts: {
          include: {
            contact: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    // Normalize contacts array and provide legacy contact for backward compatibility
    const normalized = {
      ...record,
      contact: record.contacts && record.contacts.length > 0 
        ? record.contacts[0].contact 
        : undefined,
    };

    return normalized;
  }

  private async findTask(entityId: string): Promise<TaskSnapshot | null> {
    const record = await this.prisma.task.findUnique({
      where: { id: entityId },
      select: {
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        startDate: true,
        completedAt: true,
        tags: true,
        estimatedHours: true,
        actualHours: true,
        customerId: true,
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    return record;
  }

  private async findQuote(entityId: string): Promise<QuoteSnapshot | null> {
    const record = await this.prisma.quote.findUnique({
      where: { id: entityId },
      select: {
        quoteNumber: true,
        title: true,
        description: true,
        overview: true,
        functionalProposal: true,
        technicalProposal: true,
        teamComposition: true,
        paymentTerms: true,
        warrantyPeriod: true,
        totalValue: true,
        currency: true,
        status: true,
        sentAt: true,
        sentTo: true,
        lead: {
          select: {
            title: true,
            description: true,
            contacts: {
              include: {
                contact: {
                  select: {
                    firstName: true,
                    lastName: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!record) {
      return null;
    }

    return record;
  }

  private mapFieldValues<T extends EntitySnapshot>(
    fieldKeys: string[],
    entity: T,
    selectors: FieldSelector<T>[],
  ) {
    const definitionMap = new Map(selectors.map((definition) => [definition.key, definition]));
    const result: Record<string, unknown> = {};

    fieldKeys.forEach((key) => {
      const definition = definitionMap.get(key);
      if (!definition) {
        return;
      }
      const value = definition.select(entity);
      result[key] = value === undefined ? null : value;
    });

    return result;
  }
}

